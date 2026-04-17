# Employer-Request Context Flow Audit

**Auditor:** Claude (VitalCV strategic/technical operator)
**Date:** 2026-03-27
**Scope:** Real employer-review action flow — both POVs, auth/failure states, operational readiness
**Files reviewed:** 14 files across backend services, API routes, frontend proxy, ReviewClient, VerifierPortal, EmployerDashboard, StartClinicianAction, request context, types, tests

---

## Executive Summary

The employer-request context flow is **production-grade on the backend** and **operationally sound on the employer decision surface**. The trust snapshot capture, transactional audit trail, and action persistence are rigorous. The frontend ReviewClient implements a clean 6-question employer flow with appropriate auth gating and failure states. Two significant gaps exist: the clinician has **zero visibility** into employer actions taken against their passport, and the VerifierPortal still carries demo-era mock patterns that diverge from the canonical review flow. Neither gap is a merge blocker for the M2 wave, but the clinician-side gap must be addressed before pilot launch.

**Verdict: GO for merge. Conditional on clinician notification being roadmapped for M3.**

---

## 1. Employer POV Audit

### What works well

**Decision surface (ReviewClient.tsx)** — this is genuinely good:

- **6-question layout** (Identity → Safety → Authority → Eligibility → Blockers → Next actions) maps directly to what an employer credentialing coordinator actually needs to answer. No tabs, no sidebars. Operational, not theatrical.
- **Three-action panel** (Accept as head start / Request refresh / Route to review) covers the real decision space. The "Accept as head start" label correctly frames acceptance-with-known-gaps, which is how healthcare hiring actually works.
- **Auth gating is clean.** Four-level cascade: Clerk disabled → not loaded → not signed in → not employer role. Each state renders a specific, understandable message in the preview-only banner. Actions are hard-disabled (not hidden) so the employer sees what's available before authenticating.
- **Trust snapshot at decision time** is captured BEFORE the transaction and stored immutably in the audit event. This is the right pattern — the employer's decision is bound to the exact passport state they saw, not whatever it evolves to later.
- **Loading/success/error states** are real: loading says "Writing the persisted audit record...", success shows the audit event ID and trust snapshot receipt hash, error shows the actual message with a retry button. No fake success states.
- **Duplicate acceptance guard** returns 409 with the existing acceptanceId. Frontend doesn't handle this gracefully yet (see gaps), but backend is correct.
- **Evidence packet export** writes an ARTIFACT_EXPORTED audit record before returning the payload. Export is never silent.

### Employer POV Issues

| # | Severity | Issue | Detail |
|---|----------|-------|--------|
| E1 | **Medium** | No confirmation dialog before accept | One click on "Accept as head start" immediately fires the POST. For a hiring decision that writes to an immutable audit ledger, there should be a "Confirm: you're accepting Dr. X with N blockers noted?" step. The cost of an accidental click is an indelible audit record. |
| E2 | **Low** | 409 duplicate acceptance surfaces as generic error | `postAction` catches non-ok responses and throws `error_description ?? 'Action failed (409)'`. The backend sends `already_accepted` with the existing `acceptanceId`, but the frontend error handler doesn't special-case this. The employer sees "Action failed" instead of "You've already accepted this clinician." |
| E3 | **Low** | Request-refresh body is auto-populated silently | `handleRequestRefresh` auto-fills `staleSources` and `missingDomains` from the freshness entries, but the employer never sees or confirms what's being requested. They click "Request refresh (2 stale)" and have no opportunity to add context or select specific sources. |
| E4 | **Info** | Route-to-review auto-generates the reason string | The reason is built programmatically from blockers. An employer might want to write a note. The field exists on the backend (`reason: string`) but the UI doesn't expose a text input for it. |
| E5 | **Info** | No "undo" or "amend" for any action | Once accepted, the employer can't revoke or amend. This is by design (immutable audit trail), but there's no copy explaining this permanence to the employer before they act. |
| E6 | **Low** | VerifierPortal diverges from canonical flow | VerifierPortal uses hardcoded `clinician:alice` / `employer:alpha` IDs and routes through `/trust-state`, `/acceptances`, `/verify` — a completely different API surface from the canonical `employer-review` routes. It's demo-era code. If this is still linked from any employer-facing path, it will confuse users. |

---

## 2. Clinician POV Audit

### What works well

- **The passport data itself** is well-structured. The clinician's identity, credentials, standing, and readiness are all hydrated from real primary sources with freshness metadata.
- **The share link flow** (`?from=` + `?contextId=`) lets a clinician share their passport review URL with an employer. The review page shows "Shared by" context cleanly.

### Clinician POV Issues

