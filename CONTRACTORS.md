# CONTRACTORS.md — VitalCV Handoff Reference

> Written 2026-03-23. Keep this updated when routes, sources, or rules change.

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
  → sourceVerifier (NPPES live)
  → oigLeieChecker (OIG/LEIE live)
  → nursysAdapter (Nursys, gated: REAL_NURSYS_ENABLED=true)
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
| **CMS PECOS** (Medicare enrollment) | ⚠ Mock data in prod | `PECOS_ENABLED` |
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
3. Authority verified (state license ACTIVE — requires Nursys or manual upload)
4. Eligibility (PECOS enrolled, or `NOT_FOUND` with explicit action shown)
5. `readinessEngine` score ≥ 60 → L2+; all blockers resolved → L3

If any source is `gated` or `unchecked`, it's honest-unavailable — not decision-grade, but employer can still proceed with explicit acknowledgment.

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
| Honest unavailable / gated labels | Implying a source was checked when it wasn't |

---

## 6. Demo Artifacts vs Production Routes

Two demo sub-routes are **legacy visual references only** — seeded data, not wired to trust pipeline:

- `/demo/command-center` — Wave 10 VerifierCommandCenter (seeded candidates)
- `/demo/verifier-portal` — Wave 11 VerifierPortal (seeded candidates)

Both have amber banners marking them as demo artifacts. **Do not wire these to live APIs.**

The `/demo` index page is safe — it links to live routes (explore, employers, onboarding, intelligence).

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
PECOS_ENABLED=true              # CMS PECOS model live, mock data (quarterly)
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
