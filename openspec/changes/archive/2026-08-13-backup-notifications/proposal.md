# backup-notifications

## Why

Settings already define `notificationsEnabled` and `notificationEmail`, but
nothing consumes them. Backup failures are silent — users only discover them by
opening the app and checking history.

## What Changes

- Emit success/failure events when a backup run completes.
- Add an email notifier (SMTP) honoring `notificationsEnabled` and
  `notificationEmail`.
- Add optional webhook delivery for external monitoring.
- Surface notification configuration in the Settings UI.

## Capabilities

### New Capabilities

- `notifications`: send backup status notifications via email and webhook.

### Modified Capabilities

- `backups`: emit status events on run completion.
- `settings`: store SMTP and webhook configuration.

## Impact

- `server/routes/backups.js` — emit events.
- New notifier module (email + webhook).
- `server/routes/settings.js` — config fields.
- `src/pages/Settings.jsx` — notification config UI.
- Env vars for SMTP credentials.
- Unit tests with mocked SMTP/webhook.
