import pino from 'pino';
import fs from 'fs';
import { dirname } from 'path';

const logLevel = process.env.LOG_LEVEL || 'info';
const logFile = process.env.LOG_FILE;

const streams = [
    {
        level: logLevel,
        stream: process.env.NODE_ENV !== 'production' ? pino.transport({
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
            }
        }) : process.stdout
    }
];

if (logFile) {
    try {
        const logDir = dirname(logFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        streams.push({
            level: logLevel,
            stream: fs.createWriteStream(logFile, { flags: 'a' })
        });
    } catch (error) {
        console.error('Failed to initialize file logger:', error);
    }
}

const logger = pino(
    {
        level: logLevel,
    },
    pino.multistream(streams)
);

export default logger;
