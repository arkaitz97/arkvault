import express from 'express';
import bcrypt from 'bcrypt';
import db from '../db.js';

const router = express.Router();

router.post('/login', async (req, res) => {
    const { password } = req.body;
    console.log('[Server] Login attempt received');

    if (!password) {
        return res.status(400).json({ error: 'Password is required' });
    }

    try {
        const authSettings = db.prepare('SELECT password_hash, must_change_password FROM auth_settings WHERE id = 1').get();

        const match = await bcrypt.compare(password, authSettings.password_hash);
        console.log(`[Server] Password match result: ${match} | Received length: ${password.length} | DB hash: ${authSettings.password_hash.substring(0, 10)}...`);

        if (match) {
            req.session.authenticated = true;
            req.session.mustChangePassword = !!authSettings.must_change_password;
            console.log('[Server] Login successful. Session:', req.session);
            return res.json({
                authenticated: true,
                mustChangePassword: !!authSettings.must_change_password
            });
        } else {
            console.warn('[Server] Login failed: Invalid password');
            return res.status(401).json({ error: 'Invalid password' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Could not log out' });
        }
        res.clearCookie('arkvault.sid');
        res.json({ success: true });
    });
});

router.get('/status', (req, res) => {
    console.log('[Server] Status check. Session ID:', req.sessionID, 'Authenticated:', req.session.authenticated);
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
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
