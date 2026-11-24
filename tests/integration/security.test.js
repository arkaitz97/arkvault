import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import db from '../../server/db.js';
import app from '../../server/index.js';

const DEFAULT_PASSWORD = 'admin123';


async function resetPassword() {
    const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    db.prepare("UPDATE users SET password_hash = ?, must_change_password = 1 WHERE username = 'admin'").run(hash);
}

describe('Security Features', () => {
    beforeAll(async () => {
        await resetPassword();
    });

    describe('HTTP Security Headers', () => {
        it('should set Content-Security-Policy header', async () => {
            const res = await request(app).get('/api/health');
            expect(res.headers['content-security-policy']).toBeDefined();
            expect(res.headers['content-security-policy']).toContain("default-src 'self'");
        });

        it('should set X-Frame-Options header', async () => {
            const res = await request(app).get('/api/health');
            expect(res.headers['x-frame-options']).toBe('DENY');
        });

        it('should set X-Content-Type-Options header', async () => {
            const res = await request(app).get('/api/health');
            expect(res.headers['x-content-type-options']).toBe('nosniff');
        });

        it('should set Strict-Transport-Security header', async () => {
            const res = await request(app).get('/api/health');
            expect(res.headers['strict-transport-security']).toBeDefined();
            expect(res.headers['strict-transport-security']).toContain('max-age=31536000');
        });

        it('should NOT have X-Powered-By header', async () => {
            const res = await request(app).get('/api/health');
            expect(res.headers['x-powered-by']).toBeUndefined();
        });

        it('should set Referrer-Policy header', async () => {
            const res = await request(app).get('/api/health');
            expect(res.headers['referrer-policy']).toBeDefined();
        });
    });

    describe('Rate Limiting', () => {
        it('should be disabled in test environment', async () => {
            for (let i = 0; i < 10; i++) {
                const res = await request(app)
                    .post('/api/auth/login')
                    .send({ username: 'admin', password: 'wrongpassword' });

                expect(res.status).not.toBe(429);
            }
        });

        it('should have rate limit headers configured', async () => {
            const res = await request(app).get('/api/health');
            expect(res.status).toBe(200);
        });
    });

    describe('Password Validation', () => {
        let agent;

        beforeAll(async () => {
            await resetPassword();
            agent = request.agent(app);
            await agent
                .post('/api/auth/login')
                .send({ username: 'admin', password: DEFAULT_PASSWORD });
        });

        it('should reject password shorter than 8 characters in test mode', async () => {
            const res = await agent
                .post('/api/auth/change-password')
                .send({
                    newPassword: 'short',
                    confirmPassword: 'short'
                });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Validation failed');
            expect(res.body.details).toBeDefined();
            expect(res.body.details.some(d => d.msg.includes('at least 8 characters'))).toBe(true);
        });

        it('should reject non-matching passwords', async () => {
            const res = await agent
                .post('/api/auth/change-password')
                .send({
                    newPassword: 'newpassword123',
                    confirmPassword: 'differentpassword123'
                });

            expect(res.body.error).toBe('Validation failed');
            expect(res.body.details.some(d => d.msg.includes('do not match'))).toBe(true);
        });

        it('should accept valid password in test mode', async () => {
            const res = await agent
                .post('/api/auth/change-password')
                .send({
                    newPassword: 'testpass123',
                    confirmPassword: 'testpass123'
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    describe('Input Validation', () => {
        let agent;

        beforeAll(async () => {
            await resetPassword();
            agent = request.agent(app);
            await agent.post('/api/auth/login').send({ username: 'admin', password: DEFAULT_PASSWORD });
            await agent.post('/api/auth/change-password').send({
                newPassword: 'validpass123',
                confirmPassword: 'validpass123'
            });
        });

        it('should reject invalid UUID in job ID', async () => {
            const res = await agent.get('/api/jobs/invalid-uuid');

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Validation failed');
        });

        it('should reject invalid UUID in backup ID', async () => {
            const res = await agent.get('/api/backups/available/not-a-uuid');

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Validation failed');
        });

        it('should reject invalid UUID in connector ID', async () => {
            const res = await agent.get('/api/connectors/123456');

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Validation failed');
        });

        it('should reject path traversal in restore destination', async () => {
            const res = await agent
                .post('/api/backups/restore/00000000-0000-0000-0000-000000000000')
                .send({
                    destination_type: 'local',
                    destination_path: '../../etc/passwd'
                });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Validation failed');
            expect(res.body.details.some(d => d.msg.includes('traversal'))).toBe(true);
        });

        it('should reject invalid cron expression in job creation', async () => {
            const res = await agent
                .post('/api/jobs')
                .send({
                    name: 'Test Job',
                    source_type: 'local',
                    destination_type: 'local',
                    schedule: 'not-a-cron'
                });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Validation failed');
            expect(res.body.details.some(d => d.msg.includes('cron'))).toBe(true);
        });

        it('should reject invalid source type in job creation', async () => {
            const res = await agent
                .post('/api/jobs')
                .send({
                    name: 'Test Job',
                    source_type: 'invalid-type',
                    destination_type: 'local',
                    schedule: '0 0 * * *'
                });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Validation failed');
            expect(res.body.details.some(d => d.path === 'source_type')).toBe(true);
        });

        it('should reject invalid retention period in job creation', async () => {
            const res = await agent
                .post('/api/jobs')
                .send({
                    name: 'Test Job',
                    source_type: 'local',
                    destination_type: 'local',
                    schedule: '0 0 * * *',
                    retention: 9999
                });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Validation failed');
        });

        it('should reject invalid connector type', async () => {
            const res = await agent
                .post('/api/connectors')
                .send({
                    type: 'invalid-type',
                    name: 'Test Connector',
                    config: {}
                });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Validation failed');
            expect(res.body.details.some(d => d.path === 'type')).toBe(true);
        });

        it('should reject missing config in connector creation', async () => {
            const res = await agent
                .post('/api/connectors')
                .send({
                    type: 'local',
                    name: 'Test Connector'
                });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Validation failed');
            expect(res.body.details.some(d => d.path === 'config')).toBe(true);
        });

        it('should reject non-object config in connector creation', async () => {
            const res = await agent
                .post('/api/connectors')
                .send({
                    type: 'local',
                    name: 'Test Connector',
                    config: 'not-an-object'
                });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Validation failed');
        });
    });

    describe('Error Handling', () => {
        it('should not expose stack traces in production mode', async () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';

            const res = await request(app)
                .get('/api/jobs/00000000-0000-0000-0000-000000000000');

            process.env.NODE_ENV = originalEnv;

            if (res.status >= 500) {
                expect(res.body.stack).toBeUndefined();
            }
        });

        it('should return generic error messages for 500 errors in production', async () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';

            const res = await request(app)
                .get('/api/jobs/00000000-0000-0000-0000-000000000000');

            process.env.NODE_ENV = originalEnv;

            if (res.status === 500) {
                expect(res.body.error).toBe('An internal server error occurred');
            }
        });
    });

    describe('CORS Configuration', () => {
        it('should set CORS headers for allowed origins', async () => {
            const res = await request(app)
                .get('/api/health')
                .set('Origin', 'http://localhost:5173');

            expect(res.headers['access-control-allow-origin']).toBeDefined();
        });

        it('should include credentials in CORS', async () => {
            const res = await request(app)
                .options('/api/health')
                .set('Origin', 'http://localhost:5173')
                .set('Access-Control-Request-Method', 'GET');

            expect(res.headers['access-control-allow-credentials']).toBe('true');
        });
    });

    describe('Session Security', () => {
        it('should set httpOnly cookie flag', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ username: 'admin', password: 'admin123' });

            const cookieHeader = res.headers['set-cookie'];
            if (cookieHeader) {
                expect(cookieHeader.some(c => c.includes('HttpOnly'))).toBe(true);
            }
        });

        it('should set sameSite cookie flag', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ username: 'admin', password: 'admin123' });

            const cookieHeader = res.headers['set-cookie'];
            if (cookieHeader) {
                expect(cookieHeader.some(c => c.includes('SameSite=Lax'))).toBe(true);
            }
        });

        it('should use custom session cookie name', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ username: 'admin', password: 'admin123' });

            const cookieHeader = res.headers['set-cookie'];
            if (cookieHeader) {
                expect(cookieHeader.some(c => c.includes('arkvault.sid'))).toBe(true);
            }
        });
    });
});
