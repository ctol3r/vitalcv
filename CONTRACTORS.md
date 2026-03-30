# CONTRACTORS.md — VitalCV Handoff Reference

> Updated 2026-03-30 (Wave 5). Keep this updated when routes, sources, or rules change.
>
> **CRITICAL PILOT DOCS:** Before deploying or modifying logic, read [vitalcv-launch-gate.md](./docs/specs/vitalcv-launch-gate.md), [vitalcv-pilot-runbook.md](./docs/specs/vitalcv-pilot-runbook.md), [vitalcv-pilot-brief.md](./docs/specs/vitalcv-pilot-brief.md), [vitalcv-pricing-doctrine.md](./docs/specs/vitalcv-pricing-doctrine.md), [vitalcv-source-coverage-matrix.md](./docs/specs/vitalcv-source-coverage-matrix.md), and [vitalcv-demo-script.md](./docs/specs/vitalcv-demo-script.md). **DO NOT reintroduce demo theater. Build for truth.**

---

## 1. Active Product Wedge

The product has one trust wedge. Everything else is secondary.

```
NPI → Onboarding → Passport → Review → Employer Decision
```

| Route | File | Notes |
|---|---|---|
| `/` | `app/page.tsx` | Hero + proof card teaser (score shows `—`, labeled "Example") |
| `/onboarding` | `app/onboarding/page.tsx` | NPI entry → credential ingestion start |
| `/passport/[id]` | `app/passport/[id]/page.tsx` | Full trust passport by entity UUID |
| `/p/[slug]` | `app/p/[slug]/page.tsx` | Public share surface (NPI-based slug) |
| `/interview` | `app/interview/page.tsx` + `InterviewClient.tsx` | Real-time readiness for interview mode |
| `/review/[entityId]` | `app/review/[entityId]/page.tsx` + `ReviewClient.tsx` | **Employer decision surface — production only** |
| `/get-ready` | `app/get-ready/page.tsx` | Readiness guidance for clinicians |

---

## 2. Canonical Trust Path (Backend)

```
POST /api/ingest/npi/:npi
  → sourceVerifier (NPPES source-backed)
  → oigLeieChecker (OIG/LEIE source-backed)
  → physicianLicensureLaunchLane / authority adapters (STATE_BOARD today; Nursys gated when configured)
  → trustStateEngine → readinessEngine
  → passportService.buildPassport(entityId)

GET /api/passport/entity/:entityId
GET /api/passport/npi/:npi
```

**Employer decision path:**
```
GET  /api/employer-review/:entityId/packet     — evidence export
POST /api/employer-review/:entityId/accept     — ATOMIC: EmployerAcceptance + AuditEvent
POST /api/employer-review/:entityId/request-refresh
POST /api/employer-review/:entityId/route-to-review
```

Every mutating action writes an `AuditEvent` row before returning 2xx. This is the audit contract — never skip it.

---

## 3. Live Sources (What's Actually Running)

| Source | Status | Flag |
|---|---|---|
| **NPPES** (CMS NPI Registry) | ✅ Always on | — |
| **OIG/LEIE** (Exclusion registry) | ✅ Always on | `OIG_LEIE_ENABLED` (default true) |
| **STATE_BOARD** (launch physician licensure lane) | ⚠ Source-backed when the configured launch-state adapter is enabled; otherwise access required | `STATE_BOARD_ENABLED` |
| **CMS PECOS** (Medicare enrollment) | ⚠ Quarterly CMS snapshot, source-backed but not real-time | `PECOS_ENABLED` |
| **Nursys** (State board network) | 🔒 Gated | `REAL_NURSYS_ENABLED=true` when institutional access ready |
| **FSMB** | 🔒 Gated | `FSMB_ENABLED=true` + institutional agreement |

### NOT INTEGRATED — Do not add to UI copy, copy, or source lists:
- ❌ **NPDB** — National Practitioner Data Bank (requires institutional subscription)
- ❌ **DEA** — Drug Enforcement Agency
- ❌ **ABMS** — American Board of Medical Specialties
- ❌ **SAM.gov** — Federal exclusion database
- ❌ **Doximity**

---

## 4. Decision-Grade Rules

A clinician is **decision-grade** (employer can accept) when:

1. Identity confirmed (NPPES — L2+)
2. Safety clear (OIG/LEIE — `CLEAR`)
3. Authority verified (state license ACTIVE — requires the configured state-board lane or other contracted authority access)
4. Eligibility (PECOS enrolled, or `NOT_FOUND` with explicit action shown)
5. `readinessEngine` score ≥ 60 → L2+; all blockers resolved → L3

If any source is `gated` or `pending`, it's honest-unavailable — not decision-grade, but employer can still proceed with explicit acknowledgment.

