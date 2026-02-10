import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import LocalConnector from '../../../server/connectors/local.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('LocalConnector', () => {
    const connector = new LocalConnector();
    let testDir;
    let testBackupDir;

    beforeEach(async () => {
        testDir = path.join(os.tmpdir(), `backup-test-source-${Date.now()}`);
        testBackupDir = path.join(os.tmpdir(), `backup-test-dest-${Date.now()}`);
        await fs.mkdir(testDir, { recursive: true });
        await fs.mkdir(testBackupDir, { recursive: true });

        await fs.writeFile(path.join(testDir, 'test1.txt'), 'Hello World');
        await fs.writeFile(path.join(testDir, 'test2.txt'), 'Test content');
        await fs.mkdir(path.join(testDir, 'subdir'), { recursive: true });
        await fs.writeFile(path.join(testDir, 'subdir', 'nested.txt'), 'Nested file');
    });

    afterEach(async () => {
        try {
            await fs.rm(testDir, { recursive: true, force: true });
            await fs.rm(testBackupDir, { recursive: true, force: true });
        } catch {
        }
    });

    describe('testConnection', () => {
        it('should succeed for valid directory', async () => {
            const result = await connector.testConnection({ path: testDir });
            expect(result.success).toBe(true);
        });

        it('should resolve relative paths', async () => {
            const relativeName = `relative-test-${Date.now()}`;
            await fs.mkdir(path.join(process.cwd(), relativeName), { recursive: true });

            try {
                const result = await connector.testConnection({ path: relativeName });
                expect(result.success).toBe(true);
            } finally {
                await fs.rm(path.join(process.cwd(), relativeName), { recursive: true, force: true });
            }
        });

        it('should expand home directory (~)', async () => {
            const homeDir = os.homedir();

            const fakeHome = path.join(os.tmpdir(), `fake-home-${Date.now()}`);
            await fs.mkdir(fakeHome, { recursive: true });

            const originalHomedir = os.homedir;
            os.homedir = () => fakeHome;

            try {
                const result = await connector.testConnection({ path: '~/.' });
                expect(result.success).toBe(true);
            } finally {
                os.homedir = originalHomedir;
                await fs.rm(fakeHome, { recursive: true, force: true });
            }
        });

        it('should fail for non-existent directory', async () => {
            const result = await connector.testConnection({ path: '/nonexistent/path/12345' });
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe('backup', () => {
        it('should create a backup archive', async () => {
            const result = await connector.backup({ path: testDir }, { compression: true });

            expect(result).toBeDefined();
            expect(typeof result.data).toBe('string');
            expect(result.size).toBeGreaterThan(0);
            expect(result.filesProcessed).toBeGreaterThan(0);
            expect(result.filename).toContain('.zip');
        });

        it('should include all files in backup', async () => {
            const result = await connector.backup({ path: testDir }, { compression: true });

            expect(result.filesProcessed).toBeGreaterThanOrEqual(3);
        });
    });

    describe('upload', () => {
        it('should save file to destination path', async () => {
            const testFilePath = path.join(testDir, 'test-upload.zip');
            await fs.writeFile(testFilePath, 'test backup data');
            const filename = 'test-backup.zip';

            const result = await connector.upload(testFilePath, filename, { path: testBackupDir });

            expect(result.success).toBe(true);
            expect(result.location).toContain(filename);

            const exists = await fs.access(result.location).then(() => true).catch(() => false);
            expect(exists).toBe(true);
        });
    });

    describe('download', () => {
        it('should return file location information', async () => {
            const testFilePath = path.join(testBackupDir, 'test-download.zip');
            await fs.writeFile(testFilePath, 'test backup data');

            const downloadedData = await connector.download(testFilePath, {});

            expect(downloadedData).toBeDefined();
            expect(downloadedData.path).toBe(testFilePath);
            expect(downloadedData.isFile).toBe(true);
        });
    });
});
