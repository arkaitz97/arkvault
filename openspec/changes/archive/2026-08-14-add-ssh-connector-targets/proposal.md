## Why

ArkVault can back up to local disks, NFS shares, S3 buckets, and Google Drive,
but has no way to use an arbitrary SSH/SFTP host as a backup source or
destination. Many self-hosted setups store backups on remote servers reachable
only over SSH, so today those users must mount the remote filesystem manually
or run a second backup tool.

## What Changes

- Add a new `ssh` connector type to the connector registry, usable as both a
  backup **source** and a backup **destination** ("SSH targets").
- Implement the full connector interface (`testConnection`, `backup`, `upload`,
  `download`, `restore`) over SFTP using the pure-JS `ssh2` package — no `sudo`,
  no FUSE mounts, no shelling out to `scp`/`rsync`.
- Support password and private-key authentication, with config fields `host`,
  `port`, `username`, `password`, `privateKeyPath`, and `remotePath`.
- Allow `ssh` in connector, job source/destination, and restore validation
  (backend middleware), and expose the type in the frontend connector pickers
  with matching icons.
- Register the type in the storage-connectors and connectors specifications.
- Add unit tests for the new connector with a mocked SFTP client.

## Capabilities

### New Capabilities

- `ssh-connector`: behavior of the SSH/SFTP connector — connection testing,
  remote directory backup, archive upload/download, and restore via the local
  extractor.

### Modified Capabilities

- `connectors`: the Create Connector requirement's supported type list gains
  `ssh`.
- `storage-connectors`: the Connector Registry requirement's known-type list
  gains `ssh`.

## Impact

- **New files**: `server/connectors/ssh.js`, `tests/unit/backend/ssh-connector.test.js`.
- **Modified files**: `server/connectors/index.js` (registry), `server/middleware/validation-middleware.js`
  (4 `isIn` type lists: job source, job destination, connector creation, restore
  destination), `src/api.js` (`connectorTypes` entry), `src/pages/Connectors.jsx`,
  `src/pages/CreateBackup.jsx`, `src/pages/BackupJobs.jsx`, `src/pages/Dashboard.jsx`
  (icons/labels).
- **New dependency**: `ssh2` (npm).
- **Specs**: `openspec/specs/connectors/spec.md`, `openspec/specs/storage-connectors/spec.md`.
