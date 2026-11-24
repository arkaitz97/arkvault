# Connector modules behind one five-method contract

## Status

Accepted.

## Context and problem statement

A backup job moves bytes from one backend to another. The application supports six
backends: local folder, NFS, SSH/SFTP, S3-compatible storage, Google Drive and
PostgreSQL. Each backend has a different client library and a different addressing
scheme. Each one also has different capabilities: PostgreSQL can be a source but not a
destination; NFS and S3 archive locally before they upload.

The job runner must stay one code path. If the runner branches on `source_type` and
`destination_type`, every new backend changes the runner, and every backend repeats
the archive, checksum, encryption and history steps.

## Decision drivers

- One run pipeline for all backend pairs, so history, encryption and checksums behave
  the same everywhere.
- New backends must not touch the runner.
- A missing capability must fail loudly, not silently skip a step.
- The type list must be validated before it reaches the runner.

## Considered options

1. One function per backend pair, or a `switch` inside the runner.
2. Load connector modules dynamically from a directory.
3. One module per backend, each exporting a class with a fixed method set, resolved by a
   static map.

## Decision outcome

Chosen option 3. `server/connectors/index.js` holds a map from type name to instance
and exposes `getConnector(type)`, which throws for an unknown name. Each connector
class implements `testConnection`, `backup`, `upload`, `download` and `restore`. The
runner in `server/routes/backups.js` only calls those methods.

Capabilities are expressed by behaviour, not by flags. `server/connectors/postgresql.js`
throws in `upload` and `download` with the message that PostgreSQL cannot be a
destination or a restore source.

Two connectors reuse another instead of copying code. The NFS connector mounts the
export and calls `local.backup`. The NFS and S3 connectors call `local.restore`,
because unpacking is a local operation.

### Consequences

Good:

- The run pipeline exists once. Encryption, checksum, history and notification apply to
  all six backends without per-backend code.
- A connector test can mock one class and assert the contract.

Bad:

- The type list appears three times: the map, the singleton imports, and the `isIn`
  list in `server/middleware/validation-middleware.js`. A new backend needs all three
  edits, and a missed edit fails at request time.
- `getConnector` returns a singleton, so connector state lives for the process life.
  That is safe only because the classes keep no per-call state.

Neutral:

- A connector that is a source only reports that by throwing, so the UI cannot discover
  capabilities without calling the method.

## Confirmation

- `server/connectors/index.js` contains the six-entry map and the throwing lookup.
- `tests/unit/backend/connectors-route.test.js` asserts the route uses the connector
  returned by `getConnector`.
- `tests/unit/backend/postgresql.test.js` asserts that `upload` and `download` reject.
- `server/middleware/validation-middleware.js` lists the six types for job bodies.

The integration suite for jobs runs against a mock Express app with its own table, so
it checks request shape, not the real router.

## More information

- `docs/design.md`, "The connector boundary".
- ADR 0002 for how a run is triggered.
