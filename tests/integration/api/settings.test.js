import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create test database and app
let db;
let app;
const testDbPath = join(__dirname, 'test-settings.db');

beforeAll(async () => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
    }

    // Create test database
    db = new Database(testDbPath);

    // Create settings table
    db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    `);

    // Create other tables needed for stats
    db.exec(`
        CREATE TABLE IF NOT EXISTS backup_history (
            id TEXT PRIMARY KEY,
            size INTEGER DEFAULT 0,
            status TEXT DEFAULT 'completed',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS backup_jobs (
            id TEXT PRIMARY KEY,
            is_active INTEGER DEFAULT 1
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS connectors (
            id TEXT PRIMARY KEY
        )
    `);

    // Create Express app with settings routes inline
    app = express();
    app.use(express.json());

    // Default settings
    const defaults = {
        defaultRetention: '30',
        defaultCompression: 'true',
        defaultEncryption: 'false',
        notificationsEnabled: 'false',
        notificationEmail: ''
    };

    // Insert defaults
    Object.entries(defaults).forEach(([key, value]) => {
        const existing = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
        if (!existing) {
            db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(key, value);
        }
    });

    // GET settings
    app.get('/api/settings', (req, res) => {
        const rows = db.prepare('SELECT key, value FROM settings').all();
        const settings = {};
        rows.forEach(row => {
            if (row.value === 'true') settings[row.key] = true;
            else if (row.value === 'false') settings[row.key] = false;
            else if (!isNaN(row.value) && row.value !== '') settings[row.key] = parseInt(row.value);
            else settings[row.key] = row.value;
        });
        res.json(settings);
    });

    // PUT settings
    app.put('/api/settings', (req, res) => {
        const updates = req.body;
        const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
        Object.entries(updates).forEach(([key, value]) => {
            stmt.run(key, String(value));
        });
        res.json({ success: true });
    });

    // GET stats
    app.get('/api/settings/stats', (req, res) => {
        const totalBackups = db.prepare('SELECT COUNT(*) as count FROM backup_history').get().count;
        const totalSize = db.prepare('SELECT COALESCE(SUM(size), 0) as total FROM backup_history').get().total;
        const activeJobs = db.prepare('SELECT COUNT(*) as count FROM backup_jobs WHERE is_active = 1').get().count;
        const connectors = db.prepare('SELECT COUNT(*) as count FROM connectors').get().count;
        res.json({ totalBackups, totalSize, activeJobs, connectors });
    });

    // POST cleanup
    app.post('/api/settings/cleanup', (req, res) => {
        const retentionRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('defaultRetention');
        const retentionDays = parseInt(retentionRow?.value) || 30;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        const result = db.prepare(`
            DELETE FROM backup_history 
            WHERE created_at < ? AND status = 'completed'
        `).run(cutoffDate.toISOString());

        res.json({ success: true, deleted: result.changes });
    });
});

afterAll(() => {
    if (db) db.close();
    if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
    }
});

describe('Settings API', () => {
    it('GET /api/settings - should return default settings', async () => {
        const res = await request(app).get('/api/settings');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('defaultRetention', 30);
        expect(res.body).toHaveProperty('defaultCompression', true);
        expect(res.body).toHaveProperty('defaultEncryption', false);
    });

    it('PUT /api/settings - should update settings', async () => {
        const res = await request(app)
            .put('/api/settings')
            .send({ defaultRetention: 60, defaultEncryption: true });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        // Verify update
        const verify = await request(app).get('/api/settings');
        expect(verify.body.defaultRetention).toBe(60);
        expect(verify.body.defaultEncryption).toBe(true);
    });

    it('GET /api/settings/stats - should return database stats', async () => {
        const res = await request(app).get('/api/settings/stats');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('totalBackups');
        expect(res.body).toHaveProperty('totalSize');
        expect(res.body).toHaveProperty('activeJobs');
        expect(res.body).toHaveProperty('connectors');
    });

    it('POST /api/settings/cleanup - should run cleanup', async () => {
        const res = await request(app).post('/api/settings/cleanup');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        expect(res.body).toHaveProperty('deleted');
    });
});
