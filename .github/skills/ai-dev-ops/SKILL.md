---
name: "ai-dev-ops"
description: "Use this skill when working on the AI Dev Control Center project. It covers GitHub integration, AI analysis, security review, deployment workflows, permission checks, and production readiness work for this Next.js app."
---

# AI Dev Control Center

This repository is a production-oriented AI software engineering control center for GitHub, AI analysis, security, CI/CD, deploy verification, and audit workflows.

## Core project context

- Stack: Next.js, TypeScript, React, Prisma, SQLite, Tailwind CSS, Bun
- App entry points live under `src/app` and `src/components`
- Server-side logic and integrations live under `src/lib`
- Real GitHub, AI, and Vercel behavior should prefer the existing API layer over ad hoc fetch logic
- Security-sensitive values must stay server-side only; never expose tokens in client code or `NEXT_PUBLIC_*` variables

## Architectural rules

- Prefer existing patterns in `src/lib`, `src/app/api`, and `src/components` before creating new abstractions
- Keep API routes server side and validate input before calling external systems
- Use typed data models and existing zod-based validation patterns when present
- Preserve the permission model: human approval is required for actions such as approve/merge/deploy/rollback
- Use mock/fallback behavior only when the real provider is unavailable, and clearly label it in the UI or API output

## App-specific conventions

- GitHub features belong in the GitHub workflow area: repos, PRs, diffs, checks, reviews, and workflows
- AI output and analyzer flows should remain structured and auditable, with risk and impact analysis included where relevant
- Security checks should include secret scanning, injection analysis, SSRF protections, and safe handling of headers/cookies/cors
- Deployment flows should align with the existing Vercel/verify patterns and keep verification evidence in the app state or logs
- Audit logging should capture meaningful action metadata, not just a success boolean

## Required implementation standards

- Favor minimal, surgical edits over broad rewrites
- Keep changes aligned with the current repository structure and naming patterns
- Add or update tests when the change affects behavior, validation, security, or API contracts
- Validate with the smallest relevant command, not broad suite runs unless the task truly requires it
- Maintain accessible, mobile-first UI patterns consistent with the current app shell and components

## Validation workflow

Before marking work complete:

1. Inspect whether the change affects API routes, server-side logic, or UI flows
2. Run the most relevant existing test or check for the affected behavior
3. Confirm no secrets or environment values were accidentally hard-coded
4. Verify the fix aligns with the project’s GitHub/AI/Vercel permission and audit expectations

## Typical tasks this skill applies to

- Fixing GitHub repo or PR API flows
- Adding or adjusting AI analysis logic
- Improving security or validation checks
- Updating deployment or rollback behavior
- Extending audit, permission, or merge gate logic
- Improving the dashboard, command bar, or core approval flows

## Quick operational guidance

- Use `bun install` for dependency setup when needed
- Use `bun run dev` for local workflows in this app
- Use the project’s server-side `.env` configuration and never leak secrets to browser code
- Treat production readiness, auditability, and approval gating as first-class requirements, not optional polish

## Safety checklist

- No secrets in logs, URLs, or client components
- No `NEXT_PUBLIC_*` environment variables for private credentials
- No unreviewed `fetch` calls to user-controlled URLs without validation
- No bypassing approval gates or security checks
- No broad changes without a clear reason tied to the task
