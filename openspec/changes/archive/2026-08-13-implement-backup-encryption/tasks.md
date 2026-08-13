## 1. Crypto utility

- [ ] 1.1 Add AES-256-GCM encrypt/decrypt helpers
- [ ] 1.2 Add key derivation (master key to per-backup data key)

## 2. Connector integration

- [ ] 2.1 Encrypt archive in local/S3/gdrive/nfs backup paths
- [ ] 2.2 Decrypt in restore and download paths

## 3. Run flow

- [ ] 3.1 Thread encryption options through the run endpoint
- [ ] 3.2 Keep `available_backups.encrypted` accurate

## 4. Key storage

- [ ] 4.1 Store the master key via env/settings

## 5. Tests

- [ ] 5.1 Unit test encrypt/decrypt round trip
- [ ] 5.2 Integration test encrypted run and restore
