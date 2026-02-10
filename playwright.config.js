import { defineConfig, devices } from '@playwright/test';
import os from 'os';

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: 2,
    reporter: 'html',
    use: {
        baseURL: 'http://localhost:5173',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },
    projects: [
        {
            name: 'setup',
            testMatch: /.*\.setup\.js/,
        },
        {
            name: 'chromium',
            testIgnore: /.*(auth|login_redirect)\.spec\.js/,
            use: {
                ...devices['Desktop Chrome'],
                storageState: 'tests/e2e/playwright/.auth/user.json',
            },
            dependencies: ['setup'],
        },
        {
            name: 'auth-flow',
            testMatch: /.*(auth|login_redirect)\.spec\.js/,
            use: {
                ...devices['Desktop Chrome'],
                storageState: { cookies: [], origins: [] },
            },
        }
    ],
    webServer: [
        {
            command: 'NODE_ENV=test npm run server',
            url: 'http://localhost:3001/api/health',
            reuseExistingServer: !process.env.CI,
            timeout: 30000,
            env: {
                NODE_ENV: 'test'
            }
        },
        {
            command: 'npm run dev',
            url: 'http://localhost:5173',
            reuseExistingServer: !process.env.CI,
            timeout: 30000
        }
    ]
});
