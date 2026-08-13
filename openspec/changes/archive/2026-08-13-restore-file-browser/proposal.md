# restore-file-browser

## Why

Restore today extracts an entire archive into a destination path. Users cannot
inspect what a backup contains or restore a single file/folder without
recovering everything. Granular restore is a major usability gap.

## What Changes

- Add an endpoint to list the contents of an available backup (archive entries).
- Add selective restore: choose individual files/folders to extract.
- Add a browse-and-select UI to the Restore page.
- Preserve the existing full-archive restore path.

## Capabilities

### New Capabilities

- `restore-browser`: list archive contents and restore a selected subset.

### Modified Capabilities

- `backups`: restore flow supports partial selection.
- `storage-connectors`: expose archive listing and partial extraction.

## Impact

- `server/routes/backups.js` — listing + selective restore endpoints.
- `server/connectors/*.js` — archive entry listing / partial extract.
- `src/pages/Restore.jsx` — browse/select UI.
- `src/api.js` — new API methods.
- Unit + E2E tests for browse and partial restore.
