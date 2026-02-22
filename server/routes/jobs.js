import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import logger from '../logger.js';
import { calculateNextRun } from '../utils.js';
import { validateJobCreation, validateUUID } from '../middleware/validation-middleware.js';

const router = express.Router();

router.get('/', (req, res) => {
    try {
        const jobs = db.prepare('SELECT * FROM jobs ORDER BY created_at DESC').all();
        const parsed = jobs.map(j => ({
            ...j,
            source_config: j.source_config ? JSON.parse(j.source_config) : null,
            destination_config: j.destination_config ? JSON.parse(j.destination_config) : null,
            compression: !!j.compression,
            encryption: !!j.encryption,
            incremental: !!j.incremental
        }));
        res.json(parsed);
    } catch (error) {
        logger.error({ err: error }, 'Failed to fetch jobs');
        res.status(500).json({ error: error.message });
    }
});

router.get('/:id', validateUUID, (req, res) => {
    try {
        const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }
        res.json({
            ...job,
            source_config: job.source_config ? JSON.parse(job.source_config) : null,
            destination_config: job.destination_config ? JSON.parse(job.destination_config) : null,
            compression: !!job.compression,
            encryption: !!job.encryption,
            incremental: !!job.incremental
        });
    } catch (error) {
        logger.error({ err: error, jobId: req.params.id }, 'Failed to fetch job');
        res.status(500).json({ error: error.message });
    }
});

router.post('/', validateJobCreation, (req, res) => {
    try {
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
            encryption = true,
            format = 'zip',
            incremental = false
        } = req.body;

        const id = uuidv4();
        const nextRun = calculateNextRun(schedule);

        db.prepare(`
      INSERT INTO jobs (
        id, name, source_type, source_connector_id, source_config,
        destination_type, destination_connector_id, destination_config,
        schedule, schedule_description, retention, compression, encryption, next_run, format, incremental
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            id, name, source_type, source_connector_id,
            source_config ? JSON.stringify(source_config) : null,
            destination_type, destination_connector_id,
            destination_config ? JSON.stringify(destination_config) : null,
            schedule, schedule_description, retention,
            compression ? 1 : 0, encryption ? 1 : 0, nextRun, format, incremental ? 1 : 0
        );

        const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
        logger.info({ jobId: id, name, sourceType: source_type, destType: destination_type }, 'Job created');
        res.status(201).json({
            ...job,
            source_config: job.source_config ? JSON.parse(job.source_config) : null,
            destination_config: job.destination_config ? JSON.parse(job.destination_config) : null,
            incremental: !!job.incremental
        });
    } catch (error) {
        logger.error({ err: error, name }, 'Failed to create job');
        res.status(500).json({ error: error.message });
    }
});

router.put('/:id', validateUUID, validateJobCreation, (req, res) => {
    try {
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
            retention,
            compression,
            encryption,
            status,
            format,
            incremental
        } = req.body;

        const nextRun = schedule ? calculateNextRun(schedule) : null;

        db.prepare(`
      UPDATE jobs SET
        name = COALESCE(?, name),
        source_type = COALESCE(?, source_type),
        source_connector_id = COALESCE(?, source_connector_id),
        source_config = COALESCE(?, source_config),
        destination_type = COALESCE(?, destination_type),
        destination_connector_id = COALESCE(?, destination_connector_id),
        destination_config = COALESCE(?, destination_config),
        schedule = COALESCE(?, schedule),
        schedule_description = COALESCE(?, schedule_description),
        retention = COALESCE(?, retention),
        compression = COALESCE(?, compression),
        encryption = COALESCE(?, encryption),
        status = COALESCE(?, status),
        next_run = COALESCE(?, next_run),
        format = COALESCE(?, format),
        incremental = COALESCE(?, incremental),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
            name, source_type, source_connector_id,
            source_config ? JSON.stringify(source_config) : null,
            destination_type, destination_connector_id,
            destination_config ? JSON.stringify(destination_config) : null,
            schedule, schedule_description, retention,
            compression !== undefined ? (compression ? 1 : 0) : null,
            encryption !== undefined ? (encryption ? 1 : 0) : null,
            status, nextRun, format,
            incremental !== undefined ? (incremental ? 1 : 0) : null,
            req.params.id
        );

        const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
        if (!job) {
            logger.warn({ jobId: req.params.id }, 'Job not found for update');
            return res.status(404).json({ error: 'Job not found' });
        }
        logger.info({ jobId: req.params.id, name }, 'Job updated');
        res.json({
            ...job,
            source_config: job.source_config ? JSON.parse(job.source_config) : null,
            destination_config: job.destination_config ? JSON.parse(job.destination_config) : null,
            incremental: !!job.incremental
        });
    } catch (error) {
        logger.error({ err: error, jobId: req.params.id }, 'Failed to update job');
        res.status(500).json({ error: error.message });
    }
});

router.delete('/:id', validateUUID, (req, res) => {
    try {
        const result = db.prepare('DELETE FROM jobs WHERE id = ?').run(req.params.id);
        if (result.changes === 0) {
            logger.warn({ jobId: req.params.id }, 'Job not found for deletion');
            return res.status(404).json({ error: 'Job not found' });
        }
        logger.info({ jobId: req.params.id }, 'Job deleted');
        res.json({ success: true });
    } catch (error) {
        logger.error({ err: error, jobId: req.params.id }, 'Failed to delete job');
        res.status(500).json({ error: error.message });
    }
});

router.post('/:id/toggle', validateUUID, (req, res) => {
    try {
        const job = db.prepare('SELECT status FROM jobs WHERE id = ?').get(req.params.id);
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        const newStatus = job.status === 'active' ? 'paused' : 'active';
        db.prepare('UPDATE jobs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(newStatus, req.params.id);

        logger.info({ jobId: req.params.id, status: newStatus }, 'Job status toggled');
        res.json({ status: newStatus });
    } catch (error) {
        logger.error({ err: error, jobId: req.params.id }, 'Failed to toggle job status');
        res.status(500).json({ error: error.message });
    }
});

export default router;
