## ADDED Requirements

### Requirement: Scheduled Retention Cleanup

The system SHALL run retention cleanup for expired backups on a schedule.

#### Scenario: Daily cleanup

- **GIVEN** the server is running
- **WHEN** the cleanup schedule fires
- **THEN** the system SHALL delete `available_backups` rows whose `expires_at`
  has passed
