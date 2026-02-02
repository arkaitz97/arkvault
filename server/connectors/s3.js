import {
    S3Client,
    HeadBucketCommand,
    PutObjectCommand,
    GetObjectCommand,
    ListObjectsV2Command
} from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import archiver from 'archiver';
import { promisify } from 'util';

const stat = promisify(fs.stat);
const readdir = promisify(fs.readdir);
const mkdir = promisify(fs.mkdir);
const rm = promisify(fs.rm);

class S3Connector {
    getClient(config) {
        const clientConfig = {
            region: config.region || 'us-east-1',
            credentials: {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey
            }
        };

        // Support custom S3-compatible endpoints (MinIO, Wasabi, etc.)
        if (config.endpoint) {
            clientConfig.endpoint = config.endpoint;
            clientConfig.forcePathStyle = config.forcePathStyle !== false; // Default to true for compatibility
        }

        return new S3Client(clientConfig);
    }

    async testConnection(config) {
        try {
            const client = this.getClient(config);
            await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
            return { success: true, message: 'Connection successful' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async backup(config, options = {}) {
        // Download from S3 and create a local archive
        const client = this.getClient(config);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `s3-backup-${timestamp}.zip`;
        const tempPath = path.join('/tmp', filename);
        const tempDir = path.join('/tmp', `s3-download-${timestamp}`);

        await mkdir(tempDir, { recursive: true });

        // List and download objects
        let continuationToken = undefined;
        let fileCount = 0;
        const prefix = config.prefix || '';

        do {
            const listCommand = new ListObjectsV2Command({
                Bucket: config.bucket,
                Prefix: prefix,
                ContinuationToken: continuationToken
            });
            const response = await client.send(listCommand);

            for (const object of response.Contents || []) {
                const getCommand = new GetObjectCommand({
                    Bucket: config.bucket,
                    Key: object.Key
                });
                const data = await client.send(getCommand);

                const localPath = path.join(tempDir, object.Key.replace(prefix, ''));
                await mkdir(path.dirname(localPath), { recursive: true });

                const writeStream = createWriteStream(localPath);
                await pipeline(data.Body, writeStream);
                fileCount++;
            }

            continuationToken = response.NextContinuationToken;
        } while (continuationToken);

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

        // Cleanup temp download dir
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
        const client = this.getClient(config);
        const key = path.join(config.prefix || '', filename);

        const fileStream = createReadStream(sourcePath);
        const fileStats = await stat(sourcePath);

        await client.send(new PutObjectCommand({
            Bucket: config.bucket,
            Key: key,
            Body: fileStream,
            ContentLength: fileStats.size
        }));

        // Clean up temp file
        await rm(sourcePath, { force: true });

        return {
            success: true,
            location: `s3://${config.bucket}/${key}`
        };
    }

    async download(location, config) {
        const client = this.getClient(config);

        // Parse location: s3://bucket/key
        const match = location.match(/^s3:\/\/([^/]+)\/(.+)$/);
        if (!match) {
            throw new Error('Invalid S3 location format');
        }

        const [, bucket, key] = match;
        const tempPath = path.join('/tmp', path.basename(key));

        const response = await client.send(new GetObjectCommand({
            Bucket: bucket,
            Key: key
        }));

        const writeStream = createWriteStream(tempPath);
        await pipeline(response.Body, writeStream);

        return {
            path: tempPath,
            isFile: true
        };
    }

    async restore(backupData, options) {
        // For S3 as source, we just need to extract the downloaded backup
        const LocalConnector = (await import('./local.js')).default;
        const localConnector = new LocalConnector();
        return localConnector.restore(backupData, options);
    }
}

export default S3Connector;
