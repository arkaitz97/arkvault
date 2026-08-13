# Storage Connectors Specification

## Purpose

Defines the behavior of the five storage backend implementations that back up,
upload, download, restore, and test connections for Local, S3, Google Drive,
NFS, and PostgreSQL sources and destinations.
## Requirements
### Requirement: Connector Registry

The system SHALL resolve connector types to instances via a registry and MUST
reject unknown types.

#### Scenario: Resolve known connector

- **GIVEN** a type in `local`, `s3`, `gdrive`, `postgresql`, or `nfs`
- **WHEN** `getConnector(type)` is called
- **THEN** the system SHALL return the matching connector instance

#### Scenario: Unknown connector type

- **GIVEN** a type not in the registry
- **WHEN** `getConnector(type)` is called
- **THEN** the system SHALL throw `Unknown connector type: <type>`

### Requirement: Local Connector

The system SHALL back up a local directory into a ZIP or TAR archive in `/tmp`
and support upload, download, and restore on the local filesystem.

#### Scenario: Local connection test

- **GIVEN** a config whose `path` resolves to a directory
- **WHEN** `testConnection(config)` is called
- **THEN** the system SHALL return `{ "success": true }`
- **AND** when the path is not a directory or is unreadable, the system SHALL
  return `{ "success": false, "error": <message> }`

#### Scenario: Local backup archive

- **GIVEN** a config with a valid `path`
- **WHEN** `backup(config, { compression, format, incremental, lastRun })` is called
- **THEN** the system SHALL produce `backup-<timestamp>.zip` (or `.tar`/`.tar.gz`)
  in `/tmp`
- **AND** the system SHALL return `{ data, filename, size, filesProcessed, isFile: true }`

#### Scenario: Local incremental backup

- **GIVEN** `options.incremental` is true and `options.lastRun` is set
- **WHEN** `backup` is called
- **THEN** the system SHALL include only files whose `mtime` is after `lastRun`

#### Scenario: Local upload and download

- **GIVEN** a temp archive path and a destination `config.path`
- **WHEN** `upload(sourcePath, filename, config)` is called
- **THEN** the system SHALL copy the file into the destination directory, remove
  the temp file, and return `{ success: true, location: <destPath> }`
- **AND** `download(location, config)` SHALL return `{ path: location, isFile: true }`

#### Scenario: Local restore

- **GIVEN** an archive at `backupData.path`
- **WHEN** `restore(backupData, { path })` is called
- **THEN** the system SHALL extract the archive into the destination path and
  return `{ success: true, filesRestored }`

### Requirement: S3 Connector

The system SHALL back up objects from an S3 bucket into a ZIP archive, upload
files to a bucket key, download by `s3://` location, and restore via the local
extractor.

#### Scenario: S3 connection test

- **GIVEN** an S3 config with `bucket` and credentials
- **WHEN** `testConnection(config)` is called
- **THEN** the system SHALL send a `HeadBucketCommand` and return
  `{ "success": true }` on success or `{ "success": false, "error": <message> }`
  on failure

#### Scenario: S3 backup

- **GIVEN** a bucket containing objects under the configured `prefix`
- **WHEN** `backup(config, options)` is called
- **THEN** the system SHALL page through `ListObjectsV2Command`, download each
  object into a temp directory, and archive it as `s3-backup-<timestamp>.zip`
- **AND** the system SHALL return `{ data, filename, size, filesProcessed, isFile: true }`

#### Scenario: S3 upload

- **GIVEN** a temp archive and a destination config
- **WHEN** `upload(sourcePath, filename, config)` is called
- **THEN** the system SHALL send a `PutObjectCommand` to
  `Bucket = config.bucket` and `Key = prefix + filename`
- **AND** the system SHALL return `{ success: true, location: "s3://<bucket>/<key>" }`

#### Scenario: S3 download

- **GIVEN** a location matching `s3://<bucket>/<key>`
- **WHEN** `download(location, config)` is called
- **THEN** the system SHALL fetch the object via `GetObjectCommand` and return
  `{ path: <tempPath>, isFile: true }`
- **AND** when the location does not match the `s3://` format, the system SHALL
  throw `Invalid S3 location format`

### Requirement: Google Drive Connector

The system SHALL back up files from a Drive folder into a ZIP archive, upload
files to Drive, download by `gdrive://` location, and restore via the local
extractor.

#### Scenario: Google Drive connection test

- **GIVEN** a service account key (JSON string or file path)
- **WHEN** `testConnection(config)` is called
- **THEN** the system SHALL call `drive.about.get` and return
  `{ "success": true }` on success or `{ "success": false, "error": <message> }`
  on failure

#### Scenario: Google Drive backup

- **GIVEN** a `folderId` (or `root`) containing files
- **WHEN** `backup(config, options)` is called
- **THEN** the system SHALL list non-folder files with
  `'<folderId>' in parents and trashed = false`, download each, and archive
  them as `gdrive-backup-<timestamp>.zip`

#### Scenario: Google Drive upload

- **GIVEN** a temp archive and a destination config
- **WHEN** `upload(sourcePath, filename, config)` is called
- **THEN** the system SHALL create a Drive file with `parents = [folderId]`
  when set and return `{ success: true, location: "gdrive://<fileId>" }`

