import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);
const stat = promisify(fs.stat);
const exists = promisify(fs.exists);
const mkdir = promisify(fs.mkdir);
const rm = promisify(fs.rm);

class NFSConnector {
    getMountPoint(config) {
        // Create a unique mount point for this NFS share
        const hash = Buffer.from(`${config.host}:${config.path}`).toString('base64').replace(/[/+=]/g, '').slice(0, 12);
        return `/tmp/nfs-mount-${hash}`;
    }

    async mount(config) {
        const mountPoint = this.getMountPoint(config);

        // Check if already mounted
        try {
            const { stdout } = await execAsync(`mount | grep "${mountPoint}"`);
            if (stdout.trim()) {
                return mountPoint; // Already mounted
            }
        } catch {
            // Not mounted, continue
        }

        // Create mount point
        await mkdir(mountPoint, { recursive: true });

        // Build mount command
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
            // Ignore unmount errors
        }
    }

    async testConnection(config) {
        try {
            // Try to mount and access
            const mountPoint = await this.mount(config);

            // Verify we can read the directory
            await execAsync(`ls "${mountPoint}"`, { timeout: 5000 });

            return { success: true, message: 'Connection successful' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async backup(config, options = {}) {
        // Mount NFS share
        const mountPoint = await this.mount(config);

        // Use local connector to backup from mount point
        const LocalConnector = (await import('./local.js')).default;
        const localConnector = new LocalConnector();

        try {
            const result = await localConnector.backup({ path: mountPoint }, options);
            return result;
        } finally {
            // Don't unmount - leave it for potential future operations
        }
    }

    async upload(sourcePath, filename, config) {
        // Mount NFS share
        const mountPoint = await this.mount(config);

        // Use local connector to copy to mount point
        const LocalConnector = (await import('./local.js')).default;
        const localConnector = new LocalConnector();

        const result = await localConnector.upload(sourcePath, filename, { path: mountPoint });

        // Adjust location to show NFS path
        return {
            ...result,
            location: `nfs://${config.host}${config.path}/${filename}`
        };
    }

    async download(location, config) {
        // Mount NFS share
        const mountPoint = await this.mount(config);

        // Parse location: nfs://host/path/filename
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
