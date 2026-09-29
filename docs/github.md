# GitHub Integration

## Setup

1. Create a fine-grained PAT at https://github.com/settings/personal-access-tokens
2. Required scopes:
   - **Repository**: Contents (read), Pull requests (read), Actions (read), Checks (read)
   - **Organization**: Members (read) — if accessing org repos
3. Set in `.env`:
   ```
   GITHUB_TOKEN=github_pat_xxx...
   ```
4. Never use `NEXT_PUBLIC_GITHUB_TOKEN` — server-side only

## API Routes

| Route | Method | Description |
|---|---|---|
| `/api/github/repos` | GET | List repositories |
| `/api/github/repo?owner=X&repo=Y` | GET | Get repository + branches |
| `/api/github/pr?owner=X&repo=Y[&pr=N]` | GET | List PRs or get single PR |
| `/api/github/diff?owner=X&repo=Y&pr=N` | GET | Get diff files + analysis |
| `/api/github/commits?owner=X&repo=Y&pr=N` | GET | List PR commits |
| `/api/github/reviews?owner=X&repo=Y&pr=N` | GET | List PR reviews |
| `/api/github/checks?owner=X&repo=Y&ref=SHA` | GET | List check runs for ref |
| `/api/github/workflows?owner=X&repo=Y[&branch=B]` | GET | List workflows + recent runs |

## Error Handling (Phase 2)

All errors return a structured response:

```json
{
  "error": "GitHub token is invalid or expired",
  "code": "GITHUB_UNAUTHORIZED",
  "status": 401,
  "retryable": false,
  "provider": "github",
  "requestId": "uuid"
}
```

### Error codes

| Code | Status | Retryable | Description |
|---|---|---|---|
| GITHUB_UNAUTHORIZED | 401 | no | Invalid/expired token |
| GITHUB_FORBIDDEN | 403 | no | Token lacks scope |
| GITHUB_RATE_LIMIT | 403/429 | yes (GET only) | Rate limit hit — backoff and retry |
| GITHUB_NOT_FOUND | 404 | no | Resource doesn't exist |
| GITHUB_CONFLICT | 409 | no | State mismatch (never retried) |
| GITHUB_VALIDATION | 422 | no | Invalid request body |
| GITHUB_SERVER_ERROR | 5xx | yes (GET only) | GitHub is down |
| GITHUB_NETWORK | 0 | yes | Network error |
| GITHUB_TIMEOUT | 0 | yes | 15s timeout exceeded |

## Retry Policy

- **GET operations**: retried up to 3 times with exponential backoff (500ms base, 5s max, jitter)
- **Mutations (POST/PATCH/PUT/DELETE)**: NEVER retried — risk of duplicate operations
- Only `retryable: true` errors are retried

## Timeout

All GitHub API calls have a 15-second timeout.

## Mock Fallback

When `GITHUB_TOKEN` is missing, the system uses mock data (clearly labeled with `MOCK` badge in UI). The mock data includes:

- 3 repositories
- 4 branches
- 3 pull requests (PR #42 with 8 files, #41 with 4 files, #40 draft)
- 8 diff files with realistic patches
- 4 commits
- 3 reviews
- 5 check runs
- 3 workflows + 2 runs

This allows the UI to be fully functional for development and demos without real credentials.
