import { google } from 'googleapis';
import logger from '../logger.js';
import fs from 'fs';
import path from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import archiver from 'archiver';
import { promisify } from 'util';

const stat = promisify(fs.stat);
const mkdir = promisify(fs.mkdir);
const rm = promisify(fs.rm);


class GDriveConnector {
    getAuth(config) {
        let credentials;

        if (typeof config.serviceAccountKey === 'string') {
            try {
                credentials = JSON.parse(config.serviceAccountKey);
            } catch {
                credentials = JSON.parse(fs.readFileSync(config.serviceAccountKey, 'utf8'));
            }
        } else {
            credentials = config.serviceAccountKey;
        }

        const authOptions = {
            credentials,
            scopes: ['https://www.googleapis.com/auth/drive']
        };

        // Allow overriding the root URL for testing
        if (process.env.GOOGLE_API_ROOT_URL) {
            authOptions.clientOptions = {
                rootUrl: process.env.GOOGLE_API_ROOT_URL
            };
        }

        const auth = new google.auth.GoogleAuth(authOptions);

        return auth;
    }

    getDrive(config) {
        if (process.env.GOOGLE_API_ROOT_URL) {
            logger.info({ rootUrl: process.env.GOOGLE_API_ROOT_URL }, 'GDriveConnector using mock API root');
            // Return a mock-compatible drive object that doesn't trigger real OAuth signing
            return {
                about: {
                    get: async () => ({ data: { user: { displayName: 'Mock User' } } })
                },
                files: {
                    list: async (_params) => {
                        const response = await fetch(`${process.env.GOOGLE_API_ROOT_URL}drive/v3/files`);
                        return { data: await response.json() };
                    },
                    get: async (params) => {
                        const { fileId, alt } = params;
                        const url = `${process.env.GOOGLE_API_ROOT_URL}drive/v3/files/${fileId}${alt === 'media' ? '?alt=media' : ''}`;
                        const response = await fetch(url);
                        if (alt === 'media') {
                            return { data: response.body };
                        }
                        return { data: await response.json() };
                    },
                    create: async (params) => {
                        const { requestBody, media } = params;
                        const formData = new FormData();
                        formData.append('metadata', JSON.stringify(requestBody));

                        if (media && media.body) {
                            const chunks = [];
                            for await (const chunk of media.body) {
                                chunks.push(chunk);
                            }
                            const buffer = Buffer.concat(chunks);
                            formData.append('body', new Blob([buffer]), requestBody.name || 'upload.bin');
                        }

                        const response = await fetch(`${process.env.GOOGLE_API_ROOT_URL}upload/drive/v3/files`, {
                            method: 'POST',
                            body: formData
                        });
                        const data = await response.json();
                        return { data };
                    }
                }
            };
        }

        const auth = this.getAuth(config);
        const driveOptions = { version: 'v3', auth };
        return google.drive(driveOptions);
    }

    async testConnection(config) {
        logger.info('Testing Google Drive connection');
        try {
            const drive = this.getDrive(config);
            await drive.about.get({ fields: 'user' });
            logger.info('Google Drive connection test successful');
            return { success: true, message: 'Connection successful' };
        } catch (error) {
            logger.error({ err: error }, 'Google Drive connection test failed');
            return { success: false, error: error.message };
        }
    }

    async backup(config, options = {}) {
        const drive = this.getDrive(config);

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `gdrive-backup-${timestamp}.zip`;
        const tempPath = path.join('/tmp', filename);
        const tempDir = path.join('/tmp', `gdrive-download-${timestamp}`);

        logger.info({ folderId: config.folderId, tempPath }, 'Starting Google Drive backup');
        const start = Date.now();

        await mkdir(tempDir, { recursive: true });

        let fileCount = 0;
        let pageToken = undefined;
        const folderId = config.folderId || 'root';
        const query = `'${folderId}' in parents and trashed = false`;

        do {
            const response = await drive.files.list({
                q: query,
                pageSize: 100,
                pageToken,
                fields: 'nextPageToken, files(id, name, mimeType)'
            });

            for (const file of response.data.files || []) {
                if (file.mimeType === 'application/vnd.google-apps.folder') {
                    continue;
                }

                const destPath = path.join(tempDir, file.name);
                const dest = createWriteStream(destPath);

                const fileResponse = await drive.files.get(
                    { fileId: file.id, alt: 'media' },
                    { responseType: 'stream' }
                );

                await pipeline(fileResponse.data, dest);
                fileCount++;
            }

            pageToken = response.data.nextPageToken;
        } while (pageToken);

        await new Promise((resolve, reject) => {
            const output = createWriteStream(tempPath);
            const archive = archiver('zip', {
                zlib: { level: options.compression ? 9 : 0 }
            });

            output.on('close', resolve);
            archive.on('error', reject);

            archive.pipe(output);
            archive.directory(tempDir, false);
            archive.finalize();
        });

        await rm(tempDir, { recursive: true, force: true });

        const archiveStats = await stat(tempPath);
        const duration = Date.now() - start;

        logger.info({
            filename,
            size: archiveStats.size,
            filesProcessed: fileCount,
            durationMs: duration
        }, 'Google Drive backup completed');

        return {
            data: tempPath,
            filename,
            size: archiveStats.size,
            filesProcessed: fileCount,
            isFile: true
        };
    }

    async upload(sourcePath, filename, config) {
        logger.info({ folderId: config.folderId, filename }, 'Starting Google Drive upload');
        const drive = this.getDrive(config);

        const response = await drive.files.create({
            requestBody: {
                name: filename,
                parents: config.folderId ? [config.folderId] : []
            },
            media: {
                mimeType: 'application/octet-stream',
                body: fs.createReadStream(sourcePath)
            }
        });

        await rm(sourcePath, { force: true });

        logger.info({ fileId: response.data.id, filename }, 'Google Drive upload completed');
        return {
            success: true,
            location: `gdrive://${response.data.id}`
        };
    }

    async download(location, config) {
        const drive = this.getDrive(config);

        const match = location.match(/^gdrive:\/\/(.+)$/);
        if (!match) {
            throw new Error('Invalid Google Drive location format');
        }

        const fileId = match[1];

        const fileMeta = await drive.files.get({ fileId, fields: 'name' });
        const tempPath = path.join('/tmp', fileMeta.data.name);

        const dest = createWriteStream(tempPath);
        const response = await drive.files.get(
            { fileId, alt: 'media' },
            { responseType: 'stream' }
        );

        await pipeline(response.data, dest);

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

export default GDriveConnector;
