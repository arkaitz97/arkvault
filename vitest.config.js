import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    test: {
        // Global test configuration
        globals: true,

        // Workspace configuration
        projects: [
            {
                // Unit tests for frontend
                extends: true,
                test: {
                    name: 'unit-frontend',
                    include: ['tests/unit/frontend/**/*.test.{js,jsx}'],
                    environment: 'jsdom',
                    setupFiles: ['tests/setup/frontend.js']
                }
            },
            {
                // Unit tests for backend
                extends: true,
                test: {
                    name: 'unit-backend',
                    include: ['tests/unit/backend/**/*.test.js'],
                    environment: 'node'
                }
            },
            {
                // API integration tests
                extends: true,
                test: {
                    name: 'api',
                    include: ['tests/integration/api/**/*.test.js'],
                    environment: 'node',
                    // Each API test creates its own isolated database
                    // Run sequentially to avoid conflicts
                    sequence: {
                        concurrent: false
                    },
                    fileParallelism: false
                }
            }
        ],

        // Coverage configuration
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: ['src/**/*.{js,jsx}', 'server/**/*.js'],
            exclude: ['**/node_modules/**', '**/tests/**']
        }
    }
});
