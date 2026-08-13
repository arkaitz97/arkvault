import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import db from '../db.js';
import logger from '../logger.js';

const router = express.Router();

const VALID_ROLES = ['admin', 'operator', 'viewer'];

router.use((req, res, next) => {
    if (req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
});

router.get('/', (req, res) => {
    const users = db.prepare('SELECT id, username, role, must_change_password, created_at FROM users ORDER BY created_at ASC').all();
    res.json(users);
});

router.post('/', async (req, res) => {
    const { username, password, role } = req.body;

    if (typeof username !== 'string' || !username.trim()) {
        return res.status(400).json({ error: 'Username is required' });
    }
    if (username.trim().length > 255) {
        return res.status(400).json({ error: 'Username must not exceed 255 characters' });
    }
    if (typeof password !== 'string' || !password) {
        return res.status(400).json({ error: 'Password is required' });
    }

    const userRole = role || 'operator';
    if (!VALID_ROLES.includes(userRole)) {
        return res.status(400).json({ error: 'Invalid role' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const id = uuidv4();
        db.prepare('INSERT INTO users (id, username, password_hash, role, must_change_password) VALUES (?, ?, ?, ?, 1)')
            .run(id, username.trim(), hashedPassword, userRole);

        const user = db.prepare('SELECT id, username, role, must_change_password, created_at FROM users WHERE id = ?').get(id);
        return res.status(201).json(user);
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(400).json({ error: 'Username already exists' });
        }
        logger.error({ err: error }, 'Create user error');
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/:id', async (req, res) => {
    const { role, password } = req.body;

    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!existing) {
        return res.status(404).json({ error: 'User not found' });
    }

    const updates = {};
    let hasChange = false;

    if (role !== undefined) {
        if (!VALID_ROLES.includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }
        updates.role = role;
        hasChange = true;
    }

    if (password !== undefined && password !== '') {
        const hashedPassword = await bcrypt.hash(password, 10);
        updates.password_hash = hashedPassword;
        updates.must_change_password = 1;
        hasChange = true;
    }

    if (hasChange) {
        const fields = [];
        const values = [];
        if (updates.role !== undefined) {
            fields.push('role = ?');
            values.push(updates.role);
        }
        if (updates.password_hash !== undefined) {
            fields.push('password_hash = ?');
            values.push(updates.password_hash);
            fields.push('must_change_password = ?');
            values.push(updates.must_change_password);
        }
        fields.push('updated_at = CURRENT_TIMESTAMP');
        values.push(req.params.id);

        db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }

    const user = db.prepare('SELECT id, username, role, must_change_password, created_at FROM users WHERE id = ?').get(req.params.id);
    return res.json(user);
});

router.delete('/:id', (req, res) => {
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!target) {
        return res.status(404).json({ error: 'User not found' });
    }

    if (target.role === 'admin') {
        const adminCount = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'").get().count;
        if (adminCount <= 1) {
            return res.status(400).json({ error: 'Cannot delete the last admin' });
        }
    }

    if (target.id === req.session.userId) {
        return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

export default router;
