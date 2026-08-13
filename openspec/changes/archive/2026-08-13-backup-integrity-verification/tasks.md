## 1. Checksum

- [ ] 1.1 Add a SHA-256 checksum helper

## 2. Run flow

- [ ] 2.1 Compute the checksum at backup time
- [ ] 2.2 Store checksum + integrity status in `backup_history` (schema + write)

## 3. Restore verification

- [ ] 3.1 Verify the checksum before restore, fail on mismatch

## 4. Tests

- [ ] 4.1 Unit test checksum compute/verify
- [ ] 4.2 Integration test corrupted archive fails restore
