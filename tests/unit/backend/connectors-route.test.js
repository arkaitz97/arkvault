import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import connectorsRouter from '../../../server/routes/connectors.js';
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
    validateConnectorCreation: (req, res, next) => next(),
    validateUUID: (req, res, next) => next()
}));

describe('Connectors Routes', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/api/connectors', connectorsRouter);
        vi.clearAllMocks();
    });

    describe('GET /', () => {
        it('should return all connectors', async () => {
            db.prepare.mockReturnValueOnce({
                all: vi.fn().mockReturnValue([
                    { id: '1', type: 'local', config: '{"path":"/tmp"}' }
                ])
            });

            const res = await request(app).get('/api/connectors');
            expect(res.status).toBe(200);
            expect(res.body).toEqual([{ id: '1', type: 'local', config: { path: '/tmp' } }]);
        });

        it('should handle db error on list', async () => {
            db.prepare.mockReturnValueOnce({
                all: vi.fn(() => { throw new Error('DB Error'); })
            });

            const res = await request(app).get('/api/connectors');
            expect(res.status).toBe(500);
        });
    });

    describe('GET /:id', () => {
        it('should return a single connector', async () => {
            db.prepare.mockReturnValueOnce({
                get: vi.fn().mockReturnValue({ id: '1', type: 'local', config: '{"path":"/tmp"}' })
            });

            const res = await request(app).get('/api/connectors/1');
            expect(res.status).toBe(200);
            expect(res.body.id).toBe('1');
        });

        it('should return 404 if not found', async () => {
            db.prepare.mockReturnValueOnce({
                get: vi.fn().mockReturnValue(null)
            });

            const res = await request(app).get('/api/connectors/1');
            expect(res.status).toBe(404);
        });

        it('should handle db error', async () => {
            db.prepare.mockReturnValueOnce({
                get: vi.fn(() => { throw new Error('DB Error'); })
            });

            const res = await request(app).get('/api/connectors/1');
            expect(res.status).toBe(500);
        });
    });

    describe('POST /', () => {
        it('should create connector', async () => {
            const runMock = vi.fn();
            db.prepare.mockReturnValueOnce({ run: runMock });
            db.prepare.mockReturnValueOnce({
                get: vi.fn().mockReturnValue({ id: 'new_id', type: 'local', config: '{"path":"/tmp"}' })
            });

            const res = await request(app).post('/api/connectors').send({
                type: 'local', name: 'c1', config: { path: '/tmp' }
            });

            expect(res.status).toBe(201);
            expect(runMock).toHaveBeenCalled();
            expect(res.body.id).toBe('new_id');
        });

        it('should create ssh connector', async () => {
            const runMock = vi.fn();
            db.prepare.mockReturnValueOnce({ run: runMock });
            db.prepare.mockReturnValueOnce({
                get: vi.fn().mockReturnValue({
                    id: 'ssh_id',
                    type: 'ssh',
                    config: '{"host":"backup.example.com","remotePath":"/srv/backups"}'
                })
            });

            const res = await request(app).post('/api/connectors').send({
                type: 'ssh',
                name: 'remote',
                config: { host: 'backup.example.com', remotePath: '/srv/backups' }
            });

            expect(res.status).toBe(201);
            expect(runMock).toHaveBeenCalled();
            expect(res.body.type).toBe('ssh');
            expect(res.body.config.remotePath).toBe('/srv/backups');
        });

        it('should handle db errors on create', async () => {
            db.prepare.mockReturnValueOnce({
                run: vi.fn(() => { throw new Error('DB Error'); })
            });

            const res = await request(app).post('/api/connectors').send({ type: 'local' });
            expect(res.status).toBe(500);
        });
    });

    describe('PUT /:id', () => {
        it('should update connector', async () => {
            const runMock = vi.fn();
            db.prepare.mockReturnValueOnce({ run: runMock });
            db.prepare.mockReturnValueOnce({
                get: vi.fn().mockReturnValue({ id: '1', type: 'local', config: '{"path":"/new"}' })
            });

            const res = await request(app).put('/api/connectors/1').send({
                type: 'local', name: 'c1', config: { path: '/new' }
            });

            expect(res.status).toBe(200);
            expect(runMock).toHaveBeenCalled();
            expect(res.body.config.path).toBe('/new');
        });

        it('should return 404 if updating non-existent', async () => {
            const runMock = vi.fn();
            db.prepare.mockReturnValueOnce({ run: runMock });
            db.prepare.mockReturnValueOnce({
                get: vi.fn().mockReturnValue(null)
            });

            const res = await request(app).put('/api/connectors/1').send({ type: 'local' });
            expect(res.status).toBe(404);
        });

        it('should handle db error on put', async () => {
            db.prepare.mockReturnValueOnce({
                run: vi.fn(() => { throw new Error('DB Error'); })
            });

            const res = await request(app).put('/api/connectors/1').send({ type: 'local' });
            expect(res.status).toBe(500);
        });
    });

    describe('DELETE /:id', () => {
        it('should delete connector', async () => {
            db.prepare.mockReturnValueOnce({
                run: vi.fn().mockReturnValue({ changes: 1 })
            });

            const res = await request(app).delete('/api/connectors/1');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should return 404 if delete no rows', async () => {
            db.prepare.mockReturnValueOnce({
                run: vi.fn().mockReturnValue({ changes: 0 })
            });

            const res = await request(app).delete('/api/connectors/1');
            expect(res.status).toBe(404);
        });

        it('should handle db errors on delete', async () => {
            db.prepare.mockReturnValueOnce({
                run: vi.fn(() => { throw new Error('DB Error'); })
            });

            const res = await request(app).delete('/api/connectors/1');
            expect(res.status).toBe(500);
        });
    });

    describe('POST /:id/test', () => {
        it('should test saved connector successfully', async () => {
            db.prepare.mockReturnValueOnce({
                get: vi.fn().mockReturnValue({ id: '1', type: 'local', config: '{}' })
            });
            const runMock = vi.fn();
            db.prepare.mockReturnValueOnce({ run: runMock });

            connectorsIndex.getConnector.mockReturnValueOnce({
                testConnection: vi.fn().mockResolvedValue({ success: true })
            });

            const res = await request(app).post('/api/connectors/1/test');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(runMock).toHaveBeenCalledWith('connected', '1');
        });

        it('should test saved connector failure', async () => {
            db.prepare.mockReturnValueOnce({
                get: vi.fn().mockReturnValue({ id: '1', type: 'local', config: '{}' })
            });
            const runMock = vi.fn();
            db.prepare.mockReturnValueOnce({ run: runMock });

            connectorsIndex.getConnector.mockReturnValueOnce({
                testConnection: vi.fn().mockResolvedValue({ success: false })
            });

            const res = await request(app).post('/api/connectors/1/test');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(false);
            expect(runMock).toHaveBeenCalledWith('disconnected', '1');
        });

        it('should 404 if connector to test not found', async () => {
            db.prepare.mockReturnValueOnce({
                get: vi.fn().mockReturnValue(null)
            });

            const res = await request(app).post('/api/connectors/1/test');
            expect(res.status).toBe(404);
        });

        it('should handle test errors', async () => {
            db.prepare.mockReturnValueOnce({
                get: vi.fn().mockReturnValue({ id: '1', type: 'local', config: '{}' })
            });

            connectorsIndex.getConnector.mockReturnValueOnce({
                testConnection: vi.fn().mockRejectedValue(new Error('Test Failed'))
            });

            const res = await request(app).post('/api/connectors/1/test');
            expect(res.status).toBe(500);
        });
    });

    describe('POST /test', () => {
        it('should perform ad-hoc test', async () => {
            connectorsIndex.getConnector.mockReturnValueOnce({
                testConnection: vi.fn().mockResolvedValue({ success: true })
            });

            const res = await request(app).post('/api/connectors/test').send({ type: 'local', config: {} });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should handle ad-hoc test errors', async () => {
            connectorsIndex.getConnector.mockReturnValueOnce({
                testConnection: vi.fn().mockRejectedValue(new Error('Test Error'))
            });

            const res = await request(app).post('/api/connectors/test').send({ type: 'local', config: {} });
            expect(res.status).toBe(500);
        });
    });
});
