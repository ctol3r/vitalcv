# VitalCV Real-Data Wedge Audit

**Date:** 2026-03-27
**Auditor role:** Simulated first pilot employer + first pilot clinician
**Scope:** NPI → readiness → packet → employer review → employer decision
**Methodology:** Code-level trace of every step in the wedge, judged against operational reality

---

## 1. Flow Trace Summary

### Step 1: NPI → Readiness (Clinician Activation)

**Route:** `POST /api/clinician/activate` → `clinician.ts`

**What happens:**
- Clinician submits 10-digit NPI
- System calls `ensureWorkspaceUser` (Clerk auth → workspace user)
- Conflict check: NPI already bound to another account → 409
- `bootstrapFromNpi(npi)` → calls NPPES live API, extracts name/specialty/state
- Only Type 1 (individual) NPIs accepted — correct guard
- Upserts `PersonProfile` with NPI, name, specialty, state
- Calls `refreshTrustState(npi)` → full trust state engine computation
- Returns `{ readinessScore, readinessLevel, readinessStatus }`

**Verdict: REAL.** Hits live NPPES. Stores durable profile. Computes trust state from primary sources.

**Issues found:**
- `completeness` is hardcoded to `Math.max(existing ?? 0, 30)` — 30% floor with no explanation to the clinician about what the other 70% represents or how to improve it
- No audit event is emitted for the activation itself (trust state engine emits one, but the activation action has no discrete audit trail)

### Step 2: Trust State Engine (Core Readiness Computation)

**File:** `trustStateEngine.ts` (methodology version 243.3)

**What happens:**
- Fetches NPPES live (6s timeout, graceful degradation)
- Queries `CandidateCredential` + `VerificationArtifact` records from DB
- Calls `checkExclusion()` → OIG/LEIE check
- Resolves PECOS enrollment status
- Checks licensure state-board data (production-enabled states only)
- Computes deterministic readiness via weighted dimensions: identity (20), exclusion (30), licensure (30), enrollment (20)
- Produces L0–L3 trust band, 0–100 score, gap summary, blockers, next actions
- Writes audit event via `appendAuditEvent`
- Caches in memory + DB

**Verdict: REAL.** This is the source-spine. Deterministic. Auditable. Multi-source.

**Issues found:**
- Board order severity checks exist but `isProductionEnabledPhysicianLicensureState` gates which states actually get checked — clinician sees no indication of which states are "live" vs "pending integration"
- When credential ingestion is disabled (`isCredentialIngestionEnabled() === false`), the engine silently skips document-based credentials — no gap signal surfaces to the user

### Step 3: Readiness → Packet (Passport + Evidence Packet)

**File:** `employerPacket.ts` / `passportService.ts`

**What happens:**
- `buildPassportByNpi(npi)` assembles full trust passport from all sources
- `buildEmployerEvidencePacket()` creates structured packet with:
  - Identity (NPI, name, specialty, source, truthStatus)
  - Safety (exclusion status, checkedAt, confidence, negative findings)
  - Authority (credentials with domain, status, issuer, observedAt, expiresAt, freshness, confidence, reviewRequired)
  - Eligibility (PECOS enrollment, data version, freshness)
  - Readiness (status, score, level, estimatedStartDays, blockers, nextActions)
  - Source coverage (per-source manifest with truthStatus, freshness, provenance, checksums, artifact refs, receipt refs)
- Manifest includes `schema: 'vitalcv.employer.packet.v1'`
- Launch spine sources checked with fallback coverage for unchecked sources
- ZIP export available with `packet.json`, `manifest.json`, `source-coverage.json`, `status.json`, `README.txt`

**Verdict: REAL.** Deeply structured. Source-attributed. Versioned schema. Exportable.

**Issues found:**
- `README.txt` in the ZIP bundle — not verified if it actually explains what the packet means to a non-technical employer compliance officer
- `estimatedStartDays` in readiness — source of this estimate unclear; if it's a heuristic, it needs methodology disclosure

