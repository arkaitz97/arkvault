import { test, expect } from '@playwright/test';

test.describe('Settings Page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/settings');
    });

    test('should display settings page', async ({ page }) => {
        await expect(page.getByRole('heading', { name: /Settings/i })).toBeVisible();
    });

    test('should show backup defaults section', async ({ page }) => {
        await expect(page.getByText(/Backup Defaults/i)).toBeVisible();
    });

    test('should show notifications section', async ({ page }) => {
        await expect(page.getByRole('heading', { name: /Notifications/i })).toBeVisible();
    });

    test('should show database section', async ({ page }) => {
        await expect(page.getByText(/Database & Maintenance/i)).toBeVisible();
    });

    test('should have save button', async ({ page }) => {
        await expect(page.getByRole('button', { name: /Save Settings/i })).toBeVisible();
    });

    test('should have retention input', async ({ page }) => {
        await expect(page.locator('#retention')).toBeVisible();
    });
});

test.describe('ArkVault Branding', () => {
    test('should display ArkVault in sidebar', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('.logo-title')).toContainText('ArkVault');
    });

    test('should display ArkVault in page title', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveTitle(/ArkVault/);
    });

    test('should navigate to settings from sidebar', async ({ page }) => {
        await page.goto('/');
        await page.getByRole('link', { name: /Settings/i }).click();
        await expect(page).toHaveURL(/\/settings/);
        await expect(page.getByRole('heading', { name: /Settings/i })).toBeVisible();
    });
});
