import express from 'express';
import bcrypt from 'bcrypt';
import db from '../db.js';
import logger from '../logger.js';

const router = express.Router();

router.post('/login', async (req, res) => {
    const { password } = req.body;
    logger.info('Login attempt received');

    if (!password) {
        return res.status(400).json({ error: 'Password is required' });
    }

    try {
        const authSettings = db.prepare('SELECT password_hash, must_change_password FROM auth_settings WHERE id = 1').get();

        const match = await bcrypt.compare(password, authSettings.password_hash);
        logger.debug({
            match,
            receivedLength: password.length,
            hashStart: authSettings.password_hash.substring(0, 10)
        }, 'Password match result');

        if (match) {
            req.session.authenticated = true;
            req.session.mustChangePassword = !!authSettings.must_change_password;
            logger.info({ session: req.session }, 'Login successful');
            return res.json({
                authenticated: true,
                mustChangePassword: !!authSettings.must_change_password
            });
        } else {
            logger.warn('Login failed: Invalid password');
            return res.status(401).json({ error: 'Invalid password' });
        }
    } catch (error) {
        logger.error({ err: error }, 'Login error');
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            logger.error({ err }, 'Logout error');
            return res.status(500).json({ error: 'Could not log out' });
        }
        logger.info('Logout successful');
        res.clearCookie('arkvault.sid');
        res.json({ success: true });
    });
});

router.get('/status', (req, res) => {
    logger.debug({
        sessionId: req.sessionID,
        authenticated: req.session.authenticated
    }, 'Status check');
    if (req.session.authenticated) {
        res.json({
            authenticated: true,
            mustChangePassword: req.session.mustChangePassword
        });
    } else {
        res.json({ authenticated: false });
    }
});

router.post('/change-password', async (req, res) => {
    if (!req.session.authenticated) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const { newPassword, confirmPassword } = req.body;

    if (!newPassword || !confirmPassword) {
        return res.status(400).json({ error: 'New password and confirmation are required' });
    }

    if (newPassword !== confirmPassword) {
        return res.status(400).json({ error: 'Passwords do not match' });
    }

    if (newPassword.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    try {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        db.prepare('UPDATE auth_settings SET password_hash = ?, must_change_password = 0, updated_at = CURRENT_TIMESTAMP WHERE id = 1').run(hashedPassword);

        req.session.mustChangePassword = false;

        res.json({ success: true });
    } catch (error) {
        logger.error({ err: error }, 'Change password error');
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
