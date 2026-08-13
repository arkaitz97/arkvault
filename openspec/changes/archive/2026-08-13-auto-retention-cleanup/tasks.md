## 1. Shared cleanup logic

- [ ] 1.1 Extract expired-backup deletion into a reusable function
- [ ] 1.2 Add local-file unlink for local destinations

## 2. Scheduler wiring

- [ ] 2.1 Register a daily cleanup cron task on startup
- [ ] 2.2 Reuse the internal trigger mechanism for cleanup

## 3. Tests

- [ ] 3.1 Unit test cleanup deletes expired rows and unlinks local files
- [ ] 3.2 Integration test cleanup runs on schedule
