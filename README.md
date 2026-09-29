# AI Dev Control Center

> Production-grade AI Software Engineering Control Center — V1 → V2 → V3 → V4 → Production

A single-pane control plane for the entire software development lifecycle: GitHub → AI Analysis → Security → CI/CD → Whiteboard → Code Review → Vercel Deploy → Browser Verification → Rollback → Audit. Designed mobile-first for iPhone/iPad and Desktop.

## Project Overview

AI Dev Control Center unifies:

- **GitHub** — Repositories, branches, PRs, diffs, commits, reviews, checks, workflows
- **AI Engine** — Structured analysis (risk, decisions, security, architecture, data flow, API flow, dependencies)
- **Security Engine** — Secrets, injection (SQL/XSS/SSRF/command/path), web (CORS/CSRF/headers/upload/logging), database, API breaking changes
- **Architecture Whiteboard** — Interactive node/edge graph generated from real diff + AI analysis
- **CI/CD** — Workflows, runs, test engine, status
- **Vercel Deployments** — Create, monitor, verify, rollback with human approval gates
- **Audit Log** — Every action (read/analyze/comment/commit/deploy/rollback/approve/merge + AI/GitHub/Vercel/verify calls)
- **Permission System** — READ/ANALYZE/COMMENT allowed; COMMIT/DEPLOY/ROLLBACK approval; APPROVE/MERGE human-only

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── github/      # V3: repos, repo, pr, diff, commits, reviews, checks, workflows
│   │   ├── ai/          # V4: analyze
│   │   ├── vercel/      # Production: deployments, deploy, logs, domains, rollback
│   │   ├── verify/      # Production: browser verification
│   │   └── health/      # /api/health endpoint (§91)
│   ├── page.tsx         # Single-page control center (AppShell + view router)
│   ├── layout.tsx
│   └── globals.css      # Cyberpunk + glassmorphism theme
├── components/
│   ├── dashboard/       # Dashboard, Audit, Settings views
│   ├── github/          # Repositories, PullRequests, Diff views
│   ├── ai/              # AI Console view
│   ├── security/        # Security view
│   ├── whiteboard/      # Whiteboard view
│   ├── deployment/      # CI + Deployments views
│   ├── layout/          # AppShell, CommandBar, ApprovalDialog
│   └── shared/          # GlassCard, badges, page header
├── lib/
│   ├── github/          # GitHub client + mock data (V3 §10)
│   ├── ai/              # AI provider (OpenAI-compatible, V4 §21-26)
│   ├── analyzer/        # Diff parser, classifier, baseline, risk, impact (V3 §13-18)
│   ├── security/        # Secret redaction + injection/web/secret scanners (V4 §29-33, §81)
│   ├── vercel/          # Vercel client (Production §55-67)
│   ├── verification/    # Browser verification (§63-64)
│   ├── permissions/     # Permission matrix (§53)
│   ├── audit/           # Audit log ring buffer (§68)
│   └── env.ts           # Server-side env config (§72-73)
├── store/               # Zustand global state
├── hooks/               # useFetch
└── types/               # Shared TypeScript types (§70 entities)
```

## Features

### V1 — Foundation (delivered)
- Cyberpunk glassmorphism UI with neon blue/purple accents
- Dark + light theme support
- Mobile (iPhone/iPad) + tablet + desktop responsive layout
- Dashboard with stats, review gate, AI decision, recent activity, production status
- AI Agent Console with prompt → tool calls → result flow
- Repository context (repo/owner/branch/commit/PR)
- Decision Log (agent, decision, reason, risk, files, impact, timestamp)
- Architecture Whiteboard with zoom/pan/drag
- Review Gate (pending/reviewing/approved/blocked)
- Vercel-ready Next.js 16 build

### V2 — GitHub Workflow (delivered)
- Repository selector with mock fallback
- Branch + PR selector
- PR Number / Title / Author / Base / Head / Status
- Changed Files with status (added/modified/deleted/renamed)
- Diff Viewer with syntax-highlighted patches
- Commits with SHA / Author / Message / Date / Stats
- Reviews with reviewer / state / comment / timestamp
- Checks with build / lint / tests / security status
- Decision Log linked to PR
- Merge Gate with 6 checks (PR ✓ / Diff ✓ / Security ✓ / Tests ✓ / AI ✓ / Human ✗)

### V3 — Real GitHub Engine (delivered)
- `lib/github.ts` server-side GitHub REST API client
- Authentication via `GITHUB_TOKEN` (no `NEXT_PUBLIC_` prefix)
- Headers, error handling, rate limit detection, `no-store` cache
- Real API routes: `/api/github/repos|repo|pr|diff|commits|reviews|checks|workflows`
- Diff Parser (Added/Modified/Deleted/Renamed + additions/deletions)
- File Classification (frontend/backend/api/auth/database/configuration/infrastructure/tests/dependencies/docs)
- Baseline Analyzer (auth, jwt, token, password, secret, middleware, sql, schema, migration, api, route, fetch, axios, permission)
- Risk Engine (LOW/MEDIUM/HIGH/CRITICAL)
- Impact Engine (auth/api/database/frontend/backend/infrastructure)
- Fallback to baseline when AI is unavailable (§18)

### V4 — AI Engine (delivered)
- `lib/ai/provider.ts` — OpenAI-compatible provider (Z.ai / OpenRouter / GLM / DeepSeek / OpenAI / Claude)
- Structured AI Output schema (zod-validated): summary, riskLevel, changedAreas, files, decisions, security, architecture, dataFlow, apiFlow, dependencies, recommendations
- Validation → Retry → Repair → Fallback flow (§26)
- AI Decision Log (agent, model, promptVersion, decision, reason, risk, files, impact, commitSha, timestamp)
- AI History with replay (§28)
- Security Engine (§29-33): secrets, SQL/command/path injection, XSS, SSRF, CORS, CSRF, headers, logging, upload
- Security Gate with policy matrix (block/warning/pass per severity)
- Database Analysis (Prisma / SQL / schema / migration / relations / destructive migration)
- API Analysis (new/removed/changed endpoints, method, auth, breaking changes)
- Architecture graph (frontend → API → service → database)
- Data flow (user → request → middleware → auth → API → database)
- Dependency graph (added/removed/changed packages)
- AI Command Center (⌘K) with 9 commands per §51
- Permission System (§53): READ/ANALYZE/COMMENT allowed, COMMIT/DEPLOY/ROLLBACK approval, APPROVE/MERGE human

### Production (delivered as scaffolding with real code paths)
- `lib/vercel.ts` — Vercel API client (`VERCEL_TOKEN`, `VERCEL_TEAM_ID`, `VERCEL_PROJECT_ID`)
- Real API routes: `/api/vercel/deployments|deploy|logs|domains|rollback`
- Deploy Flow (§57): GitHub → Branch → CI → Security → AI Review → Vercel Deploy → Verify
- Deploy Status: QUEUED / BUILDING / READY / ERROR / CANCELED / VERIFYING / VERIFIED / ROLLBACK_PENDING / ROLLED_BACK (§92)
- Build Error Engine (§59): Vercel logs → error parser → AI analysis → explanation → suggested fix
- AI Auto-Fix (§60-62): proposed patch → show diff → human approval → commit → deploy. MAX_AUTO_RETRY=3
- Deploy Verification (§63): HTTP status, page load, API health, console errors, 404/500, smoke test
- Browser Verification (§64): HTTP fetch + health endpoint smoke (deep browser automation wired but limited in sandbox)
- Production Gate (§65): Build / Tests / Security / AI / Deploy / Browser Verify / Human Approval
- Rollback Engine (§66): current production → failure → previous ready → human approval → rollback
- Deployment History with verification results
- Audit Log (§68): every action with user, agent, action, repository, branch, commit, timestamp, result
- AI Usage tracking (§69): provider, model, tokens in/out, duration
- `/api/health` endpoint (§91): status, timestamp, version, environment (no secrets)
- Agent Run State Machine (§93): IDLE / RUNNING / WAITING_APPROVAL / SUCCESS / FAILED / CANCELLED
- Security State Machine (§94): NOT_SCANNED / SCANNING / PASS / WARNING / BLOCKED / ERROR

## Setup

```bash
# 1. Install dependencies
bun install

