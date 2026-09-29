# Architecture

## Overview

AI Dev Control Center is a single-page Next.js 16 application that orchestrates the entire software development lifecycle: GitHub → AI Analysis → Security → CI/CD → Merge Gate → Vercel Deploy → Verification → Rollback → Audit.

## Technology Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript 5 (strict mode)
- **Styling**: Tailwind CSS 4 + shadcn/ui (New York style)
- **State**: Zustand (client) + TanStack Query patterns via custom `useFetch` hook
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Validation**: Zod (AI output schema + env validation)
- **Database**: Prisma ORM (SQLite in dev, Postgres in prod — optional)

## Directory Layout

```
src/
├── app/
│   ├── api/                    # Server-only API routes
│   │   ├── github/            # 8 GitHub routes (repos, pr, diff, etc.)
│   │   ├── ai/                # AI analysis route
│   │   ├── vercel/            # 5 Vercel routes (deployments, deploy, etc.)
│   │   ├── verify/            # Browser verification
│   │   ├── health/            # /api/health (Phase 11 §91)
│   │   ├── merge-gate/        # 6-gate evaluation (Phase 8)
│   │   ├── env-check/         # Environment checker (Phase 28)
│   │   ├── production-readiness/  # Readiness checklist (Phase 29)
│   │   └── approvals/         # Approval records (Phase 9)
│   ├── page.tsx               # Single-page app with view router
│   ├── layout.tsx
│   └── globals.css            # Cyberpunk glassmorphism theme
├── components/
│   ├── dashboard/             # Dashboard, Audit, Settings, Merge Gate, Production Readiness
│   ├── github/                # Repositories, PullRequests, Diff
│   ├── ai/                    # AI Console
│   ├── security/              # Security
│   ├── whiteboard/            # Whiteboard
│   ├── deployment/            # CI + Deployments
│   ├── layout/                # AppShell, CommandBar, ApprovalDialog
│   └── shared/                # GlassCard, badges, etc.
├── lib/
│   ├── github/                # GitHub client + mock data
│   ├── ai/                    # AI provider (OpenAI-compatible)
│   ├── analyzer/              # Diff parser + classifier + risk + impact + baseline
│   ├── security/              # Redaction + injection + web + SSRF
│   ├── vercel/                # Vercel client
│   ├── verification/          # Browser verification + health
│   ├── permissions/           # Permission matrix (server-side)
│   ├── audit/                 # Audit log
│   ├── env.ts                 # Server-side env config
│   ├── errors.ts              # StructuredError + retry + timeout
│   ├── merge-gate.ts          # 6-gate evaluation
│   └── approvals.ts           # Approval records
├── store/                     # Zustand global state
├── hooks/                     # useFetch
└── types/                     # Shared TypeScript types
```

## Data Flow

```
User Action
    ↓
Permission Check (server-side, Phase 7)
    ↓
API Route (server-only)
    ↓
Library (github/ai/vercel/security)
    ↓
External API (with timeout + retry + structured errors)
    ↓
Audit Log (every privileged action)
    ↓
Response to Client
```

## Security Boundaries

1. **Server-only secrets**: `GITHUB_TOKEN`, `AI_API_KEY`, `VERCEL_TOKEN` never reach the client. The `server-only` package enforces this at build time.
2. **No `NEXT_PUBLIC_*` for secrets**: Only `NEXT_PUBLIC_APP_URL` is exposed (non-secret).
3. **AI input sanitization**: All repository content is sanitized (secrets redacted + prompt injection neutralized) before reaching the AI.
4. **SSRF protection**: All URL fetches go through `safeFetch()` which validates protocol, blocks private IPs and metadata endpoints, and validates post-redirect URLs.
5. **Permission enforcement**: Every privileged action is checked server-side. Client claims are never trusted.
6. **Audit immutability**: Audit events are append-only and sanitized (no secrets stored).

## State Machines

- **Deployment**: QUEUED → BUILDING → READY/ERROR/CANCELED → VERIFYING → VERIFIED → ROLLBACK_PENDING → ROLLED_BACK
- **Agent Run**: IDLE → RUNNING → WAITING_APPROVAL → SUCCESS/FAILED/CANCELLED
- **Security**: NOT_SCANNED → SCANNING → PASS/WARNING/BLOCKED/ERROR
- **Merge Gate**: PENDING → PASS/FAIL/BLOCKED/SKIPPED per gate

## Mock/Fallback Policy

Per Phase 16: Mock/Fallback is allowed ONLY when credentials are missing or API unavailable. The system:

- Clearly labels mock vs. live data with `MOCK` / `FALLBACK` / `LIVE` badges
- Never executes privileged actions in mock mode (deploy/merge/rollback still require approval)
- Never pretends mock data is real
- Automatically switches to LIVE when credentials are configured
