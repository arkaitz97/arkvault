import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);
const mkdir = promisify(fs.mkdir);
const rm = promisify(fs.rm);

class NFSConnector {
    getMountPoint(config) {
        const hash = Buffer.from(`${config.host}:${config.path}`).toString('base64').replace(/[/+=]/g, '').slice(0, 12);
        return `/tmp/nfs-mount-${hash}`;
    }

    async mount(config) {
        const mountPoint = this.getMountPoint(config);

        // Check if already mounted
        try {
            const { stdout } = await execAsync(`mount | grep "${mountPoint}"`);
            if (stdout.trim()) {
                try {
                    // Try to list the directory to check for stale handle
                    await execAsync(`ls "${mountPoint}"`, { timeout: 2000 });
                    return mountPoint;
                } catch (e) {
                    try {
                        await execAsync(`sudo umount -f "${mountPoint}"`, { timeout: 5000 });
                    } catch (umountErr) {
                        // Try lazy unmount if force fails
                        await execAsync(`sudo umount -l "${mountPoint}"`, { timeout: 5000 });
                    }
                }
            }
        } catch (e) {
            // mount check failed or unmount failed, proceed to try mounting
        }

        await mkdir(mountPoint, { recursive: true });

        const source = `${config.host}:${config.path}`;
        const options = config.mountOptions || 'rw,soft,timeo=30';
        const command = `sudo mount -t nfs -o ${options} "${source}" "${mountPoint}"`;

        try {
            await execAsync(command, { timeout: 30000 });
            return mountPoint;
        } catch (error) {
            throw new Error(`Failed to mount NFS share: ${error.message}`);
        }
    }

    async unmount(config) {
        const mountPoint = this.getMountPoint(config);
        try {
            await execAsync(`sudo umount "${mountPoint}"`, { timeout: 10000 });
            await rm(mountPoint, { recursive: true, force: true });
        } catch {
            // ignore unmount errors
        }
    }

    async testConnection(config) {
        try {
            const mountPoint = await this.mount(config);

            await execAsync(`ls "${mountPoint}"`, { timeout: 5000 });

            return { success: true, message: 'Connection successful' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async backup(config, options = {}) {
        const mountPoint = await this.mount(config);

        const LocalConnector = (await import('./local.js')).default;
        const localConnector = new LocalConnector();

        try {
            const result = await localConnector.backup({ path: mountPoint }, options);
            return result;
        } finally {
            // cleanup not required
        }
    }

    async upload(sourcePath, filename, config) {
        const mountPoint = await this.mount(config);

        const LocalConnector = (await import('./local.js')).default;
        const localConnector = new LocalConnector();

        const result = await localConnector.upload(sourcePath, filename, { path: mountPoint });

        return {
            ...result,
            location: `nfs://${config.host}${config.path}/${filename}`
        };
    }

    async download(location, config) {
        const mountPoint = await this.mount(config);

        const match = location.match(/^nfs:\/\/[^/]+(.+)$/);
        if (!match) {
            throw new Error('Invalid NFS location format');
        }

        const filePath = path.join(mountPoint, path.basename(match[1]));

        return {
            path: filePath,
            isFile: true
        };
    }

    async restore(backupData, options) {
        const LocalConnector = (await import('./local.js')).default;
        const localConnector = new LocalConnector();
        return localConnector.restore(backupData, options);
    }
}

export default NFSConnector;