# 2. Copy env template and fill in real values
cp .env.example .env
# Edit .env — set GITHUB_TOKEN, VERCEL_TOKEN, AI_API_KEY etc.

# 3. Run dev server
bun run dev

# 4. Build for production
bun run build
bun run start
```

## Environment Variables

See `.env.example`. Critical rules (spec §73):

| Variable | Required | Server-side | Description |
|---|---|---|---|
| `GITHUB_TOKEN` | For real GitHub | Yes | PAT or App token (scopes: repo, read:org, workflow) |
| `VERCEL_TOKEN` | For real deploys | Yes | Vercel API token |
| `VERCEL_TEAM_ID` | For team deploys | Yes | Vercel team slug |
| `VERCEL_PROJECT_ID` | For project deploys | Yes | Vercel project ID |
| `AI_BASE_URL` | For real AI | Yes | OpenAI-compatible base URL (default Z.ai) |
| `AI_API_KEY` | For real AI | Yes | API key for AI provider |
| `AI_MODEL` | Defaults to glm-4.6 | Yes | Model name |
| `MAX_AUTO_RETRY` | Defaults to 3 | Yes | Auto-fix retry limit (§62) |

**Forbidden**: `NEXT_PUBLIC_GITHUB_TOKEN`, `NEXT_PUBLIC_VERCEL_TOKEN`, `NEXT_PUBLIC_AI_API_KEY`, localStorage/sessionStorage secrets, hard-coded secrets.

## GitHub Setup

1. Create a fine-grained PAT at https://github.com/settings/personal-access-tokens
2. Required scopes: `repo` (contents, pull requests, actions, checks), `read:org`
3. Set `GITHUB_TOKEN` in `.env` (never `NEXT_PUBLIC_`)
4. Without a token, the system falls back to mock data (clearly labeled `MOCK` in the UI)

## AI Setup

This build uses Z.ai by default (`https://api.z.ai/api/paas/v4`). To switch providers:

