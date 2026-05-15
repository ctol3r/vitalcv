# Degraded Runtime Behavior Audit

**B20-CODE-03 deliverable.** Audits how `apps/web` behaves when each
upstream dependency or env var is unavailable. Verifies the UI/API
remains calm and truthful rather than panicking or making false
guarantees.

This audit is code-level. Live verification requires probing the
canonical deployment once production is no longer paused (see
`pause-root-cause-report.md`).

## §1 — Failure-mode behavior matrix

For each potential degraded state, the audit records:

- **Surface affected** — where users / verifiers feel it
- **Code-level behavior** — what the code does on this failure path
- **User-visible outcome** — what the user sees
- **Truth verdict** — calm/honest or panic/misleading

| Failure | Surface affected | Code-level behavior | User-visible outcome | Verdict |
|---|---|---|---|---|
| Clerk env unset | All authenticated routes | `middleware.ts:126-140` enters non-Clerk fallback; public routes pass through, protected routes redirect to `/sign-in` | "Sign in" flow loads but Clerk widget can't initialize (no publishable key) — user sees a broken-feeling sign-in | DEGRADED — UI does not panic, but the redirect-loop is confusing. `/api/health` reports `clerk.enabled: false` honestly. |
| `RECEIPT_PRIVATE_KEY_JWK` unset (production) | JWKS, DID, signed-receipt routes | `getOrInitKeypair()` throws; `force-dynamic` routes (jwks/did) return 500 | Verifier hitting JWKS sees 500 (no JSON body or stack trace exposed) | CALM — explicit refusal to publish a key; better than emitting dev kid |
| `RECEIPT_KID` unset (production) | Same | Same throw | Same 500 | CALM |
| `DATABASE_URL` unset (backend) | All routes touching Prisma | `config/env.ts:loadEnv` throws at backend boot; backend never starts | Web proxies to backend return upstream timeout / 503 | EXPLICIT — backend doesn't half-start; web routes report the disconnection |
| Railway DB unreachable mid-runtime | Same | Prisma client throws on query; per-route try/catch returns 500 or graceful fallback | Most routes return 500; replay readers return `replay_infrastructure_unavailable` (503, stable code) per PR-α/β/γ guards | CALM — `replay_infrastructure_unavailable` is a stable diagnostic code |
| Replay tables missing (P2021) | Replay readers | All `/api/replay/*` routes detect P2021 and return 503 `replay_infrastructure_unavailable` per `routes/replay.ts:isPrismaTableMissingError` | Caller sees a stable error code; web proxy returns 503 + JSON body | CALM — by design |
| `/api/ingest/[npi]` upstream failure | Homepage NPI submit flow | Route returns HTTP 200 with `{fallback: true, runId: null, ...}` per `routes/ingest.ts:35-97` | Client (`startPublicIngest`) does NOT currently branch on `fallback: true` → throws an error | **DEFECT** — homepage NPI submit fails cryptically when backend is down. Known issue per `upstream-fetch-topology.md` §A.X + `gating-graph.md` §4 |
| Probe runner unscheduled | LaneHealthMount band on `/passport`, `/passport/[id]` | `getLaneSnapshots` returns UNKNOWN seeds; UI renders "Unavailable" lane status | User sees "Unavailable" lanes on the passport, conflicting with in-stream `SourceRow` lane status | DEGRADED — visible defect; "Unavailable" label collision is a UX confusion. Cron-side fix per `production-env-requirements.md` §2 |
| Sentry DSN unset | Error tracking | Sentry frontend init is a no-op | Errors not captured | DEGRADED — invisible to operator; `/api/health` reports `sentry: false` honestly |
| Edge cache stale | All cacheable routes | Cached response served until TTL expires | User sees old content for up to cache TTL | CALM — Vercel's default Cache-Control headers are sensible; signing routes are `force-dynamic` so they never cache |
| Resolve-role fetch hangs (middleware) | First-time-user sign-in path | `middleware.ts:69` now has `AbortSignal.timeout(8000)` (PR #360); on timeout falls through to `/auth/error` redirect | After 8s, user redirected to error page rather than indefinite hang | CALM — bounded timeout; explicit error page |
| Vercel deployment paused (HTTP 402) | Entire apex | Vercel intercepts at the edge; no app code runs | User sees Vercel's "deployment temporarily paused" page | BLOCKING — but explicit and operator-actionable (per `pause-root-cause-report.md`) |
| Apex serving wrong project | `/api/health` may return unexpected `service` value | Routes from the wrong project execute | Subtle data divergence (e.g., signing kid not matching expected); confusing | RISK — easy to miss; mitigated by smoke test in `scripts/verify-production-runtime.sh` |

## §2 — Specific UI calmness checks

### Homepage NPI submission

When `/api/ingest/[npi]` returns the masked-200 fallback:

| Current behavior | Verdict |
|---|---|
| Client throws because it doesn't branch on `fallback: true` | DEFECT — see §1 row "Ingest upstream failure" |
| User sees a cryptic error in console | NEEDS FIX — should display a calm "Sources unavailable" state |

**Recommended fix** (out of scope for this audit; tracked separately): `apps/web/lib/api.ts` `startPublicIngest` should check `fallback: true` and produce a clean degraded-state UI rather than throwing.

### `/passport` lane statuses

Two parallel channels render lane status:

1. **In-stream `SourceRow`** — driven by SSE; shows real per-source progression (`Checking…`, `Checked`, `Unavailable` on SSE error).
2. **`LaneHealthMount` band** — driven by `getLaneSnapshots` from a memory-keyed store, populated by the probe runner.

Both channels use the literal word "Unavailable" for different states. When the probe runner is unscheduled (current production state), the band reads "Unavailable" while the SourceRow may say "Checked" — visible inconsistency.

| Outcome | Verdict |
|---|---|
| UI does NOT crash | CALM ✓ |
| Two simultaneous "Unavailable" indicators with different causes | LABEL COLLISION — confusing |
| Underlying degraded-state policy in `degradedStateFoundation.ts` is foundation-honest | TRUTHFUL ✓ |

**Recommendation**: rename one of the two channels (e.g., LaneHealthMount band could say "Probe pending" instead of "Unavailable" when seeds are UNKNOWN). One-line copy change; out of scope for this audit.

### Authenticated route gate when Clerk unavailable

When `CLERK_SECRET_KEY` is unset, `middleware.ts:35` sets `CLERK_MIDDLEWARE_ENABLED = false`. The fallback at lines 126-140:

```ts
if (!CLERK_MIDDLEWARE_ENABLED) {
  if (isPublicRoute(req.nextUrl.pathname)) {
    return NextResponse.next();
  }
  const requiredRole = getRequiredRole(req.nextUrl.pathname);
  if (!requiredRole) {
    return NextResponse.next();
  }
  const signInUrl = req.nextUrl.clone();
  signInUrl.pathname = '/sign-in';
  signInUrl.searchParams.set('redirect_url', req.nextUrl.pathname);
  return NextResponse.redirect(signInUrl);
}
```

- Public routes pass through (calm).
- Protected routes redirect to `/sign-in` with `redirect_url` set (calm).
- `/sign-in` page loads but the Clerk widget can't initialize without `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.

| Outcome | Verdict |
|---|---|
| No middleware crash | CALM ✓ |
| Public routes survive | CALM ✓ |
| Protected routes degrade to a non-functional sign-in flow | DEGRADED but EXPLICIT |

**Recommendation**: when Clerk env is missing, the `/sign-in` page should display a "Sign-in temporarily unavailable" message rather than loading the Clerk widget into a broken state. Out of scope for this audit; tracked.

## §3 — Replay readers under failure

The PR-α/β/γ readers are designed to fail-gracefully:

| Failure | Behavior |
|---|---|
| Migration not applied | Detect P2021 → 503 `replay_infrastructure_unavailable` |
| Entity not found for NPI | Return 200 with `{ entityId: null, runs: [] }` (chronology absence is not an error) |
| Run not found by runId | Return 404 with `{ error: 'replay_run_not_found', runId }` |
| Malformed input | 400 with explicit `expected` field |
| Backend unreachable | Web proxy returns 503 with stable error code |

All paths produce JSON; no HTML stack traces leak.

## §4 — Truth-contract verification under degradation

When the UI degrades, does it ever emit a banned phrase or make a
false guarantee?

| Surface | Foundation-honest copy on origin/main? |
|---|---|
| Homepage | "Stop Starting Over. Start Ready." — promise-honest |
| `/onboarding` | Disclaims completing the credentialing process |
| `/pricing` | "Pricing is a foundation preview. Payments are not collected in this build." |
| `/docs` | "Docs are a launch-readiness foundation, not complete API documentation." |
| `/status` | "Status surfaces are foundation previews. No uptime guarantee is implied." |
| `/passport` | Per-source labels (`Checked`, `Source-backed`, `Access required`, `No profile yet`) — none claim more than the source actually provides |
| `/api/health` | Reports config booleans honestly |
| `/api/status` | Returns `degraded` with `signing_key_id: null` when signing throws — explicit |

No surface emits a banned phrase under degradation. The truth-contract
holds across the audited failure modes.

## §5 — Summary

**Code-level verdict**: VitalCV degrades calmly across the audited
failure modes, with two known UI defects that should be tracked:

1. **`/api/ingest/[npi]` masked-200 fallback** — client throws instead of rendering a clean degraded state. Small client-side PR fixes this.
2. **`LaneHealthMount` "Unavailable" label collision** — same word used for two different states; one-line copy change.

Both are out of scope for this audit per the user's directive ("no
new architecture, no UI redesign"). They are tracked for a future
hygiene PR.

**Truth-contract verdict**: no surface emits a false guarantee under
any audited failure mode. The "foundation preview" framing across
public surfaces holds; the runtime continuity reporter at
`/api/status` honestly reports `degraded` rather than green-washing.

The remaining "panic" surface is the Vercel-level HTTP 402 paused
state, which intercepts before any application code runs and is
operator-actionable per `pause-root-cause-report.md`.
