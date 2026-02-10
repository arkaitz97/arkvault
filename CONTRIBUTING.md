# Contributing to ArkVault

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js 18+
- npm 9+

### Getting Started

```bash
# Clone the repository
git clone https://github.com/yourusername/backup-app.git
cd backup-app

# Install dependencies
npm install

# Start development servers
npm run start
```

This starts:
- Frontend dev server: http://localhost:5173 (with HMR)
- Backend API server: http://localhost:3001

## Project Structure

```
backup-app/
├── src/                    # React frontend
│   ├── components/         # Reusable UI components
│   ├── pages/              # Page components
│   └── api.js              # API client
├── server/                 # Express backend
│   ├── connectors/         # Storage connectors
│   ├── routes/             # API routes
│   └── index.js            # Server entry point
├── tests/
│   ├── unit/               # Unit tests (Vitest)
│   ├── integration/        # API tests (Vitest + Supertest)
│   └── e2e/                # E2E tests (Playwright)
└── data/                   # SQLite database (created at runtime)
```

## Running Tests

```bash
# All unit and API tests
npm run test

# Unit tests only
npm run test:unit

# API integration tests
npm run test:api

# E2E tests (requires Playwright browsers)
npx playwright install chromium
npm run test:e2e

# E2E with UI
npm run test:e2e:ui
```

## Code Style

- Use ES modules (`import`/`export`)
- React functional components with hooks
- CSS files alongside components

## Adding a New Connector

1. Create `server/connectors/myconnector.js`:

```javascript
class MyConnector {
    async testConnection(config) { /* ... */ }
    async backup(config, options) { /* ... */ }
    async upload(data, filename, config) { /* ... */ }
    async download(location, config) { /* ... */ }
    async restore(backupData, options) { /* ... */ }
}
export default MyConnector;
```

2. Register in `server/connectors/index.js`
3. Add UI form in `src/pages/Connectors.jsx`

## Security Best Practices

When contributing to ArkVault, please keep the following security guidelines in mind:

- **Path Validation**: Always use `server/utils/path-validator.js` when handling file paths from user input. Never trust raw paths to prevent path traversal.
- **Input Validation**: Use the provided validation middleware for all new API routes to ensure data integrity.
- **Avoid Shell Execution**: Prefer Node.js native modules over spawning shell commands. If exec is unavoidable, never pass unsanitized user input.
- **Session Checks**: Ensure all protected routes are wrapped in the authentication middleware.
- **Sensitive Data**: Never log passwords, tokens, or other sensitive information. Use the configured logger.

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm run test && npm run test:e2e`)
5. Commit with clear messages
6. Push and open a Pull Request

## Reporting Issues

Please include:
- Steps to reproduce
- Expected vs actual behavior
- Node.js version
- OS version
