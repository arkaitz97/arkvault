import { test, expect } from './coverage-fixture.js';

test.describe('Dashboard Page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('should display the dashboard', async ({ page }) => {
        // Title is "ArkVault" as defined in index.html
        await expect(page).toHaveTitle(/ArkVault/);
        await expect(page.getByRole('heading', { name: /Dashboard/i })).toBeVisible();
    });

    test('should display stats cards', async ({ page }) => {
        // Check for stat cards presence
        await expect(page.locator('.stat-card').first()).toBeVisible();
    });

    test('should navigate to backup jobs when clicking sidebar', async ({ page }) => {
        await page.getByRole('link', { name: /Backup Jobs/i }).click();
        await expect(page).toHaveURL(/\/jobs/);
    });

    test('should navigate to connectors when clicking sidebar', async ({ page }) => {
        await page.locator('.sidebar').getByRole('link', { name: /Connectors/i }).click();
        await expect(page).toHaveURL(/\/connectors/);
    });

    test('should navigate to history when clicking sidebar', async ({ page }) => {
        await page.getByRole('link', { name: /History/i }).click();
        await expect(page).toHaveURL(/\/history/);
    });

    test('should navigate to restore when clicking sidebar', async ({ page }) => {
        await page.locator('.sidebar').getByRole('link', { name: /Restore/i }).click();
        await expect(page).toHaveURL(/\/restore/);
    });
});
