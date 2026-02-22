import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import jobsRouter from '../../../server/routes/jobs.js';
import db from '../../../server/db.js';

vi.mock('../../../server/db.js', () => ({
    default: {
        prepare: vi.fn()
    }
}));

vi.mock('../../../server/utils.js', () => ({
    calculateNextRun: vi.fn(() => '2026-02-20T00:00:00.000Z')
}));

vi.mock('../../../server/middleware/validation-middleware.js', () => ({
    validateJobCreation: (req, res, next) => next(),
    validateUUID: (req, res, next) => next()
}));

describe('Jobs Routes', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/api/jobs', jobsRouter);
        vi.clearAllMocks();
    });

    describe('GET /', () => {
        it('should return all jobs parsed', async () => {
            db.prepare.mockReturnValueOnce({
                all: vi.fn().mockReturnValue([
                    { id: '1', source_config: '{"a":1}', destination_config: null, compression: 1, encryption: 0, incremental: 1 }
                ])
            });

            const res = await request(app).get('/api/jobs');
            expect(res.status).toBe(200);
            expect(res.body).toEqual([{
                id: '1',
                source_config: { a: 1 },
                destination_config: null,
                compression: true,
                encryption: false,
                incremental: true
            }]);
        });

        it('should handle db error on GET /', async () => {
            db.prepare.mockReturnValueOnce({
                all: vi.fn(() => { throw new Error('DB Error'); })
            });
            const res = await request(app).get('/api/jobs');
            expect(res.status).toBe(500);
        });
    });

    describe('GET /:id', () => {
        it('should return a single job parsed', async () => {
            db.prepare.mockReturnValueOnce({
                get: vi.fn().mockReturnValue({ id: '1', source_config: '{"a":1}', destination_config: null, compression: 1 })
            });
            const res = await request(app).get('/api/jobs/1');
            expect(res.status).toBe(200);
            expect(res.body.source_config.a).toBe(1);
        });

        it('should return 404', async () => {
            db.prepare.mockReturnValueOnce({
                get: vi.fn().mockReturnValue(null)
            });
            const res = await request(app).get('/api/jobs/1');
            expect(res.status).toBe(404);
        });

        it('should handle db error on GET /:id', async () => {
            db.prepare.mockReturnValueOnce({
                get: vi.fn(() => { throw new Error('DB Error'); })
            });
            const res = await request(app).get('/api/jobs/1');
            expect(res.status).toBe(500);
        });
    });

    describe('POST /', () => {
        it('should create job successfully', async () => {
            db.prepare.mockImplementation((q) => {
                if (q.includes('INSERT')) return { run: vi.fn() };
                if (q.includes('SELECT')) return { get: vi.fn().mockReturnValue({ id: 'new_uuid', compression: 1 }) };
            });

            const res = await request(app).post('/api/jobs').send({
                name: 'test',
                source_type: 'local',
                source_connector_id: '1',
                source_config: { path: '/tmp' },
                destination_type: 'local',
                destination_connector_id: '2',
                destination_config: { path: '/tmp2' },
                schedule: '* * * * *',
                compression: true,
                encryption: false,
                incremental: false
            });

            expect(res.status).toBe(201);
            expect(res.body.id).toBe('new_uuid');
        });

        it('should handle missing optional body parameters', async () => {
            const runMock = vi.fn();
            db.prepare.mockImplementation((q) => {
                if (q.includes('INSERT')) return { run: runMock };
                if (q.includes('SELECT')) return { get: vi.fn().mockReturnValue({}) };
            });

            const res = await request(app).post('/api/jobs').send({
                name: 'test', source_type: 'local', destination_type: 'local', schedule: '* * * * *'
            });

            expect(res.status).toBe(201);
            expect(runMock.mock.calls[0][11]).toBe(1);
        });

        it('should handle db error', async () => {
            db.prepare.mockReturnValueOnce({
                run: vi.fn(() => { throw new Error('DB Error'); })
            });
            const res = await request(app).post('/api/jobs').send({});
            expect(res.status).toBe(500);
        });
    });

    describe('PUT /:id', () => {
        it('should update job successfully', async () => {
            const runMock = vi.fn();
            const getMock = vi.fn();
            getMock.mockReturnValueOnce({ id: '1' });

            db.prepare.mockImplementation((q) => {
                if (q.includes('UPDATE')) return { run: runMock };
                if (q.includes('SELECT')) return { get: vi.fn().mockReturnValue({ id: '1', source_config: null, destination_config: null }) };
            });

            const res = await request(app).put('/api/jobs/1').send({
                name: 'updated',
                compression: false,
                source_config: { a: 2 }
            });

            expect(res.status).toBe(200);
            expect(runMock).toHaveBeenCalled();
            expect(res.body.id).toBe('1');
        });

        it('should return 404 if not found', async () => {
            db.prepare.mockImplementation((q) => {
                if (q.includes('UPDATE')) return { run: vi.fn() };
                if (q.includes('SELECT')) return { get: vi.fn().mockReturnValue(null) };
            });

            const res = await request(app).put('/api/jobs/1').send({ name: 'updated' });
            expect(res.status).toBe(404);
        });

        it('should handle db error on update', async () => {
            db.prepare.mockImplementation((q) => {
                if (q.includes('UPDATE')) return { run: vi.fn(() => { throw new Error('DB Error'); }) };
            });
            const res = await request(app).put('/api/jobs/1').send({});
            expect(res.status).toBe(500);
        });
    });

    describe('DELETE /:id', () => {
        it('should delete a job', async () => {
            db.prepare.mockImplementation((q) => {
                if (q.includes('DELETE')) return { run: vi.fn().mockReturnValue({ changes: 1 }) };
            });
            const res = await request(app).delete('/api/jobs/1');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should 404 if delete row 0', async () => {
            db.prepare.mockImplementation((q) => {
                if (q.includes('DELETE')) return { run: vi.fn().mockReturnValue({ changes: 0 }) };
            });
            const res = await request(app).delete('/api/jobs/1');
            expect(res.status).toBe(404);
        });

        it('should handle db error', async () => {
            db.prepare.mockImplementation((q) => {
                if (q.includes('DELETE')) return { run: vi.fn(() => { throw new Error('DB Error'); }) };
            });
            const res = await request(app).delete('/api/jobs/1');
            expect(res.status).toBe(500);
        });
    });

    describe('POST /:id/toggle', () => {
        it('should toggle to active', async () => {
            const runMock = vi.fn();
            db.prepare.mockImplementation((q) => {
                if (q.includes('SELECT')) return { get: vi.fn().mockReturnValue({ status: 'paused' }) };
                if (q.includes('UPDATE')) return { run: runMock };
            });

            const res = await request(app).post('/api/jobs/1/toggle');
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('active');
            expect(runMock).toHaveBeenCalledWith('active', '1');
        });

        it('should toggle to paused', async () => {
            const runMock = vi.fn();
            db.prepare.mockImplementation((q) => {
                if (q.includes('SELECT')) return { get: vi.fn().mockReturnValue({ status: 'active' }) };
                if (q.includes('UPDATE')) return { run: runMock };
            });

            const res = await request(app).post('/api/jobs/1/toggle');
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('paused');
        });

        it('should 404 if job not found', async () => {
            db.prepare.mockImplementation((q) => {
                if (q.includes('SELECT')) return { get: vi.fn().mockReturnValue(null) };
            });
            const res = await request(app).post('/api/jobs/1/toggle');
            expect(res.status).toBe(404);
        });

        it('should handle db error', async () => {
            db.prepare.mockImplementation((q) => {
                if (q.includes('SELECT')) return { get: vi.fn(() => { throw new Error('DB Error'); }) };
            });
            const res = await request(app).post('/api/jobs/1/toggle');
            expect(res.status).toBe(500);
        });
    });
});
