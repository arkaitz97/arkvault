# multi-user-accounts

## Why

ArkVault has a single shared password in `auth_settings` (row `id = 1`). There
is no concept of users, roles, or per-user permissions, which blocks real team
use and auditability.

## What Changes

- Introduce a `users` table with usernames, bcrypt password hashes, and roles
  (admin/operator/viewer).
- Add login-by-username and per-user sessions.
- Add admin endpoints for user CRUD.
- Migrate the existing single password into an initial admin user.
- Apply role checks to destructive operations.

## Capabilities

### New Capabilities

- `user-management`: admin CRUD for user accounts and roles.

### Modified Capabilities

- `auth`: username/password login, per-user sessions, role assignment.
- `security`: session guard enforces roles on protected routes.

## Impact

- `server/db.js` — `users` table + migration.
- `server/routes/auth.js` — login/session changes.
- New user-management routes.
- `server/middleware` — role guard.
- `src/pages/Login.jsx`, `src/context/AuthContext.jsx` — username flow.
- Unit + E2E tests for roles and user management.
