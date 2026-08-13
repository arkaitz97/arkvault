# user-management Specification

## Purpose
TBD - created by archiving change multi-user-accounts. Update Purpose after archive.
## Requirements
### Requirement: User Account CRUD

The system SHALL allow administrators to create, list, update, and deactivate
user accounts.

#### Scenario: Create user

- **GIVEN** an authenticated admin
- **WHEN** the admin creates a user with a username, password, and role
- **THEN** the system SHALL store the user with a bcrypt hash and return `201`

#### Scenario: List users

- **GIVEN** an authenticated admin
- **WHEN** the admin lists users
- **THEN** the system SHALL return the users without exposing password hashes

#### Scenario: Non-admin denied

- **GIVEN** a non-admin user
- **WHEN** they attempt user management
- **THEN** the system SHALL return `403`

### Requirement: Role Assignment

The system SHALL assign roles (`admin`, `operator`, `viewer`) to users and
enforce them on operations.

#### Scenario: Role stored

- **GIVEN** a user created or updated with a role
- **WHEN** the role is assigned
- **THEN** the system SHALL persist the role on the user record

