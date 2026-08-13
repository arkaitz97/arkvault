## 1. Backend listing

- [ ] 1.1 Add endpoint to list archive contents for a backup id
- [ ] 1.2 Implement entry listing in connectors (local first, then S3/gdrive/nfs)

## 2. Selective restore

- [ ] 2.1 Add selective restore endpoint accepting selected paths
- [ ] 2.2 Implement partial extraction in the local connector

## 3. Frontend

- [ ] 3.1 Add browse/select UI to the Restore page
- [ ] 3.2 Wire new API methods in `src/api.js`

## 4. Tests

- [ ] 4.1 Unit test archive listing and partial extract
- [ ] 4.2 E2E test browse and selective restore
