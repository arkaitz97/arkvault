import { describe, it, expect, vi, beforeEach } from 'vitest';
import S3Connector from '../../../server/connectors/s3.js';
import { S3Client, HeadBucketCommand, PutObjectCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { pipeline } from 'stream/promises';

vi.mock('@aws-sdk/client-s3', () => {
    return {
        S3Client: vi.fn(),
        HeadBucketCommand: vi.fn(function (opts) { return opts; }),
        PutObjectCommand: vi.fn(function (opts) { return opts; }),
        GetObjectCommand: vi.fn(function (opts) { return opts; }),
        ListObjectsV2Command: vi.fn(function (opts) { return opts; })
    };
});

vi.mock('fs', () => {
    return {
        default: {
            stat: vi.fn((path, cb) => cb(null, { size: 1024 })),
            mkdir: vi.fn((path, opts, cb) => {
                if (typeof opts === 'function') opts(null);
                else cb(null);
            }),
            rm: vi.fn((path, opts, cb) => {
                if (typeof opts === 'function') opts(null);
                else cb(null);
            })
        },
        createWriteStream: vi.fn(() => {
            const stream = new (require('events').EventEmitter)();
            stream.pipe = vi.fn();
            setTimeout(() => stream.emit('close'), 10);
            return stream;
        }),
        createReadStream: vi.fn()
    };
});

vi.mock('stream/promises', () => ({
    pipeline: vi.fn()
}));

vi.mock('archiver', () => {
    return {
        default: vi.fn(() => ({
            pipe: vi.fn(),
            directory: vi.fn(),
            finalize: vi.fn(),
            on: vi.fn()
        }))
    };
});

describe('S3Connector', () => {
    let connector;
    let mockSend;

    beforeEach(() => {
        connector = new S3Connector();
        mockSend = vi.fn();
        S3Client.mockImplementation(function () {
            return { send: mockSend };
        });
        vi.clearAllMocks();
    });

    it('should test connection successfully', async () => {
        mockSend.mockResolvedValue({});
        const res = await connector.testConnection({ bucket: 'mybucket', accessKeyId: '123', secretAccessKey: '456' });
        expect(res.success).toBe(true);
        expect(mockSend).toHaveBeenCalled();
        expect(HeadBucketCommand).toHaveBeenCalledWith({ Bucket: 'mybucket' });
    });

    it('should fail connection test gracefully', async () => {
        mockSend.mockRejectedValue(new Error('Auth failed'));
        const res = await connector.testConnection({ bucket: 'mybucket' });
        expect(res.success).toBe(false);
        expect(res.error).toBe('Auth failed');
    });

    it('should configure endpoint properly', async () => {
        connector.getClient({ endpoint: 'http://minio:9000', forcePathStyle: false, accessKeyId: '1', secretAccessKey: '2' });
        expect(S3Client).toHaveBeenCalledWith(expect.objectContaining({
            endpoint: 'http://minio:9000',
            forcePathStyle: false
        }));
    });

    it('should default forcePathStyle to true if endpoint is set', async () => {
        connector.getClient({ endpoint: 'http://minio:9000', accessKeyId: '1', secretAccessKey: '2' });
        expect(S3Client).toHaveBeenCalledWith(expect.objectContaining({
            endpoint: 'http://minio:9000',
            forcePathStyle: true
        }));
    });

    it('should process backup correctly', async () => {
        mockSend.mockResolvedValueOnce({
            Contents: [
                { Key: 'backup/file1.txt' }
            ]
        });
        mockSend.mockResolvedValueOnce({
            Body: 'mock-stream'
        });

        const res = await connector.backup({ bucket: 'mybucket', prefix: 'backup/' }, { compression: true });

        expect(res.isFile).toBe(true);
        expect(res.filesProcessed).toBe(1);
        expect(ListObjectsV2Command).toHaveBeenCalledWith({ Bucket: 'mybucket', Prefix: 'backup/', ContinuationToken: undefined });
        expect(GetObjectCommand).toHaveBeenCalledWith({ Bucket: 'mybucket', Key: 'backup/file1.txt' });
        expect(pipeline).toHaveBeenCalled();
    });

    it('should perform upload correctly', async () => {
        const res = await connector.upload('/tmp/src.zip', 'dest.zip', { bucket: 'mybucket', prefix: 'backups/' });

        expect(res.success).toBe(true);
        expect(res.location).toBe('s3://mybucket/backups/dest.zip');
        expect(PutObjectCommand).toHaveBeenCalled();
        expect(mockSend).toHaveBeenCalled();
    });

    it('should perform download correctly', async () => {
        mockSend.mockResolvedValue({ Body: 'mock-stream' });
        const res = await connector.download('s3://mybucket/backups/dest.zip', {});

        expect(res.isFile).toBe(true);
        expect(res.path).toContain('dest.zip');
        expect(GetObjectCommand).toHaveBeenCalledWith({ Bucket: 'mybucket', Key: 'backups/dest.zip' });
        expect(pipeline).toHaveBeenCalled();
    });

    it('should reject invalid s3 location on download', async () => {
        await expect(connector.download('invalid://loc', {})).rejects.toThrow('Invalid S3 location format');
    });
});
