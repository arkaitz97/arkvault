import { test, expect } from './coverage-fixture.js';
import { S3Client, CreateBucketCommand, ListObjectsCommand } from '@aws-sdk/client-s3';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const timestamp = Date.now();
const MINIO_PORT = 9000;
const ACCESS_KEY = 'minioadmin';
const SECRET_KEY = 'minioadmin';
const BUCKET_NAME = `e2e-bucket-${timestamp}`;
const REGION = 'us-east-1';

const PROJECT_ROOT = process.cwd();
const SOURCE_DIR = path.join(PROJECT_ROOT, 'test-data/source');
const RESTORE_DIR = path.join(PROJECT_ROOT, 'test-data/restore-s3', `e2e-${timestamp}`);
const TEST_FILE = 'sample.txt';

test.describe('S3 Connector Workflow', () => {
    let s3Client;

    test.beforeAll(async () => {
        console.log('Starting MinIO container via npm script...');
        try {
            // Stop any existing instance first to avoid conflicts
            try { execSync('npm run s3:stop', { stdio: 'ignore' }); } catch { }
            execSync('npm run s3:start');
        } catch (e) {
            console.error('Failed to start MinIO:', e);
        }

        s3Client = new S3Client({
            region: REGION,
            endpoint: `http://localhost:${MINIO_PORT}`,
            credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
            forcePathStyle: true
        });

        // 3. Wait for MinIO to be ready
        console.log('Waiting for MinIO to be ready...');
        let retries = 10;
        while (retries > 0) {
            try {
                await s3Client.send(new ListObjectsCommand({ Bucket: 'non-existent-bucket-for-probe' }));
            } catch (e) {
                if (e.name === 'NoSuchBucket' || (e.$metadata && e.$metadata.httpStatusCode === 404)) {
                    break;
                }
            }
            await new Promise(r => setTimeout(r, 1000));
            retries--;
        }

        try {
            await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
            console.log(`Created bucket: ${BUCKET_NAME}`);
        } catch (e) {
            console.error('Failed to create bucket:', e);
            throw e;
        }

        if (!fs.existsSync(RESTORE_DIR)) fs.mkdirSync(RESTORE_DIR, { recursive: true });
    });

    test.afterAll(() => {
        console.log('Cleaning up...');
        try {
            execSync('npm run s3:stop');
        } catch {
            // ignore cleanup errors
        }

        if (fs.existsSync(RESTORE_DIR)) fs.rmSync(RESTORE_DIR, { recursive: true, force: true });
    });

    test('should complete full lifecycle: Connect Local -> Connect S3 -> Backup -> Restore', async ({ page }) => {
        test.setTimeout(30000);

        await page.goto('/connectors');
        await page.locator('.actions-toolbar').getByRole('button', { name: /Add Connector/i }).click();
        await page.locator('.type-option').filter({ hasText: 'Local Folder' }).click();

        // Use general config selector because 'Connector Name' label is not associated with input via 'for'
        await page.locator('.input-group').filter({ hasText: 'Connector Name' }).locator('input').fill(`Local-Source-${timestamp}`);
        await page.locator('.input-group').filter({ hasText: 'Folder Path' }).locator('input').fill(SOURCE_DIR);

        await page.locator('.modal-footer').getByRole('button', { name: /Add Connector/i }).click();

        // Verify Source
        const sourceItem = page.locator('.connector-item').filter({ hasText: `Local-Source-${timestamp}` });
        await expect(sourceItem).toBeVisible();

        await page.locator('.actions-toolbar').getByRole('button', { name: /Add Connector/i }).click();
        await page.locator('.type-option').filter({ hasText: 'S3 Compatible' }).click();

        // Fill Connector Name
        await page.locator('.input-group').filter({ hasText: 'Connector Name' }).locator('input').fill(`MinIO-Dest-${timestamp}`);

        // Fill S3 Fields
        // Inputs are not nested in labels, so we use .input-group filtering or valid placeholders
        await page.getByPlaceholder('https://s3.example.com').fill(`http://localhost:${MINIO_PORT}`);
        await page.locator('.input-group').filter({ hasText: 'Access Key ID' }).locator('input').fill(ACCESS_KEY);
        await page.locator('.input-group').filter({ hasText: 'Secret Access Key' }).locator('input').fill(SECRET_KEY);
        await page.locator('.input-group').filter({ hasText: 'Bucket Name' }).locator('input').fill(BUCKET_NAME);
        await page.locator('.input-group').filter({ hasText: 'Region' }).locator('input').fill(REGION);

        await page.locator('.modal-footer').getByRole('button', { name: /Add Connector/i }).click();

        // Verify Destination
        const destItem = page.locator('.connector-item').filter({ hasText: `MinIO-Dest-${timestamp}` });
        await expect(destItem).toBeVisible();
        await destItem.getByTitle('Test connection').click();
        await expect(destItem.locator('.connected')).toBeVisible();

        await page.goto('/create');

        // Step 1: Source
        await page.locator('.connector-type-card').filter({ hasText: 'Local Folder' }).click();
        await page.locator('.existing-item').filter({ hasText: `Local-Source-${timestamp}` }).click();
        await page.click('button:has-text("Next")');

        // Step 2: Destination
        await page.locator('.connector-type-card').filter({ hasText: 'S3 Compatible' }).click();
        await page.locator('.existing-item').filter({ hasText: `MinIO-Dest-${timestamp}` }).click();
        await page.click('button:has-text("Next")');

        // Step 3: Schedule (manual)
        await page.click('button:has-text("Next")');

        // Step 4: Options
        await page.fill('input[placeholder="e.g., Daily Documents Backup"]', `S3-Job-${timestamp}`);
        await page.click('button:has-text("Next")');

        // Step 5: Review
        await page.click('button:has-text("Create Backup Job")');

        // Verify Job Created
        await expect(page).toHaveURL(/\/jobs/);
        await expect(page.getByText(`S3-Job-${timestamp}`)).toBeVisible();

        const jobCard = page.locator('.job-card').filter({ hasText: `S3-Job-${timestamp}` });
        page.once('dialog', dialog => dialog.dismiss()); // Handle "Backup Started" alert
        await jobCard.getByRole('button', { name: /Run now/i }).click();

        // Wait for success status
        await expect(jobCard.locator('.status-success')).toBeVisible({ timeout: 20000 });

        const s3Objects = await s3Client.send(new ListObjectsCommand({ Bucket: BUCKET_NAME }));
        expect(s3Objects.Contents).toBeDefined();
        expect(s3Objects.Contents.length).toBeGreaterThan(0);

        // --- 6. Restore Workflow ---
        await page.goto('/restore');
        const backupItem = page.locator('.backup-item').filter({ hasText: `S3-Job-${timestamp}` }).first();
        await backupItem.click();

        await page.fill('input[placeholder="/path/to/restore/"]', RESTORE_DIR);

        // Handle success alert
        const restorePromise = page.waitForEvent('dialog', async dialog => {
            console.log(`Dialog message: ${dialog.message()}`);
            if (dialog.message().includes('successfully')) {
                await dialog.dismiss();
                return true;
            }
            await dialog.dismiss();
            return false;
        });

        await page.click('button:has-text("Start Restore")');
        await restorePromise;

        await expect(page.getByRole('heading', { name: 'Select a Backup' })).toBeVisible({ timeout: 15000 });

        // --- 7. Verify Restored Data ---
        // Using sample.txt which we know exists in test-data/source
        const restoredFilePath = path.join(RESTORE_DIR, TEST_FILE);
        expect(fs.existsSync(restoredFilePath)).toBe(true);
        const originalContent = fs.readFileSync(path.join(SOURCE_DIR, TEST_FILE), 'utf-8');
        const restoredContent = fs.readFileSync(restoredFilePath, 'utf-8');
        expect(restoredContent).toBe(originalContent);
    });
});
