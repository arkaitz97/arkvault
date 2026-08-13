# fix-scheduled-backups

## Why

The cron scheduler fires `POST /api/backups/run/:jobId` with no session cookie.
The `/api` authentication guard requires `req.session.authenticated`, so every
scheduled run is rejected with `401`. Scheduled backups are the core promise of
ArkVault and they silently never run.

## What Changes

- Add an internal trigger mechanism (signed header or shared secret) that the
  scheduler uses when invoking the run endpoint.
- Update the `/api` authentication guard to accept internal triggers for
  `POST /api/backups/run/:jobId` only.
- Update the scheduler's `fetch` call to include the internal trigger credential.
- Keep the public run endpoint requiring an authenticated session.

## Capabilities

### Modified Capabilities

- `scheduler`: scheduled task invokes the run endpoint with internal credentials.
- `security`: the API guard accepts an internal trigger for backup runs.
- `backups`: the run endpoint distinguishes internal triggers from user sessions.

## Impact

- `server/index.js` — `scheduleJob` fetch call, secret/config wiring.
- `server/routes/backups.js` — run endpoint.
- Auth guard middleware in `server/index.js`.
- New env var for the internal trigger secret.
- Unit tests for scheduler-triggered runs and guard behavior.