**Key type:** `PecosEnrollmentStatus = 'ENROLLED' | 'NOT_FOUND' | 'UNKNOWN' | 'UNCHECKED'`
- `NOT_FOUND` → blocker + action shown ("Submit PECOS enrollment, 45–60 days")
- `UNKNOWN` → inconclusive check, shown explicitly
- `UNCHECKED` → source never queried, shown as unavailable

---

## 5. Copy Rules — What You Can and Cannot Say

| ✅ Allowed | ❌ Not allowed |
|---|---|
| "Cryptographically signed" | "Blockchain-anchored" |
| "Verified via primary source" | "Permanently recorded" |
| "Licensed states (via Nursys)" | "All 50 states" |
| "OIG/LEIE exclusion check" | "NPDB check cleared" |
| "Selectively disclosed (SD-JWT)" | "Zero-knowledge proof" |
| "Based on observed patterns" (SEAL advisory) | Any claim that SEAL-derived output is source truth |
| "Same-band repeat access is not re-billed" | "Every review/open is a billable event" |
| "Government fees pass through at cost" | "Government fees are included in base price" |
| "Manual invoice/contact flow" when checkout is gated | "Live self-serve checkout" when it is not actually enabled |
| Honest unavailable / gated labels | Implying a source was checked when it wasn't |

---

## 6. Demo Artifacts vs Production Routes (WARNING)

**DO NOT REINTRODUCE DEMO THEATER.**

Two demo sub-routes exist as **legacy visual references only** — they use seeded data and are NOT wired to the production trust pipeline. They, along with other stale marketing and dashboard shells, have been moved to `apps/web/app/_archive`.

- `/demo/command-center` (Archived)
- `/demo/verifier-portal` (Archived)
- Mobile, Marketing Dashboard, and Simulation shells are also in `_archive`.

Both have amber banners marking them as demo artifacts. **Do not wire these to live APIs.** 

For the first live pilot, you MUST follow the exact bounds defined in:
- The [Launch Gate Check](docs/specs/vitalcv-launch-gate.md)
- The [Pilot Runbook](docs/specs/vitalcv-pilot-runbook.md)
- The [Pilot Brief](docs/specs/vitalcv-pilot-brief.md)
- The [Pricing Doctrine](docs/specs/vitalcv-pricing-doctrine.md)

Do not widen the scope or build features solely to make demos look more impressive. If it's not real, it's not shipping.

---

## 7. Pilot KPI Path

For a pilot demo run, the complete verification-to-decision flow takes <60 seconds:

```
1. Enter NPI at /onboarding
2. View passport at /passport/[id] — readiness score + blockers visible
3. Share passport link with employer
4. Employer opens /review/[entityId] — FreshnessPanel shows 4-layer freshness
5. Employer clicks "Accept as head start" → AuditEvent written → confirmation shown
```

**Evidence packet:** `GET /api/employer-review/:entityId/packet` — JSON/download of all source evidence with explicit `sourceCoverage` object.

**Scope rule:** If the pilot is filtered by org, pilot, lane, or geography, manually recorded start outcomes must carry that same scope. Do not claim filtered starts from unscoped `StartAttestation` rows.

---

## 8. SEAL Training Pipeline (Offline — Feature Flagged)

SEAL captures behavioral outcomes for offline advisory training. **It never modifies source truth.**

```
SEAL event tables (append-only):
  advisory_outcome_events
  blocker_resolution_events
  employer_decision_events
  start_outcome_events
```

Routes: `POST /api/seal/events/*` — fire-and-forget, non-blocking.
Export: `GET /api/seal/training-set` — requires `SEAL_TRAINING_EXPORT_ENABLED=true`.

**Safety rule:** Any advisory output derived from SEAL training must be labeled: `"Based on observed patterns"`. SEAL never generates claim fields or verification statuses.

---

## 9. Environment Flags (All Off by Default)

```env
REAL_NURSYS_ENABLED=false       # Set true when institutional E-Notify access ready
FSMB_ENABLED=false              # Set true when FSMB institutional agreement active
OIG_LEIE_ENABLED=true           # OIG LEIE CSV cache — always on in prod
STATE_BOARD_ENABLED=false       # Set true when the launch-state board adapter is configured
PECOS_ENABLED=true              # CMS PECOS quarterly source-backed snapshot (not real-time)
MONITORING_ENABLED=false        # Wave 245 async trust engine — enable in prod
SEAL_TRAINING_EXPORT_ENABLED=false  # Training dataset export gate
OCR_PROVIDER=stub               # Set to 'openai' when OpenAI key available
```

---

## 10. Key Files by Concern

