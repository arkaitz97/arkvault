## MODIFIED Requirements

### Requirement: API Authentication Guard

The system SHALL require an authenticated session for all `/api` routes except
login, status, health, and scheduler-originated internal backup runs, and MUST
block access when a password change is forced.

#### Scenario: Unauthenticated request

- **GIVEN** a request to a protected `/api` route without an authenticated session
- **WHEN** the request passes the guard
- **THEN** the system SHALL return `401` with `{ "error": "Unauthorized" }`

#### Scenario: Forced password change

- **GIVEN** an authenticated session with `mustChangePassword = true`
- **WHEN** the request targets any route other than `/auth/change-password`
- **THEN** the system SHALL return `403` with
  `{ "error": "Must change password", "code": "MUST_CHANGE_PASSWORD" }`

#### Scenario: Public endpoints

- **GIVEN** a request to `/api/auth/login`, `/api/auth/status`, or `/api/health`
- **WHEN** the request passes the guard
- **THEN** the system SHALL allow it without an authenticated session

#### Scenario: Internal trigger backup run

- **GIVEN** a `POST /api/backups/run/:jobId` request carrying a valid internal
  trigger credential
- **WHEN** the request passes the guard
- **THEN** the system SHALL allow it without an authenticated session

#### Scenario: Invalid internal trigger

- **GIVEN** a `POST /api/backups/run/:jobId` request with a missing or invalid
  internal trigger credential and no authenticated session
- **WHEN** the request passes the guard
- **THEN** the system SHALL return `401` with `{ "error": "Unauthorized" }`
