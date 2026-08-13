## 1. Stats fix

- [ ] 1.1 Change `activeJobs` query from `backup_jobs` to `jobs` (`status = 'active'`)

## 2. Cleanup fix

- [ ] 2.1 Update cleanup status filter to `success`/`failed`

## 3. Tests

- [ ] 3.1 Unit test stats returns `activeJobs` from the `jobs` table
- [ ] 3.2 Unit test cleanup deletes matching history rows
