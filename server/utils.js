import cron from 'node-cron';

export function calculateNextRun(cronExpression) {
    if (!cronExpression || !cron.validate(cronExpression)) {
        return null;
    }

    const now = new Date();
    const parts = cronExpression.split(' ');

    if (cronExpression === '0 * * * *') {
        const next = new Date(now);
        next.setHours(next.getHours() + 1);
        next.setMinutes(0);
        next.setSeconds(0);
        return next.toISOString();
    }

    if (cronExpression.match(/^0 \d+ \* \* \*$/)) {
        const hour = parseInt(parts[1]);
        const next = new Date(now);
        if (now.getHours() >= hour) {
            next.setDate(next.getDate() + 1);
        }
        next.setHours(hour);
        next.setMinutes(0);
        next.setSeconds(0);
        return next.toISOString();
    }

    if (cronExpression.match(/^0 \d+ \* \* 0$/)) {
        const hour = parseInt(parts[1]);
        const next = new Date(now);
        const daysUntilSunday = (7 - next.getDay()) % 7 || 7;
        next.setDate(next.getDate() + daysUntilSunday);
        next.setHours(hour);
        next.setMinutes(0);
        next.setSeconds(0);
        return next.toISOString();
    }

    if (cronExpression.match(/^0 \d+ 1 \* \*$/)) {
        const hour = parseInt(parts[1]);
        const next = new Date(now);
        next.setMonth(next.getMonth() + 1);
        next.setDate(1);
        next.setHours(hour);
        next.setMinutes(0);
        next.setSeconds(0);
        return next.toISOString();
    }

    const next = new Date(now);
    next.setHours(next.getHours() + 1);
    next.setMinutes(0);
    next.setSeconds(0);
    return next.toISOString();
}

export function formatBytes(bytes) {
    if (bytes === null || bytes === undefined || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
