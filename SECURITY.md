# Security Policy

## Reporting a vulnerability

Report security issues privately through GitHub Security Advisories:
<https://github.com/arkaitz97/arkvault/security/advisories/new>

Do not open a public issue for a vulnerability. Include the affected version or
commit, the steps to reproduce, and the impact you observed.

## Scope

ArkVault runs with access to every storage backend you connect and, for NFS, with
elevated container capabilities. The following classes of report are in scope:

- Authentication or session bypass, privilege escalation between roles.
- Path traversal in a connector or in restore.
- Leakage of secrets (passwords, tokens, keys) into logs, API responses or backups.
- Integrity or encryption failures: a restore that returns unverified bytes.
- Command injection through connector configuration.

## Out of scope

- Findings that require a compromised host or an attacker who already has the
  admin password.
- Missing hardening headers on responses that do not carry data.
- Rate-limit thresholds, unless they enable a concrete bypass.

## Response

You get an acknowledgement within 7 days and a status update within 30 days. A fix
is released as a patch commit on `main`, and the advisory is published after the
fix is available.

## Supported versions

The latest commit on `main` is the supported version. Older commits are not
maintained.
