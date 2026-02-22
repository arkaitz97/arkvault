import { describe, it, expect, vi, beforeEach } from 'vitest';
import PostgreSQLConnector from '../../../server/connectors/postgresql.js';
import { exec } from 'child_process';
import fs from 'fs';

vi.mock('child_process', () => ({
    exec: vi.fn()
}));

vi.mock('fs', () => ({
    default: {
        stat: vi.fn(),
        rm: vi.fn()
    }
}));

describe('PostgreSQLConnector', () => {
    let connector;

    beforeEach(() => {
        connector = new PostgreSQLConnector();
        vi.clearAllMocks();
    });

    describe('testConnection', () => {
        it('should pass if psql succeeds', async () => {
            exec.mockImplementation((cmd, opts, cb) => cb(null, { stdout: '' }));
            const res = await connector.testConnection({ database: 'test' });
            expect(res.success).toBe(true);
            expect(exec).toHaveBeenCalledWith(expect.stringContaining('psql -c "SELECT 1"'), expect.any(Object), expect.any(Function));
        });

        it('should fallback to pg_isready if psql fails', async () => {
            exec.mockImplementation((cmd, opts, cb) => {
                if (cmd.includes('psql')) cb(new Error('psql not found'));
                else cb(null, { stdout: '' });
            });
            const res = await connector.testConnection({ database: 'test' });
            expect(res.success).toBe(true);
            expect(exec).toHaveBeenCalledTimes(2);
            expect(exec).toHaveBeenNthCalledWith(2, expect.stringContaining('pg_isready'), expect.any(Object), expect.any(Function));
        });

        it('should fail if both fail', async () => {
            exec.mockImplementation((cmd, opts, cb) => cb(new Error('Failed')));
            const res = await connector.testConnection({ database: 'test' });
            expect(res.success).toBe(false);
            expect(res.error).toBe('Failed');
        });
    });

    describe('backup', () => {
        it('should run pg_dump with compression', async () => {
            exec.mockImplementation((cmd, opts, cb) => cb(null));
            fs.stat.mockImplementation((p, cb) => cb(null, { size: 1000 }));
            const res = await connector.backup({ database: 'db1' }, { compression: true });
            expect(res.isFile).toBe(true);
            expect(exec).toHaveBeenCalledWith(expect.stringContaining('pg_dump --format=plain | gzip >'), expect.any(Object), expect.any(Function));
        });

        it('should run pg_dump without compression', async () => {
            exec.mockImplementation((cmd, opts, cb) => cb(null));
            fs.stat.mockImplementation((p, cb) => cb(null, { size: 1000 }));
            const res = await connector.backup({ database: 'db1' }, { compression: false });
            expect(res.isFile).toBe(true);
            expect(exec).toHaveBeenCalledWith(expect.stringContaining('pg_dump --format=plain >'), expect.any(Object), expect.any(Function));
        });

        it('should handle backup failure', async () => {
            exec.mockImplementation((cmd, opts, cb) => cb(new Error('Backup failed')));
            fs.rm.mockImplementation((p, opts, cb) => cb(null));
            await expect(connector.backup({ database: 'db1' })).rejects.toThrow('Backup failed');
        });
    });

    describe('not supported methods', () => {
        it('upload rejects', async () => {
            await expect(connector.upload()).rejects.toThrow('PostgreSQL cannot be used as a backup destination');
        });
        it('download rejects', async () => {
            await expect(connector.download()).rejects.toThrow('PostgreSQL cannot be used as a restore source directly');
        });
    });

    describe('restore', () => {
        it('should run gunzip pipeline for .gz files', async () => {
            exec.mockImplementation((cmd, opts, cb) => cb(null));
            const res = await connector.restore({ path: '/tmp/db.sql.gz' }, { database: 'test' });
            expect(res.success).toBe(true);
            expect(exec).toHaveBeenCalledWith(expect.stringContaining('gunzip -c'), expect.any(Object), expect.any(Function));
        });

        it('should run psql < for .sql files', async () => {
            exec.mockImplementation((cmd, opts, cb) => cb(null));
            const res = await connector.restore({ path: '/tmp/db.sql' }, { database: 'test' });
            expect(res.success).toBe(true);
            expect(exec).toHaveBeenCalledWith(expect.stringContaining('psql < '), expect.any(Object), expect.any(Function));
        });

        it('should throw on restore failure', async () => {
            exec.mockImplementation((cmd, opts, cb) => cb(new Error('DB Error')));
            await expect(connector.restore({ path: '/tmp/db.sql' }, {})).rejects.toThrow('Restore failed: DB Error');
        });
    });
});
