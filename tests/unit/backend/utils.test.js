import { describe, it, expect } from 'vitest';
import { calculateNextRun, formatBytes } from '../../../server/utils.js';

describe('calculateNextRun', () => {
    it('should return a date string for valid cron expression', () => {
        const result = calculateNextRun('0 * * * *');
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
        expect(new Date(result).toString()).not.toBe('Invalid Date');
    });

    it('should return a future date', () => {
        const result = calculateNextRun('0 0 * * *');
        const nextDate = new Date(result);
        const now = new Date();
        expect(nextDate.getTime()).toBeGreaterThan(now.getTime());
    });

    it('should handle daily schedule', () => {
        const result = calculateNextRun('0 2 * * *');
        expect(result).toBeDefined();
    });

    it('should handle weekly schedule', () => {
        const result = calculateNextRun('0 2 * * 0');
        expect(result).toBeDefined();
    });

    it('should return null for invalid cron', () => {
        const result = calculateNextRun('invalid');
        expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
        const result = calculateNextRun('');
        expect(result).toBeNull();
    });
});

describe('formatBytes', () => {
    it('should return "0 B" for 0 bytes', () => {
        expect(formatBytes(0)).toBe('0 B');
    });

    it('should return "0 B" for null input', () => {
        expect(formatBytes(null)).toBe('0 B');
    });

    it('should return "0 B" for undefined input', () => {
        expect(formatBytes(undefined)).toBe('0 B');
    });

    it('should format bytes correctly', () => {
        expect(formatBytes(500)).toBe('500 B');
    });

    it('should format kilobytes correctly', () => {
        expect(formatBytes(1024)).toBe('1 KB');
        expect(formatBytes(2048)).toBe('2 KB');
    });

    it('should format megabytes correctly', () => {
        expect(formatBytes(1024 * 1024)).toBe('1 MB');
        expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB');
    });

    it('should format gigabytes correctly', () => {
        expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    });

    it('should handle decimal values', () => {
        const result = formatBytes(1536);
        expect(result).toBe('1.5 KB');
    });
});
