# Deployment

## Vercel Setup

1. Create a Vercel token at https://vercel.com/account/tokens
2. Find your Team ID at: Vercel Dashboard → Team Settings → General → Team ID
3. Find your Project ID at: Project Settings → General → Project ID
4. Set in `.env`:
   ```
   VERCEL_TOKEN=your-token
   VERCEL_TEAM_ID=team_xxx
   VERCEL_PROJECT_ID=prj_xxx
   ```

## Deploy Flow (Phase 10)

```
Human Approval (Phase 9)
    ↓
Create Deployment (Vercel API)
    ↓
Track Deployment Status
    ├─ QUEUED → BUILDING → READY
    └─ ERROR / CANCELED
    ↓
Verify Deployment (Phase 11)
    ├─ HTTP status check
    ├─ Page load check
    ├─ /api/health check
    └─ Smoke test
    ↓
Health Check
    ↓
Production
```

**Per spec §10**: The system never reports a deployment as successful until verification passes.

## API Routes

| Route | Method | Description |
|---|---|---|
| `/api/vercel/deployments` | GET | List deployments |
| `/api/vercel/deploy` | POST | Create deployment (requires approval for production) |
| `/api/vercel/logs?id=X` | GET | Get deployment build logs |
| `/api/vercel/domains` | GET | List project domains |
| `/api/vercel/rollback` | POST | Promote previous deployment (requires approval) |
| `/api/verify` | POST | Verify a deployment URL |

## Production Deploy Approval

Per spec §87: Production deploys require explicit human approval. The flow:

1. User clicks "Deploy" in the Deployments view
2. Approval dialog appears with:
   - Action type (DEPLOY)
   - Risk level (HIGH for production)
   - Files affected
   - Impact areas
   - Expected result
3. User approves or cancels
4. Only after approval does the API call proceed
5. The approval is recorded in the audit log

## Deployment States

| State | Description |
|---|---|
| QUEUED | Deployment queued on Vercel |
| BUILDING | Build in progress |
| READY | Build complete, deployment live |
| ERROR | Build failed |
| CANCELED | Deployment cancelled |
| VERIFYING | Verification in progress |
| VERIFIED | Verification passed |
| ROLLBACK_PENDING | Rollback initiated |
| ROLLED_BACK | Rollback complete |

## Verification (Phase 11)

After a deployment reaches READY, the system verifies:

1. **HTTP status**: Main URL returns 2xx
2. **Page load**: Content-Type is text/html
3. **API health**: `/api/health` returns `{ status: "ok" }`
4. **Console errors**: No fetch failures
5. **404/500 counts**: No not-found or server errors
6. **Smoke test**: Overall pass/fail

Verification uses SSRF-safe fetch (Phase 17) with 15s timeout.

## Health Endpoint (§91)

`GET /api/health` returns:

```json
{
  "status": "ok",
  "version": "v4-prod-build",
  "environment": "development",
  "timestamp": "2026-09-29T...",
  "checks": {
    "database": "ok",
    "github": "ok",
    "ai": "ok",
    "vercel": "ok"
  },
  "requestId": "uuid"
}
```

**Never exposes secrets** — only configured/not-configured status.
