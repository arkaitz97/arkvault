# Jobs Specification

## Purpose

Manages backup job definitions: the source, destination, schedule, retention,
compression, encryption, format, incremental settings, and active/paused state.

## Requirements

### Requirement: List Jobs

The system SHALL return all jobs ordered by creation time descending, with
boolean fields coerced from their integer storage.

#### Scenario: List jobs

- **GIVEN** one or more jobs exist
- **WHEN** the client sends `GET /api/jobs`
- **THEN** the system SHALL return `200` with an array ordered by
  `created_at DESC`
- **AND** each job's `source_config` and `destination_config` SHALL be parsed
  JSON (or `null`)
- **AND** `compression`, `encryption`, and `incremental` SHALL be booleans

### Requirement: Get Single Job

The system SHALL return a single job by id, or `404` when absent.

#### Scenario: Found job

- **GIVEN** a job with a matching id
- **WHEN** the client sends `GET /api/jobs/:id`
- **THEN** the system SHALL return `200` with the job, parsed configs, and
  coerced booleans

#### Scenario: Missing job

- **GIVEN** no job with the requested id
- **WHEN** the client sends `GET /api/jobs/:id`
- **THEN** the system SHALL return `404` with `{ "error": "Job not found" }`

### Requirement: Create Job

The system SHALL create a job with a generated UUID, validate its cron
schedule, and compute the initial `next_run`.

#### Scenario: Valid job creation

- **GIVEN** a body with a non-empty `name` (max 255), a valid cron `schedule`,
  `source_type` and `destination_type` in the supported list, and optional
  `retention` (1-3650) and `format` (`zip` or `tar`)
- **WHEN** the client sends `POST /api/jobs`
- **THEN** the system SHALL apply defaults `retention = 30`,
  `compression = true`, `encryption = true`, `format = 'zip'`,
  `incremental = false`
- **AND** the system SHALL set `next_run` via `calculateNextRun(schedule)`
- **AND** the system SHALL return `201` with the created job

#### Scenario: Invalid cron expression

- **GIVEN** a `schedule` that fails `cron.validate`
- **WHEN** the client sends `POST /api/jobs`
- **THEN** the validation middleware SHALL return `400` with
  `{ "error": "Validation failed", "details": [...] }`

#### Scenario: Retention out of range

- **GIVEN** a `retention` below 1 or above 3650
- **WHEN** the client sends `POST /api/jobs`
- **THEN** the validation middleware SHALL return `400` with
  `{ "error": "Validation failed", "details": [...] }`

### Requirement: Update Job

The system SHALL update a job with partial (COALESCE) semantics and recompute
`next_run` when the schedule changes.

#### Scenario: Partial job update

- **GIVEN** an existing job and a body containing a subset of fields
- **WHEN** the client sends `PUT /api/jobs/:id`
- **THEN** the system SHALL update only the provided fields using `COALESCE`,
  set `updated_at = CURRENT_TIMESTAMP`, and set `next_run` from the new
  schedule when provided
- **AND** the system SHALL return `200` with the updated job

#### Scenario: Update missing job

- **GIVEN** no job with the requested id
- **WHEN** the client sends `PUT /api/jobs/:id`
- **THEN** the system SHALL return `404` with `{ "error": "Job not found" }`

### Requirement: Delete Job

The system SHALL delete a job by id, or `404` when absent.

#### Scenario: Delete job

- **GIVEN** an existing job
- **WHEN** the client sends `DELETE /api/jobs/:id`
- **THEN** the system SHALL delete the row and return `200` with `{ "success": true }`

#### Scenario: Delete missing job

- **GIVEN** no job with the requested id
- **WHEN** the client sends `DELETE /api/jobs/:id`
- **THEN** the system SHALL return `404` with `{ "error": "Job not found" }`

### Requirement: Toggle Job Status

The system SHALL toggle a job between `active` and `paused`.

#### Scenario: Toggle active to paused

- **GIVEN** a job with `status = 'active'`
- **WHEN** the client sends `POST /api/jobs/:id/toggle`
- **THEN** the system SHALL set `status = 'paused'`, update `updated_at`, and
  return `200` with `{ "status": "paused" }`

#### Scenario: Toggle paused to active

- **GIVEN** a job with `status = 'paused'`
- **WHEN** the client sends `POST /api/jobs/:id/toggle`
- **THEN** the system SHALL set `status = 'active'`, update `updated_at`, and
  return `200` with `{ "status": "active" }`

#### Scenario: Toggle missing job

- **GIVEN** no job with the requested id
- **WHEN** the client sends `POST /api/jobs/:id/toggle`
- **THEN** the system SHALL return `404` with `{ "error": "Job not found" }`
