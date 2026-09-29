# Troubleshooting

## Common Issues

### All data shows `MOCK` badge

**Cause**: Environment variables not configured

**Fix**: Set `GITHUB_TOKEN`, `AI_API_KEY`, `VERCEL_TOKEN` in `.env` (copy from `.env.example`)

```bash
cp .env.example .env
# Edit .env with your real credentials
```

Restart the dev server after editing `.env`.

### AI Console shows `[FALLBACK]`

**Cause**: `AI_API_KEY` missing OR AI call failed

**Fix**:
1. Check `/api/health` — `ai.configured` should be `true`
2. If `false`, set `AI_API_KEY` in `.env`
3. If `true` but still falling back, check the audit log for error details
4. Common AI errors:
   - 401: Invalid API key
   - 429: Rate limit — wait or upgrade plan
   - Timeout: AI provider slow — check `AI_BASE_URL` is correct

### Deploy button shows approval dialog

**Cause**: This is correct behavior per spec §87 — production deploys require human approval

**Fix**: Approve or cancel. AI cannot auto-deploy to production.

### GitHub API 403

**Cause**: Rate limit hit or token lacks scope

**Fix**:
1. Check audit log for `GITHUB_RATE_LIMIT` event — wait for reset time shown
2. If not rate limit, check token scopes: `repo`, `read:org`, `workflow`
3. Create new token at https://github.com/settings/personal-access-tokens

### Build errors

**Cause**: TypeScript or ESLint failure

**Fix**:
```bash
bun run lint    # See ESLint errors
bun run build   # See TypeScript + build errors
```

Never disable ESLint rules or TypeScript strict mode to make errors go away (spec §26).

### Hydration errors

**Cause**: Server/client render mismatch

**Fix**:
1. Check browser console for the mismatch details
2. Common cause: using `Date.now()` or `Math.random()` during render
3. Move side-effect code to `useEffect`

### Command Bar (⌘K) doesn't open

**Fix**:
1. Click the "Command" button in the top bar
2. Verify keyboard shortcut: `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux)
3. Check browser console for errors

## Debug Endpoints

| Endpoint | Purpose |
|---|---|
| `/api/health` | System health + env config status |
| `/api/env-check` | Detailed env var check (masked values) |
| `/api/production-readiness` | Full readiness checklist |

## Audit Log

Every action is logged at `/api/audit` (visible in the Audit Log view). Filter by action type:

- `AI_CALL` — AI provider calls
- `GITHUB_CALL` — GitHub API calls
- `VERCEL_CALL` — Vercel API calls
- `DEPLOY` / `DEPLOY_SUCCESS` / `DEPLOY_FAILED`
- `ROLLBACK` / `ROLLBACK_SUCCESS` / `ROLLBACK_FAILED`
- `APPROVE` / `REJECT`
- `SECURITY_ALERT` — prompt injection or secret detection
- `PERMISSION_DENIED` — blocked action

## Reset State

To reset the in-memory state (audit log, approvals, agent runs):

1. Refresh the page (clears client state)
2. Restart the dev server (clears server in-memory state)

In production with a database, state persists across restarts.

## Getting Help

If you encounter an issue not covered here:

1. Check the audit log for the specific error
2. Check the browser console for client-side errors
3. Check the dev server log for server-side errors
4. Review the relevant docs file (`docs/architecture.md`, `docs/security.md`, etc.)
