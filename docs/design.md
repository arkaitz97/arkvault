# ArkVault design

Status: accepted, reflects `main` at the time of writing.

## Context and scope

A self-hosted user keeps data on several backends: a local folder, an NFS export, a
remote host over SSH, an S3 bucket, Google Drive, a PostgreSQL database. Each backend
has its own copy tool and its own failure mode. The user needs one schedule, one
history, one retention rule and one restore path across all of them.

This document covers the server side of ArkVault: the backup run, the connector
boundary, the scheduler, state storage and the restore path. It does not cover the
React UI beyond the calls it makes.

## Goals

1. Run one backup job end to end: read from a source backend, archive, optionally
   encrypt, checksum, write to a destination backend.
2. Serve several backends through one contract, so a job is a pair of type names plus
   a cron expression.
3. Schedule jobs without an external service.
4. Restore a whole archive, or selected paths inside it.
5. Record every run, every stored archive and the reason for every failure.

## Non-goals

- **Horizontal scale.** The scheduler runs inside the API process, and state is one
  SQLite file. Two instances would schedule the same job twice.
- **A job queue.** A run occupies its HTTP request. There is no worker pool, no retry
  policy, no backoff and no priority.
- **Deduplication or block-level incrementals.** Incremental mode selects files by
  modification time. It does not diff content.
- **Remote retention.** Expiry deletes the file only for `local` destinations. For
  other types the row is removed and the object stays in the backend.
- **Zero-knowledge encryption.** The server holds the key. See "Secrets" below.
- **Remote agents.** There is no installed component on a remote host. SSH and NFS
  operate over the network directly from the server.

## Design

### One process

`server/index.js` creates an Express 5 application. It configures Helmet, CORS, the
API rate limiter, the session, the authentication gate, and the routes. It starts the
scheduler in the `listen` callback. In production the same process serves the built
frontend from `dist`. The frontend calls `/api`, and Vite proxies that prefix in
development.

Authentication is a signed session cookie. A bearer token in `api_tokens` is accepted
as an alternative. A token gets the operator role. Roles are `admin`, `operator` and
`viewer`. A viewer can only issue `GET` requests.

### The run pipeline

`POST /api/backups/run/:jobId` (`server/routes/backups.js`) performs one run:

1. Insert a `backup_history` row with status `running`.
2. Resolve the source and destination configuration. A job either references a saved
   connector by id, or carries an inline configuration object.
3. Call `sourceConnector.backup(config, options)`. The connector writes an archive to
   `/tmp` and returns `{ data, filename, size, filesProcessed }`. A PostgreSQL source
   returns a `pg_dump` file here.
4. If the job sets `encryption`, encrypt the archive in place with AES-256-GCM. The
   size is read again after encryption.
5. Compute a SHA-256 checksum of the finished file.
6. Call `destConnector.upload(path, filename, config)`. The upload removes the
   temporary file and returns a `location` string, for example `s3://bucket/key`,
   `nfs://host/path/file`, or an absolute path.
7. Update history to `success`, insert an `available_backups` row with the location,
   the checksum and an `expires_at` date, update `last_run` and `next_run` on the job,
   then send a notification.

Any thrown error updates the history row and the job to `failed`, sends a failure
notification, and returns 500. The notification call is wrapped, so a broken webhook
or SMTP host cannot change the outcome of the run.

A run is synchronous. Two requests for the same job can overlap. The code holds no
lock and does not detect the overlap.

### The connector boundary

`server/connectors/index.js` maps six type names to module singletons: `local`, `nfs`,
`ssh`, `s3`, `gdrive`, `postgresql`. `getConnector(type)` throws for an unknown name.
The validation middleware repeats the same list for job and connector bodies.

Every connector implements five methods:

| Method | Contract |
|--------|----------|
| `testConnection(config)` | Return `{ success, message? , error? }`. Never throw for a reachable-path check. |
| `backup(config, options)` | Write an archive or dump to a temporary path. Return `{ data, filename, size, filesProcessed }`. |
| `upload(path, filename, config)` | Move the archive into the backend. Return `{ success, location }`. Remove the temp file. |
| `download(location, config)` | Fetch the archive to a local temp path. Return `{ path, isFile }`. |
| `restore(backupData, options)` | Unpack an archive into `options.path`. Return `{ success, filesRestored }`. |

Two connectors delegate rather than duplicate. The NFS and S3 `restore` methods call
the local connector, because an unpack is a local operation. The NFS `backup` method
mounts the export and then calls `local.backup` with the mount point.

PostgreSQL is a source only. Its `upload` and `download` throw by design.

### Storage targets

| Type | Backup source | Destination | Location format |
|------|---------------|-------------|-----------------|
| `local` | yes | yes | absolute path |
| `nfs` | yes | yes | `nfs://host/path/file` |
| `ssh` | yes | yes | `ssh://host:port/path` |
| `s3` | yes | yes | `s3://bucket/key` |
| `gdrive` | yes | yes | `gdrive://fileId` |
| `postgresql` | yes | no | dump file path |

Archives are ZIP by default. A job can select TAR, with or without gzip. The archive
helpers detect the type by magic bytes, so one code path lists or extracts both.

