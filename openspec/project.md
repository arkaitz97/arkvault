# ArkVault

## Context

ArkVault is a self-hosted backup management application. It provides a unified
web interface for scheduling and running backups from multiple source types
(Local folders, NFS shares, S3-compatible storage, Google Drive, PostgreSQL)
into multiple destination types, with compression, optional encryption,
retention policies, point-in-time restore, and real-time status monitoring.

Mission: simplify backup strategy with one interface across heterogeneous
storage backends while enforcing security defaults (signed sessions, rate
limiting, path validation, security headers).

## Stack

- **Frontend**: React 19, Vite 7, React Router 7, Lucide Icons
- **Backend**: Node.js (ESM), Express 5, better-sqlite3 (SQLite)
- **Scheduler**: node-cron
- **Storage SDKs**: `@aws-sdk/client-s3`, `googleapis`, `archiver`, `unzipper`
- **Auth**: bcrypt (password hashing), express-session (cookie sessions)
- **Security**: helmet, cors, express-rate-limit, express-validator
- **Observability**: pino + pino-http, pino-pretty
- **Testing**: Vitest (unit/integration), Playwright (E2E), supertest, nyc

## Architecture

- **Client/server monorepo**: React SPA served by Vite in dev; Express serves
  the built `dist/` in production. Frontend talks to the backend via a
  JSON REST API under `/api` using cookie credentials.
- **Three-tier backend**:
  - Routes (`server/routes/`) expose REST endpoints and delegate work.
  - Connectors (`server/connectors/`) implement a uniform storage interface
    (`testConnection`, `backup`, `upload`, `download`, `restore`) per backend.
  - Data layer (`server/db.js`) uses better-sqlite3 with WAL mode, foreign keys,
    and `CREATE TABLE IF NOT EXISTS` migration style.
- **Connector registry pattern**: `server/connectors/index.js` maps type names
  (`local`, `s3`, `gdrive`, `postgresql`, `nfs`) to connector instances via
  `getConnector(type)`; unknown types throw.
- **Scheduling**: node-cron tasks are held in an in-memory `Map` keyed by job
  id. Schedules are rebuilt on server start and every minute.
- **Auth model**: single shared password stored in `auth_settings` (bcrypt
  hash), session cookie `arkvault.sid`, and a `mustChangePassword` gate for
  first login.
- **Middleware pipeline** (in `server/index.js`): helmet → CORS → pino-http →
  JSON body parsing → API rate limit → session → `/api` auth guard → routers →
  error handler.
