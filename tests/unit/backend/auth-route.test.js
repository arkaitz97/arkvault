import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import authRouter from '../../../server/routes/auth.js';
import db from '../../../server/db.js';
import bcrypt from 'bcrypt';

vi.mock('bcrypt', () => ({
    default: {
        compare: vi.fn(),
        hash: vi.fn()
    }
}));

vi.mock('../../../server/db.js', () => ({
    default: {
        prepare: vi.fn()
    }
}));

vi.mock('../../../server/middleware/validation-middleware.js', () => ({
    validateLogin: (req, res, next) => next(),
    validateChangePassword: (req, res, next) => next()
}));

const mockSession = () => (req, res, next) => {
    if (!req.session) {
        req.session = {
            authenticated: false,
            destroy: vi.fn((cb) => cb(null))
        };
    }
    next();
};

describe('Auth Routes', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use(mockSession());
        app.use('/api/auth', authRouter);
        vi.clearAllMocks();
    });

    describe('POST /login', () => {
        it('should require username in body', async () => {
            const res = await request(app).post('/api/auth/login').send({ password: 'admin123' });
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Username is required');
        });

        it('should require password in body', async () => {
            const res = await request(app).post('/api/auth/login').send({ username: 'admin' });
            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Password is required');
        });

        it('should login successfully', async () => {
            db.prepare.mockReturnValueOnce({
                get: vi.fn(() => ({ id: '1', username: 'admin', role: 'admin', password_hash: 'hash', must_change_password: 1 }))
            });
            bcrypt.compare.mockResolvedValueOnce(true);

            const res = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'admin123' });

            expect(res.status).toBe(200);
            expect(res.body.authenticated).toBe(true);
            expect(res.body.mustChangePassword).toBe(true);
            expect(res.body.user.username).toBe('admin');
            expect(res.body.user.role).toBe('admin');
        });

        it('should reject invalid password', async () => {
            db.prepare.mockReturnValueOnce({
                get: vi.fn(() => ({ id: '1', username: 'admin', role: 'admin', password_hash: 'hash', must_change_password: 0 }))
            });
            bcrypt.compare.mockResolvedValueOnce(false);

            const res = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'wrong' });

            expect(res.status).toBe(401);
            expect(res.body.error).toBe('Invalid password');
        });

        it('should reject unknown username', async () => {
            db.prepare.mockReturnValueOnce({
                get: vi.fn(() => undefined)
            });

            const res = await request(app).post('/api/auth/login').send({ username: 'nope', password: 'whatever' });

            expect(res.status).toBe(401);
            expect(res.body.error).toBe('Invalid password');
        });

        it('should handle db error on login', async () => {
            db.prepare.mockReturnValueOnce({
                get: vi.fn(() => { throw new Error('DB Error'); })
            });

            const res = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Internal server error');
        });
    });

    describe('POST /logout', () => {
        it('should destroy session and clear cookie', async () => {
            const res = await request(app).post('/api/auth/logout');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should handle session destroy errors', async () => {
            const errApp = express();
            errApp.use(express.json());
            errApp.use((req, res, next) => {
                req.session = { destroy: (cb) => cb(new Error('Destroy Error')) };
                next();
            });
            errApp.use('/api/auth', authRouter);

            const res = await request(errApp).post('/api/auth/logout');
            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Could not log out');
        });
    });

    describe('GET /status', () => {
        it('should return unauthenticated status', async () => {
            const res = await request(app).get('/api/auth/status');
            expect(res.status).toBe(200);
            expect(res.body.authenticated).toBe(false);
        });

        it('should return authenticated status', async () => {
            const authApp = express();
            authApp.use(express.json());
            authApp.use((req, res, next) => {
                req.session = { authenticated: true, mustChangePassword: true };
                next();
            });
            authApp.use('/api/auth', authRouter);

            const res = await request(authApp).get('/api/auth/status');
            expect(res.status).toBe(200);
            expect(res.body.authenticated).toBe(true);
            expect(res.body.mustChangePassword).toBe(true);
        });
    });

    describe('POST /change-password', () => {
        it('should require authentication', async () => {
            const res = await request(app)
                .post('/api/auth/change-password')
                .send({ newPassword: 'new' });
            expect(res.status).toBe(401);
            expect(res.body.error).toBe('Not authenticated');
        });

        it('should change password successfully', async () => {
            const authApp = express();
            authApp.use(express.json());
            authApp.use((req, res, next) => {
                req.session = { authenticated: true, userId: 'user-1' };
                next();
            });
            authApp.use('/api/auth', authRouter);

            bcrypt.hash.mockResolvedValueOnce('new-hash');
            const runMock = vi.fn();
            db.prepare.mockReturnValueOnce({ run: runMock });

            const res = await request(authApp)
                .post('/api/auth/change-password')
                .send({ newPassword: 'new' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(runMock).toHaveBeenCalledWith('new-hash', 'user-1');
        });

        it('should handle db error on change password', async () => {
            const authApp = express();
            authApp.use(express.json());
            authApp.use((req, res, next) => {
                req.session = { authenticated: true };
                next();
            });
            authApp.use('/api/auth', authRouter);

            bcrypt.hash.mockResolvedValueOnce('new-hash');
            db.prepare.mockReturnValueOnce({
                run: vi.fn(() => { throw new Error('DB Error'); })
            });

            const res = await request(authApp)
                .post('/api/auth/change-password')
                .send({ newPassword: 'new' });

            expect(res.status).toBe(500);
        });
    });
});
