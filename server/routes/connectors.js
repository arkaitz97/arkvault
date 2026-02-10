import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import logger from '../logger.js';
import { getConnector } from '../connectors/index.js';
import { validateConnectorCreation, validateUUID } from '../middleware/validation-middleware.js';

const router = express.Router();

router.get('/', (req, res) => {
    try {
        const connectors = db.prepare('SELECT * FROM connectors ORDER BY created_at DESC').all();
        const parsed = connectors.map(c => ({
            ...c,
            config: JSON.parse(c.config)
        }));
        res.json(parsed);
    } catch (error) {
        logger.error({ err: error }, 'Failed to fetch connectors');
        res.status(500).json({ error: error.message });
    }
});

router.get('/:id', validateUUID, (req, res) => {
    try {
        const connector = db.prepare('SELECT * FROM connectors WHERE id = ?').get(req.params.id);
        if (!connector) {
            return res.status(404).json({ error: 'Connector not found' });
        }
        res.json({ ...connector, config: JSON.parse(connector.config) });
    } catch (error) {
        logger.error({ err: error, connectorId: req.params.id }, 'Failed to fetch connector');
        res.status(500).json({ error: error.message });
    }
});

router.post('/', validateConnectorCreation, (req, res) => {
    try {
        const { type, name, config } = req.body;
        const id = uuidv4();

        db.prepare(`
      INSERT INTO connectors (id, type, name, config)
      VALUES (?, ?, ?, ?)
    `).run(id, type, name, JSON.stringify(config));

        const connector = db.prepare('SELECT * FROM connectors WHERE id = ?').get(id);
        logger.info({ connectorId: id, type, name }, 'Connector created');
        res.status(201).json({ ...connector, config: JSON.parse(connector.config) });
    } catch (error) {
        logger.error({ err: error, type, name }, 'Failed to create connector');
        res.status(500).json({ error: error.message });
    }
});

router.put('/:id', validateUUID, validateConnectorCreation, (req, res) => {
    try {
        const { type, name, config } = req.body;

        db.prepare(`
      UPDATE connectors 
      SET type = ?, name = ?, config = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(type, name, JSON.stringify(config), req.params.id);

        const connector = db.prepare('SELECT * FROM connectors WHERE id = ?').get(req.params.id);
        if (!connector) {
            return res.status(404).json({ error: 'Connector not found' });
        }
        res.json({ ...connector, config: JSON.parse(connector.config) });
    } catch (error) {
        logger.error({ err: error, connectorId: req.params.id }, 'Failed to update connector');
        res.status(500).json({ error: error.message });
    }
});

router.delete('/:id', validateUUID, (req, res) => {
    try {
        const result = db.prepare('DELETE FROM connectors WHERE id = ?').run(req.params.id);
        if (result.changes === 0) {
            logger.warn({ connectorId: req.params.id }, 'Connector not found for deletion');
            return res.status(404).json({ error: 'Connector not found' });
        }
        logger.info({ connectorId: req.params.id }, 'Connector deleted');
        res.json({ success: true });
    } catch (error) {
        logger.error({ err: error, connectorId: req.params.id }, 'Failed to delete connector');
        res.status(500).json({ error: error.message });
    }
});

router.post('/:id/test', validateUUID, async (req, res) => {
    try {
        const connector = db.prepare('SELECT * FROM connectors WHERE id = ?').get(req.params.id);
        if (!connector) {
            return res.status(404).json({ error: 'Connector not found' });
        }

        const config = JSON.parse(connector.config);
        const connectorInstance = getConnector(connector.type);

        const result = await connectorInstance.testConnection(config);

        db.prepare(`
      UPDATE connectors 
      SET status = ?, last_tested = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(result.success ? 'connected' : 'disconnected', req.params.id);

        logger.info({ connectorId: req.params.id, success: result.success }, 'Connector test completed');
        res.json(result);
    } catch (error) {
        logger.error({ err: error, connectorId: req.params.id }, 'Connector test failed');
        res.status(500).json({ error: error.message, success: false });
    }
});

router.post('/test', async (req, res) => {
    try {
        const { type, config } = req.body;
        const connectorInstance = getConnector(type);
        const result = await connectorInstance.testConnection(config);
        logger.info({ type }, 'Ad-hoc connector test completed');
        res.json(result);
    } catch (error) {
        logger.error({ err: error, type }, 'Ad-hoc connector test failed');
        res.status(500).json({ error: error.message, success: false });
    }
});

export default router;
