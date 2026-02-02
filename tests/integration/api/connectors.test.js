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

// Create a test database
const TEST_DB_PATH = join(__dirname, '../../test-connectors.db');

let db;
let app;

beforeAll(async () => {
    // Remove existing test database
    if (fs.existsSync(TEST_DB_PATH)) {
        fs.unlinkSync(TEST_DB_PATH);
    }

    // Create fresh test database
    db = new Database(TEST_DB_PATH);
    db.pragma('foreign_keys = ON');

    // Create connectors table
    db.exec(`
        CREATE TABLE IF NOT EXISTS connectors (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            name TEXT NOT NULL,
            config TEXT NOT NULL,
            status TEXT DEFAULT 'unknown',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Create express app with inline routes
    app = express();
    app.use(cors());
    app.use(express.json());

    // GET all connectors
    app.get('/api/connectors', (req, res) => {
        const connectors = db.prepare('SELECT * FROM connectors ORDER BY created_at DESC').all();
        res.json(connectors.map(c => ({
            ...c,
            config: JSON.parse(c.config)
        })));
    });

    // GET single connector
    app.get('/api/connectors/:id', (req, res) => {
        const connector = db.prepare('SELECT * FROM connectors WHERE id = ?').get(req.params.id);
        if (!connector) {
            return res.status(404).json({ error: 'Connector not found' });
        }
        res.json({ ...connector, config: JSON.parse(connector.config) });
    });

    // POST create connector
    app.post('/api/connectors', (req, res) => {
        const { type, name, config } = req.body;

        if (!type || !name || !config) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const id = uuidv4();
        db.prepare(`
            INSERT INTO connectors (id, type, name, config)
            VALUES (?, ?, ?, ?)
        `).run(id, type, name, JSON.stringify(config));

        const connector = db.prepare('SELECT * FROM connectors WHERE id = ?').get(id);
        res.status(201).json({ ...connector, config: JSON.parse(connector.config) });
    });

    // PUT update connector
    app.put('/api/connectors/:id', (req, res) => {
        const { name, config } = req.body;

        const result = db.prepare(`
            UPDATE connectors SET 
                name = COALESCE(?, name),
                config = COALESCE(?, config),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(name, config ? JSON.stringify(config) : null, req.params.id);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Connector not found' });
        }

        const connector = db.prepare('SELECT * FROM connectors WHERE id = ?').get(req.params.id);
        res.json({ ...connector, config: JSON.parse(connector.config) });
    });

    // DELETE connector
    app.delete('/api/connectors/:id', (req, res) => {
        const result = db.prepare('DELETE FROM connectors WHERE id = ?').run(req.params.id);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Connector not found' });
        }
        res.json({ success: true });
    });
});

beforeEach(() => {
    // Clear all connectors before each test
    db.exec('DELETE FROM connectors');
});

afterAll(() => {
    db.close();
    if (fs.existsSync(TEST_DB_PATH)) {
        fs.unlinkSync(TEST_DB_PATH);
    }
});

describe('Connectors API', () => {
    describe('GET /api/connectors', () => {
        it('should return empty array when no connectors exist', async () => {
            const res = await request(app).get('/api/connectors');

            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);
        });

        it('should return all connectors', async () => {
            // Create two connectors
            db.prepare(`INSERT INTO connectors (id, type, name, config) VALUES (?, ?, ?, ?)`)
                .run('conn-1', 'local', 'Local Backup', '{"path": "/backup"}');
            db.prepare(`INSERT INTO connectors (id, type, name, config) VALUES (?, ?, ?, ?)`)
                .run('conn-2', 's3', 'S3 Backup', '{"bucket": "my-bucket"}');

            const res = await request(app).get('/api/connectors');

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(2);
        });
    });

    describe('GET /api/connectors/:id', () => {
        it('should return connector by id', async () => {
            db.prepare(`INSERT INTO connectors (id, type, name, config) VALUES (?, ?, ?, ?)`)
                .run('conn-1', 'local', 'Local Backup', '{"path": "/backup"}');

            const res = await request(app).get('/api/connectors/conn-1');

            expect(res.status).toBe(200);
            expect(res.body.id).toBe('conn-1');
            expect(res.body.name).toBe('Local Backup');
            expect(res.body.config.path).toBe('/backup');
        });

        it('should return 404 for non-existent connector', async () => {
            const res = await request(app).get('/api/connectors/nonexistent');

            expect(res.status).toBe(404);
        });
    });

    describe('POST /api/connectors', () => {
        it('should create a new connector', async () => {
            const res = await request(app)
                .post('/api/connectors')
                .send({
                    type: 'local',
                    name: 'My Local Folder',
                    config: { path: '/data/backup' }
                });

            expect(res.status).toBe(201);
            expect(res.body.id).toBeDefined();
            expect(res.body.name).toBe('My Local Folder');
            expect(res.body.type).toBe('local');
            expect(res.body.config.path).toBe('/data/backup');
        });

        it('should return 400 when missing required fields', async () => {
            const res = await request(app)
                .post('/api/connectors')
                .send({ name: 'Incomplete' });

            expect(res.status).toBe(400);
        });
    });

    describe('PUT /api/connectors/:id', () => {
        it('should update connector name', async () => {
            db.prepare(`INSERT INTO connectors (id, type, name, config) VALUES (?, ?, ?, ?)`)
                .run('conn-1', 'local', 'Old Name', '{"path": "/backup"}');

            const res = await request(app)
                .put('/api/connectors/conn-1')
                .send({ name: 'New Name' });

            expect(res.status).toBe(200);
            expect(res.body.name).toBe('New Name');
        });

        it('should return 404 for non-existent connector', async () => {
            const res = await request(app)
                .put('/api/connectors/nonexistent')
                .send({ name: 'New Name' });

            expect(res.status).toBe(404);
        });
    });

    describe('DELETE /api/connectors/:id', () => {
        it('should delete connector', async () => {
            db.prepare(`INSERT INTO connectors (id, type, name, config) VALUES (?, ?, ?, ?)`)
                .run('conn-1', 'local', 'To Delete', '{"path": "/backup"}');

            const res = await request(app).delete('/api/connectors/conn-1');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            // Verify deleted
            const connector = db.prepare('SELECT * FROM connectors WHERE id = ?').get('conn-1');
            expect(connector).toBeUndefined();
        });

        it('should return 404 for non-existent connector', async () => {
            const res = await request(app).delete('/api/connectors/nonexistent');

            expect(res.status).toBe(404);
        });
    });
});
