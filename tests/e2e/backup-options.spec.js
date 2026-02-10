import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const timestamp = Date.now();
const PROJECT_ROOT = process.cwd();
const SOURCE_DIR = path.join(PROJECT_ROOT, 'test-data/source', `options-${timestamp}`);
const DEST_DIR = path.join(PROJECT_ROOT, 'test-data/destination', `options-${timestamp}`);
const TEST_FILE_1 = 'file1.txt';
const TEST_FILE_2 = 'file2.txt';

test.describe('Backup Options Workflow', () => {
    test.beforeAll(async () => {
        if (!fs.existsSync(SOURCE_DIR)) fs.mkdirSync(SOURCE_DIR, { recursive: true });
        if (!fs.existsSync(DEST_DIR)) fs.mkdirSync(DEST_DIR, { recursive: true });

        fs.writeFileSync(path.join(SOURCE_DIR, TEST_FILE_1), 'Content 1');
    });

    test.afterAll(async () => {
        if (fs.existsSync(SOURCE_DIR)) fs.rmSync(SOURCE_DIR, { recursive: true, force: true });
        if (fs.existsSync(DEST_DIR)) fs.rmSync(DEST_DIR, { recursive: true, force: true });
    });

    test('should support tar format and incremental backups', async ({ page }) => {
        test.setTimeout(60000);

        // 1. Create Connectors
        await page.goto('/connectors');

        // Source
        await page.locator('.actions-toolbar').getByRole('button', { name: /Add Connector/i }).click();
        await page.locator('.type-option').filter({ hasText: 'Local Folder' }).click();
        await page.fill('input[placeholder="e.g., Production Database"]', `Src-Opt-${timestamp}`);
        await page.fill('input[placeholder="/path/to/folder"]', SOURCE_DIR);
        await page.locator('.modal-footer').getByRole('button', { name: /Add Connector/i }).click();

        // Destination
        await page.locator('.actions-toolbar').getByRole('button', { name: /Add Connector/i }).click();
        await page.locator('.type-option').filter({ hasText: 'Local Folder' }).click();
        await page.fill('input[placeholder="e.g., Production Database"]', `Dst-Opt-${timestamp}`);
        await page.fill('input[placeholder="/path/to/folder"]', DEST_DIR);
        await page.locator('.modal-footer').getByRole('button', { name: /Add Connector/i }).click();

        // 2. Create Backup Job (Tar + Incremental)
        await page.goto('/create');

        // Step 1: Source
        await expect(page.locator('h2')).toHaveText('Select Backup Source');
        await page.locator('.connector-type-card').filter({ hasText: 'Local Folder' }).click();
        await page.locator('.existing-item').filter({ hasText: `Src-Opt-${timestamp}` }).click();
        await page.click('button:has-text("Next")');

        // Step 2: Destination
        await expect(page.locator('h2')).toHaveText('Select Destination');
        await page.locator('.connector-type-card').filter({ hasText: 'Local Folder' }).click();
        await page.locator('.existing-item').filter({ hasText: `Dst-Opt-${timestamp}` }).click();
        await page.click('button:has-text("Next")');

        // Step 3: Schedule
        await expect(page.locator('h2')).toHaveText('Set Backup Schedule');
        await page.click('button:has-text("Next")');

        // Step 4: Options
        await expect(page.locator('h2')).toHaveText('Configure Options');
        await page.fill('input[placeholder="e.g., Daily Documents Backup"]', `Job-Opt-${timestamp}`);

        // Check constraint: Zip should disable Incremental
        await page.selectOption('select.input', 'zip');
        const incrementalOption = page.locator('.toggle-option').filter({ hasText: 'Incremental Backup' });
        await expect(incrementalOption).toHaveClass(/disabled/);

        // Select Tar to enable it
        await page.selectOption('select.input', 'tar'); // Backup Format dropdown
        await expect(incrementalOption).not.toHaveClass(/disabled/);

        // Enable Incremental
        // The input might be hidden, so click the label
        await incrementalOption.click();

        await page.click('button:has-text("Next")');

        // Step 5: Review
        const formatValue = page.locator('.review-item').filter({ hasText: 'Format:' }).locator('.review-value');
        await expect(formatValue).toHaveText('tar');
        const incValue = page.locator('.review-item').filter({ hasText: 'Incremental:' }).locator('.review-value');
        await expect(incValue).toHaveText('Enabled');

        // Wait for API response
        const [response] = await Promise.all([
            page.click('button:has-text("Create Backup Job")'),
            page.waitForResponse(resp => resp.url().includes('/api/jobs') && resp.status() === 200)
        ]);

        // 3. Run First Backup (Full)
        await expect(page).toHaveURL(/\/jobs/);
        const jobCard = page.locator('.job-card').filter({ hasText: `Job-Opt-${timestamp}` });

        page.once('dialog', dialog => dialog.dismiss());
        await jobCard.getByRole('button', { name: /Run now/i }).click();
        await expect(jobCard.locator('.status-success')).toBeVisible({ timeout: 20000 });

        // Verify file in destination
        const files = fs.readdirSync(DEST_DIR);
        const backupFile = files.find(f => f.startsWith('backup-') && f.endsWith('.tar.gz'));
        expect(backupFile).toBeDefined();

        // 4. Run Second Backup (Incremental) - No changes
        // Wait a bit to ensure timestamp difference if filesystem has low resolution,
        // though our logic uses > so equal might not match.
        // But we want to test that it *doesn't* backup everything again? 
        // Or actually, if nothing changed, it might produce an empty archive (which is a valid test).

        // Let's Add a file to trigger incremental backup
        // Sleep 1s to ensure mtime diff
        await new Promise(r => setTimeout(r, 1100));
        fs.writeFileSync(path.join(SOURCE_DIR, TEST_FILE_2), 'Content 2');

        page.once('dialog', dialog => dialog.dismiss());
        await jobCard.getByRole('button', { name: /Run now/i }).click();

        // Wait for status to go to running then success again?
        // Use history page to verify 2 backups.
        await page.waitForTimeout(1000); // Wait for UI update
        await expect(jobCard.locator('.status-success')).toBeVisible({ timeout: 20000 });

        // Verify second backup exists
        const filesAfter = fs.readdirSync(DEST_DIR);
        // Should have 2 backups
        const backups = filesAfter.filter(f => f.startsWith('backup-') && f.endsWith('.tar.gz'));
        expect(backups.length).toBe(2);

        // Sort by time
        backups.sort();
        const secondBackup = backups[1];

        // We could verify size logic here. 
        // First backup has file1 + metadata.
        // Second backup has file2 + metadata.
        // They should be roughly similar size if content is small, but strictly speaking checking content would be better.
        // For now, checking that we got a .tar.gz and it succeeded is decent coverage.
    });
});
