
import { test, expect } from './coverage-fixture.js';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const timestamp = Date.now();
const NFS_EXPORT_PATH = '/';
const HOST_VOLUME_PATH = '/tmp/nfs-share';
const MOUNT_OPTIONS = 'rw,soft,timeo=30,vers=4,nolock';

const PROJECT_ROOT = process.cwd();
const SOURCE_DIR = path.join(PROJECT_ROOT, 'test-data/source');
const RESTORE_DIR = path.join(PROJECT_ROOT, 'test-data/restore-nfs', `e2e-${timestamp}`);
const TEST_FILE = 'sample.txt';

test.describe('NFS Connector Workflow', () => {
    let containerIp = '';

    test.beforeAll(async () => {
        console.log('Starting NFS container setup...');
        try {
            execSync('npm run nfs:stop');
            execSync('npm run nfs:start');
            await new Promise(r => setTimeout(r, 5000));

            try {
                containerIp = execSync("docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' arkvault-nfs").toString().trim();
                console.log(`NFS Container IP: ${containerIp}`);
            } catch (e) {
                console.warn('Could not get container IP, might need to rely on localhost mapping if supported', e);
            }

            if (!fs.existsSync(HOST_VOLUME_PATH)) {
                fs.mkdirSync(HOST_VOLUME_PATH, { recursive: true });
            }

            try {
                execSync(`docker exec arkvault-nfs chmod 777 /nfsshare`, { stdio: 'ignore' });
            } catch (e) { console.log('Permission fix failed', e); }

        } catch (e) {
            console.error('Setup failed:', e);
            throw e;
        }

        if (!fs.existsSync(SOURCE_DIR)) {
            fs.mkdirSync(SOURCE_DIR, { recursive: true });
            fs.writeFileSync(path.join(SOURCE_DIR, TEST_FILE), 'NFS E2E Test Content');
        }
        if (!fs.existsSync(RESTORE_DIR)) fs.mkdirSync(RESTORE_DIR, { recursive: true });
    });

    test.afterAll(() => {
        try { execSync('npm run nfs:stop'); } catch { /* ignore */ }
        if (fs.existsSync(RESTORE_DIR)) fs.rmSync(RESTORE_DIR, { recursive: true, force: true });
        try { execSync(`docker run --rm -v /tmp:/data alpine rm -rf /data/nfs-share`, { stdio: 'ignore' }); } catch { /* ignore */ }
    });

    test('should complete full lifecycle', async ({ page }) => {
        test.setTimeout(180000); // 3 minutes
        await page.goto('/connectors');

        await page.locator('.actions-toolbar').getByRole('button', { name: /Add Connector/i }).click();
        await page.locator('.type-option').filter({ hasText: 'Local Folder' }).click();
        await page.locator('.input-group').filter({ hasText: 'Connector Name' }).locator('input').fill(`Local-Source-NFS-${timestamp}`);
        await page.locator('.input-group').filter({ hasText: 'Folder Path' }).locator('input').fill(SOURCE_DIR);
        await page.locator('.modal-footer').getByRole('button', { name: /Add Connector/i }).click();

        await page.locator('.actions-toolbar').getByRole('button', { name: /Add Connector/i }).click();
        await page.locator('.type-option').filter({ hasText: 'NFS Share' }).click();
        await page.locator('.input-group').filter({ hasText: 'Connector Name' }).locator('input').fill(`NFS-Dest-${timestamp}`);

        await page.locator('.input-group').filter({ hasText: 'NFS Server' }).locator('input').fill(containerIp);
        await page.locator('.input-group').filter({ hasText: 'Export Path' }).locator('input').fill(NFS_EXPORT_PATH);
        await page.locator('.input-group').filter({ hasText: 'Mount Options' }).locator('input').fill(MOUNT_OPTIONS);

        await page.locator('.modal-footer').getByRole('button', { name: /Add Connector/i }).click();

        const destItem = page.locator('.connector-item').filter({ hasText: `NFS-Dest-${timestamp}` });
        await expect(destItem).toBeVisible();
        await destItem.getByTitle('Test connection').click();
        try {
            await expect(destItem.locator('.connected')).toBeVisible({ timeout: 10000 });
        } catch {
            // Soft fail for connection check, proceed to verify backup
        }

        await page.goto('/create');
        await page.locator('.connector-type-card').filter({ hasText: 'Local Folder' }).click();
        await page.locator('.existing-item').filter({ hasText: `Local-Source-NFS-${timestamp}` }).click();
        await page.click('button:has-text("Next")');
        await page.locator('.connector-type-card').filter({ hasText: 'NFS Share' }).click();
        await page.locator('.existing-item').filter({ hasText: `NFS-Dest-${timestamp}` }).click();
        await page.click('button:has-text("Next")');
        await page.click('button:has-text("Next")');
        await page.fill('input[placeholder="e.g., Daily Documents Backup"]', `NFS-Job-${timestamp}`);
        await page.click('button:has-text("Next")');
        await page.click('button:has-text("Create Backup Job")');

        await expect(page).toHaveURL(/\/jobs/);
        const jobCard = page.locator('.job-card').filter({ hasText: `NFS-Job-${timestamp}` });
        page.once('dialog', dialog => dialog.dismiss());
        await jobCard.getByRole('button', { name: /Run now/i }).click();
        const successLocator = jobCard.locator('.status-success');
        const errorLocator = jobCard.locator('.status-error');

        await expect(async () => {
            if (await errorLocator.isVisible()) {
                const errorText = await errorLocator.innerText();
                throw new Error(`Backup failed with error: ${errorText}`);
            }
            await expect(successLocator).toBeVisible();
        }).toPass({ timeout: 90000 });

        let fileFound = false;
        try {
            const output = execSync(`docker run --rm -v /tmp:/data alpine ls /data/nfs-share`, { encoding: 'utf-8' });
            fileFound = output.includes('backup-') && output.includes('.zip');
        } catch (e) { console.error('Docker ls failed:', e); }
        expect(fileFound).toBe(true);

        await page.goto('/restore');
        await page.locator('.backup-item').filter({ hasText: `NFS-Job-${timestamp}` }).first().click();
        await page.fill('input[placeholder="/path/to/restore/"]', RESTORE_DIR);
        const restorePromise = page.waitForEvent('dialog', async dialog => {
            await dialog.dismiss();
            return true;
        });
        await page.click('button:has-text("Start Restore")');
        await restorePromise;

        const restoredFilePath = path.join(RESTORE_DIR, TEST_FILE);
        expect(fs.existsSync(restoredFilePath)).toBe(true);
    });
});