#### Scenario: Google Drive download

- **GIVEN** a location matching `gdrive://<fileId>`
- **WHEN** `download(location, config)` is called
- **THEN** the system SHALL fetch the file media and return
  `{ path: <tempPath>, isFile: true }`
- **AND** when the location does not match, the system SHALL throw
  `Invalid Google Drive location format`

### Requirement: NFS Connector

The system SHALL mount NFS shares under `/tmp` with `sudo mount -t nfs` and
delegate backup, upload, and restore to the local connector.

#### Scenario: NFS mount point derivation

- **GIVEN** a config with `host` and `path`
- **WHEN** `getMountPoint(config)` is called
- **THEN** the system SHALL return `/tmp/nfs-mount-<12-char-base64-hash>`

#### Scenario: NFS connection test

- **GIVEN** an NFS share that can be mounted
- **WHEN** `testConnection(config)` is called
- **THEN** the system SHALL mount the share and run `ls` on the mount point,
  returning `{ "success": true }` on success or `{ "success": false, "error": <message> }`
  on failure

#### Scenario: NFS backup and upload

- **GIVEN** a mounted NFS share
- **WHEN** `backup(config, options)` is called
- **THEN** the system SHALL run the local connector's `backup` against the
  mount point
- **AND** `upload(sourcePath, filename, config)` SHALL return
  `location: "nfs://<host><path>/<filename>"`

#### Scenario: NFS download

- **GIVEN** a location matching `nfs://<host><path>`
- **WHEN** `download(location, config)` is called
- **THEN** the system SHALL return `{ path: <mountPoint>/<basename>, isFile: true }`

### Requirement: PostgreSQL Connector

The system SHALL dump a PostgreSQL database with `pg_dump`, optionally gzip the
output, and restore with `psql`. PostgreSQL MUST NOT act as a backup
destination or download source.

#### Scenario: PostgreSQL connection test

- **GIVEN** a config with `host`, `port`, `database`, `username`, and `password`
- **WHEN** `testConnection(config)` is called
- **THEN** the system SHALL run `psql -c "SELECT 1"` and fall back to
  `pg_isready` on failure, returning `{ "success": true }` or
  `{ "success": false, "error": <message> }`

#### Scenario: PostgreSQL backup

- **GIVEN** a config and `options.compression`
- **WHEN** `backup(config, options)` is called
- **THEN** the system SHALL run `pg_dump --format=plain`, piping through `gzip`
  when compression is enabled
- **AND** the system SHALL return `{ data, filename, size, filesProcessed: 1, isFile: true }`

#### Scenario: PostgreSQL upload rejected

- **GIVEN** a PostgreSQL connector used as a destination
- **WHEN** `upload` or `download` is called
- **THEN** the system SHALL throw `PostgreSQL cannot be used as a backup
  destination` or `PostgreSQL cannot be used as a restore source directly`

#### Scenario: PostgreSQL restore

- **GIVEN** a `.sql` or `.sql.gz` dump path
- **WHEN** `restore(backupData, config)` is called
- **THEN** the system SHALL pipe the file into `psql` (via `gunzip` when `.gz`)
  and return `{ success: true, filesRestored: 1 }`

### Requirement: Archive Encryption

The system SHALL encrypt backup archives before upload and decrypt them before
restore or download when encryption is enabled.

#### Scenario: Encrypt on backup

- **GIVEN** a job with `encryption = true`
- **WHEN** the source connector's `backup` produces an archive
- **THEN** the system SHALL encrypt the archive before the destination
  connector's `upload` stores it

#### Scenario: Decrypt on restore

- **GIVEN** an encrypted backup with `encrypted = true`
- **WHEN** `restore` is called
- **THEN** the system SHALL decrypt the archive before extraction

#### Scenario: Decrypt on download

- **GIVEN** an encrypted backup
- **WHEN** the backup file is downloaded
- **THEN** the system SHALL decrypt it before streaming

#### Scenario: Plaintext when disabled

- **GIVEN** a job with `encryption = false`
- **WHEN** backup runs
- **THEN** the system SHALL NOT encrypt the archive

### Requirement: Checksum Computation and Verification

The system SHALL compute a SHA-256 checksum of an archive at backup time and
verify it before restore.

#### Scenario: Compute checksum

- **GIVEN** an archive produced by a backup
- **WHEN** the archive is finalized
- **THEN** the system SHALL compute its SHA-256 checksum

#### Scenario: Verify before restore

- **GIVEN** a stored checksum for a backup
- **WHEN** restore is requested
- **THEN** the system SHALL verify the archive checksum before extraction and
  fail the restore on mismatch

### Requirement: Archive Listing and Partial Extraction

The system SHALL support listing archive entries and extracting a subset.

#### Scenario: List entries

- **GIVEN** an archive at a backup location
- **WHEN** the connector lists archive contents
- **THEN** the system SHALL return entry names and paths

#### Scenario: Extract subset

- **GIVEN** an archive and a list of selected entries
- **WHEN** the connector restores a subset
- **THEN** the system SHALL extract only the selected entries

