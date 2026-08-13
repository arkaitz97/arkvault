import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import session from 'express-session';
import authRouter from './routes/auth.js';
import connectorsRouter from './routes/connectors.js';
import jobsRouter from './routes/jobs.js';
import backupsRouter, { cleanupExpiredBackups } from './routes/backups.js';
import settingsRouter from './routes/settings.js';
import usersRouter from './routes/users.js';
import tokensRouter from './routes/tokens.js';
import pinoHttp from 'pino-http';
import logger from './logger.js';
import db from './db.js';
import { configureHelmet } from './helmet-config.js';
import { apiRateLimiter } from './rate-limit-config.js';
import { errorHandler } from './middleware/error-handler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const INTERNAL_TRIGGER_SECRET = process.env.INTERNAL_TRIGGER_SECRET || 'arkvault-internal-trigger-change-me';

configureHelmet(app);

const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600
}));

app.use(pinoHttp({ logger }));
app.use(express.json({ limit: '50mb' }));
app.use(apiRateLimiter);

app.use(session({
    name: 'arkvault.sid',
    secret: process.env.SESSION_SECRET || 'backup-app-secret-change-me-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 8 * 60 * 60 * 1000
    }
}));

app.use('/api/auth', authRouter);

app.use('/api', (req, res, next) => {
    if (req.path === '/auth/login' || req.path === '/auth/status' || req.path === '/health') {
        return next();
    }

    if (req.method === 'POST' && req.path.startsWith('/backups/run/') && req.get('x-internal-trigger') === INTERNAL_TRIGGER_SECRET) {
        return next();
    }

    const authHeader = req.get('authorization') || '';
    if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7).trim();
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const row = db.prepare('SELECT id, name, scopes FROM api_tokens WHERE token_hash = ? AND revoked = 0').get(tokenHash);
        if (row) {
            req.session.authenticated = true;
            req.session.role = 'operator';
            req.session.username = 'api:' + (row.name || 'token');
            req.tokenScopes = JSON.parse(row.scopes || '[]');
            return next();
        }
    }

    if (!req.session.authenticated) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.session.mustChangePassword && req.path !== '/auth/change-password') {
        return res.status(403).json({ error: 'Must change password', code: 'MUST_CHANGE_PASSWORD' });
    }

    if (req.session.role === 'viewer' && req.method !== 'GET' && !req.path.startsWith('/auth/')) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    next();
});

app.use('/api/connectors', connectorsRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/backups', backupsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/users', usersRouter);
app.use('/api/tokens', tokensRouter);

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

if (process.env.NODE_ENV === 'production') {
    app.use(express.static(join(__dirname, '../dist')));

    app.get('{*path}', (req, res) => {
        if (!req.path.startsWith('/api')) {
            res.sendFile(join(__dirname, '../dist/index.html'));
        }
    });
}

const scheduledTasks = new Map();

function scheduleJob(job) {
    if (scheduledTasks.has(job.id)) {
        scheduledTasks.get(job.id).stop();
        scheduledTasks.delete(job.id);
    }

    if (job.status === 'active' && job.schedule && cron.validate(job.schedule)) {
        const task = cron.schedule(job.schedule, async () => {
            logger.info({ jobId: job.id, jobName: job.name }, 'Running scheduled backup');
            try {
                const response = await fetch(`http://localhost:${PORT}/api/backups/run/${job.id}`, {
                    method: 'POST',
                    headers: { 'x-internal-trigger': INTERNAL_TRIGGER_SECRET }
                });
                const result = await response.json();
                logger.info({ jobId: job.id, jobName: job.name, result }, 'Backup completed');
            } catch (error) {
                logger.error({ jobId: job.id, jobName: job.name, err: error }, 'Backup failed');
            }
        });
        scheduledTasks.set(job.id, task);
        logger.info({ jobId: job.id, jobName: job.name, schedule: job.schedule }, 'Scheduled job');
    }
}

function unscheduleJob(jobId) {
    if (scheduledTasks.has(jobId)) {
        scheduledTasks.get(jobId).stop();
        scheduledTasks.delete(jobId);
        logger.info({ jobId }, 'Unscheduled job');
    }
}

function refreshAllSchedules() {
    logger.info('Refreshing all job schedules...');

    scheduledTasks.forEach((task) => {
        task.stop();
    });
    scheduledTasks.clear();

    const jobs = db.prepare(`
        SELECT * FROM jobs WHERE status = 'active' AND schedule IS NOT NULL
    `).all();

    jobs.forEach(job => {
        scheduleJob(job);
    });

    logger.info({ count: jobs.length }, 'Scheduled active jobs');
}

export { scheduleJob, unscheduleJob, refreshAllSchedules };

app.use(errorHandler);

app.listen(PORT, () => {
    logger.info({ port: PORT }, 'Backup server running');
    refreshAllSchedules();

    cron.schedule('* * * * *', () => {
        refreshAllSchedules();
    });

    cron.schedule('0 3 * * *', async () => {
        try {
            const result = await cleanupExpiredBackups();
            logger.info({ deleted: result.deleted }, 'Scheduled backup cleanup completed');
        } catch (error) {
            logger.error({ err: error }, 'Scheduled backup cleanup failed');
        }
    });
});

export default app;
