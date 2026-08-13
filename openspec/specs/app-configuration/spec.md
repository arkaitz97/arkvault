# app-configuration Specification

## Purpose
TBD - created by archiving change configurable-api-base. Update Purpose after archive.
## Requirements
### Requirement: Configurable API Base

The system SHALL resolve the backend API base URL from configuration rather
than a hardcoded value.

#### Scenario: Env-provided base

- **GIVEN** `VITE_API_BASE` is set at build time
- **WHEN** the frontend makes an API request
- **THEN** the system SHALL use `VITE_API_BASE` as the base URL

#### Scenario: Same-origin fallback

- **GIVEN** `VITE_API_BASE` is not set
- **WHEN** the frontend makes an API request
- **THEN** the system SHALL fall back to same-origin `/api`

