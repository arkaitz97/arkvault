import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
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
                // If it's a file path
                credentials = JSON.parse(fs.readFileSync(config.serviceAccountKey, 'utf8'));
            }
        } else {
            credentials = config.serviceAccountKey;
        }

        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/drive']
        });

        return auth;
    }

    async testConnection(config) {
        try {
            const auth = this.getAuth(config);
            const drive = google.drive({ version: 'v3', auth });

            // Try to access the folder
            if (config.folderId) {
                await drive.files.get({ fileId: config.folderId });
            } else {
                // List root to verify access
                await drive.files.list({ pageSize: 1 });
            }

            return { success: true, message: 'Connection successful' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async backup(config, options = {}) {
        const auth = this.getAuth(config);
        const drive = google.drive({ version: 'v3', auth });

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `gdrive-backup-${timestamp}.zip`;
        const tempPath = path.join('/tmp', filename);
        const tempDir = path.join('/tmp', `gdrive-download-${timestamp}`);

        await mkdir(tempDir, { recursive: true });

        // Download all files from folder
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
                    // Skip folders for now (could implement recursive download)
                    continue;
                }

                // Download file
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

        // Create zip archive
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

        // Cleanup temp dir
        await rm(tempDir, { recursive: true, force: true });

        const archiveStats = await stat(tempPath);

        return {
            data: tempPath,
            filename,
            size: archiveStats.size,
            filesProcessed: fileCount,
            isFile: true
        };
    }

    async upload(sourcePath, filename, config) {
        const auth = this.getAuth(config);
        const drive = google.drive({ version: 'v3', auth });

        const fileMetadata = {
            name: filename,
            parents: config.folderId ? [config.folderId] : []
        };

        const fileStats = await stat(sourcePath);
        const media = {
            mimeType: 'application/zip',
            body: createReadStream(sourcePath)
        };

        const response = await drive.files.create({
            resource: fileMetadata,
            media,
            fields: 'id, webViewLink'
        });

        // Clean up temp file
        await rm(sourcePath, { force: true });

        return {
            success: true,
            location: `gdrive://${response.data.id}`,
            webLink: response.data.webViewLink
        };
    }

    async download(location, config) {
        const auth = this.getAuth(config);
        const drive = google.drive({ version: 'v3', auth });

        // Parse location: gdrive://fileId
        const match = location.match(/^gdrive:\/\/(.+)$/);
        if (!match) {
            throw new Error('Invalid Google Drive location format');
        }

        const fileId = match[1];

        // Get file metadata for filename
        const fileMeta = await drive.files.get({ fileId, fields: 'name' });
        const tempPath = path.join('/tmp', fileMeta.data.name);

        // Download file
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
