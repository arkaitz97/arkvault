# notifications Specification

## Purpose
TBD - created by archiving change backup-notifications. Update Purpose after archive.
## Requirements
### Requirement: Backup Status Notification

The system SHALL notify users of backup job outcomes via email and webhook.

#### Scenario: Email on failure

- **GIVEN** notifications enabled and a configured email address
- **WHEN** a backup run fails
- **THEN** the system SHALL send an email with the job name and error

#### Scenario: Email on success

- **GIVEN** notifications enabled
- **WHEN** a backup run succeeds
- **THEN** the system SHALL send a success email

#### Scenario: Webhook delivery

- **GIVEN** a webhook URL is configured
- **WHEN** a backup run completes
- **THEN** the system SHALL POST the status to the webhook URL

