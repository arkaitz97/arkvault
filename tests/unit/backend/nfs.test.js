
import { describe, it, expect, vi, beforeEach } from 'vitest';

const execMock = vi.fn();

// Mock child_process
vi.mock('child_process', () => {
    return {
        exec: (cmd, options, callback) => {
            if (typeof options === 'function') {
                callback = options;
                options = {};
            }
            if (execMock) {
                execMock(cmd, callback);
            } else if (callback) {
                // Default fallback
                callback(null, { stdout: '', stderr: '' });
            }
            return {};
        }
    };
});

// Mock fs
const mkdirMock = vi.fn();
const rmMock = vi.fn();
vi.mock('fs', async () => {
    return {
        default: {
            mkdir: (path, options, cb) => {
                if (typeof options === 'function') { cb = options; options = {}; }
                mkdirMock(path, options);
                if (cb) cb(null);
            },
            rm: (path, options, cb) => {
                if (typeof options === 'function') { cb = options; options = {}; }
                rmMock(path, options);
                if (cb) cb(null);
            },
            stat: (path, cb) => { if (cb) cb(null, { isDirectory: () => true }); }
        }
    };
});

// Mock LocalConnector
const localBackupMock = vi.fn();
const localRestoreMock = vi.fn();
const localUploadMock = vi.fn();

vi.mock('../../../server/connectors/local.js', () => {
    return {
        default: class {
            backup(...args) { return localBackupMock(...args); }
            restore(...args) { return localRestoreMock(...args); }
            upload(...args) { return localUploadMock(...args); }
        }
    };
});

import NFSConnector from '../../../server/connectors/nfs.js';

describe('NFSConnector', () => {
    let connector;
    const config = {
        host: '192.168.1.100',
        path: '/mnt/backup',
        mountOptions: 'rw,soft'
    };

    const getMountPoint = (conf) => {
        const hash = Buffer.from(`${conf.host}:${conf.path}`).toString('base64').replace(/[/+=]/g, '').slice(0, 12);
        return `/tmp/nfs-mount-${hash}`;
    };

    beforeEach(() => {
        connector = new NFSConnector();
        vi.clearAllMocks();
        mkdirMock.mockResolvedValue(undefined);
        rmMock.mockResolvedValue(undefined);

        // Default exec mock
        execMock.mockImplementation((cmd, cb) => {
            if (!cb || typeof cb !== 'function') return;

            // Note: Since we are mocking exec and passing it to util.promisify, 
            // but NOT using the native child_process.exec identity, 
            // util.promisify treats it as a generic callback function (err, value).
            // It expects 'value' to be the result.
            // So we must pass { stdout, stderr } as the second argument, NOT as 2nd and 3rd args.

            if (cmd.includes('mount | grep')) {
                cb(null, { stdout: '', stderr: '' }); // Not mounted
            } else if (cmd.includes('sudo mount')) {
                cb(null, { stdout: '', stderr: '' }); // Mount success
            } else if (cmd.includes('sudo umount')) {
                cb(null, { stdout: '', stderr: '' }); // Unmount success
            } else if (cmd.includes('ls "')) {
                cb(null, { stdout: 'file1\nfile2', stderr: '' }); // ls success
            } else {
                cb(null, { stdout: '', stderr: '' });
            }
        });
    });

    describe('getMountPoint', () => {
        it('should generate a consistent mount point hash', () => {
            const mp1 = connector.getMountPoint(config);
            const mp2 = connector.getMountPoint(config);
            expect(mp1).toBe(mp2);
            expect(mp1).toMatch(/^\/tmp\/nfs-mount-/);
        });
    });

    describe('mount', () => {
        it('should mount if not already mounted', async () => {
            await connector.mount(config);

            const mountPoint = getMountPoint(config);
            expect(mkdirMock).toHaveBeenCalled();
            expect(execMock).toHaveBeenCalledWith(
                expect.stringContaining(`grep "${mountPoint}"`),
                expect.any(Function)
            );
            expect(execMock).toHaveBeenCalledWith(
                expect.stringContaining(`sudo mount -t nfs -o rw,soft "192.168.1.100:/mnt/backup" "${mountPoint}"`),
                expect.any(Function)
            );
        });

        it('should skip mount if already mounted', async () => {
            const mountPoint = getMountPoint(config);
            execMock.mockImplementation((cmd, cb) => {
                if (cmd.includes('grep')) {
                    cb(null, { stdout: `${mountPoint} on ...`, stderr: '' });
                } else {
                    cb(null, { stdout: '', stderr: '' });
                }
            });

            await connector.mount(config);

            expect(execMock).toHaveBeenCalledWith(
                expect.stringContaining('grep'),
                expect.any(Function)
            );
            expect(execMock).not.toHaveBeenCalledWith(
                expect.stringContaining('sudo mount'),
                expect.any(Function)
            );
        });

        it('should throw error if mount fails', async () => {
            execMock.mockImplementation((cmd, cb) => {
                if (cmd.includes('grep')) {
                    cb(null, { stdout: '', stderr: '' });
                } else if (cmd.includes('sudo mount')) {
                    cb(new Error('Permission denied'), { stdout: '', stderr: 'stderr error' });
                }
            });

            await expect(connector.mount(config)).rejects.toThrow('Failed to mount NFS share');
        });
    });

    describe('unmount', () => {
        it('should unmount and remove directory', async () => {
            await connector.unmount(config);

            expect(execMock).toHaveBeenCalledWith(
                expect.stringContaining('sudo umount'),
                expect.any(Function)
            );
            expect(rmMock).toHaveBeenCalled();
        });

        it('should ignore errors during unmount', async () => {
            execMock.mockImplementation((cmd, cb) => {
                if (cmd.includes('umount')) cb(new Error('Busy'), { stdout: '', stderr: '' });
                else cb(null, { stdout: '', stderr: '' });
            });

            await expect(connector.unmount(config)).resolves.not.toThrow();
        });
    });

    describe('testConnection', () => {
        it('should return success if mount and ls work', async () => {
            const result = await connector.testConnection(config);
            expect(result).toEqual({ success: true, message: 'Connection successful' });
        });

        it('should return failure if mount fails', async () => {
            execMock.mockImplementation((cmd, cb) => {
                if (cmd.includes('sudo mount')) cb(new Error('Fail'), { stdout: '', stderr: '' });
                else cb(null, { stdout: '', stderr: '' });
            });
            const result = await connector.testConnection(config);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Failed to mount');
        });
    });

    describe('backup', () => {
        it('should mount and delegate to LocalConnector', async () => {
            localBackupMock.mockResolvedValue({ some: 'result' });

            const result = await connector.backup(config, { incremental: true });

            expect(execMock).toHaveBeenCalledWith(
                expect.stringContaining('sudo mount'),
                expect.any(Function)
            );

            const mountPoint = getMountPoint(config);
            expect(localBackupMock).toHaveBeenCalledWith(
                { path: mountPoint },
                { incremental: true }
            );
            expect(result).toEqual({ some: 'result' });
        });
    });

    describe('restore', () => {
        it('should delegate to LocalConnector', async () => {
            localRestoreMock.mockResolvedValue({ success: true });
            const backupData = { path: '/tmp/backup.zip' };
            const options = { path: '/restore/here' };

            const result = await connector.restore(backupData, options);

            expect(localRestoreMock).toHaveBeenCalledWith(backupData, options);
            expect(result).toEqual({ success: true });
        });
    });
});
