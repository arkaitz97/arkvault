import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import GDriveConnector from '../../../server/connectors/gdrive.js';
import { google } from 'googleapis';
import fs from 'fs';
import { pipeline } from 'stream/promises';

vi.mock('googleapis', () => ({
    google: {
        auth: { GoogleAuth: vi.fn() },
        drive: vi.fn()
    }
}));

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
            }),
            createWriteStream: vi.fn(() => ({ on: vi.fn() })),
            createReadStream: vi.fn(),
            readFileSync: vi.fn(() => JSON.stringify({ type: 'service_account' }))
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
            on: vi.fn((event, _cb) => {
                if (event === 'close' || event === 'finish') {
                    // no-op: the connector only needs the listener registered
                }
            })
        }))
    };
});

import { EventEmitter } from 'events';

describe('GDriveConnector', () => {
    let connector;
    let driveMock;
    let originalEnv;

    beforeEach(() => {
        originalEnv = process.env.GOOGLE_API_ROOT_URL;
        delete process.env.GOOGLE_API_ROOT_URL;

        connector = new GDriveConnector();
        driveMock = {
            about: { get: vi.fn() },
            files: {
                list: vi.fn(),
                get: vi.fn(),
                create: vi.fn()
            }
        };
        google.drive.mockReturnValue(driveMock);

        vi.clearAllMocks();
    });

    afterEach(() => {
        if (originalEnv) process.env.GOOGLE_API_ROOT_URL = originalEnv;
        else delete process.env.GOOGLE_API_ROOT_URL;
    });

    it('should test connection successfully', async () => {
        driveMock.about.get.mockResolvedValue({ data: { user: { displayName: 'User' } } });

        const result = await connector.testConnection({ serviceAccountKey: '{}' });
        expect(result.success).toBe(true);
        expect(driveMock.about.get).toHaveBeenCalled();
    });

    it('should fail connection test gracefully', async () => {
        driveMock.about.get.mockRejectedValue(new Error('Auth failed'));

        const result = await connector.testConnection({ serviceAccountKey: '{}' });
        expect(result.success).toBe(false);
        expect(result.error).toBe('Auth failed');
    });

    it('should process backup correctly', async () => {
        driveMock.files.list.mockResolvedValueOnce({
            data: {
                files: [
                    { id: '1', name: 'file1.txt', mimeType: 'text/plain' },
                    { id: '2', name: 'folder1', mimeType: 'application/vnd.google-apps.folder' }
                ]
            }
        });

        driveMock.files.get.mockResolvedValue({ data: 'mock-stream' });

        const result = await connector.backup({ serviceAccountKey: '{}', folderId: 'f1' }, { compression: true });

        expect(result.isFile).toBe(true);
        expect(result.filesProcessed).toBe(1);
        expect(driveMock.files.list).toHaveBeenCalled();
        expect(driveMock.files.get).toHaveBeenCalledWith({ fileId: '1', alt: 'media' }, { responseType: 'stream' });
        expect(pipeline).toHaveBeenCalled();
    });

    it('should handle stringified serviceAccountKey', async () => {
        driveMock.about.get.mockResolvedValue({ data: {} });
        await connector.testConnection({ serviceAccountKey: '{"type":"service_account"}' });
        expect(google.auth.GoogleAuth).toHaveBeenCalledWith(expect.objectContaining({
            credentials: { type: 'service_account' }
        }));
    });

    it('should handle serviceAccountKey as file path', async () => {
        driveMock.about.get.mockResolvedValue({ data: {} });
        await connector.testConnection({ serviceAccountKey: '/path/to/creds.json' });
        expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/creds.json', 'utf8');
    });

    it('should perform upload correctly', async () => {
        driveMock.files.create.mockResolvedValue({ data: { id: 'new_file_id' } });

        const result = await connector.upload('/tmp/src.zip', 'dest.zip', { serviceAccountKey: '{}', folderId: 'root' });

        expect(result.success).toBe(true);
        expect(result.location).toBe('gdrive://new_file_id');
        expect(driveMock.files.create).toHaveBeenCalled();
    });

    it('should perform download correctly', async () => {
        driveMock.files.get.mockImplementation(async (params) => {
            if (params.fields === 'name') return { data: { name: 'dest.zip' } };
            return { data: 'mock-stream' };
        });

        const result = await connector.download('gdrive://file_123', { serviceAccountKey: '{}' });

        expect(result.isFile).toBe(true);
        expect(result.path).toContain('dest.zip');
        expect(driveMock.files.get).toHaveBeenCalledWith({ fileId: 'file_123', alt: 'media' }, { responseType: 'stream' });
    });

    it('should reject invalid generic gdrive location on download', async () => {
        await expect(connector.download('invalid://loc', {})).rejects.toThrow('Invalid Google Drive location format');
    });

    it('should use fetch API if GOOGLE_API_ROOT_URL is set', async () => {
        process.env.GOOGLE_API_ROOT_URL = 'http://localhost:9999/';

        global.fetch = vi.fn().mockResolvedValue({
            json: vi.fn().mockResolvedValue({ user: { displayName: 'Mock' } })
        });

        const result = await connector.testConnection({});
        expect(result.success).toBe(true);
        expect(global.fetch).not.toHaveBeenCalled();
        const drive = connector.getDrive({});
        await drive.files.list({});
        expect(global.fetch).toHaveBeenCalledWith('http://localhost:9999/drive/v3/files');

        global.fetch.mockResolvedValueOnce({ json: vi.fn().mockResolvedValue({ id: 'f1' }) });
        await drive.files.create({ requestBody: { name: 'test' } });
        expect(global.fetch).toHaveBeenCalledWith('http://localhost:9999/upload/drive/v3/files', expect.any(Object));
        global.fetch.mockResolvedValueOnce({ body: 'stream' });
        const res = await drive.files.get({ fileId: 'f1', alt: 'media' });
        expect(res.data).toBe('stream');
    });
});
