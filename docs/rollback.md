# Rollback

## Rollback Policy (Phase 12)

When a production deployment fails verification:

```
Detect failure
    ↓
Mark deployment as ERROR
    ↓
Find previous healthy (READY) deployment
    ↓
Require authorized operator approval (Phase 9)
    ↓
Rollback (promote previous deployment)
    ↓
Verify rollback
    ↓
Audit
```

## What Can Be Rolled Back

- **Only READY deployments** — the system refuses to rollback to a deployment that is not healthy (per spec §12)
- The `findRollbackTarget()` function searches the 20 most recent deployments and returns the first READY one (excluding the current failed deployment)

## Rollback Flow

1. Production deployment fails verification
2. Operator opens the Deployments view
3. Operator clicks "Promote" on a previous READY deployment
4. Approval dialog appears with:
   - Current deployment (failed)
   - Rollback target (READY deployment)
   - Commit SHA and message
   - Reason for rollback
   - Risk level
5. Operator approves
6. API call to `/api/vercel/rollback` with `approved: true`
7. Vercel promotes the previous deployment
8. Verification re-runs against the rolled-back URL
9. Audit event records the rollback

## API

```http
POST /api/vercel/rollback
Content-Type: application/json

{
  "id": "dpl_abc123",
  "approved": true
}
```

**Per spec §88**: Rollback requires explicit approval. The API returns 403 if `approved` is not `true`.

## Audit Events

Rollback produces these audit events:

1. `ROLLBACK` — approval requested
2. `ROLLBACK_SUCCESS` or `ROLLBACK_FAILED` — after Vercel API response
3. `VERIFY` — verification of rolled-back deployment

## What Is Never Allowed

- **Silent rollback** — every rollback requires explicit human approval (spec §66)
- **Rollback to non-healthy deployment** — the system validates the target is READY before promoting (spec §12)
- **AI-initiated rollback** — AI cannot rollback; it can only recommend (spec §9)
- **Rollback without audit** — every rollback attempt is recorded

## Verification After Rollback

After the Vercel promote API returns, the system:

1. Waits for the promoted deployment to reach READY
2. Runs the same verification pipeline as a new deploy
3. Records the verification result in the audit log
4. Updates the deployment state to VERIFIED or ERROR

If verification fails after rollback, the operator is alerted — there is no automatic rollback of the rollback.