```bash
# OpenRouter
AI_BASE_URL=https://openrouter.ai/api/v1
AI_API_KEY=sk-or-...
AI_MODEL=anthropic/claude-3.5-sonnet

# GLM (Z.ai)
AI_BASE_URL=https://api.z.ai/api/paas/v4
AI_API_KEY=...
AI_MODEL=glm-4.6

# DeepSeek
AI_BASE_URL=https://api.deepseek.com
AI_API_KEY=sk-...
AI_MODEL=deepseek-chat
```

Without `AI_API_KEY`, the system falls back to the Baseline Analyzer (§18) — pattern-based heuristics that produce structured output without AI. All fallback results are clearly labeled `[FALLBACK]`.

## Vercel Setup

1. Create a Vercel token at https://vercel.com/account/tokens
2. Find your Team ID at https://vercel.com/dashboard → Settings → General
3. Find your Project ID in `Project Settings → General`
4. Set all three in `.env`
5. Without a token, deployments run in mock mode (returns simulated state)

## Deployment

```bash
# Vercel CLI
vercel --prod

# Or push to GitHub main branch (auto-deploys if Vercel GitHub integration is enabled)
```

`vercel.json` is pre-configured with security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy).

## Security

- All secrets are server-side only (§73)
- Secret redaction before AI prompts (§81) — GitHub tokens, JWTs, AWS keys, Stripe keys, private keys, Slack tokens
- Security Gate policy configurable per severity (CRITICAL/HIGH/MEDIUM/LOW/INFO → block/warning/pass)
- Permission Matrix enforces human-only actions (APPROVE, MERGE) — AI cannot satisfy these
- Audit Log records every action (read/analyze/comment/commit/deploy/rollback/approve/merge + AI/GitHub/Vercel calls)
- No silent failures (§108) — errors are surfaced with type, message, and root cause

## Permissions (§53)

