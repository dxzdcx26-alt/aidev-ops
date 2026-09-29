# AI Engine

## Setup

The AI provider is OpenAI-compatible — works with Z.ai (default), OpenRouter, GLM, DeepSeek, OpenAI, and Claude-compatible endpoints.

### Z.ai (default)

```env
AI_BASE_URL=https://api.z.ai/api/paas/v4
AI_API_KEY=your-zai-api-key
AI_MODEL=glm-4.6
```

### OpenRouter

```env
AI_BASE_URL=https://openrouter.ai/api/v1
AI_API_KEY=sk-or-...
AI_MODEL=anthropic/claude-3.5-sonnet
```

### DeepSeek

```env
AI_BASE_URL=https://api.deepseek.com
AI_API_KEY=sk-...
AI_MODEL=deepseek-chat
```

### OpenAI

```env
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=sk-...
AI_MODEL=gpt-4o
```

## Architecture

```
User triggers analysis
    ↓
Build sanitized prompt (Phase 5+6)
    ├─ Redact secrets from PR context, diff summary, patches
    └─ Detect & neutralize prompt injection
    ↓
Call AI provider (with 60s timeout)
    ↓
Parse JSON response (strip markdown fences)
    ↓
Zod validate against AIResultSchema
    ↓
If invalid → retry with repair instructions (max 2 attempts)
    ↓
If still invalid → fallback to baseline analyzer
    ↓
Return structured AIAnalysisResult
```

## Structured Output Schema

The AI must return a JSON object matching this schema (validated with Zod):

```typescript
{
  summary: string,              // >= 10 chars
  riskLevel: "LOW"|"MEDIUM"|"HIGH"|"CRITICAL",
  confidence: number,           // 0..1
  changedAreas: string[],
  files: [{ filename, category, risk, note }],
  decisions: [{ decision, reason, risk, files, impact, recommendation? }],
  security: [{ file, line, severity, evidence, reason, recommendation, category }],
  architecture: { nodes: [...], edges: [...] },
  dataFlow: [{ step, from, to, description }],
  apiFlow: [{ method, path, auth, change }],
  apiImpact: { breaking: boolean, endpoints: string[], summary: string },
  dependencies: [{ name, version, change }],
  dependencyImpact: { added, removed, risk, notes },
  recommendations: string[],
  blockers: string[],           // hard blockers preventing merge
  tests: [{ area, recommended, reason }],
  deploymentRisk: { level, reasons, canaryRecommended }
}
```

## Validation Flow (Phase 4 §26)

1. **Attempt 1**: Send prompt, parse JSON, validate schema
2. **If invalid**: Send repair instructions with validation errors, retry
3. **If still invalid**: Fall back to baseline analyzer
4. **Baseline analyzer**: Pattern-based heuristics that produce a valid (but less semantic) result

The fallback is always clearly labeled with `[FALLBACK]` prefix in the summary and `fallback: true` in the metadata.

## AI Authority Limits (Phase 4)

The AI is an **analysis layer only**. It has NO privileged authority:

| Action | AI Allowed? |
|---|---|
| Read PR/diff/files | ✓ |
| Analyze risk | ✓ |
| Detect security issues | ✓ |
| Recommend changes | ✓ |
| Suggest architecture | ✓ |
| Approve merge | ✗ (HUMAN-ONLY) |
| Merge PR | ✗ (HUMAN-ONLY) |
| Deploy | ✗ (requires approval) |
| Rollback | ✗ (requires approval) |
| Execute shell commands | ✗ (never) |
| Override security policy | ✗ (never) |

## Cost Tracking

Every AI call records:

- Provider
- Model
- Prompt version
- Input tokens
- Output tokens
- Duration (ms)
- Whether fallback was used
- Number of secrets redacted
- Whether prompt injection was detected

This data is visible in the AI Console footer and recorded in the audit log.

## Prompt Versioning

Current prompt version: `ai-dev-control-center-v2`

The prompt version is stored with every analysis result. When the prompt changes, the version is incremented, allowing comparison of results across prompt versions.
