# backup-integrity-verification

## Why

Nothing verifies that an upload succeeded or that an archive is readable after
it is written. A corrupted or truncated backup is only discovered at restore
time, when it is too late.

## What Changes

- Compute a SHA-256 checksum of the archive at backup time.
- Store the checksum and verify it after upload (and before restore).
- Record an integrity status on `backup_history`.
- Optionally perform a verify-extract step for local archives.

## Capabilities

### Modified Capabilities

- `storage-connectors`: compute and verify checksums across backends.
- `backups`: record checksum and integrity status in history; verify on restore.

## Impact

- `server/connectors/*.js` — checksum compute/verify.
- `server/routes/backups.js` — store/verify during run and restore.
- `server/db.js` — history `checksum` / integrity columns.
- Unit tests for corruption detection.
