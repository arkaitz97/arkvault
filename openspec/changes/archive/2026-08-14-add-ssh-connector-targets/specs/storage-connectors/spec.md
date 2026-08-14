## MODIFIED Requirements

### Requirement: Connector Registry

The system SHALL resolve connector types to instances via a registry and MUST
reject unknown types.

#### Scenario: Resolve known connector

- **GIVEN** a type in `local`, `s3`, `gdrive`, `postgresql`, `nfs`, or `ssh`
- **WHEN** `getConnector(type)` is called
- **THEN** the system SHALL return the matching connector instance

#### Scenario: Unknown connector type

- **GIVEN** a type not in the registry
- **WHEN** `getConnector(type)` is called
- **THEN** the system SHALL throw `Unknown connector type: <type>`

## ADDED Requirements

### Requirement: SSH Connector

The system SHALL connect to SSH/SFTP hosts with the `ssh2` library, back up
remote directories into a ZIP archive, upload archives to a remote path,
download by `ssh://` location, and restore via the local extractor. The
connector SHALL support password and private-key authentication and MUST NOT
require `sudo`, FUSE, or external SSH binaries.

#### Scenario: SSH connection test

- **GIVEN** a config with `host`, `port`, `username`, an auth method, and a
  `remotePath`
- **WHEN** `testConnection(config)` is called
- **THEN** the system SHALL open an SSH connection, open an SFTP session, and
  `stat` the `remotePath`
- **AND** the system SHALL return `{ "success": true }` on success or
  `{ "success": false, "error": <message> }` on failure

#### Scenario: SSH backup

- **GIVEN** a reachable host and a `remotePath` containing files
- **WHEN** `backup(config, options)` is called
- **THEN** the system SHALL recursively walk the remote path via SFTP, download
  each file to a temp directory, and archive it as `ssh-backup-<timestamp>.zip`
- **AND** the system SHALL return `{ data, filename, size, filesProcessed, isFile: true }`

#### Scenario: SSH incremental backup

- **GIVEN** `options.incremental` is true and `options.lastRun` is set
- **WHEN** `backup` is called
- **THEN** the system SHALL include only remote files whose `mtime` is after
  `lastRun`

#### Scenario: SSH upload

- **GIVEN** a temp archive and a destination config
- **WHEN** `upload(sourcePath, filename, config)` is called
- **THEN** the system SHALL ensure the remote directory exists (creating parent
  directories as needed), upload the file via SFTP, remove the temp file, and
  return `{ success: true, location: "ssh://<host>:<port><remotePath>/<filename>" }`

#### Scenario: SSH download

- **GIVEN** a location matching `ssh://<host>:<port><remotePath>`
- **WHEN** `download(location, config)` is called
- **THEN** the system SHALL fetch the file via SFTP to a temp path and return
  `{ path: <tempPath>, isFile: true }`
- **AND** when the location does not match the `ssh://` format, the system
  SHALL throw `Invalid SSH location format`

#### Scenario: SSH restore

- **GIVEN** an archive at `backupData.path`
- **WHEN** `restore(backupData, options)` is called
- **THEN** the system SHALL extract the archive into the destination path via
  the local connector's restore and return `{ success: true, filesRestored }`

#### Scenario: SSH private-key authentication

- **GIVEN** a config with `authMethod = "privateKey"` and a readable
  `privateKeyPath`
- **WHEN** the connector establishes a connection
- **THEN** the system SHALL authenticate with the private key read from
  `privateKeyPath`

#### Scenario: SSH password authentication

- **GIVEN** a config with `authMethod = "password"` and a `password`
- **WHEN** the connector establishes a connection
- **THEN** the system SHALL authenticate with the password
