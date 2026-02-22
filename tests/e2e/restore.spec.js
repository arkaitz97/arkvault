import { test, expect } from './coverage-fixture.js';

test.describe('Restore Page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/restore');
    });

    test('should display restore page', async ({ page }) => {
        await expect(page.getByRole('heading', { name: /Restore from Backup/i })).toBeVisible();
    });

    test('should show available backups section', async ({ page }) => {
        await expect(page.locator('h2').filter({ hasText: /Available Backups/i })).toBeVisible();
    });

    test('should show search box', async ({ page }) => {
        await expect(page.getByPlaceholder(/Search backups/i)).toBeVisible();
    });

    test('should show restore panel with instructions', async ({ page }) => {
        await expect(page.getByText(/Select a Backup/i)).toBeVisible();
    });
});

test.describe('History Page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/history');
    });

    test('should display history page', async ({ page }) => {
        await expect(page.getByRole('heading', { name: /Backup History/i, level: 1 })).toBeVisible();
    });

    test('should show stats bar', async ({ page }) => {
        await expect(page.locator('.stats-bar')).toBeVisible();
    });

    test('should show search filter', async ({ page }) => {
        await expect(page.getByPlaceholder(/Search by job name/i)).toBeVisible();
    });

    test('should have status filter dropdown', async ({ page }) => {
        await expect(page.locator('.filter-group select')).toBeVisible();
    });
});
