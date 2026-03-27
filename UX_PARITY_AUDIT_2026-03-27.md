# VitalCV Wedge Parity Audit — 2026-03-27

## Executive Summary

The five wedge surfaces (homepage, passport, interview, review, onboarding) share a single canonical truth spine rooted in `packages/trust-state/sourceCoverage.ts`. Status language is unified through `lib/trust/status-language.ts` and all surfaces import from the same `TrustStatusBadge` primitive. The wiring is solid — but **five specific parity mismatches** remain, plus two route-confusion points that will bite during packet/employer hardening.

**Verdict: CONDITIONAL GO.** Fix the five mismatches below before starting employer hardening. None require architectural changes.

---

## 1. Canonical Truth Spine — What's Shared

All five surfaces ultimately derive from:

| Layer | Source | Status |
|---|---|---|
| Source coverage states | `packages/trust-state/sourceCoverage.ts` → `CANONICAL_SOURCE_COVERAGE_STATES` | **9 states** — checked, stale, pending, gated, unavailable, accessRequired, reviewRequired, notDecisionGrade, previewOnly |
| UI status labels | `packages/trust-state/sourceCoverage.ts` → `TRUST_UI_STATUS_LABELS` | **9 labels** — Verified, Clear, Checked, Pending, Stale, Unavailable, Access required, Review required, Preview only |
| Frontend re-export | `apps/web/lib/trust/status-language.ts` | Re-exports `getTrustStatusLabel`, `resolveTrustUiStatus`, adds `VDS_TRUST_STATUS_LABELS` |

This is correct and properly wired. The shared `TrustStatusBadge` component consumes these labels consistently.

---

## 2. Surface-by-Surface Status Language

### Homepage (LiveTrustConsole + ReadinessPreview)
- Source stages: `waiting | loading | ok | skipped | failed` → mapped to badge status `pending | checked | review_required | unavailable`
- ReadinessTone: `clear | pending | blocked` with labels `Checked | Pending | Blocked`
- Readiness copy: `{score}/100 · {level}` (L0–L3)
- Real accordion statuses: `checked | pending | access_required | review_required`
- Hero copy explicitly lists: "checked, pending, access required, unavailable, or preview only"
- Color rule: "green used ONLY on the CTA button" ✓

### Passport (/passport — ingest entry)
- Source states: `pending | checking | done | error`
- Badge mapping via `resolveSourceBadge()`: done → verified/clear/enrolled/checked/review required/blocked/unavailable
- Phase labels: "Connecting…", "Checking primary sources…", "Checking sanctions…", "Checking Medicare…", "Complete", "Error"

### Passport (/passport/[id] — full wallet)
- Delegates to `PassportWallet` component
- Consumes `PassportData` with `ReadinessStatus`: `READY | PARTIAL | BLOCKED`
- Error: "Passport not found" / "VitalCV could not hydrate a passport record for this entity."

### Interview (InterviewClient)
- Readiness mapped via `resolveLivePathReadinessStatus`: READY→clear, BLOCKED→blocked, PARTIAL→pending
- Tags: "Identity anchored", "Licensure attached", "Board evidence attached", "DEA evidence attached", "Sanctions clear", "Enrollment checked"
- Missing tags: blockers + missing domains + exclusion/enrollment status strings
- Proceed notes vary by READY/BLOCKED/PARTIAL
- Share context: "Review context attached" or "Preview only"

### Review (ReviewClient)
- Decision surface — `READY | PARTIAL | BLOCKED` via `resolveLivePathReadinessStatus` (same mapper)
- Safety row: `confirmed | review | blocked | missing` (TrustLabel statuses)
- Employer actions: accept / request missing / save
- Error: "Employer review unavailable" / "No decision card is rendered until VitalCV can hydrate a passport record…"

### Onboarding (OnboardingOrchestrator)
- DataState: `idle | loading | success | error`
- Consumes `TrustStateResponse` (from `components/trust-state/types`)
- VerificationLane config with separate lane-level states
- TrustBand from `TrustStateResponse`: `GREEN | YELLOW | RED`

---

## 3. Exact Parity Mismatches

