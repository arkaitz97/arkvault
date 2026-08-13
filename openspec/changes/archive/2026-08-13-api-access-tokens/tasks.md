## 1. Data model

- [ ] 1.1 Add `api_tokens` table (id, name, token_hash, scopes, created_at, revoked)

## 2. Token endpoints

- [ ] 2.1 Add admin routes to create/list/revoke tokens

## 3. Guard integration

- [ ] 3.1 Accept bearer tokens in the API guard
- [ ] 3.2 Enforce token scopes

## 4. Frontend

- [ ] 4.1 Add token management UI to Settings

## 5. Tests

- [ ] 5.1 Unit test token auth and scopes
- [ ] 5.2 Integration test revoked token is rejected
