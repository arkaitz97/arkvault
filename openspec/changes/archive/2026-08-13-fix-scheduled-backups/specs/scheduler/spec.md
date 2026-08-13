## MODIFIED Requirements

### Requirement: Schedule Job

The system SHALL register a cron task for a job that is `active` and has a
valid cron `schedule`.

#### Scenario: Schedule active job

- **GIVEN** a job with `status = 'active'` and a `schedule` that passes
  `cron.validate`
- **WHEN** `scheduleJob(job)` is called
- **THEN** the system SHALL create a cron task that, on firing, sends
  `POST /api/backups/run/:jobId` to the local server with the internal trigger
  credential
- **AND** the system SHALL store the task in the `scheduledTasks` map keyed by job id

#### Scenario: Re-schedule existing job

- **GIVEN** a job whose id already has a scheduled task
- **WHEN** `scheduleJob(job)` is called again
- **THEN** the system SHALL stop and remove the existing task before creating
  the replacement

#### Scenario: Skip inactive or invalid job

- **GIVEN** a job with `status != 'active'` or an invalid/missing `schedule`
- **WHEN** `scheduleJob(job)` is called
- **THEN** the system SHALL NOT create a cron task
