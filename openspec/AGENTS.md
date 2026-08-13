# OpenSpec Instructions for ArkVault

Instructions for AI agents maintaining the ArkVault OpenSpec specifications.

## Purpose

This directory is the source of truth for ArkVault's actual behavior. Specs
describe what the system currently does, not aspirational features. Keep them
in sync with code changes.

## Layout

- `openspec/project.md` — project context, stack, and architecture.
- `openspec/specs/<domain>/spec.md` — one spec per domain. Current domains:
  - `auth` — password login, session, change-password flow
  - `connectors` — connector CRUD + connection testing
  - `jobs` — backup job CRUD + status toggle
  - `backups` — run, history, restore, download, retention cleanup
  - `storage-connectors` — the five backend implementations
  - `scheduler` — cron scheduling lifecycle
  - `settings` — key/value settings, stats, cleanup
  - `security` — headers, CORS, rate limits, session, guard, path validation
- `openspec/changes/` — change proposals and delta specs.

## Spec Format Rules

- Each spec file MUST have a `## Purpose` section and a `## Requirements` section.
- Requirements MUST use `### Requirement: <Name>` headers with a body that
  contains `SHALL` or `MUST`.
- Scenarios MUST use exactly four hashes: `#### Scenario: <Name>`.
- Scenarios MUST include `**WHEN**` and `**THEN**` bullets; `**GIVEN**` and
  `**AND**` are optional.
- Every requirement MUST have at least one scenario.

## Change Workflow

1. When behavior changes, create a change under `openspec/changes/` with a
   delta spec using `## ADDED Requirements`, `## MODIFIED Requirements`
   (full updated content), `## REMOVED Requirements` (with Reason/Migration),
   or `## RENAMED Requirements` (FROM/TO).
2. Archive the change to merge deltas into the main specs.
3. Never edit `openspec/specs/<domain>/spec.md` directly for behavior changes;
   route through changes so deltas stay traceable.

## Verification

Run `openspec validate --specs` after edits. Fix any missing `## Purpose` /
`## Requirements` sections, requirements without `SHALL`/`MUST`, or scenarios
that are not level-4 headers.

## Domain-Specific Notes

- `backups` and `storage-connectors` overlap: route execution logic (history,
  restore, retention) is `backups`; per-backend I/O semantics are
  `storage-connectors`.
- `security` documents cross-cutting middleware applied in `server/index.js`.
  If middleware ordering changes, update both the spec and `project.md`.
- `scheduler` documents the in-memory task map rebuilt on startup and every
  minute; keep it in sync with `server/index.js` scheduling functions.
- `settings` stats and cleanup reference columns that may drift (e.g.,
  `status = 'completed'` vs. history `status = 'success'`). Verify against
  `server/routes/settings.js` and `server/routes/backups.js` before changing.