| Concern | File |
|---|---|
| Trust source catalog | `apps/api/backend/src/services/identity/sourceCatalog.ts` |
| Passport builder | `apps/api/backend/src/services/entity/passportService.ts` |
| Readiness engine | `apps/api/backend/src/services/verticals/readiness/readinessEngine.ts` |
| Readiness next actions | `apps/api/backend/src/services/entity/readinessActions.ts` |
| Employer review routes | `apps/api/backend/src/routes/employerActions.ts` |
| SEAL event capture | `apps/api/backend/src/services/seal/sealEventCapture.ts` |
| SEAL training export | `apps/api/backend/src/services/seal/sealTrainingNormalizer.ts` |
| Canonical source coverage | `packages/trust-state/sourceCoverage.ts` |
| PSV receipt types | `packages/psv/PSVReceipt.ts` |
| PassportWallet UI | `apps/web/components/passport/PassportWallet.tsx` |
| ReviewClient UI | `apps/web/components/review/ReviewClient.tsx` |
| InterviewClient UI | `apps/web/app/interview/InterviewClient.tsx` |
| DB schema | `apps/api/backend/prisma/schema.prisma` |

---

## 11. Do Not Introduce

**These are hard rules. Violating them blocks any PR from merging.**

### 11.1 — Demo Theater (Fake UI States)

Do not create, restore, or wire UI components that display readiness states, source results, scores, or employer actions that are not backed by real data flowing through the production trust pipeline. This includes:

- Seeded "happy path" data rendered as if it were live verification results.
- Mock readiness scores or trust levels not produced by `readinessEngine`.
- Static JSON fixtures rendered in production routes (dev/test fixtures are fine in test environments).
- Any route that produces a "verified" or "cleared" appearance without a real source check behind it.

**Test:** If the data disappears when you disconnect all source adapters, it was real. If it still looks the same, it's theater.

### 11.2 — Unsupported Source Claims

Do not add NPDB, DEA, ABMS, CAQH ProView, or SAM.gov to any UI, marketing copy, source coverage display, or readiness calculation unless the source is actually integrated, enabled via env flag, and flowing data in production.

Specifically:
- Do not add these source names to `SourceHealthPanel`, passport lanes, readiness factors, or blocker lists.
- Do not add "coming soon" labels that imply imminent availability.
- Do not create gated source UI that looks like it's one toggle away from being live when no code path exists.

**Reference:** See [vitalcv-source-coverage-matrix.md](./docs/specs/vitalcv-source-coverage-matrix.md) for the canonical status of every source.

### 11.3 — Fake Signatures or PDF Theater

Do not generate, display, or export documents that appear to be cryptographically signed, notarized, or officially stamped when the signing infrastructure is not actually in place. This includes:

- Rendered signature lines, seals, or "digitally signed by" labels without actual signing.
- PDF exports styled to look like official verification letters when they are evidence packets.
- Any visual element that implies legal weight the document does not carry.

### 11.4 — Fake Self-Serve Claims

Do not display live checkout buttons, Stripe payment forms, or "subscribe now" CTAs unless card payment is actually enabled and processing. During pilot mode:

- Pricing tiers can be shown for transparency.
- CTAs must route to `mailto:` or the request-access flow.
- Do not claim "instant activation" or "start your free trial" when access requires manual approval.

### 11.5 — Platform Breadth Ahead of Wedge

Do not build or ship features that imply VitalCV is a general recruiting marketplace, a full credentialing platform, or a workflow automation suite. The product has one launch wedge:

```
NPI -> Onboarding -> Passport -> Review -> Employer Decision
```

Do not add:
- Job boards, candidate matching, or sourcing features.
- Committee management, document collection workflows, or multi-step approval chains.
- Multi-tenant admin panels for features that don't exist yet.
- Dashboard shells for analytics that have no real data behind them.

### 11.6 — Silent Source Failures Appearing as Clean/Verified

A source that fails to respond, times out, or throws an error must NEVER render as `CLEAR`, `VERIFIED`, `ENROLLED`, or any positive state. It must render as:

- `UNAVAILABLE` — source could not be reached.
- `ERROR` — source returned an error.
- `UNCHECKED` — source was never queried.

**Test:** Kill the source adapter or block the network call. If the UI still shows a positive state, the error handling is wrong.

### 11.7 — Bypassing Canonical Trust-Status Definitions

The trust pipeline uses canonical status values defined in `packages/trust-state/`. Do not:

- Invent new status strings without updating the canonical type definitions.
- Map a negative source result to a positive display state (e.g., `NOT_FOUND` -> "Verified").
- Skip the `trustStateEngine` or `readinessEngine` to produce a readiness score directly.
- Allow an employer action to succeed without writing an `AuditEvent` in the same transaction.

**Reference:** See the decision-grade rules in Section 4 of this document and the launch gate at [vitalcv-launch-gate.md](./docs/specs/vitalcv-launch-gate.md).
