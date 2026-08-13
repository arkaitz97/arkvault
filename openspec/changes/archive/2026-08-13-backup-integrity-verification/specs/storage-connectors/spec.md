## ADDED Requirements

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
