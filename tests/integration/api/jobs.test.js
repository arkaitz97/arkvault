import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEST_DB_PATH = join(__dirname, '../../test-jobs.db');

let db;
let app;

// Simple cron next run calculator for tests
function calculateNextRun(cronExpression) {
    if (!cronExpression) return null;
    // For testing, just return 1 hour from now
    return new Date(Date.now() + 60 * 60 * 1000).toISOString();
}

beforeAll(async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
        fs.unlinkSync(TEST_DB_PATH);
    }

    db = new Database(TEST_DB_PATH);
    db.pragma('foreign_keys = ON');

    db.exec(`
        CREATE TABLE IF NOT EXISTS jobs (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            source_type TEXT NOT NULL,
            source_connector_id TEXT,
            source_config TEXT,
            destination_type TEXT NOT NULL,
            destination_connector_id TEXT,
            destination_config TEXT,
            schedule TEXT NOT NULL,
            schedule_description TEXT,
            retention INTEGER DEFAULT 30,
            compression INTEGER DEFAULT 1,
            encryption INTEGER DEFAULT 1,
            status TEXT DEFAULT 'active',
            last_run DATETIME,
            last_run_status TEXT,
            next_run DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    app = express();
    app.use(cors());
    app.use(express.json());

    // GET all jobs
    app.get('/api/jobs', (req, res) => {
        const jobs = db.prepare('SELECT * FROM jobs ORDER BY created_at DESC').all();
        res.json(jobs.map(j => ({
            ...j,
            source_config: j.source_config ? JSON.parse(j.source_config) : null,
            destination_config: j.destination_config ? JSON.parse(j.destination_config) : null,
            compression: !!j.compression,
            encryption: !!j.encryption
        })));
    });

    // GET single job
    app.get('/api/jobs/:id', (req, res) => {
        const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        res.json({
            ...job,
            source_config: job.source_config ? JSON.parse(job.source_config) : null,
            destination_config: job.destination_config ? JSON.parse(job.destination_config) : null,
            compression: !!job.compression,
            encryption: !!job.encryption
        });
    });

    // POST create job
    app.post('/api/jobs', (req, res) => {
        const {
            name,
            source_type,
            source_connector_id,
            source_config,
            destination_type,
            destination_connector_id,
            destination_config,
            schedule,
            schedule_description,
            retention = 30,
            compression = true,
            encryption = true
        } = req.body;

        if (!name || !source_type || !destination_type || !schedule) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const id = uuidv4();
        const nextRun = calculateNextRun(schedule);

        db.prepare(`
            INSERT INTO jobs (
                id, name, source_type, source_connector_id, source_config,
                destination_type, destination_connector_id, destination_config,
                schedule, schedule_description, retention, compression, encryption, next_run
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, name, source_type, source_connector_id,
            source_config ? JSON.stringify(source_config) : null,
            destination_type, destination_connector_id,
            destination_config ? JSON.stringify(destination_config) : null,
            schedule, schedule_description, retention,
            compression ? 1 : 0, encryption ? 1 : 0, nextRun
        );

        const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
        res.status(201).json({
            ...job,
            source_config: job.source_config ? JSON.parse(job.source_config) : null,
            destination_config: job.destination_config ? JSON.parse(job.destination_config) : null
        });
    });

    // DELETE job
    app.delete('/api/jobs/:id', (req, res) => {
        const result = db.prepare('DELETE FROM jobs WHERE id = ?').run(req.params.id);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Job not found' });
        }
        res.json({ success: true });
    });

    // Toggle job status
    app.post('/api/jobs/:id/toggle', (req, res) => {
        const job = db.prepare('SELECT status FROM jobs WHERE id = ?').get(req.params.id);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        const newStatus = job.status === 'active' ? 'paused' : 'active';
        db.prepare('UPDATE jobs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(newStatus, req.params.id);

        res.json({ status: newStatus });
    });
});

beforeEach(() => {
    db.exec('DELETE FROM jobs');
});

afterAll(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) {
        fs.unlinkSync(TEST_DB_PATH);
    }
});

describe('Jobs API', () => {
    describe('GET /api/jobs', () => {
        it('should return empty array when no jobs exist', async () => {
            const res = await request(app).get('/api/jobs');

            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);
        });

        it('should return all jobs', async () => {
            db.prepare(`
                INSERT INTO jobs (id, name, source_type, destination_type, schedule)
                VALUES (?, ?, ?, ?, ?)
            `).run('job-1', 'Daily Backup', 'local', 'local', '0 2 * * *');

            const res = await request(app).get('/api/jobs');

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(res.body[0].name).toBe('Daily Backup');
        });
    });

    describe('POST /api/jobs', () => {
        it('should create a new job', async () => {
            const res = await request(app)
                .post('/api/jobs')
                .send({
                    name: 'Test Backup Job',
                    source_type: 'local',
                    source_config: { path: '/data' },
                    destination_type: 'local',
                    destination_config: { path: '/backup' },
                    schedule: '0 2 * * *',
                    schedule_description: 'Daily at 2 AM'
                });

            expect(res.status).toBe(201);
            expect(res.body.id).toBeDefined();
            expect(res.body.name).toBe('Test Backup Job');
            expect(res.body.next_run).toBeDefined();
        });

        it('should return 400 when missing required fields', async () => {
            const res = await request(app)
                .post('/api/jobs')
                .send({ name: 'Incomplete Job' });

            expect(res.status).toBe(400);
        });
    });

    describe('POST /api/jobs/:id/toggle', () => {
        it('should toggle job from active to paused', async () => {
            db.prepare(`
                INSERT INTO jobs (id, name, source_type, destination_type, schedule, status)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run('job-1', 'Test Job', 'local', 'local', '0 2 * * *', 'active');

            const res = await request(app).post('/api/jobs/job-1/toggle');

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('paused');
        });

        it('should toggle job from paused to active', async () => {
            db.prepare(`
                INSERT INTO jobs (id, name, source_type, destination_type, schedule, status)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run('job-1', 'Test Job', 'local', 'local', '0 2 * * *', 'paused');

            const res = await request(app).post('/api/jobs/job-1/toggle');

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('active');
        });
    });

    describe('DELETE /api/jobs/:id', () => {
        it('should delete job', async () => {
            db.prepare(`
                INSERT INTO jobs (id, name, source_type, destination_type, schedule)
                VALUES (?, ?, ?, ?, ?)
            `).run('job-1', 'To Delete', 'local', 'local', '0 2 * * *');

            const res = await request(app).delete('/api/jobs/job-1');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should return 404 for non-existent job', async () => {
            const res = await request(app).delete('/api/jobs/nonexistent');

            expect(res.status).toBe(404);
        });
    });
});
