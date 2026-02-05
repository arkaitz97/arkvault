import { defineConfig, devices } from '@playwright/test';
import os from 'os';

export default defineConfig({
    testDir: './tests/e2e',

    // Run tests in parallel
    fullyParallel: true,

    // Fail the build on CI if you accidentally left test.only in the source code
    forbidOnly: !!process.env.CI,

    // Retry on CI only
    retries: process.env.CI ? 2 : 0,

    // Run tests in parallel using all available cores
    workers: os.cpus().length,

    // Reporter to use
    reporter: 'html',

    // Shared settings for all the projects below
    use: {
        // Base URL to use in actions like `await page.goto('/')`
        baseURL: 'http://localhost:5173',

        // Collect trace when retrying the failed test
        trace: 'on-first-retry',

        // Take screenshot on failure
        screenshot: 'only-on-failure',
    },

    // Configure projects for major browsers
    projects: [
        {
            name: 'setup',
            testMatch: /.*\.setup\.js/,
        },
        {
            name: 'chromium',
            testIgnore: /.*(auth|login_redirect)\.spec\.js/, // Exclude auth tests that reset DB
            use: {
                ...devices['Desktop Chrome'],
                storageState: 'tests/e2e/playwright/.auth/user.json',
            },
            dependencies: ['setup'],
        },
        {
            name: 'auth-flow',
            testMatch: /.*(auth|login_redirect)\.spec\.js/, // Run auth tests separately
            use: {
                ...devices['Desktop Chrome'],
                storageState: { cookies: [], origins: [] }, // Start fresh
            },
        }
    ],

    // Run your local dev server before starting the tests
    webServer: [
        {
            command: 'npm run server',
            url: 'http://localhost:3001/api/health',
            reuseExistingServer: !process.env.CI,
            timeout: 30000
        },
        {
            command: 'npm run dev',
            url: 'http://localhost:5173',
            reuseExistingServer: !process.env.CI,
            timeout: 30000
        }
    ]
});
