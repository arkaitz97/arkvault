import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        projects: [
            {
                extends: true,
                test: {
                    name: 'unit-frontend',
                    include: ['tests/unit/frontend/**/*.test.{js,jsx}'],
                    environment: 'jsdom',
                    setupFiles: ['tests/setup/frontend.js']
                }
            },
            {
                extends: true,
                test: {
                    name: 'unit-backend',
                    include: ['tests/unit/backend/**/*.test.js'],
                    environment: 'node'
                }
            },
            {
                extends: true,
                test: {
                    name: 'api',
                    include: ['tests/integration/api/**/*.test.js'],
                    environment: 'node',
                    sequence: {
                        concurrent: false
                    },
                    fileParallelism: false
                }
            }
        ],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: ['src/**/*.{js,jsx}', 'server/**/*.js'],
            exclude: ['**/node_modules/**', '**/tests/**']
        }
    }
});
