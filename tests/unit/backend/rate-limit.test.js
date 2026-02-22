import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('express-rate-limit', () => {
    return {
        default: vi.fn((config) => config)
    };
});

describe('Rate Limit Config', () => {
    let originalEnv;

    beforeEach(() => {
        originalEnv = process.env.NODE_ENV;
        vi.resetModules();
    });

    afterEach(() => {
        process.env.NODE_ENV = originalEnv;
    });

    it('should return higher limits in test environment', async () => {
        process.env.NODE_ENV = 'test';
        const { authRateLimiter, apiRateLimiter, downloadRateLimiter } = await import('../../../server/rate-limit-config.js?test=1');

        expect(authRateLimiter.max()).toBe(10000);
        expect(apiRateLimiter.max()).toBe(10000);
        expect(downloadRateLimiter.max()).toBe(10000);
    });

    it('should return strict limits in production environment', async () => {
        process.env.NODE_ENV = 'production';
        const { authRateLimiter, apiRateLimiter, downloadRateLimiter } = await import('../../../server/rate-limit-config.js?test=2');

        expect(authRateLimiter.max()).toBe(5);
        expect(apiRateLimiter.max()).toBe(100);
        expect(downloadRateLimiter.max()).toBe(10);
    });
});
