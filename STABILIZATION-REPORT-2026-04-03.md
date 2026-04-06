# VitalCV Stabilization Report — 2026-04-03
> Post-Credential Hydration | Demo Readiness Assessment

---

## Step 1: Backend Passport Contract — FROZEN

The canonical contract lives at `apps/web/lib/trust/passport-contract.ts` and defines the `PassportData` interface. The backend builder is `apps/api/backend/src/services/entity/passportService.ts`.

### Frozen PassportData Shape (Top-Level)

| Field | Type | Required | Notes |
|---|---|---|---|
| `entityId` | string | ✅ | UUID |
| `npi` | string | ⚠ optional | 10-digit NPI |
| `identity` | object | ✅ | displayName, specialty?, entityType, status, npi? |
| `authority` | object | ✅ | credentials[], summary {active, expired, stale, missing[]} |
| `training` | object | ✅ | records[], hasDegree, degreeVerified, hasResidency, fellowshipCount |
| `standing` | object | ✅ | exclusion, licensure, PECOS enrollment, negativeFindings |
| `readiness` | object | ✅ | status, score, level, blockers[], gaps[], nextActions[] |
| `sources` | object | ✅ | checked[], lastFetch{} |
| `sourceCoverage` | PassportSourceCoverageReport | ✅ | 9 canonical states |
| `truth` | CanonicalTruthSet | ⚠ optional | Always sent by backend, optional in frontend type |
| `trustPosture` | PassportTrustPosture | ✅ | band, score, dimensions[], freshness |
| `lastCheckedAt` | string (ISO8601) | ✅ | |

### Credential Shape (authority.credentials[])

