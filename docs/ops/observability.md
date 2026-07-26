# Observability — what Sentry captures, and what it must never capture

**Owner:** platform · **Task:** MS-1 (Wave 1509 · S4) · **Established:** 2026-07-20

VitalCV is healthcare-adjacent. Error telemetry is the one system that, by design,
copies arbitrary runtime state off our infrastructure to a third party. **The
redaction list below is the review artifact** — if you change it, this document is
the change record.

---

## 1. Where Sentry is initialised

| Process | File | DSN env var |
| --- | --- | --- |
| Web — browser | `apps/web/sentry.client.config.ts` | `NEXT_PUBLIC_SENTRY_DSN` |
| Web — server | `apps/web/sentry.server.config.ts` | `NEXT_PUBLIC_SENTRY_DSN` |
| Web — edge | `apps/web/sentry.edge.config.ts` | `NEXT_PUBLIC_SENTRY_DSN` |
| Backend API | `apps/api/backend/src/server.ts` (`bootstrapApp`) | `SENTRY_DSN` |

Every init is wrapped in `if (dsn)`. **No DSN → Sentry is completely inert**, which is
why preview and local builds stay silent, and why production is dark until the DSN is
set on Railway (see §6).

The web build additionally gates the Sentry webpack plugin: `apps/web/next.config.mjs`
only applies `withSentryConfig` when `NEXT_PUBLIC_SENTRY_DSN` is set.

---

## 2. The scrubber — one list, four processes

Implementation: **`packages/shared/observability/index.ts`**, exported as
`@vitalcv/shared/observability`.

`apps/web/lib/observability/sentryScrub.ts` is a thin re-export so the web keeps its
existing import path. **Add rules in the shared package, never in the web file** — the
whole point of the move is that web and API cannot drift apart.

It is installed as **both** `beforeSend` and `beforeSendTransaction` in all four
processes, always paired with `sendDefaultPii: false`.

### 2.1 Patterns redacted anywhere in free text

| Pattern | Why |
| --- | --- |
| `foo@bar.tld` | email |
| `123-45-6789` | SSN |
| bare 10-digit number | NPI. Deliberately over-broad — it also catches unix-second timestamps. Over-redaction is the safe failure. |
| `Bearer <token>` | session/API tokens |

### 2.2 Keys whose values are dropped entirely

`authorization` · `cookie` · `set-cookie` · `x-clerk-user-id` · `x-clerk-user-email` ·
`x-org-id` · `x-user-role` · `x-verifier-role` · `password` · `token` · `secret` ·
`apikey` · `api_key`

Matching is case-insensitive and recurses 6 levels into objects and arrays.

### 2.3 Event fields the scrubber rewrites

`user` (reduced to a bare `id`) · `request.headers` · `request.cookies` ·
`request.data` · `request.query_string` · **`request.url`** · **`transaction`** ·
`extra` · `tags` · `breadcrumbs` · `message` · `exception.values[].value`

> **`request.url` and `transaction` are load-bearing on the API.** This backend routes
> NPIs in the path — `/api/passport/1457128589` — so the URL and the Express
> transaction name carry PII *before any request body is considered*. A `beforeSend`
> that only scrubbed bodies and headers would still have shipped every looked-up NPI
> to Sentry. Covered by `apps/web/__tests__/sentry-scrub.test.ts`.

---

## 3. What IS captured

- Unhandled exceptions and 5xx handler errors from web (browser/server/edge) and API.
- Stack traces and source-mapped frames.
- Performance transactions at **10% sampling in production**, 100% outside it.
- Release tag = deploy commit SHA (§4), environment name, and non-sensitive request
  metadata (method, path shape, status, `user-agent`).
- A bare, opaque user id when one is present on the event.

## 4. Release tagging

`resolveSentryRelease()` reads, in order: `RAILWAY_GIT_COMMIT_SHA` → `GIT_SHA` →
`VERCEL_GIT_COMMIT_SHA`. `GIT_SHA` is the Dockerfile build-arg fallback (see
`apps/web/Dockerfile`).

If none is set it returns **`undefined`, not a placeholder**. An honest missing release
is better than a fake one that silently groups every deploy into a single bucket.

The browser bundle cannot read those (only `NEXT_PUBLIC_*` reaches the client), so
`sentry.client.config.ts` uses `NEXT_PUBLIC_APP_VERSION` → `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`.

## 5. What is NOT captured — and must not become captured

- **No Session Replay.** `replaysSessionSampleRate` and `replaysOnErrorSampleRate` are
  both `0`. Replay records the DOM, which on this product means clinician names, NPIs,
  and credential detail — and **the replay pipeline does not pass through `beforeSend`,
  so the scrubber above would not protect it.** Enabling replay requires a masking
  review first (`maskAllText`, `blockAllMedia`) and an update to this document.
- **No `sendDefaultPii`.** Explicitly `false` everywhere; never flip it to get better
  IP/cookie context.
- **No raw NPI, name, email, SSN, or auth token** in any field listed in §2.3.
- **No profile bodies or credential payloads** — these are only in `request.data`,
  which is scrubbed key-wise, so add any new sensitive key to §2.2 rather than relying
  on the free-text patterns.

## 6. Operational status

Code is complete. **Production is dark until the DSNs are set** — this is an owner
action, not a code change:

| Variable | Service | Status |
| --- | --- | --- |
| `NEXT_PUBLIC_SENTRY_DSN` | Railway `web` | **unset** |
| `SENTRY_DSN` | Railway `api` | **unset** |

Prod health currently reports `sentry: false` for exactly this reason (see
`docs/ops/m5-observability-status.md`). Setting both values turns telemetry on with the
scrubbing described above already in force.

## 7. Changing the redaction list

1. Edit `packages/shared/observability/index.ts`.
2. Add or extend a case in `apps/web/__tests__/sentry-scrub.test.ts`.
3. Update §2 of this document in the same commit.

A redaction change with no test and no doc update should not pass review.
