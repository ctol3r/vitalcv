# VitalCV Architecture Audit — 2026-04-13

> Scope: Auth boundaries, NPI state hydration, Prisma/API efficiency
> Auditor: Claude Cowork (Opus)

---

## 1. Auth Boundaries

### CRITICAL — Readiness endpoints have NO authentication

**File:** `apps/api/backend/src/routes/readiness.ts`

| Route | Auth | PII Exposed |
|---|---|---|
| `GET /api/readiness/:npi/clear-to-start` | **NONE** | `clearToStart` boolean, `daysEstimate`, full `report` object including verification artifacts |
| `GET /api/readiness/:npi/report` | **NONE** | Complete readiness report with credential verification status |

Any anonymous caller can query any NPI and retrieve professional readiness status and endorsement timelines. The `orchestrateVerification()` return value is passed directly to the response with no redaction.

### HIGH — Passport endpoints are public by design (verify intent)

**File:** `apps/api/backend/src/routes/passport.ts`

| Route | Auth | Notes |
|---|---|---|
| `GET /api/passport/:npi` | NONE | Returns name, specialty, state, trustBand, readinessScore, sanctions.status, privileges, filtered credentials |
| `GET /api/passport/:npi/disclose` | NONE | Selective disclosure — caller picks claim classes |
| `GET /api/passport/:npi/trust` | Rate-limited only | Trust state data |
| `GET /api/passport/:npi/embed.svg` | NONE | Embeddable badge |
| `GET /api/passport/:npi/card.json` | NONE | Structured card data |
| `GET /api/passport/:npi/export` | NONE | Full export |

**Wallet mode weakness (line ~525):** `mode=wallet&token=<npi>` grants elevated access (unredacted org names, private credentials, full sanctions detail). The "token" is just the NPI itself — not a secret. Any caller who knows the NPI can access wallet-mode data.

### OK — Employer review routes are properly protected

**File:** `apps/api/backend/src/routes/employerActions.ts`

All routes enforce Clerk auth via `requireClerkUserId()` (checks `x-clerk-user-id` header). POST accept, request-refresh, route-to-review, and GET status/acceptance-history are all gated.

### No global auth middleware

Authentication is per-route, not app-level. No Express-level `app.use(authMiddleware)` found.

**Recommendations:**
1. **P0:** Add auth to `/api/readiness/:npi/*` immediately.
2. **P0:** Replace wallet-mode `token=npi` with a real bearer token or Clerk session.
3. **P1:** Document the business justification for public passport endpoints, or gate them behind at least a rate-limited API key.

---

## 2. NPI State Hydration

### Clinician self-service path (Marketing → Passport)

```
NpiLookupInput.tsx → router.push(`/readiness?npi=${npi}`)
  → readiness/page.tsx → redirect('/passport') (preserves query params)
    → passport/page.tsx → useSearchParams().get('npi')
      → Luhn checksum validation (ISO/IEC 7812, 80840 prefix)
      → sessionStorage preview (TTL 5 min, key: vitalcv:preview:${npi})
      → useIngestStream() kicks off credential verification
```

**State carrier:** URL query parameter throughout. Survives navigation. No context providers needed.

### Employer review path (Request → Review)

```
RequestReviewPanel.tsx → POST /api/request-review { npi }
  → API returns { contextId, entityId, reviewUrl }
    → /review/[entityId]?contextId=...
      → ReviewPageClient.tsx
        → /^\d{10}$/.test(entityId)
            ? fetch(`/api/passport/npi/${entityId}`)
            : fetch(`/api/passport/entity/${entityId}`)
```

**State carrier:** Route segment (`[entityId]`) + optional query params. Server-fetched. No client state dependency.

### Onboarding routes

All `/onboarding/*` pages (`identity`, `readiness`, `fetching`) are bare `redirect('/passport')` calls with no NPI extraction. They are scaffolding stubs — no state processing occurs.

### State loss risks

