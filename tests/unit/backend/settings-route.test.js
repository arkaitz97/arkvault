import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import settingsRouter from '../../../server/routes/settings.js';
import db from '../../../server/db.js';

vi.mock('../../../server/db.js', () => ({
    default: {
        exec: vi.fn(),
        prepare: vi.fn(() => ({
            run: vi.fn(),
            get: vi.fn(),
            all: vi.fn()
        }))
    }
}));

describe('Settings Routes', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/api/settings', settingsRouter);
        vi.clearAllMocks();
    });

    describe('GET /', () => {
        it('should return typed settings', async () => {
            db.prepare.mockReturnValueOnce({
                all: vi.fn().mockReturnValue([
                    { key: 'defaultRetention', value: '30' },
                    { key: 'defaultCompression', value: 'true' },
                    { key: 'defaultEncryption', value: 'false' },
                    { key: 'notificationEmail', value: 'test@test.com' }
                ])
            });

            const res = await request(app).get('/api/settings');

            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                defaultRetention: 30,
                defaultCompression: true,
                defaultEncryption: false,
                notificationEmail: 'test@test.com'
            });
        });

        it('should handle db errors', async () => {
            db.prepare.mockReturnValueOnce({
                all: vi.fn().mockImplementation(() => { throw new Error('DB Error'); })
            });

            const res = await request(app).get('/api/settings');
            expect(res.status).toBe(500);
            expect(res.body.error).toBe('DB Error');
        });
    });

    describe('PUT /', () => {
        it('should update settings', async () => {
            const runMock = vi.fn();
            db.prepare.mockReturnValueOnce({ run: runMock });

            const res = await request(app)
                .put('/api/settings')
                .send({ defaultRetention: 45, defaultCompression: false });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(runMock).toHaveBeenCalledTimes(2);
            expect(runMock).toHaveBeenCalledWith('defaultRetention', '45');
            expect(runMock).toHaveBeenCalledWith('defaultCompression', 'false');
        });

        it('should handle db errors on put', async () => {
            db.prepare.mockImplementation(() => { throw new Error('DB Error'); });

            const res = await request(app).put('/api/settings').send({ k: 'v' });
            expect(res.status).toBe(500);
            expect(res.body.error).toBe('DB Error');
        });
    });

    describe('GET /stats', () => {
        it('should return stats', async () => {
            const getMock = vi.fn();
            getMock.mockReturnValueOnce({ count: 10 })
                .mockReturnValueOnce({ total: 5000 })
                .mockReturnValueOnce({ count: 2 })
                .mockReturnValueOnce({ count: 4 });

            db.prepare.mockReturnValue({ get: getMock });

            const res = await request(app).get('/api/settings/stats');

            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                totalBackups: 10,
                totalSize: 5000,
                activeJobs: 2,
                connectors: 4
            });
        });

        it('should handle db errors on stats', async () => {
            db.prepare.mockReturnValue({
                get: vi.fn(() => { throw new Error('DB Error'); })
            });

            const res = await request(app).get('/api/settings/stats');
            expect(res.status).toBe(500);
            expect(res.body.error).toBe('DB Error');
        });
    });

    describe('POST /cleanup', () => {
        it('should perform cleanup based on retention', async () => {
            db.prepare.mockReturnValueOnce({ get: vi.fn(() => ({ value: '10' })) });
            db.prepare.mockReturnValueOnce({ run: vi.fn(() => ({ changes: 5 })) });

            const res = await request(app).post('/api/settings/cleanup');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.deleted).toBe(5);
        });

        it('should handle defaults when retention is missing', async () => {
            db.prepare.mockReturnValueOnce({ get: vi.fn(() => null) });
            db.prepare.mockReturnValueOnce({ run: vi.fn(() => ({ changes: 0 })) });

            await request(app).post('/api/settings/cleanup');
            expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM backup_history'));
        });

        it('should handle db errors on cleanup', async () => {
            db.prepare.mockReturnValueOnce({ get: vi.fn(() => { throw new Error('DB Error'); }) });

            const res = await request(app).post('/api/settings/cleanup');
            expect(res.status).toBe(500);
            expect(res.body.error).toBe('DB Error');
        });
    });
});
