# configurable-api-base

## Why

The frontend hardcodes `http://localhost:3001/api` in `src/api.js`, and
`AuthContext` uses relative `/api/...` paths. Deploying behind a reverse proxy,
a different host, or a containerized setup breaks API calls because the base
URL cannot be configured.

## What Changes

- Introduce a Vite env-driven API base (`VITE_API_BASE`) with a same-origin
  fallback.
- Route all frontend API calls (`src/api.js`, `AuthContext.jsx`) through the
  configured base.
- Document the variable in `.env.example` and README.

## Capabilities

### New Capabilities

- `app-configuration`: frontend runtime API endpoint configuration.

## Impact

- `src/api.js` — base URL from env.
- `src/context/AuthContext.jsx` — use the shared base.
- `.env.example`, `README.md` — documentation.
- Frontend unit tests for base-URL resolution.