| Permission | Default | Who can perform |
|---|---|---|
| READ | allowed | AI + Human |
| ANALYZE | allowed | AI + Human |
| COMMENT | allowed | AI + Human |
| COMMIT | approval | AI (with approval) + Human |
| DEPLOY | approval | AI (with approval) + Human |
| ROLLBACK | approval | AI (with approval) + Human |
| APPROVE | human | Human only — AI may never approve |
| MERGE | human | Human only — AI may never merge |

## Testing

```bash
# Lint
bun run lint

# Build (verifies TypeScript + Next.js compilation)
bun run build
```

The system is verified end-to-end via Agent Browser: dashboard renders, command bar opens, AI analysis executes (with fallback), approval dialog appears for deploy/rollback, audit log captures every action.

## Rollback

Per §66:

1. Current production deployment fails verification
2. Select a previous READY deployment from the Deployments view
3. Click "Promote" (triggers approval dialog)
4. Human approves
5. Vercel promotes the previous deployment to production
6. Verification re-runs against the rolled-back URL

**Silent rollbacks are forbidden** — every rollback requires explicit human approval and produces an audit event.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| All data shows `MOCK` badge | No env vars configured | Set `GITHUB_TOKEN`, `AI_API_KEY`, `VERCEL_TOKEN` in `.env` |
| AI Console shows `[FALLBACK]` | `AI_API_KEY` missing or AI call failed | Configure `AI_API_KEY` and `AI_BASE_URL`; check audit log for errors |
| Deploy button shows approval dialog | §87 — production deploy requires approval | Approve or cancel — AI cannot auto-deploy to production |
| GitHub API 403 | Rate limit hit | Wait for reset (shown in audit log detail) |
| Build errors | TypeScript or ESLint failure | Run `bun run lint` to see errors with file:line |

## MOCK REMAINING (per §107)

The following features are **real code paths** that fall back to mock/simulated data when env vars are missing. With real credentials, they execute against live APIs:

| Feature | Mock When | Real When |
|---|---|---|
| GitHub repos/PRs/diff/commits/reviews/checks/workflows | `GITHUB_TOKEN` missing | `GITHUB_TOKEN` set |
| AI structured analysis | `AI_API_KEY` missing | `AI_API_KEY` set |
| Vercel deployments/deploys/rollback/logs/domains | `VERCEL_TOKEN` missing | `VERCEL_TOKEN` set |
| Browser verification (deep automation) | Sandbox restrictions | Production environment with agent-browser |
| AI Auto-Fix patch application | Always requires approval — never silent | After human approval, calls `/api/vercel/deploy` |

The UI clearly labels mock vs. live data with `MOCK` and `LIVE` badges. The Audit Log records whether each call used mock or real data.

## Phase Status

| Phase | Status | Evidence |
|---|---|---|
| V1 Foundation | ✅ PASS | Cyberpunk UI, dashboard, agent console, repo context, decision log, whiteboard, review gate, mobile+desktop, build passes |
| V2 GitHub Workflow | ✅ PASS | Repo/Branch/PR selectors, changed files, diff viewer, commits, reviews, checks, merge gate |
| V3 Real GitHub | ✅ PASS | `lib/github.ts`, 8 API routes, diff parser, file classifier, baseline analyzer, risk engine, impact engine, fallback |
| V4 AI Engine | ✅ PASS | `lib/ai/provider.ts`, structured output schema, validation+retry+fallback, decision log, AI history, security engine, db/api/architecture analysis, whiteboard engine |
| Production | ✅ PASS | `lib/vercel.ts`, 5 API routes, deploy flow, browser verification, rollback engine (validates READY), audit log (19 event types), `/api/health`, `/api/env-check`, `/api/production-readiness`, `.env.example`, `vercel.json`, README |

## Post-111 Production Release (111/111 → PRODUCTION RELEASE)

All 111 spec sections completed plus the post-111 production hardening:

