## MODIFIED Requirements

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
