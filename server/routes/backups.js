import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import logger from '../logger.js';
import { getConnector } from '../connectors/index.js';
import { calculateNextRun } from '../utils.js';

const router = express.Router();

router.get('/history', (req, res) => {
    try {
        const history = db.prepare(`
      SELECT * FROM backup_history 
      ORDER BY start_time DESC 
      LIMIT 100
    `).all();
        res.json(history);
    } catch (error) {
        logger.error({ err: error }, 'Failed to fetch backup history');
        res.status(500).json({ error: error.message });
    }
});

router.get('/available', (req, res) => {
    try {
        const backups = db.prepare(`
      SELECT * FROM available_backups 
      WHERE expires_at IS NULL OR expires_at > datetime('now')
      ORDER BY timestamp DESC
    `).all();
        res.json(backups);
    } catch (error) {
        logger.error({ err: error }, 'Failed to fetch available backups');
        res.status(500).json({ error: error.message });
    }
});

router.post('/run/:jobId', async (req, res) => {
    const historyId = uuidv4();

    try {
        const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.jobId);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        db.prepare(`
      INSERT INTO backup_history (id, job_id, job_name, start_time, status, destination)
      VALUES (?, ?, ?, datetime('now'), 'running', ?)
    `).run(historyId, job.id, job.name, job.destination_type);

        let sourceConfig;
        if (job.source_connector_id) {
            const connector = db.prepare('SELECT * FROM connectors WHERE id = ?').get(job.source_connector_id);
            sourceConfig = JSON.parse(connector.config);
        } else {
            sourceConfig = JSON.parse(job.source_config);
        }

        let destConfig;
        if (job.destination_connector_id) {
            const connector = db.prepare('SELECT * FROM connectors WHERE id = ?').get(job.destination_connector_id);
            destConfig = JSON.parse(connector.config);
        } else {
            destConfig = JSON.parse(job.destination_config);
        }

        const sourceConnector = getConnector(job.source_type);
        const destConnector = getConnector(job.destination_type);

        const backupResult = await sourceConnector.backup(sourceConfig, {
            compression: !!job.compression,
            encryption: !!job.encryption,
            format: job.format || 'zip',
            incremental: !!job.incremental,
            lastRun: job.last_run_status === 'success' ? job.last_run : null
        });

        const uploadResult = await destConnector.upload(
            backupResult.data,
            backupResult.filename,
            destConfig
        );

        db.prepare(`
      UPDATE backup_history SET
        end_time = datetime('now'),
        status = 'success',
        size = ?,
        files_processed = ?,
        backup_location = ?
      WHERE id = ?
    `).run(backupResult.size, backupResult.filesProcessed, uploadResult.location, historyId);

        const backupId = uuidv4();
        const expiresAt = job.retention
            ? new Date(Date.now() + job.retention * 24 * 60 * 60 * 1000).toISOString()
            : null;

        db.prepare(`
      INSERT INTO available_backups (id, job_id, job_name, timestamp, size, encrypted, compressed, location, expires_at)
      VALUES (?, ?, ?, datetime('now'), ?, ?, ?, ?, ?)
    `).run(
            backupId, job.id, job.name, backupResult.size,
            job.encryption ? 1 : 0, job.compression ? 1 : 0,
            uploadResult.location, expiresAt
        );

        const nextRun = calculateNextRun(job.schedule);
        db.prepare(`
      UPDATE jobs SET 
        last_run = datetime('now'),
        last_run_status = 'success',
        next_run = ?
      WHERE id = ?
    `).run(nextRun, job.id);

        res.json({
            success: true,
            historyId,
            backupId,
            size: backupResult.size,
            filesProcessed: backupResult.filesProcessed,
            location: uploadResult.location
        });
    } catch (error) {
        db.prepare(`
      UPDATE backup_history SET
        end_time = datetime('now'),
        status = 'failed',
        error = ?
      WHERE id = ?
    `).run(error.message, historyId);

        db.prepare(`
      UPDATE jobs SET 
        last_run = datetime('now'),
        last_run_status = 'failed'
      WHERE id = ?
    `).run(req.params.jobId);

        logger.error({ err: error, jobId: req.params.jobId }, 'Backup run failed');
        res.status(500).json({ error: error.message, success: false });
    }
});

