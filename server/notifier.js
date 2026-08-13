import db from './db.js';
import logger from './logger.js';

let transporter = null;
let transporterConfig = '';

function getSettings() {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    for (const row of rows) {
        settings[row.key] = row.value;
    }
    return settings;
}

async function getTransporter(settings) {
    if (!settings.smtpHost) {
        logger.warn('SMTP host not configured; email notifications disabled');
        return null;
    }

    let nodemailer;
    try {
        const mod = await import('nodemailer');
        nodemailer = mod.default || mod;
    } catch {
        logger.warn('nodemailer not installed; email notifications disabled');
        return null;
    }

    const config = [settings.smtpHost, settings.smtpPort, settings.smtpUser, settings.smtpPass].join('|');
    if (!transporter || transporterConfig !== config) {
        const port = parseInt(settings.smtpPort, 10) || 587;
        transporter = nodemailer.createTransport({
            host: settings.smtpHost,
            port,
            secure: port === 465,
            auth: settings.smtpUser
                ? { user: settings.smtpUser, pass: settings.smtpPass }
                : undefined
        });
        transporterConfig = config;
    }

    return transporter;
}

async function sendEmail(settings, payload) {
    try {
        const transport = await getTransporter(settings);
        if (!transport) return;

        const subject = `[ArkVault] Backup ${payload.status}: ${payload.jobName || payload.jobId}`;
        const html = `
            <h2>ArkVault Backup ${payload.status}</h2>
            <p><strong>Job:</strong> ${payload.jobName || payload.jobId}</p>
            <p><strong>Status:</strong> ${payload.status}</p>
            ${payload.error ? `<p><strong>Error:</strong> ${payload.error}</p>` : ''}
            <p><strong>Time:</strong> ${payload.timestamp}</p>
        `;

        await transport.sendMail({
            from: settings.smtpUser || settings.notificationEmail,
            to: settings.notificationEmail,
            subject,
            html
        });

        logger.info({ jobId: payload.jobId, status: payload.status }, 'Email notification sent');
    } catch (error) {
        logger.error({ err: error, jobId: payload.jobId }, 'Email notification failed');
    }
}

async function sendWebhook(settings, payload) {
    try {
        const response = await fetch(settings.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            logger.error({ status: response.status, jobId: payload.jobId }, 'Webhook notification failed');
        } else {
            logger.info({ jobId: payload.jobId, status: payload.status }, 'Webhook notification sent');
        }
    } catch (error) {
        logger.error({ err: error, jobId: payload.jobId }, 'Webhook notification failed');
    }
}

export default async function notify(statusPayload) {
    const settings = getSettings();

    const payload = {
        jobId: statusPayload.jobId,
        jobName: statusPayload.jobName,
        status: statusPayload.status,
        error: statusPayload.error || null,
        timestamp: new Date().toISOString()
    };

    if (settings.webhookUrl) {
        await sendWebhook(settings, payload);
    }

    if (settings.notificationsEnabled === 'true' && settings.notificationEmail) {
        await sendEmail(settings, payload);
    }
}
