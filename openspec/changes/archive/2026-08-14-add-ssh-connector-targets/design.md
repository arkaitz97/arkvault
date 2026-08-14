## Context

ArkVault connectors (`server/connectors/`) implement a uniform interface —
`testConnection`, `backup`, `upload`, `download`, `restore` — and are resolved
through the registry in `server/connectors/index.js`. Five backends exist
(`local`, `s3`, `gdrive`, `postgresql`, `nfs`); NFS is the closest analog for a
remote-host backend but works by `sudo` mounting the share under `/tmp` and
delegating to the local connector. Connector configs are JSON strings in the
`connectors` table; the PostgreSQL connector already stores a plaintext
`password` there, so storing an SSH password follows precedent. Backend type
lists are enforced in four `isIn` validators in
`server/middleware/validation-middleware.js` and mirrored in
`src/api.js` `connectorTypes` for the UI pickers.

## Goals / Non-Goals

**Goals:**
- SSH/SFTP host usable as backup source and destination via the standard
  connector interface.
- Pure-JS implementation: no `sudo`, no FUSE/sshfs, no external `scp`/`rsync`
  binaries — the NFS connector's privilege requirements were a pain point this
  avoids.
- Password and private-key auth.
- Full interface parity with existing connectors so jobs, restore, retention,
  and encryption work unchanged.

**Non-Goals:**
- SSH agent/socket auth (`agent` forwarding).
- Host-key pinning UI / known-hosts management.
- Encryption of connector config at rest (pre-existing gap, affects all types).
- SCP/rsync modes or tunneling other connectors over SSH.
- Per-host public-key management (admin drops a key file on the server instead).

## Decisions

### D1: `ssh2` (pure JS) over sshfs-mount delegation

NFS precedent (mount + delegate to local) fails for SSH: requires `sudo`,
`fuse`, and `sshfs` present on the host, and stale-handle recovery is fragile
(`umount -f` dance in `nfs.js`). `ssh2` provides the SFTP client
(`sftp.fastPut`/`fastGet`/`readdir`/`stat`/`mkdir`) with no system
dependencies. Backups still reuse the local connector's archiver by downloading
remote files into a temp dir first — same pattern S3 and Google Drive use, so
archive format, encryption, and checksum code paths stay untouched.

### D2: Config schema

```json
{
  "host": "backup.example.com",
  "port": 22,
  "username": "backup",
  "authMethod": "password",        // "password" | "privateKey"
  "password": "",                  // when authMethod = password
  "privateKeyPath": "/etc/arkvault/id_ed25519", // when authMethod = privateKey
  "remotePath": "/srv/backups"
}
```

- `authMethod` switch instead of nullable password so the UI can render the
  right field set.
- `privateKeyPath` (file path, read at connect time) rather than storing key
  material in the DB — keeps private keys out of `connectors.config` and lets
  the key be rotated on disk without an API edit.
- `remotePath` is the directory used as source root (backup) or upload target
  (destination).

### D3: Connection lifecycle

One client per operation; open → run SFTP work → close (`conn.end()` in a
`finally`). No shared pool — matches how other connectors are stateless. Use
`connectTimeout: 10000`, `readyTimeout: 20000`, and `algorithms` defaults.
Connection creation is factored into a private `connect(config)` helper so
tests can inject a fake `Client`.

### D4: Directory handling

- Backup source: recursive SFTP walk (`readdir` + `stat`), skip symlinks,
  download regular files to a temp staging dir, then archive with the local
  connector's archiver (zip default, tar/tar.gz per `options.format`).
  Incremental reuses `options.lastRun` against remote `mtime` — SFTP `stat`
  returns `mtime` directly, no extra round-trips.
- Upload destination: `mkdir -p` the remote `remotePath` (walk segments with
  `mkdir` + ignore `EEXIST`) before `fastPut`, so fresh destinations work
  without pre-creating the directory.
- `download` resolves the filename from the `ssh://` location basename —
  mirrors `nfs.js` behavior. Location format:
  `ssh://<host>:<port><remotePath>/<filename>`; parse defensively (port
  optional, tolerate missing port by defaulting 22).

### D5: Restore

Delegate to the local connector's `restore` (extract archive to destination
path), exactly like NFS/S3/GDrive. SSH never writes remote during restore.

### D6: Registry, validation, UI

- `server/connectors/index.js`: `ssh: new SSHConnector()`.
- Four `isIn` lists in `validation-middleware.js` gain `'ssh'` (job source,
  job destination, connector creation, restore destination).
- `src/api.js`: add `{ id: 'ssh', name: 'SSH Host', icon: 'Server',
  canBeSource: true, canBeDestination: true, fields: [host, port, username,
  authMethod, password, privateKeyPath, remotePath] }`.
- Icon maps in `Connectors.jsx`, `CreateBackup.jsx`, `BackupJobs.jsx`,
  `Dashboard.jsx` gain `case 'ssh'` (Lucide `Server`; fallback `Network`).

### D7: Testing

Mock `ssh2` via `proxyquire`/dependency injection in
`tests/unit/backend/ssh-connector.test.js` (no live SSH in unit tests — same
as `nfs.test.js` mocks `child_process`). Cover: connect success/failure,
password + private-key auth, backup walk + archive + incremental filter,
upload mkdir + put + location format, download temp path + invalid location,
restore delegation. Update `connectors-route.test.js` valid type list.

## Risks / Trade-offs

- **Host-key verification not enforced**: `ssh2` accepts any host key unless a
  `hostVerifier` is supplied. Mitigation for v1: document that this is
  first-connection-trust semantics; a fingerprint pinning feature is follow-up
  work (kept out of scope to avoid UI + DB changes).
- **SFTP download bandwidth**: backing up large remote trees streams every
  file over one SFTP connection; slower than rsync. Acceptable for the
  archive-centric backup model; follow-up could add `rsync` mode.
- **Password at rest**: plaintext in `connectors.config` JSON, same as
  PostgreSQL. Config encryption is a cross-cutting gap tracked separately.
- **Private key permissions**: server process must read `privateKeyPath`;
  recommend 0600 key owned by the ArkVault service user.
- **Failure semantics**: partial downloads leave temp dirs behind — reuse the
  local/S3 cleanup pattern (temp dir under `fs.mkdtemp` in `/tmp`, removed in
  `finally`).
