# Scheduler Specification

## Purpose

Schedules active backup jobs as cron tasks and keeps the in-memory task map in
sync with the database on startup and every minute.
## Requirements
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

### Requirement: Unschedule Job

The system SHALL stop and remove a job's cron task by id.

#### Scenario: Unschedule scheduled job

- **GIVEN** a job id present in the `scheduledTasks` map
- **WHEN** `unscheduleJob(jobId)` is called
- **THEN** the system SHALL stop the task and remove it from the map

### Requirement: Refresh All Schedules

The system SHALL rebuild the task map from active, scheduled jobs in the
database.

#### Scenario: Refresh from database

- **GIVEN** jobs in the database where `status = 'active'` and
  `schedule IS NOT NULL`
- **WHEN** `refreshAllSchedules()` is called
- **THEN** the system SHALL stop all existing tasks, clear the map, and
  schedule each matching job

#### Scenario: Refresh on startup and periodically

- **GIVEN** the server starts
- **WHEN** `app.listen` runs
- **THEN** the system SHALL call `refreshAllSchedules()` immediately and then
  every minute via the `* * * * *` cron expression

### Requirement: Scheduled Retention Cleanup

The system SHALL run retention cleanup for expired backups on a schedule.

#### Scenario: Daily cleanup

- **GIVEN** the server is running
- **WHEN** the cleanup schedule fires
- **THEN** the system SHALL delete `available_backups` rows whose `expires_at`
  has passed

