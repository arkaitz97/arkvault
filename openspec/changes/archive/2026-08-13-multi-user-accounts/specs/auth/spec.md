## MODIFIED Requirements

### Requirement: Password Login

The system SHALL authenticate a client by matching a submitted username and
password against the `users` table.

#### Scenario: Successful login

- **GIVEN** a client submits a username and password matching a user record
- **WHEN** the client sends `POST /api/auth/login`
- **THEN** the system SHALL set `req.session.authenticated` to `true`
- **AND** the system SHALL store the user id and role in the session
- **AND** the system SHALL set `req.session.mustChangePassword` from the user
  record
- **AND** the system SHALL return `200` with
  `{ "authenticated": true, "mustChangePassword": <bool>, "user": {...} }`

#### Scenario: Wrong password

- **GIVEN** a client submits a password that does not match the user's hash
- **WHEN** the client sends `POST /api/auth/login`
- **THEN** the system SHALL return `401` with `{ "error": "Invalid password" }`

#### Scenario: Unknown username

- **GIVEN** a username not in the `users` table
- **WHEN** the client sends `POST /api/auth/login`
- **THEN** the system SHALL return `401` with `{ "error": "Invalid password" }`

#### Scenario: Missing credentials

- **GIVEN** a request body missing `username` or `password`
- **WHEN** the client sends `POST /api/auth/login`
- **THEN** the validation middleware SHALL return `400` with
  `{ "error": "Validation failed", "details": [...] }`
