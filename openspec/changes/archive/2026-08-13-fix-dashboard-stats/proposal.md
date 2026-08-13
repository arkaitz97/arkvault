# fix-dashboard-stats

## Why

`GET /api/settings/stats` queries the `backup_jobs` table, which does not exist
(the real table is `jobs`), so `activeJobs` always errors. The dashboard
"active jobs" stat is broken. Separately, `POST /api/settings/cleanup` filters
`status = 'completed'`, but `backup_history` stores `success`/`failed`, so the
cleanup deletes nothing.

## What Changes

- Fix `stats` to count active jobs from `jobs WHERE status = 'active'`.
- Fix `cleanup` to delete history by the actual status values used by the run
  flow.
- Align the cutoff logic with `defaultRetention`.

## Capabilities

### Modified Capabilities

- `settings`: correct stats query and cleanup status filter.

## Impact

- `server/routes/settings.js` — stats and cleanup SQL.
- Unit tests for stats correctness and cleanup row deletion.
