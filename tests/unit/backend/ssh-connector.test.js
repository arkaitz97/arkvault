import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const fakeSftp = {
    stat: vi.fn(),
    readdir: vi.fn(),
    mkdir: vi.fn(),
    fastGet: vi.fn(),
    fastPut: vi.fn()
};

let connectConfig = null;
let connectError = null;
let readyHandler = null;
let errorHandler = null;

vi.mock('ssh2', () => {
    return {
        Client: class {
            on(event, handler) {
                if (event === 'ready') readyHandler = handler;
                if (event === 'error') errorHandler = handler;
                return this;
            }
            connect(config) {
                connectConfig = config;
                if (connectError) {
                    setImmediate(() => errorHandler(new Error(connectError)));
                } else {
                    setImmediate(() => readyHandler());
                }
                return this;
            }
            sftp(cb) {
                setImmediate(() => cb(null, fakeSftp));
                return this;
            }
            end() {}
        }
    };
});

const localRestoreMock = vi.fn();

vi.mock('../../../server/connectors/local.js', () => {
    return {
        default: class {
            restore(...args) { return localRestoreMock(...args); }
        }
    };
});

import SSHConnector from '../../../server/connectors/ssh.js';

describe('SSHConnector', () => {
    let connector;
    let fixtureDir;
    const config = {
        host: 'backup.example.com',
        port: 2222,
        username: 'backup',
        authMethod: 'password',
        password: 'secret',
        remotePath: '/srv/data'
    };

    const fileEntry = (name, mtimeSeconds, size = 10) => ({
        filename: name,
        attrs: {
            isDirectory: () => false,
            isFile: () => true,
            mtime: mtimeSeconds,
            size
        }
    });

    const dirEntry = (name) => ({
        filename: name,
        attrs: {
            isDirectory: () => true,
            isFile: () => false
        }
    });

    beforeEach(() => {
        connector = new SSHConnector();
        vi.clearAllMocks();
        connectConfig = null;
        connectError = null;
        readyHandler = null;
        errorHandler = null;

        fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssh-test-'));
        fs.writeFileSync(path.join(fixtureDir, 'file1.txt'), 'hello');
        fs.writeFileSync(path.join(fixtureDir, 'file2.txt'), 'world');

        fakeSftp.stat.mockImplementation((p, cb) => cb(null, { isDirectory: () => true }));
        fakeSftp.mkdir.mockImplementation((p, cb) => cb(null));
        fakeSftp.fastGet.mockImplementation((remote, local, cb) => {
            fs.writeFileSync(local, 'remote-file-content');
            cb(null);
        });
        fakeSftp.fastPut.mockImplementation((local, remote, cb) => cb(null));
        fakeSftp.readdir.mockImplementation((p, cb) => cb(null, [fileEntry('file1.txt', 1)]));
    });

    afterEach(() => {
        fs.rmSync(fixtureDir, { recursive: true, force: true });
    });

    describe('connect', () => {
        it('should authenticate with password by default', async () => {
            await connector.testConnection(config);
            expect(connectConfig.host).toBe('backup.example.com');
            expect(connectConfig.port).toBe(2222);
            expect(connectConfig.username).toBe('backup');
            expect(connectConfig.password).toBe('secret');
            expect(connectConfig.privateKey).toBeUndefined();
        });

        it('should authenticate with private key when authMethod is privateKey', async () => {
            const keyPath = path.join(fixtureDir, 'id_test');
            fs.writeFileSync(keyPath, 'KEY-CONTENTS');

            await connector.testConnection({
                ...config,
                authMethod: 'privateKey',
                privateKeyPath: keyPath
            });

            expect(connectConfig.password).toBeUndefined();
            expect(connectConfig.privateKey).toBe('KEY-CONTENTS');
        });

        it('should default port to 22 when not set', async () => {
            await connector.testConnection({ ...config, port: undefined });
            expect(connectConfig.port).toBe(22);
        });
    });

    describe('testConnection', () => {
        it('should return success when stat succeeds', async () => {
            const result = await connector.testConnection(config);
            expect(result).toEqual({ success: true, message: 'Connection successful' });
            expect(fakeSftp.stat).toHaveBeenCalledWith('/srv/data', expect.any(Function));
        });

        it('should return failure when stat fails', async () => {
            fakeSftp.stat.mockImplementation((p, cb) => cb(new Error('No such file')));
            const result = await connector.testConnection(config);
            expect(result.success).toBe(false);
            expect(result.error).toBe('No such file');
        });

        it('should return failure when connection is refused', async () => {
            connectError = 'connect ECONNREFUSED';
            const result = await connector.testConnection(config);
            expect(result.success).toBe(false);
            expect(result.error).toContain('ECONNREFUSED');
        });
    });

    describe('backup', () => {
        it('should walk remote dir, download files, and produce a zip archive', async () => {
            fakeSftp.readdir.mockImplementation((p, cb) => {
                if (p === '/srv/data') {
                    cb(null, [fileEntry('file1.txt', 1000), dirEntry('sub')]);
                } else if (p === '/srv/data/sub') {
                    cb(null, [fileEntry('file2.txt', 2000)]);
                } else {
                    cb(null, []);
                }
            });

            const result = await connector.backup(config, { format: 'zip' });

            expect(fakeSftp.fastGet).toHaveBeenCalledTimes(2);
            expect(result.filename).toMatch(/^ssh-backup-.*\.zip$/);
            expect(result.filesProcessed).toBe(2);
            expect(result.size).toBeGreaterThan(0);
            expect(result.isFile).toBe(true);
            expect(fs.existsSync(result.data)).toBe(true);
            fs.rmSync(result.data, { force: true });
        });

        it('should skip files older than lastRun when incremental', async () => {
            fakeSftp.readdir.mockImplementation((p, cb) => {
                cb(null, [fileEntry('old.txt', 1), fileEntry('new.txt', 9999999999)]);
            });

            const result = await connector.backup(config, {
                incremental: true,
                lastRun: new Date(5000)
            });

            expect(fakeSftp.fastGet).toHaveBeenCalledTimes(1);
            expect(fakeSftp.fastGet).toHaveBeenCalledWith(
                '/srv/data/new.txt',
                expect.any(String),
                expect.any(Function)
            );
            expect(result.filesProcessed).toBe(1);
            fs.rmSync(result.data, { force: true });
        });
    });

    describe('upload', () => {
        it('should ensure remote dir exists, put file, and return ssh location', async () => {
            const sourcePath = path.join(fixtureDir, 'archive.zip');
            fs.writeFileSync(sourcePath, 'zip-data');

            const result = await connector.upload(sourcePath, 'backup.zip', {
                ...config,
                remotePath: '/srv/backups'
            });

            expect(fakeSftp.mkdir).toHaveBeenCalledWith('/srv', expect.any(Function));
            expect(fakeSftp.mkdir).toHaveBeenCalledWith('/srv/backups', expect.any(Function));
            expect(fakeSftp.fastPut).toHaveBeenCalledWith(
                sourcePath,
                '/srv/backups/backup.zip',
                expect.any(Function)
            );
            expect(result).toEqual({
                success: true,
                location: 'ssh://backup.example.com:2222/srv/backups/backup.zip'
            });
            expect(fs.existsSync(sourcePath)).toBe(false);
        });

        it('should tolerate generic FAILURE (code 4) when remote dir already exists', async () => {
            const sourcePath = path.join(fixtureDir, 'archive.zip');
            fs.writeFileSync(sourcePath, 'zip-data');
            fakeSftp.mkdir.mockImplementation((p, cb) => cb(Object.assign(new Error('Failure'), { code: 4 })));
            fakeSftp.stat.mockImplementation((p, cb) => cb(null, { isDirectory: () => true }));

            const result = await connector.upload(sourcePath, 'backup.zip', {
                ...config,
                remotePath: '/srv/backups'
            });

            expect(result.success).toBe(true);
            expect(fakeSftp.fastPut).toHaveBeenCalled();
            expect(fs.existsSync(sourcePath)).toBe(false);
        });

        it('should fail when remote dir cannot be created', async () => {
            const sourcePath = path.join(fixtureDir, 'archive.zip');
            fs.writeFileSync(sourcePath, 'zip-data');
            fakeSftp.mkdir.mockImplementation((p, cb) => cb(Object.assign(new Error('Failure'), { code: 4 })));
            fakeSftp.stat.mockImplementation((p, cb) => cb(new Error('No such file')));

            await expect(connector.upload(sourcePath, 'backup.zip', {
                ...config,
                remotePath: '/srv/backups'
            })).rejects.toThrow('Failure');
        });
    });

    describe('download', () => {
        it('should fastGet the remote file to a temp path', async () => {
            const result = await connector.download(
                'ssh://backup.example.com:2222/srv/backups/backup.zip',
                config
            );

            expect(fakeSftp.fastGet).toHaveBeenCalledWith(
                '/srv/backups/backup.zip',
                expect.stringContaining('/tmp/'),
                expect.any(Function)
            );
            expect(result.path).toContain('backup.zip');
            expect(result.isFile).toBe(true);
            fs.rmSync(result.path, { force: true });
        });

        it('should throw on invalid location format', async () => {
            await expect(connector.download('ftp://nope/file', config))
                .rejects.toThrow('Invalid SSH location format');
        });
    });

    describe('restore', () => {
        it('should delegate to LocalConnector', async () => {
            localRestoreMock.mockResolvedValue({ success: true, filesRestored: 3 });
            const backupData = { path: '/tmp/backup.zip' };
            const options = { path: '/restore/here' };

            const result = await connector.restore(backupData, options);

            expect(localRestoreMock).toHaveBeenCalledWith(backupData, options);
            expect(result).toEqual({ success: true, filesRestored: 3 });
        });
    });
});