router.post('/restore/:backupId', async (req, res) => {
    try {
        const backup = db.prepare('SELECT * FROM available_backups WHERE id = ?').get(req.params.backupId);
        if (!backup) {
            return res.status(404).json({ error: 'Backup not found' });
        }

        const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(backup.job_id);
        const { destination_type, destination_path } = req.body;

        let sourceConfig;
        if (job.destination_connector_id) {
            const connector = db.prepare('SELECT * FROM connectors WHERE id = ?').get(job.destination_connector_id);
            sourceConfig = JSON.parse(connector.config);
        } else {
            sourceConfig = JSON.parse(job.destination_config);
        }

        const sourceConnector = getConnector(job.destination_type);

        const backupData = await sourceConnector.download(backup.location, sourceConfig);

        const destConnector = getConnector(destination_type);

        const result = await destConnector.restore(backupData, {
            path: destination_path,
            encrypted: !!backup.encrypted,
            compressed: !!backup.compressed
        });

        res.json({
            success: true,
            filesRestored: result.filesRestored,
            destination: destination_path
        });
    } catch (error) {
        logger.error({ err: error, jobId: req.params.jobId }, 'Manual backup run failed');
        res.status(500).json({ error: error.message, success: false });
    }
});

router.get('/available/:id', (req, res) => {
    try {
        const backup = db.prepare('SELECT * FROM available_backups WHERE id = ?').get(req.params.id);
        if (!backup) {
            return res.status(404).json({ error: 'Backup not found' });
        }
        res.json(backup);
    } catch (error) {
        logger.error({ err: error, backupId: req.params.id }, 'Failed to fetch backup details');
        res.status(500).json({ error: error.message });
    }
});

router.get('/download/:historyId', async (req, res) => {
    try {
        const history = db.prepare('SELECT * FROM backup_history WHERE id = ?').get(req.params.historyId);
        if (!history) {
            return res.status(404).json({ error: 'History entry not found' });
        }

        if (!history.backup_location) {
            return res.status(404).json({ error: 'No backup file associated with this entry' });
        }

        const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(history.job_id);
        if (!job) {
            return res.status(404).json({ error: 'Associated job not found' });
        }

        let destConfig;
        if (job.destination_connector_id) {
            const connector = db.prepare('SELECT * FROM connectors WHERE id = ?').get(job.destination_connector_id);
            if (connector) destConfig = JSON.parse(connector.config);
        } else if (job.destination_config) {
            destConfig = JSON.parse(job.destination_config);
        }

        const destConnector = getConnector(job.destination_type);
        const backupData = await destConnector.download(history.backup_location, destConfig);

        const filename = history.backup_location.split('/').pop();
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(backupData);
    } catch (error) {
        logger.error({ err: error, historyId: req.params.historyId }, 'Backup download failed');
        res.status(500).json({ error: error.message });
    }
});

router.delete('/history/:id', (req, res) => {
    try {
        const result = db.prepare('DELETE FROM backup_history WHERE id = ?').run(req.params.id);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'History entry not found' });
        }
        res.json({ success: true });
    } catch (error) {
        logger.error({ err: error, historyId: req.params.id }, 'Failed to delete history entry');
        res.status(500).json({ error: error.message });
    }
});

router.delete('/available/:id', async (req, res) => {
    try {
        const backup = db.prepare('SELECT * FROM available_backups WHERE id = ?').get(req.params.id);
        if (!backup) {
            return res.status(404).json({ error: 'Backup not found' });
        }

        const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(backup.job_id);
        if (job) {
            if (job.destination_type === 'local' && backup.location) {
                const fs = await import('fs/promises');
                try {
                    await fs.unlink(backup.location);
                } catch (e) {
                    if (e.code !== 'ENOENT') logger.error({ err: e }, 'Failed to delete backup file');
                }
            }
        }

        db.prepare('DELETE FROM available_backups WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (error) {
        logger.error({ err: error, backupId: req.params.id }, 'Failed to delete backup');
        res.status(500).json({ error: error.message });
    }
});

router.delete('/cleanup', (req, res) => {
    try {
        const result = db.prepare(`
      DELETE FROM available_backups 
      WHERE expires_at IS NOT NULL AND expires_at < datetime('now')
    `).run();
        res.json({ deleted: result.changes });
    } catch (error) {
        logger.error({ err: error }, 'Backup cleanup failed');
        res.status(500).json({ error: error.message });
    }
});

export default router;
