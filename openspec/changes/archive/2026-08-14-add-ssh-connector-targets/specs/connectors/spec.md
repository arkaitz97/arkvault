## MODIFIED Requirements

### Requirement: Create Connector

The system SHALL create a connector with a generated UUID, an initial
`disconnected` status, and a JSON-serialized `config`.

#### Scenario: Valid connector creation

- **GIVEN** a body with `type` in `[local, s3, gdrive, postgresql, nfs, ssh]`,
  a non-empty `name` of at most 255 characters, and an object `config`
- **WHEN** the client sends `POST /api/connectors`
- **THEN** the system SHALL insert the connector with a new UUID and
  `status = 'disconnected'`
- **AND** the system SHALL return `201` with the created connector and parsed `config`

#### Scenario: Invalid connector type

- **GIVEN** a `type` outside the supported list
- **WHEN** the client sends `POST /api/connectors`
- **THEN** the validation middleware SHALL return `400` with
  `{ "error": "Validation failed", "details": [...] }`
