import fs from 'fs';
import path from 'path';
import os from 'os';
import { promisify } from 'util';
import archiver from 'archiver';
import { createWriteStream, createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Extract } from 'unzipper';
import logger from '../logger.js';

const stat = promisify(fs.stat);
const readdir = promisify(fs.readdir);
const mkdir = promisify(fs.mkdir);
const copyFile = promisify(fs.copyFile);
const rm = promisify(fs.rm);

class LocalConnector {
    resolvePath(inputPath) {
        if (!inputPath) return inputPath;

        let resolvedPath = inputPath;
        if (resolvedPath.startsWith('~')) {
            resolvedPath = path.join(os.homedir(), resolvedPath.slice(1));
        }

        return path.resolve(resolvedPath);
    }

    async testConnection(config) {
        const resolvedPath = this.resolvePath(config.path);
        logger.debug({ path: config.path, resolvedPath }, 'Testing local connection');
        try {
            const stats = await stat(resolvedPath);
            if (!stats.isDirectory()) {
                logger.warn({ resolvedPath }, 'Connection test failed: Not a directory');
                return { success: false, error: 'Path is not a directory' };
            }
            await readdir(resolvedPath);
            logger.info({ resolvedPath }, 'Local connection test successful');
            return { success: true, message: 'Connection successful' };
        } catch (error) {
            logger.error({ err: error, resolvedPath }, 'Local connection test failed');
            return { success: false, error: error.message };
        }
    }

    async backup(config, options = {}) {
        const sourcePath = this.resolvePath(config.path);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const format = options.format || 'zip';
        const isTar = format === 'tar';
        const extension = isTar ? (options.compression ? 'tar.gz' : 'tar') : 'zip';
        const filename = `backup-${timestamp}.${extension}`;
        const tempPath = path.join('/tmp', filename);

        logger.info({ sourcePath, tempPath, format, options }, 'Starting local backup');
        const start = Date.now();

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
                    fileStats.totalSize += file.size;
                }
            } else {
                archive.directory(sourcePath, false);
                fileStats = await this.getDirectoryStats(sourcePath);
            }

            archive.finalize();
        });

        const archiveStats = await stat(tempPath);
        const duration = Date.now() - start;

        logger.info({
            filename,
            size: archiveStats.size,
            filesProcessed: fileStats.fileCount,
            durationMs: duration
        }, 'Local backup completed');

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
        const resolvedPath = this.resolvePath(config.path);
        const destPath = path.join(resolvedPath, filename);
        logger.info({ sourcePath, destPath }, 'Uploading local file');

        await mkdir(path.dirname(destPath), { recursive: true });
        await copyFile(sourcePath, destPath);
        await rm(sourcePath, { force: true });

        logger.info({ destPath }, 'Upload completed');
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
        const destPath = this.resolvePath(options.path);
        logger.info({ backupPath: backupData.path, destPath }, 'Starting local restore');
        const start = Date.now();

        await mkdir(destPath, { recursive: true });

        await pipeline(
            createReadStream(backupData.path),
            Extract({ path: destPath })
        );

        const stats = await this.getDirectoryStats(destPath);
        const duration = Date.now() - start;

        logger.info({
            destPath,
            filesRestored: stats.fileCount,
            durationMs: duration
        }, 'Local restore completed');

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
