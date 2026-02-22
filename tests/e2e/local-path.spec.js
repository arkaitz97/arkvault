import { test, expect } from './coverage-fixture.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

test.describe('Local Connector Path Handling', () => {
    let relativeDir;
    let homeExpandDir;
    let fullRelativePath;
    let fullHomeExpandPath;

    test.beforeAll(async () => {
        // Setup directories
        relativeDir = `e2e-rel-${uuidv4().substring(0, 8)}`;
        homeExpandDir = `e2e-home-${uuidv4().substring(0, 8)}`;

        fullRelativePath = path.join(process.cwd(), relativeDir);
        fullHomeExpandPath = path.join(os.homedir(), homeExpandDir);

        try {
            await fs.mkdir(fullRelativePath, { recursive: true });
            await fs.mkdir(fullHomeExpandPath, { recursive: true });

            // Create dummy files
            await fs.writeFile(path.join(fullRelativePath, 'rel-data.txt'), 'Relative Data');
            await fs.writeFile(path.join(fullHomeExpandPath, 'home-data.txt'), 'Home Data');
        } catch (e) {
            console.error('Setup failed:', e);
        }
    });

    test.afterAll(async () => {
        // Cleanup
        try {
            // We use standard fs rm, relying on node process permissions
            await fs.rm(fullRelativePath, { recursive: true, force: true });
            await fs.rm(fullHomeExpandPath, { recursive: true, force: true });
        } catch (e) {
            console.error('Cleanup failed:', e);
        }
    });

    test('should support relative path in connector', async ({ page }) => {
        // Create a connector with relative path
        await page.goto('/connectors');
        await page.getByRole('button', { name: 'Add Connector' }).first().click();

        // Select Local Folder type
        await page.locator('.type-option').filter({ hasText: 'Local Folder' }).click();

        // Fill form
        const connectorName = `Relative Test ${uuidv4().substring(0, 4)}`;
        await page.fill('input[placeholder="e.g., Production Database"]', connectorName);

        // Use relative path
        await page.fill('input[placeholder="/path/to/folder"]', relativeDir);

        // Save
        await page.locator('.modal-footer').getByRole('button', { name: 'Add Connector' }).click();

        // Wait for modal to disappear
        await expect(page.locator('.modal')).not.toBeVisible();

        // Verify connector appears in list
        // Reload to be safe if list doesn't auto-update reliably or is large
        await page.reload();
        await expect(page.locator('.connectors-list')).toContainText(connectorName);

        // Test connection (which verifies server-side resolution)
        const connectorItem = page.locator('.connector-item').filter({ hasText: connectorName });
        await connectorItem.getByTitle('Test connection').click();

        // Expect success status
        await expect(connectorItem.locator('.status-badge.connected')).toBeVisible({ timeout: 10000 });
    });

    test('should support home directory expansion (~)', async ({ page }) => {
        // Create a connector with ~ path
        await page.goto('/connectors');
        await page.getByRole('button', { name: 'Add Connector' }).first().click();

        // Select Local Folder type
        await page.locator('.type-option').filter({ hasText: 'Local Folder' }).click();

        // Fill form
        const connectorName = `Home Test ${uuidv4().substring(0, 4)}`;
        await page.fill('input[placeholder="e.g., Production Database"]', connectorName);

        // Use ~ path
        await page.fill('input[placeholder="/path/to/folder"]', `~/${homeExpandDir}`);

        // Save
        await page.locator('.modal-footer').getByRole('button', { name: 'Add Connector' }).click();

        // Wait for modal to disappear
        await expect(page.locator('.modal')).not.toBeVisible();

        // Verify connector appears
        await page.reload();
        await expect(page.locator('.connectors-list')).toContainText(connectorName);

        // Test connection
        const connectorItem = page.locator('.connector-item').filter({ hasText: connectorName });
        await connectorItem.getByTitle('Test connection').click();

        // Expect success status
        await expect(connectorItem.locator('.status-badge.connected')).toBeVisible({ timeout: 10000 });
    });
});
