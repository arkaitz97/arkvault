import { test, expect } from '@playwright/test';

test.describe('Restore Page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/restore');
    });

    test('should display restore page', async ({ page }) => {
        await expect(page.getByRole('heading', { name: /Restore from Backup/i })).toBeVisible();
    });

    test('should show available backups section', async ({ page }) => {
        // The h2 heading says "Available Backups"
        await expect(page.locator('h2').filter({ hasText: /Available Backups/i })).toBeVisible();
    });

    test('should show search box', async ({ page }) => {
        await expect(page.getByPlaceholder(/Search backups/i)).toBeVisible();
    });

    test('should show restore panel with instructions', async ({ page }) => {
        // Should show "Select a Backup" message when nothing selected
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
        // Stats bar contains "Total Backups" stat
        await expect(page.locator('.stats-bar')).toBeVisible();
    });

    test('should show search filter', async ({ page }) => {
        await expect(page.getByPlaceholder(/Search by job name/i)).toBeVisible();
    });

    test('should have status filter dropdown', async ({ page }) => {
        await expect(page.locator('.filter-group select')).toBeVisible();
    });
});