### MISMATCH 1: ReadinessTone label "Checked" vs canonical "Verified/Clear"
**Location:** `ReadinessPreview.tsx` line 95
**Problem:** When all checks pass (identity verified, exclusion clear, no gaps), the tone is `clear` but the label is **"Checked"**. Downstream in interview and review, the same state renders as **"Clear"** via `resolveLivePathReadinessStatus(READY) → 'clear'`. A clinician who sees "Checked" on homepage then sees "Clear" on interview will wonder if something changed.
**Fix:** Change `READINESS_TONE_LABELS.clear` from `'Checked'` to `'Clear'` — or, if "Checked" is intentional for the preview context, add a visible transition note explaining the upgrade from "Checked" to "Clear" when entering passport.

### MISMATCH 2: Passport ingest uses "Verified" for identity; homepage uses "Identity checked"
**Location:** Passport `page.tsx` line 232 (`identityLabel = 'Verified'`), Homepage `ReadinessPreview.tsx` line 117 (`'Identity checked'`)
**Problem:** Same underlying state (`identity.authoritative === true` / `identityVerified === true`) renders as **"Verified"** on passport and **"Identity checked"** on homepage. The status is materially the same but the word choice implies different evidence thresholds.
**Fix:** Align to one term. Recommend **"Verified"** everywhere when the canonical truth is `VERIFIED`, and **"Checked"** only when `checked` source coverage without `satisfied: true`.

### MISMATCH 3: Review safety row uses `TrustLabel` statuses (`confirmed/review/blocked/missing`) instead of canonical `TrustUiStatus`
**Location:** `ReviewClient.tsx` line 88–120 (`buildSafetyRow`)
**Problem:** ReviewClient's `TrustLabel` component uses a **parallel status vocabulary** (`confirmed | review | blocked | missing`) that doesn't exist in the canonical truth spine. Meanwhile all other surfaces use `TrustStatusBadge` with canonical statuses (`verified | clear | checked | pending | …`). This is the biggest actual divergence — the review surface has its own status rendering path.
**Fix:** Either (a) migrate ReviewClient's safety/authority/enrollment rows to use `TrustStatusBadge` + canonical statuses, or (b) create an explicit mapping layer from `TrustLabel` statuses → canonical statuses and document it. Option (a) is cleaner for employer hardening.

### MISMATCH 4: Onboarding uses `TrustBand` (GREEN/YELLOW/RED) while all other surfaces use `ReadinessStatus` (READY/PARTIAL/BLOCKED)
**Location:** `OnboardingOrchestrator.tsx` line 9–10 (imports `TrustBand` from `trust-state/types`)
**Problem:** Onboarding fetches `TrustStateResponse` which includes `TrustBand: GREEN | YELLOW | RED`, but interview/review/passport all consume `PassportData.readiness.status: READY | PARTIAL | BLOCKED`. These are two different views of the same underlying state with no shared mapper.
**Fix:** Add a `mapTrustBandToReadinessStatus()` function or ensure onboarding also consumes `PassportData` shape. Without this, an onboarded clinician can see "GREEN" in onboarding but "PARTIAL" when they hit passport.

### MISMATCH 5: Interview "Verified now" tags use domain-specific language not used elsewhere
**Location:** `InterviewClient.tsx` lines 73–88 (`buildVerifiedTags`)
**Problem:** Tags like "Identity anchored", "Licensure attached", "Board evidence attached", "DEA evidence attached" only appear on interview. Homepage uses "Identity checked / OIG checked / Licensure checked". Review uses "Exclusion check" / "Medicare enrollment" / "Authority" as row labels. These are all describing the same credential lanes with different vocabulary.
**Fix:** Create a shared `CREDENTIAL_LANE_LABELS` constant that all surfaces consume, ensuring consistent language for each trust dimension.

---

## 4. Route Confusion Points

