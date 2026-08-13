# api-access-tokens

## Why

ArkVault only supports cookie-session auth. There is no way for external
systems (CI, monitoring, scripts) to trigger backups or read status
programmatically, limiting automation and integration.

## What Changes

- Add scoped API tokens (create, list, revoke) stored hashed in the database.
- Accept token auth via the `Authorization` header in the API guard.
- Allow token-triggered backup runs and read-only status/history access.
- Add token management to the Settings UI.

## Capabilities

### New Capabilities

- `api-tokens`: token lifecycle and authenticated programmatic access.

### Modified Capabilities

- `security`: guard accepts bearer tokens with scope checks.
- `auth`: token management endpoints.

## Impact

- `server/db.js` — `api_tokens` table.
- New token routes / middleware.
- `server/index.js` — guard accepts tokens.
- `src/pages/Settings.jsx` — token UI.
- Unit + integration tests for token auth and scopes.
