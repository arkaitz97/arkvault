import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import archiver from 'archiver';
import { createWriteStream, createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createGunzip } from 'zlib';
import { Extract } from 'unzipper';

const stat = promisify(fs.stat);
const readdir = promisify(fs.readdir);
const mkdir = promisify(fs.mkdir);
const copyFile = promisify(fs.copyFile);
const rm = promisify(fs.rm);

class LocalConnector {
    async testConnection(config) {
        try {
            const stats = await stat(config.path);
            if (!stats.isDirectory()) {
                return { success: false, error: 'Path is not a directory' };
            }
            // Check if readable
            await readdir(config.path);
            return { success: true, message: 'Connection successful' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async backup(config, options = {}) {
        const sourcePath = config.path;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `backup-${timestamp}.zip`;
        const tempPath = path.join('/tmp', filename);

        // Count files and calculate size
        const fileStats = await this.getDirectoryStats(sourcePath);

        // Create zip archive
        await new Promise((resolve, reject) => {
            const output = createWriteStream(tempPath);
            const archive = archiver('zip', {
                zlib: { level: options.compression ? 9 : 0 }
            });

            output.on('close', resolve);
            archive.on('error', reject);

            archive.pipe(output);
            archive.directory(sourcePath, false);
            archive.finalize();
        });

        const archiveStats = await stat(tempPath);

        return {
            data: tempPath,
            filename,
            size: archiveStats.size,
            filesProcessed: fileStats.fileCount,
            isFile: true
        };
    }

    async upload(sourcePath, filename, config) {
        const destPath = path.join(config.path, filename);
        await mkdir(path.dirname(destPath), { recursive: true });
        await copyFile(sourcePath, destPath);

        // Clean up temp file
        await rm(sourcePath, { force: true });

        return {
            success: true,
            location: destPath
        };
    }

    async download(location, config) {
        // For local, location is the file path
        return {
            path: location,
            isFile: true
        };
    }

    async restore(backupData, options) {
        const destPath = options.path;
        await mkdir(destPath, { recursive: true });

        // Extract zip
        await pipeline(
            createReadStream(backupData.path),
            Extract({ path: destPath })
        );

        const stats = await this.getDirectoryStats(destPath);
        return {
            success: true,
            filesRestored: stats.fileCount
        };
    }

    async getDirectoryStats(dirPath) {
        let fileCount = 0;
        let totalSize = 0;

        const processDir = async (currentPath) => {
            const entries = await readdir(currentPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name);
                if (entry.isDirectory()) {
                    await processDir(fullPath);
                } else {
                    fileCount++;
                    const fileStat = await stat(fullPath);
                    totalSize += fileStat.size;
                }
            }
        };

        await processDir(dirPath);
        return { fileCount, totalSize };
    }
}

export default LocalConnector;
