import { test, expect } from './coverage-fixture.js';
import fs from 'fs';

test.describe('Backup Jobs Page', () => {
    test.beforeAll(() => {
        fs.mkdirSync('/tmp/source', { recursive: true });
        fs.mkdirSync('/tmp/dest', { recursive: true });
        if (!fs.existsSync('/tmp/source/test.txt')) {
            fs.writeFileSync('/tmp/source/test.txt', 'hello world');
        }
    });
    test.beforeEach(async ({ page }) => {
        await page.goto('/jobs');
    });

    test('should handle job lifecycle: create, pause, edit, run, delete', async ({ page }) => {
        await page.getByRole('link', { name: /New Backup Job/i }).click();

        await page.locator('.connector-type-card').filter({ hasText: 'Local Folder' }).click();
        await page.getByPlaceholder('/path/to/folder').fill('/tmp/source');
        await page.getByRole('button', { name: /Next/i }).click();

        await page.locator('.connector-type-card').filter({ hasText: 'Local Folder' }).click();
        await page.getByPlaceholder('/path/to/folder').fill('/tmp/dest');
        await page.getByRole('button', { name: /Next/i }).click();

        await page.getByRole('button', { name: /Next/i }).click();

        const jobName = 'E2E Test Job ' + Date.now();
        await page.getByPlaceholder('e.g., Daily Documents Backup').fill(jobName);
        await page.getByRole('button', { name: /Next/i }).click();

        await page.getByRole('button', { name: /Create Backup Job/i }).click();
        await expect(page).toHaveURL(/\/jobs$/);
        await expect(page.getByText(jobName).first()).toBeVisible();

        const jobCard = page.locator('.job-card').filter({ hasText: jobName }).first();
        await jobCard.getByTitle('Pause').click();
        await expect(jobCard.getByText('paused')).toBeVisible();

        await jobCard.getByTitle('Resume').click();
        await expect(jobCard.getByText('active')).toBeVisible();

        await jobCard.locator('.dropdown button').click();
        await page.getByRole('button', { name: /Edit/i }).click();

        await expect(page.locator('.modal')).toBeVisible();

        // The first input type="text" is the Job name
        await page.locator('.modal-body input[type="text"]').first().fill(jobName + ' Updated');

        // Try custom schedule
        await page.locator('select').selectOption('custom');
        await page.getByPlaceholder('* * * * *').fill('0 12 * * *');

        // Options
        await page.locator('input[type="number"]').fill('14');
        await page.getByText('Compression').locator('..').locator('input[type="checkbox"]').check();
        await page.getByText('Encryption').locator('..').locator('input[type="checkbox"]').check();

        const savePromise = page.waitForResponse(resp => resp.url().includes('/api/jobs') && resp.request().method() === 'PUT');
        await page.getByRole('button', { name: /Save Changes/i }).click();
        await savePromise;

        await expect(page.getByText(jobName + ' Updated').first()).toBeVisible();

        page.on('dialog', dialog => dialog.accept());
        const runPromise = page.waitForResponse(resp => resp.url().includes('/api/backups/run') && resp.request().method() === 'POST');
        await jobCard.getByTitle('Run now').click();
        await runPromise;

        await jobCard.locator('.dropdown button').click();
        await page.getByRole('button', { name: /Delete/i }).click();
        await page.locator('.modal').getByRole('button', { name: 'Delete Job' }).click();
        await expect(page.getByText(jobName + ' Updated').first()).not.toBeVisible();
    });

    test('empty state and wizard entry', async ({ page }) => {
        await expect(page.getByRole('heading', { name: /Backup Jobs/i, level: 1 })).toBeVisible();
    });
});
