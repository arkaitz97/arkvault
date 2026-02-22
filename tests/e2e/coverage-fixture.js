import { test as baseTest, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export const test = baseTest.extend({
    coverage: [async ({ page }, use) => {
        await use();

        // Extract coverage
        const coverage = await page.evaluate(() => window.__coverage__).catch(() => null);
        if (coverage && Object.keys(coverage).length > 0) {
            if (!fs.existsSync('.nyc_output')) {
                fs.mkdirSync('.nyc_output', { recursive: true });
            }
            fs.writeFileSync(`.nyc_output/coverage-${crypto.randomUUID()}.json`, JSON.stringify(coverage));
        }
    }, { auto: true }]
});
export { expect };
