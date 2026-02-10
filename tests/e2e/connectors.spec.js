import { test, expect } from '@playwright/test';

test.describe('Connectors Page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/connectors');
    });

    test('should display connectors page', async ({ page }) => {
        await expect(page.getByRole('heading', { name: /Connectors/i }).first()).toBeVisible();
    });

    test('should show add connector button', async ({ page }) => {
        await expect(page.locator('.actions-toolbar').getByRole('button', { name: /Add Connector/i })).toBeVisible();
    });

    test('should open add connector modal when clicking add button', async ({ page }) => {
        await page.locator('.actions-toolbar').getByRole('button', { name: /Add Connector/i }).click();

        // Modal should appear with "Add New Connector" heading (h3)
        await expect(page.locator('.modal')).toBeVisible();
        await expect(page.locator('.modal-header h3')).toContainText('Add New Connector');
    });

    test('should show connector type options in modal', async ({ page }) => {
        await page.locator('.actions-toolbar').getByRole('button', { name: /Add Connector/i }).click();

        // Wait for modal and check connector types
        await expect(page.locator('.modal')).toBeVisible();
        await expect(page.locator('.type-option').first()).toBeVisible();
    });

    test('should close modal when clicking close button', async ({ page }) => {
        await page.locator('.actions-toolbar').getByRole('button', { name: /Add Connector/i }).click();
        await expect(page.locator('.modal')).toBeVisible();

        // Click close button (X icon in header)
        await page.locator('.modal-header button').click();
        await expect(page.locator('.modal')).not.toBeVisible();
    });

    test('should select connector type and show form', async ({ page }) => {
        // Open modal
        await page.locator('.actions-toolbar').getByRole('button', { name: /Add Connector/i }).click();
        await expect(page.locator('.modal')).toBeVisible();

        // Click the first type option (Local Folder)
        await page.locator('.type-option').first().click();

        // After selecting type, the connector-form should appear
        await expect(page.locator('.connector-form')).toBeVisible();
    });
});
