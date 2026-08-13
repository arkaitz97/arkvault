# auto-retention-cleanup

## Why

Retention only stamps `expires_at` on `available_backups`. Cleanup exists only
as a manual `DELETE /api/backups/cleanup` call that nothing invokes, so expired
backups accumulate indefinitely and consume storage.

## What Changes

- Add a scheduled cleanup task (e.g. daily) that deletes expired
  `available_backups` rows.
- When deleting expired backups whose destination is local, also unlink the
  underlying file (reusing existing local-delete logic).
- Expose the cleanup as a scheduler-invoked internal action, in addition to the
  existing manual endpoint.

## Capabilities

### Modified Capabilities

- `scheduler`: run retention cleanup on a schedule.
- `backups`: cleanup deletes expired rows and removes local files.

## Impact

- `server/index.js` — new cron task wiring.
- `server/routes/backups.js` — shared cleanup logic.
- Unit tests for expiry deletion and local file removal.