### Step 4: Packet → Employer Review (ReviewClient)

**File:** `review/[entityId]/page.tsx` → `ReviewClient.tsx`

**What happens:**
- Server-side: fetches passport via `GET /api/passport/entity/:entityId`
- Fires `employer-review-opened` KPI event (fire-and-forget, 2s timeout)
- Renders `ReviewClient` with full passport data
- ReviewClient renders:
  - **Decision card** (name, specialty, readiness status, start estimate, confidence)
  - **Truth breakdown** (identity, safety/exclusion, authority/licensure, eligibility/enrollment)
  - **Freshness panel** (per-source staleness warnings)
  - **Proof sections** (accordion: each credential with source + timestamp + status)
  - **Action panel** (Accept / Request refresh / Route to review)
  - **Share context** (who shared, when)
- Auth gating: requires Clerk employer session for actions; shows "Preview only" otherwise
- Persisted action state loaded on mount for returning employers

**Verdict: REAL.** Decision-first layout. Truth-model backed. Auth-gated actions.

**Issues found:**
- The `previewOnlyMessage` covers four different states (Clerk disabled, loading, not signed in, not employer) but the user sees a single flat string — no affordance to sign in or switch workspace inline
- `API = ''` constant in ReviewClient means it relies on same-origin routing — no explicit base URL, which could silently fail in certain deployment configs

### Step 5: Employer Decision (Accept / Refresh / Route)

**File:** `employerActions.ts` → `employerReviewActions.ts`

**What happens:**
- **Accept:** Creates `EmployerAcceptance` row + audit event in transaction. Captures `DecisionTrustSnapshot` (SHA-256 hashed, immutable). Fires SEAL decision signal.
- **Request refresh:** Records refresh request with stale sources + missing domains. Writes audit event. (Future: triggers clinician notification — NOT YET IMPLEMENTED)
- **Route to review:** Creates review queue item + audit event.
- **Packet export:** Returns JSON or ZIP packet. Writes audit event for distribution.

**Verdict: REAL.** Transactional. Audited. Snapshot-hashed. Properly guarded (duplicate acceptance → 409).

**Issues found:**
- "Request refresh" says "Future: triggers clinician notification" — this means the employer clicks "request missing data" and... nothing reaches the clinician. The action is recorded but not delivered. **This is the single biggest theatrical action in the wedge.**
- SEAL `captureEmployerDecision` is fire-and-forget (`void`) — if it fails, no signal reaches the employer that the decision signal was lost

---

## 2. Clinician POV Notes

### Can a clinician understand what they have now?

**Partially. Major gaps remain.**

**What works:**
- `ClinicianReadinessSurface` (holder/readiness) pulls real data from `useClinicianMobile()` hook — score, trust history, delta tracking, blockers with next-action labels and links
- Refresh button triggers live `refreshTrustState()` with spinner + error handling
- Blocker cards show specific items ("One item left before you feel ready") with actionable links
- Pilot telemetry tracks readiness views and blocker interactions

**What does NOT work:**

1. **`ReadinessDashboard.tsx` is 100% hardcoded demo data.** Score 85, "CONDITIONALLY_READY", L2 trust level, demo alerts for "ACLS Certification" and "State Medical License (CA)". If any route renders this component, the clinician sees fiction. The `CredentialReadinessCard` component itself is well-built (takes props), but the dashboard wrapper feeds it static values.

2. **No explanation of what the score means.** The clinician sees "85/100" and "L2 Trust Level" but no methodology disclosure. What are the four dimensions? What's weighted how? The `trustCore.ts` weights (identity 20, exclusion 30, licensure 30, enrollment 20) are never surfaced.

3. **No visibility into which sources were actually checked.** The employer gets a full source coverage panel; the clinician gets nothing. A clinician cannot see "NPPES: checked, OIG: checked, State board: access required, PECOS: checked."

4. **No visibility into what "L2" means vs L1 vs L3.** The trust band taxonomy (L0–L3) is internal. No clinician-facing explanation of what each level means operationally.

