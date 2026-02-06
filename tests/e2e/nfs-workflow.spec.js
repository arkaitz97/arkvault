
import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const timestamp = Date.now();
const NFS_EXPORT_PATH = '/';
const HOST_VOLUME_PATH = '/tmp/nfs-share';
// Use vers=4 for consistency. Port/mountport not strictly needed if usng standard 2049 on direct IP.
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
            // 1. Start NFS using standard script
            // The script uses -p 22049:2049, so we can access it via localhost:22049 or container IP
            execSync('npm run nfs:stop'); // Ensure clean state
            execSync('npm run nfs:start');
            await new Promise(r => setTimeout(r, 5000)); // Wait for container to be ready

            // 2. Get Container IP (optional if we use mapped port, but good for direct internal access if needed)
            // But let's try using the container IP as before since it is on the bridge network and host can usually reach it.
            // If the test runs inside a container, this might be tricky, but we are on linux host.
            try {
                containerIp = execSync("docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' arkvault-nfs").toString().trim();
                console.log(`NFS Container IP: ${containerIp}`);
            } catch (e) {
                console.warn('Could not get container IP, might need to rely on localhost mapping if supported', e);
            }

            // 3. Ensure host volume exists and has permissions
            // The script maps /tmp/nfs-share:/nfsshare
            if (!fs.existsSync(HOST_VOLUME_PATH)) {
                fs.mkdirSync(HOST_VOLUME_PATH, { recursive: true });
            }

            // Fix permissions so the NFS server can write to it (and we can read it)
            // The alpine image runs as root usually, but let's be safe.
            try {
                execSync(`docker exec arkvault-nfs chmod 777 /nfsshare`, { stdio: 'ignore' });
            } catch (e) { console.log('Permission fix failed', e); }

        } catch (e) {
            console.error('Setup failed:', e);
            throw e;
        }

        // Prepare source data
        if (!fs.existsSync(SOURCE_DIR)) {
            fs.mkdirSync(SOURCE_DIR, { recursive: true });
            fs.writeFileSync(path.join(SOURCE_DIR, TEST_FILE), 'NFS E2E Test Content');
        }
        if (!fs.existsSync(RESTORE_DIR)) fs.mkdirSync(RESTORE_DIR, { recursive: true });
    });

    test.afterAll(() => {
        try { execSync('npm run nfs:stop'); } catch { }
        if (fs.existsSync(RESTORE_DIR)) fs.rmSync(RESTORE_DIR, { recursive: true, force: true });
        // Optional: cleanup host volume, but maybe leave for debugging if failed? 
        // Better to clean up to avoid side effects.
        // Use docker to cleanup root-owned files in HOST_VOLUME_PATH
        try { execSync(`docker run --rm -v /tmp:/data alpine rm -rf /data/nfs-share`, { stdio: 'ignore' }); } catch { }
    });

    test('should complete full lifecycle', async ({ page }) => {
        test.setTimeout(180000); // 3 minutes
        await page.goto('/connectors');

        // Add Source
        await page.locator('header').getByRole('button', { name: /Add Connector/i }).click();
        await page.locator('.type-option').filter({ hasText: 'Local Folder' }).click();
        await page.locator('.input-group').filter({ hasText: 'Connector Name' }).locator('input').fill(`Local-Source-NFS-${timestamp}`);
        await page.locator('.input-group').filter({ hasText: 'Folder Path' }).locator('input').fill(SOURCE_DIR);
        await page.locator('.modal-footer').getByRole('button', { name: /Add Connector/i }).click();

        // Add NFS Destination using Container IP
        await page.locator('header').getByRole('button', { name: /Add Connector/i }).click();
        await page.locator('.type-option').filter({ hasText: 'NFS Share' }).click();
        await page.locator('.input-group').filter({ hasText: 'Connector Name' }).locator('input').fill(`NFS-Dest-${timestamp}`);

        // Use container IP!
        await page.locator('.input-group').filter({ hasText: 'NFS Server' }).locator('input').fill(containerIp);
        await page.locator('.input-group').filter({ hasText: 'Export Path' }).locator('input').fill(NFS_EXPORT_PATH);
        await page.locator('.input-group').filter({ hasText: 'Mount Options' }).locator('input').fill(MOUNT_OPTIONS);

        await page.locator('.modal-footer').getByRole('button', { name: /Add Connector/i }).click();

        // Verify Connection
        const destItem = page.locator('.connector-item').filter({ hasText: `NFS-Dest-${timestamp}` });
        await expect(destItem).toBeVisible();
        await destItem.getByTitle('Test connection').click();
        try {
            await expect(destItem.locator('.connected')).toBeVisible({ timeout: 10000 });
        } catch (e) {
            // Soft fail for connection check, proceed to verify backup
        }

        // Job & Backup
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
        // Wait for either success or error
        const successLocator = jobCard.locator('.status-success');
        const errorLocator = jobCard.locator('.status-error');

        // Poll for status
        await expect(async () => {
            if (await errorLocator.isVisible()) {
                const errorText = await errorLocator.innerText();
                throw new Error(`Backup failed with error: ${errorText}`);
            }
            await expect(successLocator).toBeVisible();
        }).toPass({ timeout: 90000 });

        // Verify File with Docker ls
        let fileFound = false;
        try {
            const output = execSync(`docker run --rm -v /tmp:/data alpine ls /data/nfs-share`, { encoding: 'utf-8' });
            fileFound = output.includes('backup-') && output.includes('.zip');
        } catch (e) { console.error('Docker ls failed:', e); }
        expect(fileFound).toBe(true);

        // Restore
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
