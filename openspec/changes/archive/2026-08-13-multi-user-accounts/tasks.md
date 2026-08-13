## 1. Data model

- [ ] 1.1 Add `users` table (id, username, password_hash, role, must_change_password)
- [ ] 1.2 Migrate `auth_settings` into an initial admin user

## 2. Auth routes

- [ ] 2.1 Update login to username/password against `users`
- [ ] 2.2 Store user id and role in the session
- [ ] 2.3 Update change-password to target the session user

## 3. User management

- [ ] 3.1 Add admin CRUD routes for users
- [ ] 3.2 Add role middleware

## 4. Frontend

- [ ] 4.1 Update Login page and AuthContext for the username flow
- [ ] 4.2 Add user management UI (admin)

## 5. Tests

- [ ] 5.1 Unit test login and role enforcement
- [ ] 5.2 E2E test admin creates user and viewer is restricted
