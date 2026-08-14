import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import archiver from 'archiver';
import { createWriteStream } from 'fs';
import { isTarArchive, listZipEntries, extractZipEntries } from '../../../server/utils/archive.js';
import LocalConnector from '../../../server/connectors/local.js';

function createTarGz(filePath, sourceDir) {
    return new Promise((resolve, reject) => {
        const output = createWriteStream(filePath);
        const archive = archiver('tar', { gzip: true });
        output.on('close', resolve);
        archive.on('error', reject);
        archive.pipe(output);
        archive.directory(sourceDir, false);
        archive.finalize();
    });
}

describe('tar archive support', () => {
    let workDir;
    let sourceDir;
    let tarPath;

    beforeEach(async () => {
        workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tar-test-'));
        sourceDir = path.join(workDir, 'src');
        fs.mkdirSync(path.join(sourceDir, 'sub'), { recursive: true });
        fs.writeFileSync(path.join(sourceDir, 'a.txt'), 'aaa');
        fs.writeFileSync(path.join(sourceDir, 'sub', 'b.txt'), 'bbb');

        tarPath = path.join(workDir, 'backup-1.tar.gz');
        await createTarGz(tarPath, sourceDir);
    });

    afterEach(() => {
        fs.rmSync(workDir, { recursive: true, force: true });
    });

    it('should detect tar.gz by magic bytes even without extension', async () => {
        const renamed = path.join(workDir, 'blob.dec');
        fs.copyFileSync(tarPath, renamed);
        expect(await isTarArchive(renamed)).toBe(true);
        expect(await isTarArchive(tarPath)).toBe(true);
    });

    it('should list entries of a tar.gz archive', async () => {
        const entries = await listZipEntries(tarPath);
        expect(entries.map((e) => e.path)).toEqual(expect.arrayContaining(['a.txt', 'sub/b.txt']));
        expect(entries.find((e) => e.path === 'a.txt').size).toBe(3);
    });

    it('should extract a subset of tar.gz entries', async () => {
        const dest = path.join(workDir, 'out');
        const result = await extractZipEntries(tarPath, ['sub/b.txt'], dest);
        expect(result.filesRestored).toBe(1);
        expect(fs.readFileSync(path.join(dest, 'sub', 'b.txt'), 'utf8')).toBe('bbb');
        expect(fs.existsSync(path.join(dest, 'a.txt'))).toBe(false);
    });

    it('should restore a tar.gz archive via local connector', async () => {
        const dest = path.join(workDir, 'restore');
        const connector = new LocalConnector();
        const result = await connector.restore({ path: tarPath }, { path: dest });
        expect(result.success).toBe(true);
        expect(result.filesRestored).toBe(2);
        expect(fs.readFileSync(path.join(dest, 'a.txt'), 'utf8')).toBe('aaa');
        expect(fs.readFileSync(path.join(dest, 'sub', 'b.txt'), 'utf8')).toBe('bbb');
    });
});
