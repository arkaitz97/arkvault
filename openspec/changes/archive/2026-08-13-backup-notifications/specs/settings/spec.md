## ADDED Requirements

### Requirement: Notification Configuration

The system SHALL store SMTP and webhook notification settings.

#### Scenario: Configure notifications

- **GIVEN** notification settings (`notificationsEnabled`, `notificationEmail`,
  SMTP host/credentials, webhook URL)
- **WHEN** the client updates settings
- **THEN** the system SHALL persist them and honor them when sending notifications
