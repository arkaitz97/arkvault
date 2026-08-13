# Auth Specification

## Purpose

Handles password authentication, session lifecycle, and the forced
password-change flow for the single shared administrator account.
## Requirements
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

### Requirement: Session Status

The system SHALL report the current authentication state of the session.

#### Scenario: Authenticated status check

- **GIVEN** a session where `req.session.authenticated` is `true`
- **WHEN** the client sends `GET /api/auth/status`
- **THEN** the system SHALL return `200` with `{ "authenticated": true, "mustChangePassword": <bool> }`

#### Scenario: Unauthenticated status check

- **GIVEN** a session where `req.session.authenticated` is not set
- **WHEN** the client sends `GET /api/auth/status`
- **THEN** the system SHALL return `200` with `{ "authenticated": false }`

### Requirement: Logout

The system SHALL terminate the session and clear the session cookie.

#### Scenario: Successful logout

- **GIVEN** an existing session
- **WHEN** the client sends `POST /api/auth/logout`
- **THEN** the system SHALL destroy the session
- **AND** the system SHALL clear the `arkvault.sid` cookie
- **AND** the system SHALL return `200` with `{ "success": true }`

#### Scenario: Logout session destroy failure

- **GIVEN** a session that fails to destroy
- **WHEN** the client sends `POST /api/auth/logout`
- **THEN** the system SHALL return `500` with `{ "error": "Could not log out" }`

### Requirement: Change Password

The system SHALL allow an authenticated client to replace the password and
clear the forced password-change flag.

#### Scenario: Successful password change

- **GIVEN** an authenticated session and a valid `newPassword` matching `confirmPassword`
- **WHEN** the client sends `POST /api/auth/change-password`
- **THEN** the system SHALL hash the new password with bcrypt at 10 salt rounds
- **AND** the system SHALL update `auth_settings` with the new hash, set
  `must_change_password = 0`, and update `updated_at`
- **AND** the system SHALL set `req.session.mustChangePassword` to `false`
- **AND** the system SHALL return `200` with `{ "success": true }`

#### Scenario: Unauthenticated password change

- **GIVEN** a session where `req.session.authenticated` is not set
- **WHEN** the client sends `POST /api/auth/change-password`
- **THEN** the system SHALL return `401` with `{ "error": "Not authenticated" }`

#### Scenario: Password complexity violation

- **GIVEN** a `newPassword` shorter than the minimum length or lacking a
  required character class (lowercase, uppercase, or digit outside test env)
- **WHEN** the client sends `POST /api/auth/change-password`
- **THEN** the validation middleware SHALL return `400` with `{ "error": "Validation failed", "details": [...] }`

#### Scenario: Password confirmation mismatch

- **GIVEN** a `confirmPassword` that does not equal `newPassword`
- **WHEN** the client sends `POST /api/auth/change-password`
- **THEN** the validation middleware SHALL return `400` with `{ "error": "Validation failed", "details": [...] }`

### Requirement: Default Credentials

The system SHALL seed `auth_settings` with a default password hash on database
initialization, with forced password change enabled.

#### Scenario: Initial seed

- **GIVEN** an empty `auth_settings` table
- **WHEN** the database is initialized
- **THEN** the system SHALL insert row `id = 1` with the bcrypt hash for
  `admin123` and `must_change_password = 1`

#### Scenario: Reset script

- **GIVEN** the `scripts/reset-auth.js` script is executed
- **WHEN** the script runs `npm run db:reset`
- **THEN** the system SHALL reset the password hash to the default and set
  `must_change_password = 1`

