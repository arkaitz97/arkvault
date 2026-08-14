## 1. Dependency and Registry

- [x] 1.1 Add `ssh2` to `package.json` dependencies and install
- [x] 1.2 Create `server/connectors/ssh.js` with a private `connect(config)` helper (open SSH client, auth by `authMethod`, open SFTP session, `finally`-closed)
- [x] 1.3 Register `ssh: new SSHConnector()` in `server/connectors/index.js`

## 2. SSH Connector Operations

- [x] 2.1 Implement `testConnection` — connect, `sftp.stat(remotePath)`, return `{ success }` or `{ success: false, error }`
- [x] 2.2 Implement recursive SFTP walk helper (skip symlinks) returning file list with `mtime`
- [x] 2.3 Implement `backup` — walk, filter by `options.lastRun` when incremental, download to `fs.mkdtemp` staging dir, archive via local connector's archiver, return `{ data, filename, size, filesProcessed, isFile: true }`
- [x] 2.4 Implement `upload` — mkdir -p `remotePath` (ignore EEXIST), `fastPut`, remove temp file, return `{ success, location: "ssh://<host>:<port><remotePath>/<filename>" }`
- [x] 2.5 Implement `download` — parse `ssh://` location (port optional), `fastGet` to temp, return `{ path, isFile: true }`, throw `Invalid SSH location format` on mismatch
- [x] 2.6 Implement `restore` — delegate to local connector's `restore`
- [x] 2.7 Ensure staging temp dirs are cleaned up in `finally` on failure paths

## 3. Validation and API

- [x] 3.1 Add `'ssh'` to the four `isIn` lists in `server/middleware/validation-middleware.js` (job source, job destination, connector creation, restore destination)

## 4. Frontend

- [x] 4.1 Add `ssh` entry to `connectorTypes` in `src/api.js` (fields: host, port, username, authMethod, password, privateKeyPath, remotePath; `canBeSource`/`canBeDestination` true)
- [x] 4.2 Add `case 'ssh'` icon/label mappings in `src/pages/Connectors.jsx`, `src/pages/CreateBackup.jsx`, `src/pages/BackupJobs.jsx`, `src/pages/Dashboard.jsx`

## 5. Tests

- [x] 5.1 Create `tests/unit/backend/ssh-connector.test.js` with mocked `ssh2`: connect success/failure, password and private-key auth, backup walk + archive + incremental filter, upload mkdir/put/location, download temp path + invalid location, restore delegation
- [x] 5.2 Update `tests/unit/backend/connectors-route.test.js` valid type list to include `ssh`
- [x] 5.3 Run `npm test` and confirm the full suite passes

## 6. Specs and Docs

- [x] 6.1 Run `openspec validate --specs` and fix any violations
- [x] 6.2 Note the `ssh` connector and its config fields in `README.md`
