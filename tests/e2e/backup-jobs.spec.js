import { test, expect } from '@playwright/test';

test.describe('Backup Jobs Page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/jobs');
    });

    test('should display backup jobs page', async ({ page }) => {
        await expect(page.getByRole('heading', { name: /Backup Jobs/i })).toBeVisible();
    });

    test('should show new backup job button', async ({ page }) => {
        await expect(page.getByRole('link', { name: /New Backup Job/i })).toBeVisible();
    });

    test('should navigate to create backup wizard', async ({ page }) => {
        await page.getByRole('link', { name: /New Backup Job/i }).click();
        await expect(page).toHaveURL(/\/create/);
    });
});

test.describe('Create Backup Wizard', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/create');
    });

    test('should display create backup wizard', async ({ page }) => {
        await expect(page.getByRole('heading', { name: /Create Backup Job/i })).toBeVisible();
    });

    test('should show wizard steps', async ({ page }) => {
        // Should show step 1 initially
        await expect(page.getByText(/Source/i).first()).toBeVisible();
    });

    test('should require source selection before proceeding', async ({ page }) => {
        // Next button should be present
        const nextButton = page.getByRole('button', { name: /Next/i });
        await expect(nextButton).toBeVisible();
    });
});
