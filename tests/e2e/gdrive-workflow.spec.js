import { test, expect } from './coverage-fixture.js';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const timestamp = Date.now();
const PROJECT_ROOT = process.cwd();
const SOURCE_DIR = path.join(PROJECT_ROOT, 'test-data/source-gdrive');
const RESTORE_DIR = path.join(PROJECT_ROOT, 'test-data/restore-gdrive', `e2e-${timestamp}`);
const TEST_FILE = 'gdrive-test-sample.txt';
const MOCK_SERVER_PORT = 9999;
const MOCK_STORAGE = '/tmp/gdrive-mock-storage';

test.describe('Google Drive Connector Workflow', () => {
    let mockServerProcess;

    test.beforeAll(async () => {
        // Prepare storage
        if (fs.existsSync(MOCK_STORAGE)) fs.rmSync(MOCK_STORAGE, { recursive: true, force: true });
        fs.mkdirSync(MOCK_STORAGE, { recursive: true });

        // Start Mock Server
        mockServerProcess = spawn('node', ['tests/mocks/gdrive-mock-server.js'], {
            env: { ...process.env },
            stdio: 'inherit'
        });

        // Wait for server to be ready
        let retries = 5;
        while (retries > 0) {
            try {
                const response = await fetch(`http://localhost:${MOCK_SERVER_PORT}/drive/v3/about`);
                if (response.ok) break;
            } catch {
                // mock server not ready yet
            }
            await new Promise(r => setTimeout(r, 1000));
            retries--;
        }

        // Prepare source data
        if (!fs.existsSync(SOURCE_DIR)) fs.mkdirSync(SOURCE_DIR, { recursive: true });
        fs.writeFileSync(path.join(SOURCE_DIR, TEST_FILE), `GDrive E2E Test Content ${timestamp}`);

        if (!fs.existsSync(RESTORE_DIR)) fs.mkdirSync(RESTORE_DIR, { recursive: true });
    });

    test.afterAll(() => {
        if (mockServerProcess) mockServerProcess.kill();

        if (fs.existsSync(RESTORE_DIR)) fs.rmSync(RESTORE_DIR, { recursive: true, force: true });
        if (fs.existsSync(MOCK_STORAGE)) fs.rmSync(MOCK_STORAGE, { recursive: true, force: true });
    });

    test('should complete full lifecycle: Connect -> Backup -> Restore', async ({ page }) => {
        test.setTimeout(90000);

        // 1. Add Local Source Connector
        await page.goto('/connectors');
        await page.locator('.actions-toolbar').getByRole('button', { name: /Add Connector/i }).click();
        await page.locator('.type-option').filter({ hasText: 'Local Folder' }).click();
        await page.locator('.input-group').filter({ hasText: 'Connector Name' }).locator('input').fill(`GD-Source-${timestamp}`);
        await page.locator('.input-group').filter({ hasText: 'Folder Path' }).locator('input').fill(SOURCE_DIR);
        await page.locator('.modal-footer').getByRole('button', { name: /Add Connector/i }).click();

        // 2. Add Google Drive Destination Connector
        await page.locator('.actions-toolbar').getByRole('button', { name: /Add Connector/i }).click();
        await page.locator('.type-option').filter({ hasText: 'Google Drive' }).click();
        await page.locator('.input-group').filter({ hasText: 'Connector Name' }).locator('input').fill(`GD-Mock-Dest-${timestamp}`);

        // Mock credentials (JSON string or path to file)
        const mockCreds = JSON.stringify({
            client_email: 'mock@example.com',
            private_key: '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----'
        });
        await page.locator('.input-group').filter({ hasText: 'Service Account JSON' }).locator('textarea').fill(mockCreds);

        await page.locator('.modal-footer').getByRole('button', { name: /Add Connector/i }).click();

        // 3. Test Connection
        const destItem = page.locator('.connector-item').filter({ hasText: `GD-Mock-Dest-${timestamp}` });
        await expect(destItem).toBeVisible();
        await destItem.getByTitle('Test connection').click();
        await expect(destItem.locator('.connected')).toBeVisible({ timeout: 10000 });

        // 4. Create Backup Job
        await page.goto('/create');
        await page.locator('.connector-type-card').filter({ hasText: 'Local Folder' }).click();
        await page.locator('.existing-item').filter({ hasText: `GD-Source-${timestamp}` }).click();
        await page.click('button:has-text("Next")');

        await page.locator('.connector-type-card').filter({ hasText: 'Google Drive' }).click();
        await page.locator('.existing-item').filter({ hasText: `GD-Mock-Dest-${timestamp}` }).click();
        await page.click('button:has-text("Next")');

        await page.click('button:has-text("Next")'); // Schedule
        await page.fill('input[placeholder="e.g., Daily Documents Backup"]', `GD-Job-${timestamp}`);
        await page.click('button:has-text("Next")');
        await page.click('button:has-text("Create Backup Job")');

        // 5. Run Backup
        await expect(page).toHaveURL(/\/jobs/);
        const jobCard = page.locator('.job-card').filter({ hasText: `GD-Job-${timestamp}` });
        page.once('dialog', dialog => dialog.dismiss());
        await jobCard.getByRole('button', { name: /Run now/i }).click();

        // Wait for success status
        await expect(jobCard.locator('.status-success')).toBeVisible({ timeout: 30000 });

        // Verify "Upload" to mock storage
        const uploadedFiles = fs.readdirSync(MOCK_STORAGE);
        expect(uploadedFiles.length).toBeGreaterThan(0);
        expect(uploadedFiles.some(f => f.startsWith('backup-'))).toBe(true);

        // 6. Restore Workflow
        await page.goto('/restore');
        const backupItem = page.locator('.backup-item').filter({ hasText: `GD-Job-${timestamp}` }).first();
        await backupItem.click();

        await page.fill('input[placeholder="/path/to/restore/"]', RESTORE_DIR);

        const restorePromise = page.waitForEvent('dialog', async dialog => {
            await dialog.dismiss();
            return true;
        });

        await page.click('button:has-text("Start Restore")');
        await restorePromise;

        // 7. Verify Restored Data
        const restoredFilePath = path.join(RESTORE_DIR, TEST_FILE);
        expect(fs.existsSync(restoredFilePath)).toBe(true);
        const originalContent = fs.readFileSync(path.join(SOURCE_DIR, TEST_FILE), 'utf-8');
        const restoredContent = fs.readFileSync(restoredFilePath, 'utf-8');
        expect(restoredContent).toBe(originalContent);
    });
});
