# Keep state in one SQLite file

## Status

Accepted.

## Context and problem statement

The application stores five kinds of state: connector definitions, backup jobs, run
history, the list of stored archives, and authentication data (users, sessions,
API tokens, notification settings). The volume is small: tens of connectors, tens of
jobs, and one history row per run. Reads happen from the UI, and writes come from a
single process.

The deployment target is one container. The user installs nothing else.

## Decision drivers

- Install with one command and one volume.
- Transactional writes across several tables in one run.
- No separate service to operate, back up or secure.
- Foreign keys must be enforced, because history and archives belong to a job.

## Considered options

1. A separate database server, for example PostgreSQL.
2. JSON or NDJSON files per entity.
3. SQLite through `better-sqlite3`, one file.

## Decision outcome

Chosen option 3. `server/db.js` opens the file at `DATABASE_PATH` (default
`server/arkvault.db`) and sets `journal_mode = WAL`, `busy_timeout = 5000` and
`foreign_keys = ON`. It creates the schema with idempotent `CREATE TABLE IF NOT
EXISTS` statements at import time. A missing column is added with an `ALTER TABLE`
inside a `try`/`catch` that ignores the error.

Per-backend configuration is stored as a JSON string in a `config` or
`*_config` column. Reads parse it at the route boundary; writes stringify it there.

The `backup_history` and `available_backups` tables declare
`FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE`, so deleting a job removes
its history and its archive rows in the same statement.

Option 1 was rejected because a backup tool that needs a database server before it can
take a backup is a worse artifact to self-host. Option 2 was rejected because a run
writes a history row and an archive row, and a process exit between two file writes
would leave a success without an archive or the reverse.

### Consequences

Good:

- One file is the whole state, so a backup of ArkVault is a copy of the database file.
- A run writes history, archives and the job update inside one connection, and the
  whole process shares one handle.
- WAL allows the UI to read while a run writes.

Bad:

- One writer. Two application instances would contend, and WAL does not make the
  scheduler safe to run twice.
- The JSON config columns carry no per-backend schema. A malformed configuration is
  accepted at write time and fails when the run calls the connector.
- There is no migration framework. Schema change means another idempotent statement in
  `server/db.js`.
- Several test files build their own copy of the schema. Those copies drift from
  `server/db.js` without a check.

Neutral:

- The `settings` table is created on first use in `server/routes/settings.js`, not in
  `db.js`. Code that imports the notifier before any settings call would query a table
  that does not exist yet.

## Confirmation

- `server/db.js` contains the pragmas, the schema statements and the `ALTER TABLE`
  guard.
- `server/routes/backups.js` deletes and inserts against `backup_history` and
  `available_backups` in the same handler.
- `tests/integration/security.test.js` asserts the security headers and the auth gate
  against a database built by the real schema path.

## More information

- `docs/design.md`, "State".
- ADR 0002 for why the process count is fixed at one.
