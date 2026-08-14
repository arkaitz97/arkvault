import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { createWriteStream } from 'fs';
import archiver from 'archiver';
import logger from '../logger.js';

const mkdir = promisify(fs.mkdir);
const rm = promisify(fs.rm);
const stat = promisify(fs.stat);
const mkdtemp = promisify(fs.mkdtemp);

class SSHConnector {
    connect(config) {
        return new Promise((resolve, reject) => {
            const client = new Client();
            const connectConfig = {
                host: config.host,
                port: config.port || 22,
                username: config.username,
                connectTimeout: config.connectTimeout || 10000,
                readyTimeout: config.readyTimeout || 20000
            };

            if (config.authMethod === 'privateKey') {
                connectConfig.privateKey = fs.readFileSync(config.privateKeyPath, 'utf8');
            } else {
                connectConfig.password = config.password;
            }

            client.on('ready', () => {
                client.sftp((err, sftp) => {
                    if (err) {
                        client.end();
                        reject(err);
                        return;
                    }
                    resolve({ client, sftp });
                });
            });
            client.on('error', reject);
            client.connect(connectConfig);
        });
    }

    async withConnection(config, fn) {
        let connection = null;
        try {
            connection = await this.connect(config);
            return await fn(connection);
        } finally {
            if (connection) {
                connection.client.end();
            }
        }
    }

    sftpStat(sftp, remotePath) {
        return new Promise((resolve, reject) => {
            sftp.stat(remotePath, (err, stats) => err ? reject(err) : resolve(stats));
        });
    }

    sftpReaddir(sftp, remotePath) {
        return new Promise((resolve, reject) => {
            sftp.readdir(remotePath, (err, list) => err ? reject(err) : resolve(list));
        });
    }

    sftpMkdir(sftp, remotePath) {
        return new Promise((resolve, reject) => {
            sftp.mkdir(remotePath, (err) => err ? reject(err) : resolve());
        });
    }

    sftpFastGet(sftp, remotePath, localPath) {
        return new Promise((resolve, reject) => {
            sftp.fastGet(remotePath, localPath, (err) => err ? reject(err) : resolve());
        });
    }

    sftpFastPut(sftp, localPath, remotePath) {
        return new Promise((resolve, reject) => {
            sftp.fastPut(localPath, remotePath, (err) => err ? reject(err) : resolve());
        });
    }

    async ensureRemoteDir(sftp, remotePath) {
        const segments = remotePath.split('/').filter(Boolean);
        let current = '';
        for (const segment of segments) {
            current += `/${segment}`;
            try {
                await this.sftpMkdir(sftp, current);
            } catch (error) {
                // Some SFTP servers (e.g. Hetzner Storage Box) return a generic
                // FAILURE (code 4) instead of EEXIST when the directory exists.
                const exists = await this.dirExists(sftp, current).catch(() => false);
                if (!exists) {
                    throw error;
                }
            }
        }
    }

    async dirExists(sftp, remotePath) {
        const stats = await this.sftpStat(sftp, remotePath);
        return stats.isDirectory();
    }

    async walkRemoteDir(sftp, dirPath, files = [], rootDir = dirPath) {
        const entries = await this.sftpReaddir(sftp, dirPath);
        for (const entry of entries) {
            const entryPath = path.join(dirPath, entry.filename);
            if (entry.attrs.isDirectory()) {
                await this.walkRemoteDir(sftp, entryPath, files, rootDir);
            } else if (entry.attrs.isFile()) {
                files.push({
                    remotePath: entryPath,
                    relativePath: path.relative(rootDir, entryPath),
                    mtime: new Date(entry.attrs.mtime * 1000),
                    size: entry.attrs.size
                });
            }
        }
        return files;
    }

    async testConnection(config) {
        logger.info({ host: config.host, port: config.port }, 'Testing SSH connection');
        try {
            await this.withConnection(config, async ({ sftp }) => {
                await this.sftpStat(sftp, config.remotePath);
            });
            logger.info({ host: config.host, port: config.port }, 'SSH connection test successful');
            return { success: true, message: 'Connection successful' };
        } catch (error) {
            logger.error({ err: error, host: config.host, port: config.port }, 'SSH connection test failed');
            return { success: false, error: error.message };
        }
    }

    async backup(config, options = {}) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const format = options.format || 'zip';
        const isTar = format === 'tar';
        const extension = isTar ? (options.compression ? 'tar.gz' : 'tar') : 'zip';
        const filename = `ssh-backup-${timestamp}.${extension}`;
        const tempPath = path.join('/tmp', filename);
        const stagingDir = await mkdtemp(path.join('/tmp', 'ssh-download-'));

        const lastRun = options.incremental && options.lastRun ? new Date(options.lastRun) : null;
        let fileCount = 0;

        logger.info({ host: config.host, remotePath: config.remotePath, format, options }, 'Starting SSH backup');
        const start = Date.now();

        try {
            await this.withConnection(config, async ({ sftp }) => {
                const files = await this.walkRemoteDir(sftp, config.remotePath);
                for (const file of files) {
                    if (lastRun && file.mtime <= lastRun) {
                        continue;
                    }
                    const localPath = path.join(stagingDir, file.relativePath);
                    await mkdir(path.dirname(localPath), { recursive: true });
                    await this.sftpFastGet(sftp, file.remotePath, localPath);
                    fileCount++;
                }
            });

            await new Promise((resolve, reject) => {
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
                archive.directory(stagingDir, false);
                archive.finalize();
            });

            const archiveStats = await stat(tempPath);
            const duration = Date.now() - start;

            logger.info({
                filename,
                size: archiveStats.size,
                filesProcessed: fileCount,
                durationMs: duration
            }, 'SSH backup completed');

            return {
                data: tempPath,
                filename,
                size: archiveStats.size,
                filesProcessed: fileCount,
                isFile: true
            };
        } finally {
            await rm(stagingDir, { recursive: true, force: true });
        }
    }

    async upload(sourcePath, filename, config) {
        logger.info({ host: config.host, remotePath: config.remotePath, filename }, 'Starting SSH upload');

        const remotePath = path.join(config.remotePath, filename);

        await this.withConnection(config, async ({ sftp }) => {
            await this.ensureRemoteDir(sftp, config.remotePath);
            await this.sftpFastPut(sftp, sourcePath, remotePath);
        });

        await rm(sourcePath, { force: true });

        const port = config.port || 22;
        logger.info({ host: config.host, remotePath }, 'SSH upload completed');
        return {
            success: true,
            location: `ssh://${config.host}:${port}${remotePath}`
        };
    }

    async download(location, config) {
        const match = location.match(/^ssh:\/\/([^/:]+)(?::(\d+))?(\/.+)$/);
        if (!match) {
            throw new Error('Invalid SSH location format');
        }

        const [, host, , remotePath] = match;
        const tempPath = path.join('/tmp', path.basename(remotePath));

        logger.info({ host, remotePath, tempPath }, 'Starting SSH download');

        await this.withConnection(config, async ({ sftp }) => {
            await this.sftpFastGet(sftp, remotePath, tempPath);
        });

        return {
            path: tempPath,
            isFile: true
        };
    }

    async restore(backupData, options) {
        const LocalConnector = (await import('./local.js')).default;
        const localConnector = new LocalConnector();
        return localConnector.restore(backupData, options);
    }
}

export default SSHConnector;