### Scheduling

`scheduleJob` in `server/index.js` keeps one `node-cron` task per active job in a
`Map`. A task fires a `fetch` against the local API with the `x-internal-trigger`
header. The running process therefore takes the same path for a scheduled run and a
manual run.

`refreshAllSchedules` stops every task, re-reads `jobs`, and schedules the active jobs
again. It runs at boot and once per minute, so a job edit takes effect within a minute
without a restart.

`next_run` is a display value. `calculateNextRun` in `server/utils.js` handles hourly,
daily, weekly and monthly patterns and falls back to the next hour for anything else.
Cron validity is decided by `node-cron`, not by that function.

### State

`server/db.js` opens one SQLite file with `journal_mode = WAL`, `busy_timeout = 5000`
and `foreign_keys = ON`. Schema creation is idempotent SQL at startup. Tables:
`connectors`, `jobs`, `backup_history`, `available_backups`, `users`, `auth_settings`,
`api_tokens`. The `settings` table is created by `server/routes/settings.js` on first
use.

Per-backend configuration is a JSON string in a `config` column. No table has a column
per backend field, and no query reads inside the JSON.

### Restore

`POST /api/backups/restore/:backupId` takes `{ destination_type, destination_path,
entries? }`. It downloads the archive through the destination connector of the original
job, verifies the stored SHA-256 checksum, decrypts when `encrypted` is set, and then
either extracts the selected paths (ZIP or TAR) or calls the destination connector's
`restore`.

A checksum mismatch aborts the restore with an error. The download endpoint
(`GET /api/backups/download/:historyId`) decrypts but does not verify the checksum.

### Retention

When a run succeeds, `expires_at` is set to now plus `retention` days. A daily task at
03:00 calls `cleanupExpiredBackups`. The function unlinks the file for `local`
destinations, then deletes every expired `available_backups` row. `DELETE
/api/backups/cleanup` runs the same function on demand.

## Alternatives considered

| Option | Rejected because |
|--------|------------------|
| One `runBackup` function with a `switch` per source type | Six copies of the run pipeline would diverge. The five-method contract keeps the pipeline single and lets two connectors delegate to the local one. |
| Load connector modules dynamically from a directory | Six fixed backends fit in a map of six entries. Dynamic loading would add a resolution and error path for no current caller. The cost is visible: a new backend means edits in three places (module, map, validation list). |
| External queue (for example Redis plus BullMQ) | The deployment target is one container with one SQLite file. A queue adds a service, a scheduler and a second failure domain for a job volume that is measured in runs per day. |
| OS cron plus a script that calls the API | Two schedulers would then exist, and job edits would not reach cron without a file rewrite. In-process `node-cron` reads the same `jobs` table the UI edits. |
| Stream the archive directly to the destination | The checksum, the encryption step and the post-encryption size all need the finished file. A temp file in `/tmp` gives one ordered pipeline and one restore path. The cost is temporary disk equal to the archive size. |
| Separate database server (PostgreSQL) | A backup tool that needs a database server to start is a worse self-hosted artifact. SQLite covers single-node concurrency with WAL and a busy timeout. |

## Cross-cutting concerns

### Secrets

Connector credentials are JSON in the `connectors.config` column and are not encrypted
at rest. The application protects them only by the API auth gate and by the file mode
of the database file.
`SESSION_SECRET` and `ENCRYPTION_KEY` come from the environment, and both have a
development fallback constant in code, so a deployment that skips `.env` runs with a
known key. Set both in production.

Backup encryption uses one server-side key: `sha256(ENCRYPTION_KEY)`. Rotating that
value makes existing encrypted backups unreadable. There is no key id and no key
rotation path.

### Encryption

`server/utils/crypto.js` uses `aes-256-gcm` with a random 12-byte IV per file. The
output file is `IV (12) || auth tag (16) || ciphertext`. GCM authenticates the
ciphertext, and the checksum is computed on the encrypted bytes. Encryption happens
after archiving and before upload, so the destination never receives plaintext.

### Integrity

The SHA-256 of the stored file is kept in `available_backups.checksum` and compared on
every restore. It detects transfer or storage corruption after the write. It does not
prove that the archive contains the files the source had.

### Failure handling

Every route returns a JSON error and logs through pino. A failed run leaves three
consistent records: the history row with `status = failed` and the message, the job
with `last_run_status = failed`, and a notification attempt. A failed run does not
retry. The next scheduled run retries by construction; a manual run retries on demand.

### Restore path

Restore reads through the original destination connector. If that connector no longer
exists or its credentials changed, the archive cannot be read, and the checksum step
fails before any write. The route rejects `..` in a requested entry list. ZIP
extraction joins the entry name from the archive under the destination path and does
not normalise it, so a crafted archive could write outside that path. Treat the
backup store as trusted input until that check exists.

## Open questions

- Per-job encryption keys and a key identifier, to make key rotation possible.
- Remote deletion for `s3`, `ssh` and `gdrive` destinations during retention.
- A run lock per job, to reject or queue an overlapping run.
- Normalise archive entry names before extraction.

