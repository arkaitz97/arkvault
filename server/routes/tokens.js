import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import db from '../db.js';

const router = express.Router();

router.use((req, res, next) => {
    if (req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
});

router.get('/', (req, res) => {
    const rows = db.prepare('SELECT id, name, scopes, created_at, revoked FROM api_tokens ORDER BY created_at DESC').all();
    const tokens = rows.map((row) => ({
        id: row.id,
        name: row.name,
        scopes: JSON.parse(row.scopes || '[]'),
        created_at: row.created_at,
        revoked: row.revoked
    }));
    res.json(tokens);
});

router.post('/', (req, res) => {
    const { name, scopes } = req.body;

    if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Name is required' });
    }
    if (name.trim().length > 255) {
        return res.status(400).json({ error: 'Name must not exceed 255 characters' });
    }

    const tokenScopes = Array.isArray(scopes) && scopes.every((s) => typeof s === 'string')
        ? scopes
        : [];

    const token = 'arkvault_' + crypto.randomBytes(24).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const id = uuidv4();

    db.prepare('INSERT INTO api_tokens (id, name, token_hash, scopes, revoked) VALUES (?, ?, ?, ?, 0)')
        .run(id, name.trim(), hash, JSON.stringify(tokenScopes));

    return res.status(201).json({ id, name: name.trim(), scopes: tokenScopes, token });
});

router.delete('/:id', (req, res) => {
    const existing = db.prepare('SELECT id FROM api_tokens WHERE id = ?').get(req.params.id);
    if (!existing) {
        return res.status(404).json({ error: 'Token not found' });
    }

    db.prepare('UPDATE api_tokens SET revoked = 1 WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

export default router;
