import { test, expect } from './coverage-fixture.js';

test.describe('Connectors Page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/connectors');
    });

    test('should handle connector lifecycle: create, test, edit, delete', async ({ page }) => {
        await page.locator('.actions-toolbar').getByRole('button', { name: /Add Connector/i }).click();
        await expect(page.locator('.modal')).toBeVisible();
        await page.locator('.type-option').filter({ hasText: 'Local Folder' }).click();

        const connectorName = 'E2E Local Connector ' + Date.now();

        await expect(page.locator('.connector-form')).toBeVisible();
        await page.locator('input[placeholder="e.g., Production Database"]').fill(connectorName);
        await page.getByPlaceholder('/path/to/folder').fill('/tmp/e2e-connector');

        const savePromise = page.waitForResponse(resp => resp.url().includes('/api/connectors') && resp.request().method() === 'POST');
        await page.locator('.modal-footer .btn-primary').click();
        await savePromise;

        const connectorItem = page.locator('.connector-item').filter({ hasText: connectorName }).first();
        await expect(connectorItem).toBeVisible();

        const testPromise = page.waitForResponse(resp => resp.url().includes('/test') && resp.request().method() === 'POST');
        await connectorItem.getByTitle('Test connection').click();
        await testPromise;

        await connectorItem.getByTitle('Edit').click();
        await expect(page.locator('.modal')).toBeVisible();
        await page.locator('input[placeholder="e.g., Production Database"]').fill(connectorName + ' Updated');

        const editPromise = page.waitForResponse(resp => resp.url().includes('/api/connectors/') && resp.request().method() === 'PUT');
        await page.getByRole('button', { name: 'Save Changes' }).click();
        await editPromise;

        await expect(page.locator('.connector-item').filter({ hasText: connectorName + ' Updated' }).first()).toBeVisible();

        await page.locator('.connector-item').filter({ hasText: connectorName + ' Updated' }).first().getByTitle('Delete').click();
        await page.locator('.modal').getByRole('button', { name: 'Delete Connector' }).click();

        await expect(page.locator('.connector-item').filter({ hasText: connectorName + ' Updated' })).not.toBeVisible();
    });

    test('should display connectors page and modal basics', async ({ page }) => {
        await expect(page.getByRole('heading', { name: /Connectors/i }).first()).toBeVisible();

        await page.locator('.actions-toolbar').getByRole('button', { name: /Add Connector/i }).click();
        await expect(page.locator('.modal-header h3')).toContainText('Add New Connector');
        await expect(page.locator('.type-option').first()).toBeVisible();

        await page.locator('.modal-header button').click();
        await expect(page.locator('.modal')).not.toBeVisible();
    });
});
