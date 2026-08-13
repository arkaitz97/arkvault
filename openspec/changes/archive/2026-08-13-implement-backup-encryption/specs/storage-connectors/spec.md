## ADDED Requirements

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
