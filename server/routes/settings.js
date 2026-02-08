import express from 'express';
import db from '../db.js';
import logger from '../logger.js';

const router = express.Router();

db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )
`);

const defaults = {
    defaultRetention: '30',
    defaultCompression: 'true',
    defaultEncryption: 'false',
    notificationsEnabled: 'false',
    notificationEmail: ''
};

Object.entries(defaults).forEach(([key, value]) => {
    const existing = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    if (!existing) {
        db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(key, value);
    }
});

router.get('/', (req, res) => {
    try {
        const rows = db.prepare('SELECT key, value FROM settings').all();
        const settings = {};
        rows.forEach(row => {
            if (row.value === 'true') settings[row.key] = true;
            else if (row.value === 'false') settings[row.key] = false;
            else if (!isNaN(row.value) && row.value !== '') settings[row.key] = parseInt(row.value);
            else settings[row.key] = row.value;
        });
        res.json(settings);
    } catch (error) {
        logger.error({ err: error }, 'Failed to fetch settings');
        res.status(500).json({ error: error.message });
    }
});

router.put('/', (req, res) => {
    try {
        const updates = req.body;
        const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

        Object.entries(updates).forEach(([key, value]) => {
            stmt.run(key, String(value));
        });

        logger.info({ keys: Object.keys(updates) }, 'Settings updated');
        res.json({ success: true });
    } catch (error) {
        logger.error({ err: error }, 'Failed to update settings');
        res.status(500).json({ error: error.message });
    }
});

router.get('/stats', (req, res) => {
    try {
        const totalBackups = db.prepare('SELECT COUNT(*) as count FROM backup_history').get().count;
        const totalSize = db.prepare('SELECT COALESCE(SUM(size), 0) as total FROM backup_history').get().total;
        const activeJobs = db.prepare('SELECT COUNT(*) as count FROM backup_jobs WHERE is_active = 1').get().count;
        const connectors = db.prepare('SELECT COUNT(*) as count FROM connectors').get().count;

        res.json({
            totalBackups,
            totalSize,
            activeJobs,
            connectors
        });
    } catch (error) {
        logger.error({ err: error }, 'Failed to fetch stats');
        res.status(500).json({ error: error.message });
    }
});

router.post('/cleanup', (req, res) => {
    try {
        const retentionRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('defaultRetention');
        const retentionDays = parseInt(retentionRow?.value) || 30;

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        const result = db.prepare(`
            DELETE FROM backup_history 
            WHERE created_at < ? AND status = 'completed'
        `).run(cutoffDate.toISOString());

        logger.info({ deleted: result.changes, cutoffDate: cutoffDate.toISOString() }, 'Settings cleanup completed');
        res.json({
            success: true,
            deleted: result.changes,
            cutoffDate: cutoffDate.toISOString()
        });
    } catch (error) {
        logger.error({ err: error }, 'Settings cleanup failed');
        res.status(500).json({ error: error.message });
    }
});

export default router;