### CONFUSION 1: `/review` landing page points to both `/` and `/interview` without explaining the difference
**Location:** `apps/web/app/review/page.tsx`
**Problem:** The review landing says "Start from NPI lookup, then share when a real packet exists" and offers two CTAs: "Start with NPI lookup" (→ `/`) and "Packet preview" (→ `/interview`). But `/interview` requires an entityId or NPI param that the user doesn't have if they're landing cold on `/review`. Clicking "Packet preview" without context drops them into `InterviewBlockedState`.
**Fix:** Remove the "Packet preview" ghost CTA from the review landing, or route it to `/passport` which handles NPI entry gracefully. The review landing should have exactly one forward path: "Start with NPI lookup" → homepage → passport → interview → review.

### CONFUSION 2: Homepage "Continue to passport" goes to `/passport?npi=X` but passport page ignores the `?npi` query param
**Location:** `LiveTrustConsole.tsx` line 490 (`/passport?npi=${trimmed}`), `passport/page.tsx` line 178 (never reads searchParams)
**Problem:** The homepage carefully constructs a URL with `?npi=` but the passport page **starts from scratch** — it shows a blank NPI input field and ignores the query param. This means the clinician who just saw their readiness preview has to re-enter their NPI. This is the most user-visible parity break in the entire wedge.
**Fix:** Read `searchParams.npi` in the passport page and auto-trigger `startIngest(npi)` when present. This is likely a ~10-line change.

---

## 5. Packet Flow vs Homepage NPI Flow — Detachment Assessment

The homepage NPI flow produces a `ClinicianTrustState` (from `/api/trust-state/:npi`) which has a different shape from the `PassportData` (from `/api/passport/entity/:entityId`) that interview and review consume. This is the core detachment:

| Property | ClinicianTrustState (homepage) | PassportData (interview/review) |
|---|---|---|
| Readiness | `readiness_level` (L0–L3) + `readiness_score` + `readiness_status` | `readiness.status` (READY/PARTIAL/BLOCKED) + `readiness.score` + `readiness.estimatedStartDays` |
| Identity | `identityVerified: boolean` | `identity.npi` + `identity.displayName` + credential array |
| Exclusion | `exclusionClear: boolean` + `exclusionStatus` | `standing.exclusionStatus` (CLEAR/POSSIBLE_MATCH/EXCLUDED/UNCHECKED/UNKNOWN) |
| Gaps | `gap_summary: string[]` + `gaps: string[]` | `readiness.blockers: string[]` + `authority.summary.missing: string[]` |

**The passport ingest page (`/passport`) bridges this gap** — it runs its own ingest and produces a `PassportData` entity. But the *data from the homepage preview is thrown away* and never transferred. The passport page re-ingests from scratch.

**Assessment:** This is architecturally intentional (re-ingest ensures fresh data) but UX-confusing (user sees different numbers if the backend state changed between homepage and passport). The fix for CONFUSION 2 above (auto-ingest from `?npi=`) closes the gap for the user without changing the architecture.

---

## 6. GO / NO-GO for Packet/Employer Hardening

### Verdict: **CONDITIONAL GO**

The canonical truth spine is correctly wired. All surfaces ultimately derive from the same source coverage states and truth statuses. The five mismatches are **copy/vocabulary divergences**, not architectural breaks.

### Must-fix before employer hardening (blocks GO):

| # | Fix | Effort | Why |
|---|---|---|---|
| M2 | Align "Identity checked" → "Verified" across surfaces | S | Employer review will surface this inconsistency directly |
| M3 | Migrate ReviewClient TrustLabel to canonical TrustStatusBadge | M | Employer hardening directly touches this component |
| C2 | Auto-ingest from `?npi=` on passport page | S | Without this, the wedge feels broken at the seam |

### Should-fix (doesn't block but creates friction):

| # | Fix | Effort | Why |
|---|---|---|---|
| M1 | ReadinessTone label "Checked" → "Clear" | S | Prevents confusion between homepage preview and downstream surfaces |
| M4 | Add TrustBand → ReadinessStatus mapper for onboarding | S | Prevents GREEN/PARTIAL mismatch |
| M5 | Shared credential lane labels constant | M | Reduces vocabulary drift across future surfaces |
| C1 | Remove dead "Packet preview" CTA from review landing | S | Prevents dead-end navigation |

### Total estimated effort: 1 focused task wave (S–M complexity, ~6–8 hours Claude Code execution).
