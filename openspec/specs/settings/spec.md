# Settings Specification

## Purpose

Stores and retrieves application-wide preferences in a key/value table and
exposes dashboard statistics and history cleanup.
## Requirements
### Requirement: Default Settings

The system SHALL seed the `settings` table with default values on startup when
keys are absent.

#### Scenario: Seed defaults

- **GIVEN** an empty `settings` table
- **WHEN** the settings router is loaded
- **THEN** the system SHALL insert defaults `defaultRetention = "30"`,
  `defaultCompression = "true"`, `defaultEncryption = "false"`,
  `notificationsEnabled = "false"`, and `notificationEmail = ""`

### Requirement: Read Settings

The system SHALL return all settings with values coerced to their inferred
type (boolean, number, or string).

#### Scenario: Get settings

- **GIVEN** settings rows exist
- **WHEN** the client sends `GET /api/settings`
- **THEN** the system SHALL return `200` with a JSON object where `"true"`/`"false"`
  become booleans, numeric strings become integers, and other values stay strings

### Requirement: Update Settings

The system SHALL upsert arbitrary key/value pairs from the request body.

#### Scenario: Update settings

- **GIVEN** a request body of key/value pairs
- **WHEN** the client sends `PUT /api/settings`
- **THEN** the system SHALL `INSERT OR REPLACE` each key with the stringified
  value and return `200` with `{ "success": true }`

### Requirement: Dashboard Statistics

The system SHALL return aggregate backup, job, and connector counts.

#### Scenario: Get stats

- **GIVEN** populated `backup_history`, `jobs`, and `connectors` tables
- **WHEN** the client sends `GET /api/settings/stats`
- **THEN** the system SHALL return `200` with `totalBackups`, `totalSize`,
  `activeJobs`, and `connectors`
- **AND** `totalBackups` SHALL be the count of `backup_history` rows
- **AND** `totalSize` SHALL be the sum of `backup_history.size`
- **AND** `activeJobs` SHALL be the count of `jobs` rows where `status = 'active'`

### Requirement: History Cleanup

The system SHALL delete history records older than the configured default
retention window, matching the statuses recorded by the run flow.

#### Scenario: Cleanup old history

- **GIVEN** a `defaultRetention` setting and `backup_history` rows
- **WHEN** the client sends `POST /api/settings/cleanup`
- **THEN** the system SHALL delete rows where `created_at` is older than the
  cutoff (now minus retention days) and `status` is `success` or `failed`
- **AND** the system SHALL return `200` with
  `{ "success": true, "deleted": <count>, "cutoffDate": <iso> }`

### Requirement: Notification Configuration

The system SHALL store SMTP and webhook notification settings.

#### Scenario: Configure notifications

- **GIVEN** notification settings (`notificationsEnabled`, `notificationEmail`,
  SMTP host/credentials, webhook URL)
- **WHEN** the client updates settings
- **THEN** the system SHALL persist them and honor them when sending notifications

### Requirement: Encryption Key Configuration

The system SHALL store the master encryption key material in settings or
environment configuration.

#### Scenario: Key provisioned

- **GIVEN** encryption is enabled
- **WHEN** the server starts
- **THEN** the system SHALL load the master key from `ENCRYPTION_KEY` (or a
  generated persisted default) for encrypting and decrypting backups

