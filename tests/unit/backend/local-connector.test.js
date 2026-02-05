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
        // Create temporary test directories
        testDir = path.join(os.tmpdir(), `backup-test-source-${Date.now()}`);
        testBackupDir = path.join(os.tmpdir(), `backup-test-dest-${Date.now()}`);
        await fs.mkdir(testDir, { recursive: true });
        await fs.mkdir(testBackupDir, { recursive: true });

        // Create some test files
        await fs.writeFile(path.join(testDir, 'test1.txt'), 'Hello World');
        await fs.writeFile(path.join(testDir, 'test2.txt'), 'Test content');
        await fs.mkdir(path.join(testDir, 'subdir'), { recursive: true });
        await fs.writeFile(path.join(testDir, 'subdir', 'nested.txt'), 'Nested file');
    });

    afterEach(async () => {
        // Cleanup test directories
        try {
            await fs.rm(testDir, { recursive: true, force: true });
            await fs.rm(testBackupDir, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    describe('testConnection', () => {
        it('should succeed for valid directory', async () => {
            const result = await connector.testConnection({ path: testDir });
            expect(result.success).toBe(true);
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
            // LocalConnector returns the file path as `data`, not a Buffer
            expect(typeof result.data).toBe('string');
            expect(result.size).toBeGreaterThan(0);
            expect(result.filesProcessed).toBeGreaterThan(0);
            expect(result.filename).toContain('.zip');
        });

        it('should include all files in backup', async () => {
            const result = await connector.backup({ path: testDir }, { compression: true });

            // Should have processed at least 3 files (test1.txt, test2.txt, nested.txt)
            expect(result.filesProcessed).toBeGreaterThanOrEqual(3);
        });
    });

    describe('upload', () => {
        it('should save file to destination path', async () => {
            // First create a test file to upload
            const testFilePath = path.join(testDir, 'test-upload.zip');
            await fs.writeFile(testFilePath, 'test backup data');
            const filename = 'test-backup.zip';

            // LocalConnector.upload expects a file path, not a Buffer
            const result = await connector.upload(testFilePath, filename, { path: testBackupDir });

            expect(result.success).toBe(true);
            expect(result.location).toContain(filename);

            // Verify file was created
            const exists = await fs.access(result.location).then(() => true).catch(() => false);
            expect(exists).toBe(true);
        });
    });

    describe('download', () => {
        it('should return file location information', async () => {
            // Create a test file directly
            const testFilePath = path.join(testBackupDir, 'test-download.zip');
            await fs.writeFile(testFilePath, 'test backup data');

            // Download returns file location info, not the actual data
            const downloadedData = await connector.download(testFilePath, {});

            expect(downloadedData).toBeDefined();
            expect(downloadedData.path).toBe(testFilePath);
            expect(downloadedData.isFile).toBe(true);
        });
    });
});
