import { describe, it, expect, vi, beforeEach } from 'vitest';
import { connectorsAPI } from '../../../src/api';

// Mock fetch
global.fetch = vi.fn(() =>
    Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
    })
);

describe('API Client', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should include credentials in requests', async () => {
        await connectorsAPI.getAll();

        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/connectors'),
            expect.objectContaining({
                credentials: 'include'
            })
        );
    });
});