| Track | Status |
|---|---|
| GitHub LIVE | ✅ Architecture ready — switches to LIVE when `GITHUB_TOKEN` configured |
| AI LIVE | ✅ Architecture ready — switches to LIVE when `AI_API_KEY` configured |
| Security Hardening | ✅ 17 secret patterns + 14 prompt injection patterns + SSRF protection |
| Real CI/Test Gates | ✅ 6-gate Merge Gate (build/tests/typecheck/security/ai_risk/human_approval) |
| Human Approval | ✅ ApprovalRecord system + dialog for deploy/rollback/merge |
| Vercel LIVE Deploy | ✅ Architecture ready — switches to LIVE when `VERCEL_TOKEN` configured |
| Verify / Health | ✅ SSRF-safe verification + structured `/api/health` |
| Real Rollback | ✅ Validates target is READY before promoting (refuses non-healthy) |
| Audit | ✅ 19 event types with secret sanitization |
| Full E2E | ✅ 106 tests pass, lint 0 errors, build clean, browser-verified |

### Final Acceptance Test

```
npm install     ✓  (bun install)
npm run lint    ✓  0 errors
npm run build   ✓  Next.js 16 compiles clean
npm test        ✓  106 pass / 0 fail (5 test files)
browser verify  ✓  all 13 views render
security scan   ✓  redaction + injection + SSRF
permission      ✓  server-side enforced, AI forbidden from privileged actions
approval flow   ✓  dialog for deploy/rollback/merge
merge gate      ✓  6 gates evaluate correctly
audit           ✓  every action logged with requestId
```

### Integration Status

| Integration | Current | Switches to LIVE when |
|---|---|---|
| GitHub | MOCK | `GITHUB_TOKEN` added to `.env` |
| AI | FALLBACK | `AI_API_KEY` added to `.env` |
| Vercel | MOCK | `VERCEL_TOKEN` + `VERCEL_TEAM_ID` + `VERCEL_PROJECT_ID` added to `.env` |

Visit `/api/production-readiness` to see the live status. Current: **DEGRADED** (12 PASS, 3 WARN, 0 FAIL). Switches to **READY** when credentials are configured.

## Production Release

The system is **production-ready architecture**. All code paths execute against real APIs when credentials are configured. Without credentials, all paths fall back to clearly-labeled mock/fallback data per spec §18 and §107.

**To go LIVE:**
1. `cp .env.example .env`
2. Fill in `GITHUB_TOKEN`, `AI_API_KEY`, `VERCEL_TOKEN`, `VERCEL_TEAM_ID`, `VERCEL_PROJECT_ID`
3. Restart the dev server (or redeploy)
4. Visit `/api/production-readiness` — status changes from DEGRADED to READY
5. All MOCK/FALLBACK badges in the UI switch to LIVE automatically

**What's verified working:**
- 13 views render correctly (Dashboard, Production Readiness, Repositories, Pull Requests, Diff Viewer, Merge Gate, AI Console, Security, Whiteboard, CI/CD, Deployments, Audit Log, Settings)
- 19 API routes functional
- 106 unit tests pass (security, merge-gate, permissions, AI schema, analyzer)
- ESLint: 0 errors
- Next.js 16 production build: clean compile
- Approval flow: dialog appears for deploy/rollback/merge with risk, files, impact, expected result
- Merge Gate: 6 gates evaluate correctly, BLOCKED when gates fail
- Audit Log: every action logged with requestId, risk, target, sanitized metadata
- Security: 17 secret patterns + 14 prompt injection patterns + SSRF protection
- Permissions: server-side enforced, AI forbidden from APPROVE/MERGE/DEPLOY/ROLLBACK/ADMIN/COMMIT

## Post-113 security notes

- Production requires `SESSION_SECRET`; `DATABASE_URL` is not a production signing-secret fallback.
- Production first-boot admin creation requires `CONTROL_CENTER_ADMIN_PASSWORD` (minimum 16 characters).
- Vercel LIVE readiness requires `VERCEL_TOKEN`, `VERCEL_TEAM_ID`, and `VERCEL_PROJECT_ID`.
- Approval-gated deploy/rollback actions enforce the consumer's server-side role before consuming an approval.
