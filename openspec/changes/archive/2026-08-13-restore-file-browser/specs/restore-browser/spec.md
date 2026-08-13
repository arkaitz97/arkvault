## ADDED Requirements

### Requirement: Archive Content Listing

The system SHALL list the files and folders contained in an available backup.

#### Scenario: List archive contents

- **GIVEN** an `available_backups` row
- **WHEN** the client requests the backup's contents
- **THEN** the system SHALL return the archive's entry list with names and paths

#### Scenario: Missing backup

- **GIVEN** no `available_backups` row with the requested id
- **WHEN** the client requests contents
- **THEN** the system SHALL return `404` with `{ "error": "Backup not found" }`

### Requirement: Selective Restore

The system SHALL restore a subset of files or folders selected by the user.

#### Scenario: Restore selected paths

- **GIVEN** an available backup and a list of selected entry paths
- **WHEN** the client requests a selective restore
- **THEN** the system SHALL extract only the selected entries to the destination
- **AND** the system SHALL return `200` with the number of files restored
