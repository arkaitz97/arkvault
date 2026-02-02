import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import connectorsRouter from './routes/connectors.js';
import jobsRouter from './routes/jobs.js';
import backupsRouter from './routes/backups.js';
import settingsRouter from './routes/settings.js';
import db from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use('/api/connectors', connectorsRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/backups', backupsRouter);
app.use('/api/settings', settingsRouter);

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
            console.log(`[${new Date().toISOString()}] Running scheduled backup: ${job.name}`);
            try {
                const response = await fetch(`http://localhost:${PORT}/api/backups/run/${job.id}`, {
                    method: 'POST'
                });
                const result = await response.json();
                console.log(`[${new Date().toISOString()}] Backup ${job.name} completed:`, result);
            } catch (error) {
                console.error(`[${new Date().toISOString()}] Backup ${job.name} failed:`, error);
            }
        });
        scheduledTasks.set(job.id, task);
        console.log(`Scheduled job: ${job.name} (${job.id}) with cron: ${job.schedule}`);
    }
}

function unscheduleJob(jobId) {
    if (scheduledTasks.has(jobId)) {
        scheduledTasks.get(jobId).stop();
        scheduledTasks.delete(jobId);
        console.log(`Unscheduled job: ${jobId}`);
    }
}

function refreshAllSchedules() {
    console.log('Refreshing all job schedules...');

    scheduledTasks.forEach((task, id) => {
        task.stop();
    });
    scheduledTasks.clear();

    const jobs = db.prepare(`
        SELECT * FROM jobs WHERE status = 'active' AND schedule IS NOT NULL
    `).all();

    jobs.forEach(job => {
        scheduleJob(job);
    });

    console.log(`Scheduled ${jobs.length} active jobs`);
}

export { scheduleJob, unscheduleJob, refreshAllSchedules };

app.listen(PORT, () => {
    console.log(`Backup server running on http://localhost:${PORT}`);
    refreshAllSchedules();

    cron.schedule('* * * * *', () => {
        refreshAllSchedules();
    });
});

export default app;
