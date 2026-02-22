import { test, expect } from './coverage-fixture.js';
import fs from 'fs';
import path from 'path';

const timestamp = Date.now();
const PROJECT_ROOT = process.cwd();
const SOURCE_DIR = path.join(PROJECT_ROOT, 'test-data/source', `e2e-${timestamp}`);
const DEST_DIR = path.join(PROJECT_ROOT, 'test-data/destination', `e2e-${timestamp}`);
const RESTORE_DIR = path.join(PROJECT_ROOT, 'test-data/restore', `e2e-${timestamp}`);
const TEST_FILE = 'test-file.txt';
const TEST_CONTENT = `Hello E2E World! ${timestamp}`;

test.describe('Full Backup & Restore Workflow', () => {
    test.beforeAll(async () => {
        if (!fs.existsSync(SOURCE_DIR)) fs.mkdirSync(SOURCE_DIR);
        if (!fs.existsSync(DEST_DIR)) fs.mkdirSync(DEST_DIR);
        if (!fs.existsSync(RESTORE_DIR)) fs.mkdirSync(RESTORE_DIR);

        fs.writeFileSync(path.join(SOURCE_DIR, TEST_FILE), TEST_CONTENT);
    });

    test.afterAll(async () => {
        if (fs.existsSync(SOURCE_DIR)) fs.rmSync(SOURCE_DIR, { recursive: true, force: true });
        if (fs.existsSync(DEST_DIR)) fs.rmSync(DEST_DIR, { recursive: true, force: true });
        if (fs.existsSync(RESTORE_DIR)) fs.rmSync(RESTORE_DIR, { recursive: true, force: true });
    });

    test('should complete full lifecycle: connect -> job -> backup -> history -> restore', async ({ page }) => {
        test.setTimeout(30000);
        await page.goto('/connectors');
        await page.locator('.actions-toolbar').getByRole('button', { name: /Add Connector/i }).click();
        await page.locator('.type-option').filter({ hasText: 'Local Folder' }).click();

        await page.fill('input[placeholder="e.g., Production Database"]', `Source-${timestamp}`);
        await page.fill('input[placeholder="/path/to/folder"]', SOURCE_DIR);
        await page.locator('.modal-footer').getByRole('button', { name: /Add Connector/i }).click();

        const sourceItem = page.locator('.connector-item').filter({ hasText: `Source-${timestamp}` });
        await expect(sourceItem).toBeVisible();
        await sourceItem.getByTitle('Test connection').click();
        await expect(sourceItem.locator('.connected')).toBeVisible();

        await page.locator('.actions-toolbar').getByRole('button', { name: /Add Connector/i }).click();
        await page.locator('.type-option').filter({ hasText: 'Local Folder' }).click();

        await page.fill('input[placeholder="e.g., Production Database"]', `Dest-${timestamp}`);
        await page.fill('input[placeholder="/path/to/folder"]', DEST_DIR);
        await page.locator('.modal-footer').getByRole('button', { name: /Add Connector/i }).click();

        const destItem = page.locator('.connector-item').filter({ hasText: `Dest-${timestamp}` });
        await expect(destItem).toBeVisible();
        await destItem.getByTitle('Test connection').click();
        await expect(destItem.locator('.connected')).toBeVisible();

        await page.goto('/create');

        // Step 1: Select Source
        await page.locator('.connector-type-card').filter({ hasText: 'Local Folder' }).click();
        await page.locator('.existing-item').filter({ hasText: `Source-${timestamp}` }).click();
        await page.click('button:has-text("Next")');

        // Step 2: Select Destination
        await page.locator('.connector-type-card').filter({ hasText: 'Local Folder' }).click();
        await page.locator('.existing-item').filter({ hasText: `Dest-${timestamp}` }).click();
        await page.click('button:has-text("Next")');

        // Step 3: Schedule
        await page.click('button:has-text("Next")');

        // Step 4: Options
        await page.fill('input[placeholder="e.g., Daily Documents Backup"]', `Job-${timestamp}`);
        await page.click('button:has-text("Next")');

        // Step 5: Review
        await page.click('button:has-text("Create Backup Job")');

        await expect(page).toHaveURL(/\/jobs/);
        await expect(page.getByText(`Job-${timestamp}`)).toBeVisible();

        const jobCard = page.locator('.job-card').filter({ hasText: `Job-${timestamp}` });

        // Listen for the alert that happens AFTER backup
        page.once('dialog', dialog => dialog.dismiss());

        await jobCard.getByRole('button', { name: /Run now/i }).click();
        await expect(jobCard.locator('.status-success')).toBeVisible({ timeout: 15000 });

        await page.goto('/history');
        const historyRow = page.locator('tr').filter({ hasText: `Job-${timestamp}` }).first();
        await expect(historyRow).toBeVisible();
        await expect(historyRow.locator('.status-icon.success')).toBeVisible();

        await page.goto('/restore');
        // Select the latest backup for our job
        const backupItem = page.locator('.backup-item').filter({ hasText: `Job-${timestamp}` }).first();
        await backupItem.click();

        await page.fill('input[placeholder="/path/to/restore/"]', RESTORE_DIR);

        // Handle the success alert after restore
        page.once('dialog', async dialog => {
            expect(dialog.message()).toContain('Restore completed successfully!');
            await dialog.dismiss();
        });

        await page.click('button:has-text("Start Restore")');

        await expect(page.getByRole('heading', { name: 'Select a Backup' })).toBeVisible({ timeout: 15000 });

        const restoredFilePath = path.join(RESTORE_DIR, TEST_FILE);
        expect(fs.existsSync(restoredFilePath)).toBe(true);
        const restoredContent = fs.readFileSync(restoredFilePath, 'utf-8');
        expect(restoredContent).toBe(TEST_CONTENT);
    });
});