5. **Profile completeness floor of 30% is unexplained.** After activation, the clinician is told their profile is 30% complete with no itemized breakdown of what the remaining 70% consists of.

6. **No confirmation receipt after NPI activation.** The `/api/clinician/activate` endpoint returns JSON `{ readinessScore, readinessLevel, readinessStatus }` — but no explicit "you are now activated" artifact, no audit receipt reference, no timestamp the clinician can keep.

7. **Document upload flow (OnboardingOrchestrator) checks API reachability but gives no clear signal when the API is unreachable** — just silently sets `apiReachable = false` without user-facing guidance.

---

## 3. Employer POV Notes

### Can an employer understand what is proven now?

**Yes, substantially. The employer surface is the strongest part of the wedge.**

**What works well:**
- Decision-first layout: READY/PARTIAL/BLOCKED status visible immediately
- Truth breakdown: identity, safety, authority, eligibility — each with explicit trust status (confirmed/review/unchecked/blocked)
- Freshness panel warns about stale sources with specific dates
- Proof accordion: per-credential source + timestamp + status + freshness label + confidence label
- Each truth row includes an `explanation` field with specific operational language ("No exclusion entry was found in the current OIG LEIE check")
- Medicare enrollment shows quarterly data lag disclaimers
- Exclusion `POSSIBLE_MATCH` correctly surfaces "requires manual adjudication"
- `NOT DECISION-GRADE` status correctly labeled as "context only"
- Auth gating prevents accidental decisions without employer session
- Persisted action state survives page reload

**What does NOT work:**

1. **"Request missing data" goes nowhere.** The employer clicks it, sees a confirmation, an audit event is written — but the clinician is never notified. The code explicitly says `// Future: triggers clinician notification`. This makes the second-most-important employer action theatrical.

2. **No explanation of what the readiness score means to an employer.** The score and band are shown, but the employer has no way to understand whether 72 is "normal for a nurse in Texas" or "unusually low." No benchmark. No methodology disclosure.

3. **`estimatedStartDays` has no disclosed methodology.** If this says "Est. 14 days to start" an employer will treat it as a commitment. Source and confidence of this estimate are invisible.

4. **Packet ZIP `README.txt` is unverified.** If it's a placeholder or generic, the compliance officer who opens the ZIP gets no useful context about what the files mean.

5. **The "Accept as head start" action label is ambiguous.** Does "head start" mean "conditional acceptance pending full credentialing" or "full acceptance"? The action's operational meaning is unclear for a compliance team.

6. **No reject action.** An employer can accept, request refresh, or route to review — but cannot explicitly reject. If a clinician is blocked, there's no employer-side close-out that creates an auditable rejection event through this flow.

7. **SEAL decision capture is fire-and-forget.** If the signal drops, no retry, no alert. The employer's accept action succeeds but the downstream decision signal may silently vanish.

---

## 4. Top 10 Remaining Real-Data UX Problems

| # | Problem | Severity | Who it affects |
|---|---------|----------|----------------|
| **1** | **"Request refresh" action is theatrical** — writes audit event but never notifies clinician | CRITICAL | Employer + Clinician |
| **2** | **ReadinessDashboard.tsx is 100% hardcoded demo** — renders fiction if reachable | CRITICAL | Clinician |
| **3** | **No clinician-facing source coverage panel** — clinician cannot see which sources were checked | HIGH | Clinician |
| **4** | **No readiness score methodology disclosure** — neither persona understands what the score means | HIGH | Both |
| **5** | **No clinician notification channel exists** — refresh requests, blocker resolutions, and status changes have no delivery path to the clinician beyond polling | HIGH | Clinician |
| **6** | **`estimatedStartDays` has undisclosed methodology** — employer treats it as a commitment with no confidence bound | HIGH | Employer |
| **7** | **No explicit reject/decline action for employers** — cannot close out a blocked candidate with auditable finality | MEDIUM | Employer |
| **8** | **Trust band labels (L0–L3) are unexplained** to both personas — internal taxonomy leaked to UI without glossary | MEDIUM | Both |
| **9** | **CRS fallback returns `score: 95, band: GREEN`** when Neo4j is not configured (wedge.ts:183–188) — presents fabricated confidence when the graph is unavailable | MEDIUM | Internal/Audit |
| **10** | **Activation produces no receipt** — clinician gets JSON response but no durable confirmation artifact, no audit ref, no timestamp they can reference | MEDIUM | Clinician |

