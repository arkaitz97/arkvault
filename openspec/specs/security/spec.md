# Security Specification

## Purpose

Enforces HTTP security headers, CORS, rate limiting, session cookie handling,
authentication guards, path traversal protection, and centralized error
responses.
## Requirements
### Requirement: Security Headers

The system SHALL apply Helmet with a restrictive Content Security Policy and
related hardening headers.

#### Scenario: Response headers applied

- **GIVEN** any HTTP response
- **WHEN** the request passes through `configureHelmet(app)`
- **THEN** the system SHALL set a CSP with `default-src 'self'`, `script-src 'self'`,
  `style-src 'self' 'unsafe-inline'`, `img-src 'self' data: https:`,
  `object-src 'none'`, and `frame-src 'none'`
- **AND** the system SHALL set HSTS with `maxAge = 31536000`,
  `includeSubDomains`, and `preload`
- **AND** the system SHALL set `X-Frame-Options: deny`, `X-Content-Type-Options:
  nosniff`, and a `strict-origin-when-cross-origin` referrer policy
- **AND** the system SHALL disable the Helmet `X-XSS-Protection` header

### Requirement: CORS

The system SHALL allow only configured origins and permit credentialed requests.

#### Scenario: Allowed origin

- **GIVEN** a request whose `Origin` is in `ALLOWED_ORIGINS` (default
  `http://localhost:5173` and `http://localhost:3000`) or has no `Origin`
- **WHEN** the request is received
- **THEN** the system SHALL allow it with `credentials: true`, methods
  `GET, POST, PUT, DELETE`, allowed headers `Content-Type, Authorization`, and
  `maxAge: 600`

#### Scenario: Disallowed origin

- **GIVEN** a request whose `Origin` is not in the allowed list
- **WHEN** the request is received
- **THEN** the system SHALL reject it with the error `Not allowed by CORS`

### Requirement: Rate Limiting

The system SHALL apply distinct rate limits to authentication, general API, and
download routes, disabled in the test environment.

#### Scenario: Authentication rate limit

- **GIVEN** a non-test environment
- **WHEN** a client exceeds 5 auth requests in 15 minutes
- **THEN** the system SHALL return a rate-limit response with
  `{ "error": "Too many authentication attempts. Please try again later.", "retryAfter": "15 minutes" }`

#### Scenario: API rate limit

- **GIVEN** a non-test environment
- **WHEN** a client exceeds 100 API requests in 15 minutes (excluding
  successful requests)
- **THEN** the system SHALL return a rate-limit response with
  `{ "error": "Too many requests. Please try again later." }`

#### Scenario: Download rate limit

- **GIVEN** a non-test environment
- **WHEN** a client exceeds 10 download requests in 1 minute
- **THEN** the system SHALL return a rate-limit response with
  `{ "error": "Too many download requests. Please try again later." }`

#### Scenario: Test environment bypass

- **GIVEN** `NODE_ENV === 'test'`
- **WHEN** any rate-limited request is made
- **THEN** the system SHALL skip rate limiting (allow up to 10000 requests)

### Requirement: Session Cookie

The system SHALL manage authentication state via a signed session cookie.

#### Scenario: Session cookie attributes

- **GIVEN** a session is created
- **WHEN** the session middleware runs
- **THEN** the system SHALL use the cookie name `arkvault.sid` with
  `httpOnly: true`, `sameSite: 'lax'`, `maxAge` of 8 hours, and
  `secure: true` only when `NODE_ENV === 'production'`
- **AND** the system SHALL use the `SESSION_SECRET` env var (or a development
  default) to sign the cookie

### Requirement: API Authentication Guard

The system SHALL require an authenticated session or a valid bearer token for
all `/api` routes except login, status, health, and scheduler-originated
internal backup runs, MUST block access when a password change is forced, and
SHALL enforce role-based access on protected operations.

#### Scenario: Unauthenticated request

- **GIVEN** a request to a protected `/api` route without an authenticated
  session or bearer token
- **WHEN** the request passes the guard
- **THEN** the system SHALL return `401` with `{ "error": "Unauthorized" }`

#### Scenario: Forced password change

- **GIVEN** an authenticated session with `mustChangePassword = true`
- **WHEN** the request targets any route other than `/auth/change-password`
- **THEN** the system SHALL return `403` with
  `{ "error": "Must change password", "code": "MUST_CHANGE_PASSWORD" }`

#### Scenario: Public endpoints

- **GIVEN** a request to `/api/auth/login`, `/api/auth/status`, or `/api/health`
- **WHEN** the request passes the guard
- **THEN** the system SHALL allow it without an authenticated session

#### Scenario: Internal trigger backup run

- **GIVEN** a `POST /api/backups/run/:jobId` request carrying a valid internal
  trigger credential
- **WHEN** the request passes the guard
- **THEN** the system SHALL allow it without an authenticated session

#### Scenario: Bearer token authentication

- **GIVEN** a request with a valid bearer token
- **WHEN** the request passes the guard
- **THEN** the system SHALL authenticate it and apply the token's scopes

#### Scenario: Role enforcement

- **GIVEN** an authenticated user whose role lacks permission for an operation
- **WHEN** the request targets that operation
- **THEN** the system SHALL return `403`

### Requirement: Path Validation

The system SHALL reject path traversal and sanitize filenames.

#### Scenario: Path traversal rejected

- **GIVEN** a path string containing `..`
- **WHEN** `validatePath` is called
- **THEN** the system SHALL throw `Invalid path: path traversal detected`

#### Scenario: Empty or non-string path rejected

- **GIVEN** a non-string or empty path
- **WHEN** `validatePath` is called
- **THEN** the system SHALL throw `Invalid path: path must be a non-empty string`

#### Scenario: Path outside allowed base rejected

- **GIVEN** an absolute path outside all `allowedBasePaths`
- **WHEN** `validatePath` is called with `allowedBasePaths`
- **THEN** the system SHALL throw `Invalid path: path outside allowed directories`

#### Scenario: Filename sanitized

- **GIVEN** a filename with characters outside `[a-zA-Z0-9._-]`
- **WHEN** `sanitizeFilename` is called
- **THEN** the system SHALL replace disallowed characters with `_` and throw on
  empty, `.`, or `..` results

### Requirement: Error Responses

The system SHALL return JSON error responses, hiding stack traces in production.

#### Scenario: Error in development

- **GIVEN** an error and `NODE_ENV != 'production'`
- **WHEN** the error handler runs
- **THEN** the system SHALL return the error status with
  `{ "error": <message>, "stack": <stack>, "details": ... }`

#### Scenario: Error in production

- **GIVEN** an error and `NODE_ENV === 'production'`
- **WHEN** the error handler runs
- **THEN** the system SHALL return `{ "error": "An internal server error occurred" }`
  for 500 errors and `{ "error": <message> }` otherwise, without a stack trace

