## 1. Internal trigger credential

- [ ] 1.1 Add `INTERNAL_TRIGGER_SECRET` env var with a development default
- [ ] 1.2 Add a utility to issue and verify an internal trigger header (HMAC)

## 2. Auth guard update

- [ ] 2.1 Allow `POST /api/backups/run/:jobId` with a valid internal trigger header
- [ ] 2.2 Keep `401` for missing or invalid credentials

## 3. Scheduler update

- [ ] 3.1 Include the internal trigger header in the scheduler's `fetch` call

## 4. Tests

- [ ] 4.1 Unit test guard allows valid trigger and rejects invalid
- [ ] 4.2 Integration test scheduler-triggered run succeeds
