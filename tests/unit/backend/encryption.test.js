import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, writeFile, readFile, rm, access } from 'fs/promises';
import os from 'os';
import path from 'path';
import { encryptFile, decryptFile } from '../../../server/utils/crypto.js';

const ORIGINAL = Buffer.from('arkvault-encryption-roundtrip-test');

describe('AES-256-GCM file encryption', () => {
    let tmpDir;
    let filePath;

    beforeAll(async () => {
        tmpDir = await mkdtemp(path.join(os.tmpdir(), 'arkvault-enc-'));
        filePath = path.join(tmpDir, 'backup.zip');
        await writeFile(filePath, ORIGINAL);
    });

    afterAll(async () => {
        await rm(tmpDir, { recursive: true, force: true });
    });

    it('encrypts, removes original, decrypts back to identical bytes', async () => {
        const encPath = await encryptFile(filePath);
        expect(encPath).toBe(`${filePath}.enc`);

        await expect(access(filePath)).rejects.toThrow();

        const encBytes = await readFile(encPath);
        expect(encBytes.equals(ORIGINAL)).toBe(false);

        const decPath = await decryptFile(encPath);
        expect(decPath).toBe(`${encPath}.dec`);

        await expect(access(encPath)).rejects.toThrow();

        const decBytes = await readFile(decPath);
        expect(decBytes.equals(ORIGINAL)).toBe(true);
    });
});