| # | Severity | Issue | Detail |
|---|----------|-------|--------|
| C1 | **HIGH** | Clinician has ZERO visibility into employer actions | There is no clinician-facing UI, API, or notification for: acceptance, refresh request, or route-to-review. The clinician shares their passport, then hears nothing. The outbox events are written but no consumer delivers them to the clinician. This is the #1 UX gap in the entire flow. |
| C2 | **HIGH** | Refresh requests go to outbox but never reach the clinician | `recordEmployerReviewRefreshRequest` writes to `outboxEvent` with status PENDING, but there is no outbox consumer, no email trigger, no in-app notification. The employer thinks they've asked for updated data; the clinician never knows. |
| C3 | **Medium** | No clinician consent or intent binding for share | The clinician can share a URL, but there's no explicit intent assertion ("I'm sharing my VitalCV passport with Employer X for the purpose of Y"). Per VitalCV doctrine, this should be a QIA-bound event with purpose binding between holder and verifier. Currently it's just a URL with a `from` query param. |
| C4 | **Medium** | No revocation of shared access | Once shared, the clinician cannot revoke the employer's access to their review page. The passport endpoint (`/api/passport/entity/:entityId`) has no access control — it serves the passport to anyone with the entityId. |
| C5 | **Low** | No clinician-side record of what was shared | The `fireReviewOpenedEvent` fires server-side when the employer opens the review, but this is a KPI event — the clinician has no dashboard or log showing "Employer X viewed your passport on Date Y." |

---

## 3. Auth & Failure States Assessment

| State | Handling | Verdict |
|-------|----------|---------|
| Clerk disabled (dev/test) | Preview-only banner, actions disabled, explicit message | ✅ Correct |
| Clerk loading | "Checking employer session before enabling actions" | ✅ Correct |
| Not signed in | "Preview only. Sign in with an employer workspace to persist decisions." + sign-in link | ✅ Correct |
| Signed in, not employer role | "Preview only. Switch into an employer workspace to persist decisions." | ✅ Correct |
| Entity not found | Server-side 404 → "Employer review unavailable" card with retry + home links | ✅ Correct |
| Backend action fails | Error message shown with "Try again" button | ✅ Correct |
| Network failure on action | `resolveLivePathErrorMessage` catches and surfaces message | ✅ Correct |
| Duplicate acceptance (409) | Backend correct, frontend renders as generic error | ⚠️ Needs special-case handling (E2) |
| Missing x-clerk-user-id | Backend returns 401, proxy returns 401 with "Sign in with an employer workspace" | ✅ Correct |
| Passport build fails | `buildDecisionTrustSnapshot` returns minimal fallback, never blocks the action | ✅ Correct — degraded but never broken |

---

## 4. "Operational, Not Theatrical" Assessment

**Backend: Fully operational.**
- Transactional writes (acceptance + outbox + audit in one $transaction)
- SHA-256 hash-linked audit events
- Deduplication keys on outbox events
- SEAL fire-and-forget for KPI capture that never blocks the critical path
- Sanitization of all user inputs (string length limits, dedup, priority normalization)

**Employer frontend: Operational with minor theatrical edges.**
- The action panel is real — buttons fire real POSTs, success shows real audit IDs
- The `SectionReveal` animations and progressive disclosure are tasteful, not gratuitous
- The freshness panel and source coverage panel surface genuine operational data
- Minor theatrical concern: the `VerifierPortal` and `StartClinicianAction` components feel like demo-day artifacts (hardcoded IDs, "ZK Terminal" language, "ON Loop" branding) that shouldn't be reachable from production paths

**Clinician frontend: Not operational — doesn't exist yet.**

---

## 5. Top UX Gaps (Ranked)

1. **Clinician notification void** — Employer actions (accept, refresh, route-to-review) write audit events but never reach the clinician. This makes the two-sided marketplace one-sided. *(C1, C2)*

2. **No confirmation before irreversible accept** — One click writes an indelible audit record. Healthcare credentialing decisions warrant a confirmation step. *(E1)*

3. **No intent/consent binding on share** — Sharing a passport URL should be a QIA-bound event per VitalCV doctrine, not an untracked URL pass. *(C3)*

4. **409 duplicate acceptance rendered as error** — Employer sees "Action failed" when they've already accepted. Should say "Already accepted" with the existing acceptance context. *(E2)*

5. **Refresh request is fire-and-forget from employer UX** — Employer clicks "Request refresh," gets audit confirmation, but has no way to see if the clinician acted on it. No status tracking of the request lifecycle. *(E3, related to C2)*

---

## 6. Verdict

### GO for merge.

The employer-review action flow (M2: Accept with Confidence) is structurally sound. The backend is production-grade: transactional, auditable, hash-linked, deduplicated, and degradation-safe. The employer decision surface is operationally honest — real data, real actions, real audit receipts. Auth/failure states handle all known edge cases correctly.

### Conditions for pilot launch (must be roadmapped for M3):

- **MUST:** Clinician notification on employer actions (at minimum: email or in-app for acceptance and refresh request)
- **MUST:** Confirmation dialog before accept action
- **SHOULD:** Intent-binding on passport share (QIA event)
- **SHOULD:** Special-case 409 handling in frontend
- **NICE:** Clinician-side dashboard showing "who viewed / acted on my passport"

### Not blocking merge:

- VerifierPortal demo code (separate cleanup task)
- Refresh request text input (enhancement)
- Route-to-review reason input (enhancement)