---

## 5. Theatrical vs Operational Assessment

### Confirmed OPERATIONAL (real data, real persistence, real audit):
- NPI → NPPES live lookup
- Trust state computation (NPPES + OIG + PECOS + credentials + licensure)
- Evidence packet assembly with source coverage
- Employer review surface with truth model
- Accept action with DecisionTrustSnapshot + SHA-256 hash
- Route-to-review with queue item creation
- Audit events for every mutating action
- Packet export (JSON + ZIP) with audit trail
- Freshness/staleness detection and display
- Auth gating for employer actions

### Confirmed THEATRICAL (looks real, isn't):
- **"Request refresh" button** — persists audit event, returns success, but clinician is never notified
- **ReadinessDashboard** — renders hardcoded demo data, not connected to any real state
- **CRS fallback score of 95/GREEN** — presented when graph DB is unavailable, fabricates confidence
- **"Future: triggers clinician notification" comment** — the notification system does not exist yet
- **SEAL fire-and-forget** — decision signals can silently drop with no retry or alerting

### Ambiguous (could go either way):
- `estimatedStartDays` — real computation unclear, may be a heuristic presented as fact
- Profile completeness 30% floor — real but unexplained, could confuse or mislead
- State-board licensure gating — real check, but clinician has no visibility into which states are production-enabled

---

## 6. GO / NO-GO Verdict

### Source-Spine Hardening: **CONDITIONAL GO**

The trust state engine (`trustStateEngine.ts`, methodology 243.3) is genuinely operational. It hits live primary sources (NPPES, OIG/LEIE, PECOS), computes deterministic readiness with documented dimension weights, writes audit events, and produces structured packets with source coverage and SHA-256 integrity hashes. The employer review surface correctly presents truth-model-backed decisions with proper auth gating.

**The source spine is real. It can be hardened.**

### Pilot-Ops Readiness: **NO-GO (3 blockers)**

The wedge cannot be put in front of a real pilot employer + clinician pair until these three items are resolved:

| Blocker | Why it blocks | Effort |
|---------|---------------|--------|
| **1. "Request refresh" must deliver** | An employer who clicks "request missing data" and gets silence will lose trust in the platform immediately. Even a simple email/webhook notification to the clinician is sufficient for pilot. | S–M |
| **2. Kill or connect ReadinessDashboard** | If any clinician-facing route renders the hardcoded dashboard, it destroys credibility. Either remove it, gate it behind a feature flag, or wire it to real data via the same `useClinicianMobile()` pattern that `ClinicianReadinessSurface` uses. | S |
| **3. CRS fallback must not fabricate confidence** | Returning `score: 95, band: GREEN` when the graph DB is down is a compliance violation waiting to happen. Fallback should return `score: null, band: UNAVAILABLE` with an explicit "readiness score temporarily unavailable" message. | S |

### Post-Blocker Hardening (pilot-ops quality):

Once the three blockers are cleared, these should follow in priority order:

1. Add clinician-facing source coverage panel (which sources checked, freshness, gaps)
2. Add methodology disclosure for readiness score (even a tooltip or expandable section)
3. Add explicit reject/decline action for employers
4. Disclose `estimatedStartDays` confidence/methodology
5. Add activation receipt for clinicians (audit ref + timestamp)
6. Add L0–L3 trust band glossary to both surfaces
7. Add SEAL retry/dead-letter for dropped decision signals

---

*Audit complete. The spine is real. The edges need finishing.*
