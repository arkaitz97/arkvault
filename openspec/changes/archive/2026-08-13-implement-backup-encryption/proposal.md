# implement-backup-encryption

## Why

Jobs carry an `encryption` flag and the UI advertises "optional backup
encryption", but no connector encrypts the archive. Backups are stored as
plaintext ZIP/TAR, so the feature is a no-op and users get a false sense of
security.

## What Changes

- Encrypt archives (AES-256-GCM) before upload and decrypt before restore and
  download.
- Introduce key management: a master key from env/settings, with a per-backup
  data key wrapped for storage.
- Thread encryption options through `backup` → `upload` → `download` →
  `restore` in the run and restore flows.
- Keep the existing `encrypted` flags on `available_backups` and job
  definitions accurate.

## Capabilities

### Modified Capabilities

- `storage-connectors`: encrypt on archive, decrypt on restore for local, S3,
  Google Drive, and NFS flows.
- `backups`: pass encryption options through run, restore, and download.
- `settings`: store the encryption key material.

## Impact

- `server/connectors/*.js` — encrypt/decrypt integration.
- `server/routes/backups.js` — pass key/options.
- `server/db.js` / `server/routes/settings.js` — key storage.
- New crypto utility module.
- Unit tests for round-trip encryption/decryption.
