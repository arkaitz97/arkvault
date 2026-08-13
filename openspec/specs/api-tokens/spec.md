# api-tokens Specification

## Purpose
TBD - created by archiving change api-access-tokens. Update Purpose after archive.
## Requirements
### Requirement: Token Lifecycle

The system SHALL allow administrators to create, list, and revoke scoped API
tokens.

#### Scenario: Create token

- **GIVEN** an authenticated admin
- **WHEN** the admin creates a token with scopes
- **THEN** the system SHALL store a hash of the token and return the plaintext
  once

#### Scenario: List tokens

- **GIVEN** an authenticated admin
- **WHEN** the admin lists tokens
- **THEN** the system SHALL return token metadata without the secret

#### Scenario: Revoke token

- **GIVEN** an existing token
- **WHEN** the admin revokes it
- **THEN** the system SHALL invalidate the token so it no longer authenticates

### Requirement: Token Authentication

The system SHALL authenticate API requests using a bearer token and enforce
token scopes.

#### Scenario: Bearer token request

- **GIVEN** a valid token in the `Authorization` header
- **WHEN** a request reaches the guard
- **THEN** the system SHALL authenticate it and allow operations within scope

#### Scenario: Invalid token

- **GIVEN** a missing or invalid token with no session
- **WHEN** a request reaches the guard
- **THEN** the system SHALL return `401` with `{ "error": "Unauthorized" }`

