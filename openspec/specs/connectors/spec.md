# Connectors Specification

## Purpose

Manages the lifecycle (create, read, update, delete, test) of storage
connector definitions that jobs reference as sources or destinations.

## Requirements

### Requirement: List Connectors

The system SHALL return all connectors ordered by creation time descending,
with their `config` field parsed from JSON.

#### Scenario: List connectors

- **GIVEN** one or more connectors exist
- **WHEN** the client sends `GET /api/connectors`
- **THEN** the system SHALL return `200` with an array ordered by
  `created_at DESC`
- **AND** each connector's `config` SHALL be a parsed JSON object

### Requirement: Get Single Connector

The system SHALL return a single connector by id, or `404` when absent.

#### Scenario: Found connector

- **GIVEN** a connector with a matching id
- **WHEN** the client sends `GET /api/connectors/:id`
- **THEN** the system SHALL return `200` with the connector and a parsed `config`

#### Scenario: Missing connector

- **GIVEN** no connector with the requested id
- **WHEN** the client sends `GET /api/connectors/:id`
- **THEN** the system SHALL return `404` with `{ "error": "Connector not found" }`

#### Scenario: Invalid id format

- **GIVEN** a non-UUID `:id`
- **WHEN** the client sends `GET /api/connectors/:id`
- **THEN** the validation middleware SHALL return `400` with
  `{ "error": "Validation failed", "details": [...] }`

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

### Requirement: Update Connector

The system SHALL update a connector's `type`, `name`, and `config`, refreshing
`updated_at`.

#### Scenario: Valid connector update

- **GIVEN** an existing connector and a valid body
- **WHEN** the client sends `PUT /api/connectors/:id`
- **THEN** the system SHALL update `type`, `name`, `config`, and
  `updated_at = CURRENT_TIMESTAMP`
- **AND** the system SHALL return `200` with the updated connector and parsed `config`

#### Scenario: Update missing connector

- **GIVEN** no connector with the requested id
- **WHEN** the client sends `PUT /api/connectors/:id`
- **THEN** the system SHALL return `404` with `{ "error": "Connector not found" }`

### Requirement: Delete Connector

The system SHALL delete a connector by id, or `404` when absent.

#### Scenario: Delete connector

- **GIVEN** an existing connector
- **WHEN** the client sends `DELETE /api/connectors/:id`
- **THEN** the system SHALL delete the row and return `200` with `{ "success": true }`

#### Scenario: Delete missing connector

- **GIVEN** no connector with the requested id
- **WHEN** the client sends `DELETE /api/connectors/:id`
- **THEN** the system SHALL return `404` with `{ "error": "Connector not found" }`

### Requirement: Test Saved Connector

The system SHALL test a saved connector's connection and persist the result in
the `status` and `last_tested` columns.

#### Scenario: Successful connection test

- **GIVEN** an existing connector whose backend test succeeds
- **WHEN** the client sends `POST /api/connectors/:id/test`
- **THEN** the system SHALL set `status = 'connected'` and
  `last_tested = CURRENT_TIMESTAMP`
- **AND** the system SHALL return `200` with `{ "success": true, ... }`

#### Scenario: Failed connection test

- **GIVEN** an existing connector whose backend test fails
- **WHEN** the client sends `POST /api/connectors/:id/test`
- **THEN** the system SHALL set `status = 'disconnected'` and
  `last_tested = CURRENT_TIMESTAMP`
- **AND** the system SHALL return `200` with `{ "success": false, "error": <message> }`

#### Scenario: Test missing connector

- **GIVEN** no connector with the requested id
- **WHEN** the client sends `POST /api/connectors/:id/test`
- **THEN** the system SHALL return `404` with `{ "error": "Connector not found" }`

### Requirement: Ad-hoc Connector Test

The system SHALL test an unsaved `{ type, config }` pair without persisting it.

#### Scenario: Ad-hoc test

- **GIVEN** a body with `type` and `config`
- **WHEN** the client sends `POST /api/connectors/test`
- **THEN** the system SHALL invoke the connector's `testConnection` and return
  the result without writing to the database
