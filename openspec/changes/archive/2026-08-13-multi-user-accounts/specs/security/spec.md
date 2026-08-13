## MODIFIED Requirements

### Requirement: API Authentication Guard

The system SHALL require an authenticated session for all `/api` routes except
login, status, and health, MUST block access when a password change is forced,
and SHALL enforce role-based access on protected operations.

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

#### Scenario: Role enforcement

- **GIVEN** an authenticated user whose role lacks permission for an operation
- **WHEN** the request targets that operation
- **THEN** the system SHALL return `403`
