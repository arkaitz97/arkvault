import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import archiver from 'archiver';
import { createWriteStream, createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
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
            await readdir(config.path);
            return { success: true, message: 'Connection successful' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async backup(config, options = {}) {
        const sourcePath = config.path;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const format = options.format || 'zip';
        const isTar = format === 'tar';
        const extension = isTar ? (options.compression ? 'tar.gz' : 'tar') : 'zip';
        const filename = `backup-${timestamp}.${extension}`;
        const tempPath = path.join('/tmp', filename);

        // For file stats, we might want to count only what we are backing up if incremental
        // But the original code counted everything in source.
        // Let's stick to counting what is actually backed up.

        let fileStats = { fileCount: 0, totalSize: 0 };

        await new Promise(async (resolve, reject) => {
            const output = createWriteStream(tempPath);
            const archive = isTar
                ? archiver('tar', {
                    gzip: !!options.compression,
                    gzipOptions: { level: 9 }
                })
                : archiver('zip', {
                    zlib: { level: options.compression ? 9 : 0 }
                });

            output.on('close', resolve);
            archive.on('error', reject);

            archive.pipe(output);

            if (options.incremental && options.lastRun) {
                const files = await this.getFilesToBackup(sourcePath, options.lastRun);
                fileStats.fileCount = files.length;
                for (const file of files) {
                    archive.file(file.fullPath, { name: file.relativePath });
                    fileStats.totalSize += file.size; // Accumulate size
                }
                // If no files changed, we still create an empty backup or should we?
                // An empty zip/tar is valid.
            } else {
                archive.directory(sourcePath, false);
                fileStats = await this.getDirectoryStats(sourcePath);
            }

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

    async getFilesToBackup(dirPath, lastRun) {
        const files = [];
        const lastRunDate = new Date(lastRun);

        const processDir = async (currentPath) => {
            const entries = await readdir(currentPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name);
                if (entry.isDirectory()) {
                    await processDir(fullPath);
                } else {
                    const fileStat = await stat(fullPath);
                    if (fileStat.mtime > lastRunDate) {
                        files.push({
                            fullPath,
                            relativePath: path.relative(dirPath, fullPath),
                            size: fileStat.size
                        });
                    }
                }
            }
        };

        await processDir(dirPath);
        return files;
    }

    async upload(sourcePath, filename, config) {
        const destPath = path.join(config.path, filename);
        await mkdir(path.dirname(destPath), { recursive: true });
        await copyFile(sourcePath, destPath);

        await rm(sourcePath, { force: true });

        return {
            success: true,
            location: destPath
        };
    }

    async download(location, _config) {
        return {
            path: location,
            isFile: true
        };
    }

    async restore(backupData, options) {
        const destPath = options.path;
        await mkdir(destPath, { recursive: true });

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