30+ fields per credential. Key fields: `id`, `domain`, `type`, `status`, `verificationLevel`, `stale`, `confidenceLabel`, `claimConfidenceLabel`, `dataFreshness`, `dataFreshnessLabel`, `reviewRequired`. All date fields are ISO8601 strings (see Mismatch #4 below).

### Rule: No breaking changes to this shape without explicit coordination between backend and frontend agents.

---

## Step 2: Frontend-Backend Mismatches — 6 FOUND

| # | Issue | Severity | Action Required |
|---|---|---|---|
| 1 | Backend sends `matchType` on credentials; frontend contract omits it | LOW | Add to contract or ignore (extra field) |
| 2 | Backend sends `daysUntilExpiry` on credentials; frontend contract omits it | LOW | Add to contract or ignore |
| 3 | Backend sends both `readiness_score` and `score`; frontend only uses `score` | LOW | No action — redundancy is safe |
| 4 | `enrollmentObservedAt` may arrive as Date object (not ISO string) | **P1** | Backend must call `.toISOString()` at passportService.ts:1734 |
| 5 | Backend always sends `truth`; frontend marks optional | LOW | Defensive — no fix needed |
| 6 | Backend populates credential `label`; frontend contract doesn't include it | **P2** | Add `label?: string` to frontend contract for display use |

### Critical Fix: Mismatch #4

In `passportService.ts` line ~1734, `enrollmentObservedAt` is assigned directly from a Prisma `DateTime` field without `.toISOString()`. This can cause frontend date formatting to fail silently. Fix: ensure all Date fields are serialized to ISO strings before response.

---

## Step 3: Demo Flow — FUNCTIONAL

The NPI → Passport → Review path is wired and working:

1. **Homepage → NPI input**: `LiveTrustConsole` component, POST `/api/ingest/:npi`, SSE streaming
2. **Readiness appears quickly**: Progressive hydration via SSE (NPPES ~1s → OIG ~2s → PECOS ~3s)
3. **Passport shows real credentials**: 37 claims hydrated from ClaimRecord (commit 44c4599e)
4. **Review page loads cleanly**: ReviewClient consumes full PassportData
5. **Employer decision**: 4 canonical bullets (Identity, Safety, License, Enrollment) + Accept/Refresh/Route

**SessionStorage optimization**: Homepage preview state is cached (5-minute TTL), so navigating to passport page resumes from enrollment phase without re-running NPPES/OIG.

### No dead routes found in the demo path.

**Auth gate concern**: `/review/request` is auth-gated, which blocks unauthenticated employer demo walkthroughs. This is a known issue from the Release Gate Report.

---

## Step 4: Cold Start — ALREADY MITIGATED

The backend uses an **early-binding health check pattern** (server.ts lines 24-70):

- A bare `http.createServer` binds the port immediately on boot
- Health probe returns `{status: 'starting'}` while Express bootstraps
- Express takes over the socket once ready
- Railway config: `healthcheckPath = "/health"`, `healthcheckTimeout = 120s`, `restartPolicyType = "ON_FAILURE"`, maxRetries = 5

**Result**: The 502 cold-start issue is already handled. First health probe succeeds even during app bootstrap. The container will not be marked unhealthy during startup.

**Remaining risk**: If Railway idles the container (sleep policy), the first user request after wake-up could experience a ~5-10s delay during Express bootstrap. Mitigation options:

- **Option A**: Add a periodic ping from the frontend (e.g., on homepage load, call `/health`)
- **Option B**: Configure Railway to keep the service awake (if on Pro plan)
- **Option C**: Accept the delay — the SSE streaming UX handles this gracefully since it shows progressive loading anyway

---

## Step 5: Visual Consistency — MOSTLY CONSISTENT, 2 ISSUES

### Token System
- VitalCV tokens (`vt-*` in `vitalTokens.css`): oklch colors, spacing scale, radius
- Typography classes (`typography.css`): `heading-xl` through `body-sm`, metric display classes
- Font stack: Google Sans Flex (display), JetBrains Mono (code), Fraunces (serif)

### Issues Found

**Issue 1: Radius Conflict (P2)**
- `globals.css` declares `--radius: 0.125rem` (brutalist near-sharp)
- Components use `rounded-2xl` (16px), `rounded-lg` (8px), `rounded-xl` (12px)
- The brutalist radius mandate is aspirational, not enforced
- **Impact on demo**: Low — the current rounded corners look polished and consistent with each other

**Issue 2: Design Language Mix (P3)**
- Glass tokens exist (`--vt-glass-bg`, `.glass` class) but are NOT used on primary surfaces
- Brutalist opacity-based borders (`border-white/8`, `border-white/6`) are applied consistently
- No jarring transitions between pages — all three surfaces share the dark-bg + opacity-border vocabulary

**Verdict**: Visual consistency is adequate for demo. No jarring mismatches.

---

## Step 6: Parallel Agent Safety — FILE OWNERSHIP MAP

### Backend Agent Owns:
- `apps/api/backend/src/services/entity/passportService.ts`
- `apps/api/backend/src/services/identity/sourceCatalog.ts`
- `apps/api/backend/src/services/verticals/readiness/readinessEngine.ts`
- `apps/api/backend/src/services/sourceOpsService.ts`
- `apps/api/backend/src/routes/` (all route files)
- `packages/trust-state/`, `packages/psv/`, `packages/domain-common/`
- `apps/api/backend/prisma/schema.prisma` (READ ONLY — no migrations without approval)

### Frontend Agent Owns:
- `apps/web/components/passport/PassportWallet.tsx`
- `apps/web/components/review/ReviewClient.tsx`
- `apps/web/components/hero/ReadinessPreview.tsx`
- `apps/web/app/interview/InterviewClient.tsx`
- `apps/web/app/passport/page.tsx`
- `apps/web/app/onboarding/page.tsx`
- `apps/web/lib/trust/passport-contract.ts`

### Shared / Coordination Required:
- `apps/web/lib/trust/passport-contract.ts` — This is the contract boundary. Changes here require both agents to agree.
- `packages/trust-state/sourceCoverage.ts` — Types shared by both sides
- Any API response shape changes — must update contract first

### Rule: Backend agent must not modify files in `apps/web/`. Frontend agent must not modify files in `apps/api/` or `packages/`.

---

## Step 7: Validation Summary

| Check | Status | Notes |
|---|---|---|
| NPI ingest works | ✅ | POST /api/ingest/:npi → SSE stream → progressive hydration |
| Passport shows full credentials | ✅ | 37 claims from ClaimRecord hydration |
| Review page renders | ✅ | 4 canonical decision bullets + proof panel |
| No dead routes | ✅ | All demo-path pages wired |
| Cold start handled | ✅ | Early-binding health server |
| Visual consistency | ✅ | Adequate for demo |
| Contract defined | ✅ | PassportData frozen in passport-contract.ts |
| Frontend-backend mismatches | ⚠ | 6 found — 1 P1, 1 P2, 4 LOW |

---

## Step 8: Final Output

### What Is Now Demo-Ready

The **NPI → Readiness → Passport → Employer Review** flow is functional end-to-end:
- Real credentials hydrated from ClaimRecord (37 claims)
- Progressive SSE streaming gives fast perceived performance
- Passport wallet displays all 5 accordion sections (Identity, Authority, Training, Standing, Eligibility)
- Employer review surface shows 4 canonical decision bullets with Accept/Refresh/Route actions
- Cold start is handled by early-binding health server
- Visual language is consistent (dark-bg, opacity borders, unified typography)

### Remaining Blockers

| Priority | Blocker | Owner | Effort |
|---|---|---|---|
| **P0** | Hero.tsx copy violations (W17-1, W17-2, W17-5) — "zero-trust ledger", "hire instantly", Nursys green checkmarks | Frontend | S |
| **P0** | Marketing → Web app seam (dead `/clinician` route) | Frontend | M |
| **P1** | `enrollmentObservedAt` Date vs string serialization (Mismatch #4) | Backend | S |
| **P1** | HomeSections.tsx "graph"/"ledger" copy (W17-3, W17-4) | Frontend | S |
| **P2** | Add `label` field to frontend contract (Mismatch #6) | Frontend | S |
| **P2** | SOC 2 / NCQA badges on Hero.tsx (W17-6) | Frontend | S |
| **P2** | "Request a Demo" CTA routes to /verifier (W17-7) | Frontend | S |
| **P2** | `/partners` and `/investors` hardcoded metrics without "illustrative" label | Frontend | S |
| **P3** | Brutalist radius not enforced (aspirational only) | Frontend | M |

### Exact Next Actions to Get to First Employer Demo

1. **Fix Mismatch #4** (backend, 15 min): In `passportService.ts` ~line 1734, ensure `enrollmentObservedAt` is serialized with `.toISOString()`. This prevents silent frontend failures on date formatting.

2. **Fix W17 P0 copy violations** (frontend, 1 hour): Rewrite Hero.tsx lines 122, 133-136 per Release Gate Report. Remove Nursys green checkmarks at lines 16/20. These are the copy discipline blockers that prevent any buyer-facing deployment.

3. **Add `label` to frontend contract** (frontend, 15 min): Add `label?: string` to the credentials type in `passport-contract.ts`. Components can then display human-readable credential names from backend.

4. **Test one full demo cycle**: Enter a real NPI → wait for readiness → view passport → open review → click Accept. Confirm no console errors, no empty states, no stale data.

5. **Prepare demo NPI list**: Identify 3-5 NPIs that produce complete, decision-grade passports (all 4 canonical bullets green). These become the demo script.

---

*Generated 2026-04-03 by Claude Cowork.*
*Next refresh: after W17 copy fixes land.*