| Scenario | Risk | Severity |
|---|---|---|
| Direct navigation to `/passport` without `?npi=` | Empty state rendered (graceful, not broken) | Low |
| SessionStorage preview expires (5 min TTL) | Preview data lost; user must re-enter NPI | Low (intentional) |
| Page refresh during ingest stream | Stream interrupted; re-initiates on next load from server state | Low |
| Missing `contextId` in review URL | View event attribution incomplete; passport still renders | Low |
| Marketing app NPI input → dead `/clinician` route | **State lost entirely — user hits 404** | **P0 (known)** |

### Verdict

The web app's NPI hydration chain is sound. URL params carry state; server fetches are independent of client state. The only real break is the marketing-app-to-web-app seam (already flagged as P0 in CLAUDE.md).

---

## 3. Database & API Efficiency

### External API caching — well-implemented

| Source | Cache Type | TTL | Refresh Strategy |
|---|---|---|---|
| **NPPES** | In-memory Map | 1 hour | Cache-first; miss triggers `executeWithRetry()` (3 retries, exponential backoff up to 8s) |
| **OIG/LEIE** | In-memory bulk CSV index | 24 hours | Non-blocking async refresh — stale data returned while CSV re-downloads in background |
| **PECOS** | Not fully examined | Quarterly snapshot | Source-backed; not real-time by design |

NPPES cache logs `nppes_cache_hit` events for monitoring. LEIE uses fuzzy matching with weighted confidence scores (0.58–0.9).

### Prisma query patterns — no N+1 detected in primary paths

**`loadPassportData()` in `passport.ts` (lines 726–800):**
7 parallel queries via `Promise.all`:
1. `provider.findFirst` (identity)
2. `verificationArtifact.findMany` (credentials)
3. `getCachedTrustState()` (trust state with fallback compute)
4. `decisionCapsule.findMany` (decisions, `take: 30`)
5. `verificationArtifact.findFirst` (OIG/LEIE latest)
6. `claimRecord.findFirst` (NPPES identity claim)
7. `claimRecord.findMany` (active claims)

All batched. No sequential loops.

**`buildPassport()` in `passportService.ts` (lines 1655–1800):**
- Initial `vcvCredential.findMany` with `include: { issuer: { select: ... } }` — eager loaded.
- Artifact/receipt IDs collected, then fetched via `findMany({ where: { id: { in: ids } } })` — batched IN clause.
- For-loops iterate over pre-fetched collections only. No queries inside loops.
- Education records loaded with `include: { institution: true }`.

**`buildMonitoringStatus()` in `npiPassportContract.ts` (lines 549–602):**
Single `findMany` with `select` clause. Iteration over results, no nested queries.

### Areas not fully audited

| Area | Status | Risk |
|---|---|---|
| `readinessEngine.ts` | File location unconfirmed in agent scan | Unknown — needs manual check |
| `sourceOpsService.ts` | File location unconfirmed | Unknown |
| `sealEventCapture.ts` | Located but not deeply inspected | Low (append-only event capture) |
| Ingest pipeline freshness check | Not examined | Medium — does `POST /api/ingest/npi/:npi` always hit all sources or check freshness first? |

### Verdict

Primary data paths (passport loading, credential assembly) are well-optimized with `Promise.all` batching, eager `include` clauses, and IN-clause batch fetches. External API caching is TTL-based with reasonable intervals. No confirmed N+1 patterns in examined code. The ingest pipeline's freshness-check behavior remains unverified.

---

## Summary of Action Items

| Priority | Finding | Location | Action |
|---|---|---|---|
| **P0** | Readiness endpoints have zero auth | `routes/readiness.ts` | Add Clerk auth middleware |
| **P0** | Wallet mode token = NPI (not a secret) | `routes/passport.ts:~525` | Replace with bearer token or Clerk session |
| **P1** | Public passport endpoints undocumented | `routes/passport.ts` | Document business justification or add API key gating |
| **P1** | Marketing → web app NPI seam broken | `apps/marketing` Hero → `/clinician` | Already tracked — route to `/passport?npi=` in web app |
| **P2** | Ingest pipeline freshness logic unverified | `POST /api/ingest/npi/:npi` | Manual audit of source-check-before-fetch logic |
| **P2** | readinessEngine.ts and sourceOpsService.ts not fully inspected | `apps/api/backend/src/services/` | Complete N+1 audit on these files |

---

*Generated 2026-04-13 by Claude Cowork. Read-only audit — no code modified.*
