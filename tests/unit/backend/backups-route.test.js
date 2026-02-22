import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import backupsRouter from '../../../server/routes/backups.js';
import db from '../../../server/db.js';
import * as connectorsIndex from '../../../server/connectors/index.js';

vi.mock('../../../server/db.js', () => ({
    default: {
        prepare: vi.fn()
    }
}));

vi.mock('../../../server/connectors/index.js', () => ({
    getConnector: vi.fn()
}));

vi.mock('../../../server/middleware/validation-middleware.js', () => ({
    validateUUID: (req, res, next) => next(),
    validateRestoreRequest: (req, res, next) => next()
}));

vi.mock('../../../server/utils.js', () => ({
    calculateNextRun: vi.fn(() => '2026-02-20T00:00:00.000Z')
}));

vi.mock('fs/promises', () => ({
    unlink: vi.fn()
}));

vi.mock('../../../server/rate-limit-config.js', () => ({
    downloadRateLimiter: (req, res, next) => next()
}));

describe('Backups Routes', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/api/backups', backupsRouter);
        vi.clearAllMocks();
    });

    describe('GET /history', () => {
        it('should return backup history', async () => {
            db.prepare.mockReturnValueOnce({
                all: vi.fn().mockReturnValue([{ id: '1' }])
            });
            const res = await request(app).get('/api/backups/history');
            expect(res.status).toBe(200);
            expect(res.body).toEqual([{ id: '1' }]);
        });

        it('should handle db error on history', async () => {
            db.prepare.mockReturnValueOnce({
                all: vi.fn(() => { throw new Error('DB Error'); })
            });
            const res = await request(app).get('/api/backups/history');
            expect(res.status).toBe(500);
        });
    });

    describe('GET /available', () => {
        it('should return available backups', async () => {
            db.prepare.mockReturnValueOnce({
                all: vi.fn().mockReturnValue([{ id: '1' }])
            });
            const res = await request(app).get('/api/backups/available');
            expect(res.status).toBe(200);
            expect(res.body).toEqual([{ id: '1' }]);
        });

        it('should handle db error on available', async () => {
            db.prepare.mockReturnValueOnce({
                all: vi.fn(() => { throw new Error('DB Error'); })
            });
            const res = await request(app).get('/api/backups/available');
            expect(res.status).toBe(500);
        });
    });

    describe('POST /run/:jobId', () => {
        it('should return 404 if job not found', async () => {
            db.prepare.mockReturnValueOnce({
                get: vi.fn().mockReturnValue(null)
            });
            const res = await request(app).post('/api/backups/run/1');
            expect(res.status).toBe(404);
        });

        it('should run backup successfully', async () => {
            const runMock = vi.fn();
            db.prepare.mockImplementation((q) => {
                if (q.includes('SELECT * FROM jobs')) return { get: vi.fn().mockReturnValue({ id: '1', name: 'j1', source_type: 'local', destination_type: 'local', source_connector_id: 'c1', destination_connector_id: 'c2' }) };
                if (q.includes('SELECT * FROM connectors')) return { get: vi.fn().mockReturnValue({ config: '{}' }) };
                return { run: runMock, get: vi.fn() };
            });

            const backupMock = vi.fn().mockResolvedValue({ data: '/tmp/b.zip', filename: 'b.zip', size: 100, filesProcessed: 1 });
            const uploadMock = vi.fn().mockResolvedValue({ location: '/dest/b.zip' });
            connectorsIndex.getConnector.mockReturnValue({
                backup: backupMock,
                upload: uploadMock
            });

            const res = await request(app).post('/api/backups/run/1');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(backupMock).toHaveBeenCalled();
            expect(uploadMock).toHaveBeenCalled();
        });

        it('should handle backup failure correctly', async () => {
            const runMock = vi.fn();
            db.prepare.mockImplementation((q) => {
                if (q.includes('SELECT * FROM jobs')) return { get: vi.fn().mockReturnValue({ id: '1', name: 'j1', source_type: 'local', destination_type: 'local', source_config: '{}', destination_config: '{}' }) };
                return { run: runMock, get: vi.fn() };
            });

            connectorsIndex.getConnector.mockReturnValue({
                backup: vi.fn().mockRejectedValue(new Error('Backup Failed'))
            });

            const res = await request(app).post('/api/backups/run/1');
            expect(res.status).toBe(500);
            expect(runMock).toHaveBeenCalled(); // Checked that error state updates were run
        });
    });

    describe('POST /restore/:backupId', () => {
        it('should return 404 if backup not found', async () => {
            db.prepare.mockReturnValueOnce({
                get: vi.fn().mockReturnValue(null)
            });
            const res = await request(app).post('/api/backups/restore/1');
            expect(res.status).toBe(404);
        });

        it('should run restore successfully', async () => {
            db.prepare.mockImplementation((q) => {
                if (q.includes('SELECT * FROM available_backups')) return { get: vi.fn().mockReturnValue({ id: '1', job_id: 'j1', location: '/path/b.zip' }) };
                if (q.includes('SELECT * FROM jobs')) return { get: vi.fn().mockReturnValue({ id: 'j1', destination_type: 'local', destination_config: '{}' }) };
                return { run: vi.fn(), get: vi.fn() };
            });

            const downloadMock = vi.fn().mockResolvedValue('/tmp/dl.zip');
            const restoreMock = vi.fn().mockResolvedValue({ filesRestored: 5 });
            connectorsIndex.getConnector.mockReturnValue({
                download: downloadMock,
                restore: restoreMock
            });

            const res = await request(app).post('/api/backups/restore/1').send({ destination_type: 'local', destination_path: '/dest' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.filesRestored).toBe(5);
        });

        it('should run restore successfully with destination_connector_id', async () => {
            db.prepare.mockImplementation((q) => {
                if (q.includes('SELECT * FROM available_backups')) return { get: vi.fn().mockReturnValue({ id: '1', job_id: 'j1', location: '/path/b.zip' }) };
                if (q.includes('SELECT * FROM jobs')) return { get: vi.fn().mockReturnValue({ id: 'j1', destination_type: 'local', destination_connector_id: 'c1' }) };
                if (q.includes('SELECT * FROM connectors')) return { get: vi.fn().mockReturnValue({ config: '{}' }) };
                return { run: vi.fn(), get: vi.fn() };
            });

            connectorsIndex.getConnector.mockReturnValue({
                download: vi.fn().mockResolvedValue('/tmp/dl.zip'),
                restore: vi.fn().mockResolvedValue({ filesRestored: 5 })
            });

            const res = await request(app).post('/api/backups/restore/1').send({ destination_type: 'local', destination_path: '/dest' });
            expect(res.status).toBe(200);
        });

        it('should handle restore failure', async () => {
            db.prepare.mockImplementation((q) => {
                if (q.includes('SELECT * FROM available_backups')) return { get: vi.fn().mockReturnValue({ id: '1', job_id: 'j1' }) };
                if (q.includes('SELECT * FROM jobs')) return { get: vi.fn().mockReturnValue({ id: 'j1', destination_config: '{}' }) };
                return { get: vi.fn() };
            });

            connectorsIndex.getConnector.mockReturnValue({
                download: vi.fn().mockRejectedValue(new Error('Download Failed'))
            });

            const res = await request(app).post('/api/backups/restore/1');
            expect(res.status).toBe(500);
        });
    });

    describe('GET /available/:id', () => {
        it('should return backup details', async () => {
            db.prepare.mockReturnValueOnce({
                get: vi.fn().mockReturnValue({ id: '1' })
            });

            const res = await request(app).get('/api/backups/available/1');
            expect(res.status).toBe(200);
            expect(res.body.id).toBe('1');
        });

        it('should return 404 if not found', async () => {
            db.prepare.mockReturnValueOnce({
                get: vi.fn().mockReturnValue(null)
            });

            const res = await request(app).get('/api/backups/available/1');
            expect(res.status).toBe(404);
        });

        it('should handle db error on available id', async () => {
            db.prepare.mockReturnValueOnce({
                get: vi.fn(() => { throw new Error('DB Error'); })
            });

            const res = await request(app).get('/api/backups/available/1');
            expect(res.status).toBe(500);
        });
    });

    describe('GET /download/:historyId', () => {
        it('should return 404 if history not found', async () => {
            db.prepare.mockImplementation((q) => {
                if (q.includes('SELECT * FROM backup_history')) return { get: vi.fn().mockReturnValue(null) };
            });
            const res = await request(app).get('/api/backups/download/1');
            expect(res.status).toBe(404);
        });

        it('should return 404 if no backup location in history', async () => {
            db.prepare.mockImplementation((q) => {
                if (q.includes('SELECT * FROM backup_history')) return { get: vi.fn().mockReturnValue({ id: '1', backup_location: null }) };
            });
            const res = await request(app).get('/api/backups/download/1');
            expect(res.status).toBe(404);
        });

        it('should return 404 if job not found', async () => {
            db.prepare.mockImplementation((q) => {
                if (q.includes('SELECT * FROM backup_history')) return { get: vi.fn().mockReturnValue({ id: '1', backup_location: '/a' }) };
                return { get: vi.fn().mockReturnValue(null) };
            });
            const res = await request(app).get('/api/backups/download/1');
            expect(res.status).toBe(404);
        });

        it('should download file successfully', async () => {
            db.prepare.mockImplementation((q) => {
                if (q.includes('SELECT * FROM backup_history')) return { get: vi.fn().mockReturnValue({ id: '1', backup_location: '/a/file.zip' }) };
                if (q.includes('SELECT * FROM jobs')) return { get: vi.fn().mockReturnValue({ id: '1', destination_config: '{}' }) };
                return { get: vi.fn() };
            });

            connectorsIndex.getConnector.mockReturnValue({
                download: vi.fn().mockResolvedValue('file-content')
            });

            const res = await request(app).get('/api/backups/download/1');
            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toContain('application/zip');
            expect(res.headers['content-disposition']).toContain('filename="file.zip"');
            expect(res.text).toBe('file-content');
        });

        it('should download file successfully with destination_connector_id', async () => {
            db.prepare.mockImplementation((q) => {
                if (q.includes('SELECT * FROM backup_history')) return { get: vi.fn().mockReturnValue({ id: '1', backup_location: '/a/file.zip', job_id: '1' }) };
                if (q.includes('SELECT * FROM jobs')) return { get: vi.fn().mockReturnValue({ id: '1', destination_type: 'local', destination_connector_id: 'c1' }) };
                if (q.includes('SELECT * FROM connectors')) return { get: vi.fn().mockReturnValue({ config: '{}' }) };
                return { get: vi.fn() };
            });

            connectorsIndex.getConnector.mockReturnValue({ download: vi.fn().mockResolvedValue('file-content') });
            const res = await request(app).get('/api/backups/download/1');
            expect(res.status).toBe(200);
        });

        it('should gracefully handle download failures', async () => {
            db.prepare.mockImplementation((q) => {
                if (q.includes('SELECT * FROM backup_history')) return { get: vi.fn().mockReturnValue({ id: '1', backup_location: '/a/file.zip' }) };
                if (q.includes('SELECT * FROM jobs')) return { get: vi.fn().mockReturnValue({ id: '1', destination_config: '{}' }) };
                return { get: vi.fn() };
            });

            connectorsIndex.getConnector.mockReturnValue({
                download: vi.fn().mockRejectedValue(new Error('DL Fail'))
            });

            const res = await request(app).get('/api/backups/download/1');
            expect(res.status).toBe(500);
        });
    });

    describe('DELETE /history/:id', () => {
        it('should delete history', async () => {
            db.prepare.mockReturnValueOnce({
                run: vi.fn().mockReturnValue({ changes: 1 })
            });
            const res = await request(app).delete('/api/backups/history/1');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should return 404 if 0 deletion', async () => {
            db.prepare.mockReturnValueOnce({
                run: vi.fn().mockReturnValue({ changes: 0 })
            });
            const res = await request(app).delete('/api/backups/history/1');
            expect(res.status).toBe(404);
        });

        it('should respect errors', async () => {
            db.prepare.mockReturnValueOnce({
                run: vi.fn(() => { throw new Error('DB Error'); })
            });
            const res = await request(app).delete('/api/backups/history/1');
            expect(res.status).toBe(500);
        });
    });

    describe('DELETE /available/:id', () => {
        it('should delete available backup and local file', async () => {
            db.prepare.mockImplementation((q) => {
                if (q.includes('SELECT * FROM available_backups')) return { get: vi.fn().mockReturnValue({ id: '1', job_id: 'j1', location: '/tmp/f' }) };
                if (q.includes('SELECT * FROM jobs')) return { get: vi.fn().mockReturnValue({ destination_type: 'local' }) };
                return { run: vi.fn(), get: vi.fn() };
            });

            const fs = await import('fs/promises');

            const res = await request(app).delete('/api/backups/available/1');
            expect(res.status).toBe(200);
            expect(fs.unlink).toHaveBeenCalledWith('/tmp/f');
        });

        it('should handle fs unlink errors gracefully when deleting available backup', async () => {
            db.prepare.mockImplementation((q) => {
                if (q.includes('SELECT * FROM available_backups')) return { get: vi.fn().mockReturnValue({ id: '1', job_id: 'j1', location: '/tmp/f' }) };
                if (q.includes('SELECT * FROM jobs')) return { get: vi.fn().mockReturnValue({ destination_type: 'local' }) };
                return { run: vi.fn(), get: vi.fn() };
            });

            const fs = await import('fs/promises');
            fs.unlink.mockRejectedValueOnce({ code: 'EACCES' });

            const res = await request(app).delete('/api/backups/available/1');
            expect(res.status).toBe(200);
        });

        it('should return 404 if missing db entry', async () => {
            db.prepare.mockReturnValueOnce({
                get: vi.fn().mockReturnValue(null)
            });
            const res = await request(app).delete('/api/backups/available/1');
            expect(res.status).toBe(404);
        });

        it('should handle db error in delete available', async () => {
            db.prepare.mockReturnValueOnce({
                get: vi.fn(() => { throw new Error('DB Error'); })
            });
            const res = await request(app).delete('/api/backups/available/1');
            expect(res.status).toBe(500);
        });
    });

    describe('DELETE /cleanup', () => {
        it('should cleanup expired backups', async () => {
            db.prepare.mockReturnValueOnce({
                run: vi.fn().mockReturnValue({ changes: 3 })
            });
            const res = await request(app).delete('/api/backups/cleanup');
            expect(res.status).toBe(200);
            expect(res.body.deleted).toBe(3);
        });

        it('should handle db error on cleanup', async () => {
            db.prepare.mockReturnValueOnce({
                run: vi.fn(() => { throw new Error('DB Error'); })
            });
            const res = await request(app).delete('/api/backups/cleanup');
            expect(res.status).toBe(500);
        });
    });
});
