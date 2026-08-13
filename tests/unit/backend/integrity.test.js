import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import os from 'os';
import path from 'path';
import { checksumFile } from '../../../server/utils/crypto.js';

const CONTENT = Buffer.from('arkvault-integrity');

describe('checksumFile', () => {
    let tmpDir;
    let filePath;
    let otherPath;

    beforeAll(async () => {
        tmpDir = await mkdtemp(path.join(os.tmpdir(), 'arkvault-checksum-'));
        filePath = path.join(tmpDir, 'backup.zip');
        otherPath = path.join(tmpDir, 'other.zip');
        await writeFile(filePath, CONTENT);
        await writeFile(otherPath, Buffer.from('different-content'));
    });

    afterAll(async () => {
        await rm(tmpDir, { recursive: true, force: true });
    });

    it('returns a 64-character hex string', async () => {
        const hash = await checksumFile(filePath);
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('same content yields the same hash', async () => {
        const hash1 = await checksumFile(filePath);
        const hash2 = await checksumFile(filePath);
        expect(hash1).toBe(hash2);
    });

    it('different content yields a different hash', async () => {
        const hash1 = await checksumFile(filePath);
        const hash2 = await checksumFile(otherPath);
        expect(hash1).not.toBe(hash2);
    });
});
