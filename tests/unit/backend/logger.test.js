import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';

vi.mock('fs');
vi.mock('pino', () => {
    const pinoFunc = vi.fn(() => ({ info: vi.fn(), error: vi.fn(), assign: vi.fn() }));
    pinoFunc.transport = vi.fn();
    pinoFunc.multistream = vi.fn(() => []);
    return {
        default: pinoFunc
    };
});

describe('Logger', () => {
    let originalEnv;

    beforeEach(() => {
        originalEnv = process.env.LOG_FILE;
        vi.resetModules();
        vi.clearAllMocks();
    });

    afterEach(() => {
        process.env.LOG_FILE = originalEnv;
    });

    it('should initialize without log file', async () => {
        delete process.env.LOG_FILE;
        await import('../../../server/logger.js?1');
        expect(fs.createWriteStream).not.toHaveBeenCalled();
    });

    it('should create log directory and stream if LOG_FILE is set', async () => {
        process.env.LOG_FILE = '/fake/logs/app.log';
        fs.existsSync.mockReturnValue(false);
        fs.mkdirSync.mockImplementation(() => { });
        fs.createWriteStream.mockReturnValue({});

        await import('../../../server/logger.js?2');

        expect(fs.existsSync).toHaveBeenCalledWith('/fake/logs');
        expect(fs.mkdirSync).toHaveBeenCalledWith('/fake/logs', { recursive: true });
        expect(fs.createWriteStream).toHaveBeenCalledWith('/fake/logs/app.log', { flags: 'a' });
    });

    it('should not create directory if it exists', async () => {
        process.env.LOG_FILE = '/fake/logs/app.log';
        fs.existsSync.mockReturnValue(true);
        fs.createWriteStream.mockReturnValue({});

        await import('../../../server/logger.js?2b');

        expect(fs.mkdirSync).not.toHaveBeenCalled();
        expect(fs.createWriteStream).toHaveBeenCalledWith('/fake/logs/app.log', { flags: 'a' });
    });

    it('should handle errors when creating log directory', async () => {
        process.env.LOG_FILE = '/fake/logs/app.log';
        fs.existsSync.mockImplementation(() => { throw new Error('Mock error'); });

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        await import('../../../server/logger.js?3');

        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to initialize file logger:', expect.any(Error));
        consoleErrorSpy.mockRestore();
    });
});
