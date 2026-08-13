## ADDED Requirements

### Requirement: Encryption Key Configuration

The system SHALL store the master encryption key material in settings or
environment configuration.

#### Scenario: Key provisioned

- **GIVEN** encryption is enabled
- **WHEN** the server starts
- **THEN** the system SHALL load the master key from `ENCRYPTION_KEY` (or a
  generated persisted default) for encrypting and decrypting backups
