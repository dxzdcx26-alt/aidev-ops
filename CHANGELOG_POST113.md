# AI Dev Control Center — Post-113

## Scope

Security/production-readiness hardening performed directly on the existing Post-112 codebase. No rebuild or replacement of the architecture.

## Changes

### 1. Production session fail-closed
- `src/lib/auth.ts`
  - `SESSION_SECRET` is mandatory in production.
  - `DATABASE_URL` is no longer accepted as a production signing-secret fallback.
- `src/middleware.ts`
  - Edge session verification also fails closed when `SESSION_SECRET` is missing in production.
  - Development fallback remains available for local development only.

### 2. Production admin bootstrap hardening
- Added `validateAdminPasswordConfig()`.
- Production requires `CONTROL_CENTER_ADMIN_PASSWORD` before a first-boot admin can be created.
- Minimum password length: 16 characters.
- Common weak bootstrap passwords are rejected.
- Development can still generate a random bootstrap password.
- Production never prints bootstrap credentials to logs.

### 3. Production-readiness checks made more truthful
- Added an explicit `Admin Bootstrap Password` readiness check.
- Vercel is considered configured only when `VERCEL_TOKEN`, `VERCEL_TEAM_ID`, and `VERCEL_PROJECT_ID` are all present.
- AI readiness now performs an authenticated `GET /models` request rather than swallowing connection failures.
- AI HTTP 401/403/5xx responses are treated as integration failures.
- AI redirects remain blocked.

### 4. Privileged deployment authorization
- Added `requireActionPermission()` for approval-gated actions.
- Deploy routes now enforce the server-side `DEPLOY` role permission before execution.
- Rollback routes now enforce the server-side `ROLLBACK` role permission before execution.
- Approval consumption can validate the consuming user's server-side role, preventing a valid approval record from becoming a privilege-escalation token.

### 5. Deliverable cleanup
- Removed `.git` metadata from the distributable workspace.
- Removed stale TAR archives from `download/`.
- Removed transient `.zscripts/dev.pid`.
- Real `.env` is excluded from the deliverable archive.
- Local SQLite database is excluded from the deliverable archive to avoid shipping credentials/session data.

## Verification

Static source review completed after modifications.

The environment available for this editing pass does not contain `node_modules` or Bun. Two dependency-install attempts timed out, so a fresh `lint`, `test`, and production `build` could not be executed in this workspace.

Existing project verification recorded before this pass:
- Lint: 0 errors
- Tests: 170 pass / 0 fail
- Build: compiled successfully with `ignoreBuildErrors: false`

These historical results are not claimed as fresh post-113 execution results.
