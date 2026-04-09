# VitalCV Truth Purge Checklist

**Date:** 2026-04-09
**Auditor:** Claude Cowork (Opus)
**Scope:** All buyer-facing, holder-facing, and employer-facing UI surfaces
**Active Source Spine:** NPPES, OIG/LEIE, CMS PECOS only
**Not Integrated (must not appear as live):** DEA, ABMS, NPDB, SAM.gov, Doximity, Nursys (gated), FSMB (gated)

---

## P0 — Must Fix Before Any External Demo

### TP-01: ReadinessDemo.tsx — "Real verification running in production" on simulated data

**File:** `apps/web/components/marketing/ReadinessDemo.tsx`
**Lines:** 249
**Current:** `"Real verification running in production"`
**Problem:** Footer claims real production verification while the component header (line 4) explicitly declares "fully simulated." This is a direct contradiction.
**Fix:** Change to `"Simulated readiness output — see real results at /get-ready"`

### TP-02: ReadinessDemo.tsx — "Real readiness data, real verified sources"

**File:** `apps/web/components/marketing/ReadinessDemo.tsx`
**Lines:** 121
**Current:** `"Real readiness data, real verified sources, real blockers — surfaced instantly."`
**Problem:** The demo profiles show DEA, ABEM, ABA, Hospital Privileges — none of which are in the active source spine. These are not "real verified sources."
**Fix:** Change to `"See how VitalCV surfaces readiness, verified sources, and blockers — in seconds."`

### TP-03: ReadinessDemo.tsx — DEA and Board Certification in demo profiles

**File:** `apps/web/components/marketing/ReadinessDemo.tsx`
**Lines:** 31, 32, 55, 70, 71, 73
**Current:** Demo profiles include DEA Registration (issuer: "DEA Office"), Board Certification (issuer: "ABEM", "ABA"), Hospital Privileges (issuer: "NYU Langone")
**Problem:** DEA, ABMS board certs, and facility privileges are not in the active source spine. Showing them in a demo implies they are verified capabilities.
**Fix:** Replace demo credential sets with only sources we actually verify: NPI Identity (NPPES), OIG/LEIE Exclusion Check, CMS PECOS Enrollment, State Medical License (via configured state board lane). Add a note for board cert and DEA: `{ label: 'DEA Registration', issuer: 'Not yet integrated', date: '—', gated: true }` with a lock icon, or remove entirely.

### TP-04: ReadinessDemo.tsx — "Live demo" label on simulated component

**File:** `apps/web/components/marketing/ReadinessDemo.tsx`
**Lines:** 115
**Current:** `"Live demo — no login required"`
**Problem:** "Live" implies real data. This is hardcoded simulated data.
**Fix:** Change to `"Sample readiness output — no login required"`

### TP-05: Hero.tsx — FSMB listed as active source

**File:** `apps/web/components/marketing/Hero.tsx`
**Lines:** 72-75
**Current:** FSMB shown as a source icon at equal weight with NPPES, OIG/LEIE, PECOS
**Problem:** FSMB requires an institutional agreement and is not integrated. Displaying it alongside active sources implies it is live.
**Fix:** Remove the FSMB icon entirely, or add a lock icon + "Institutional access required" label beneath it. Active spine display should be: NPPES, OIG/LEIE, PECOS only.

### TP-06: HeroSection.tsx — DEA in MOCK_CREDENTIALS

**File:** `apps/web/components/marketing/HeroSection.tsx`
**Lines:** 16-20
**Current:** `MOCK_CREDENTIALS` includes `{ label: 'DEA', level: 'L1', color: 'var(--claim-l1)' }`
**Problem:** DEA is not in the active source spine. Showing it as a credential level implies integration.
**Fix:** Replace "DEA" with "OIG/LEIE Clearance" or "PECOS Enrollment" — sources we actually check.

### TP-07: HeroSection.tsx — NCQA in compliance marquee without qualifier

**File:** `apps/web/components/marketing/HeroSection.tsx`
**Lines:** 14
**Current:** `const COMPLIANCE_ITEMS = ['NCQA', 'CMS', 'HIPAA', 'OID4VCI', 'ES256'] as const;`
**Problem:** NCQA listed without "aligned" qualifier. We are not NCQA-certified.
**Fix:** Change 'NCQA' to 'NCQA-aligned' and 'HIPAA' to 'HIPAA-aligned'. Or restructure: `['HIPAA-aligned', 'NCQA CR1-CR5', 'CMS §482.12', 'OID4VCI', 'ES256']`

---

## P1 — Fix Before Pilot Deployment

### TP-08: HeroSection.tsx — "NCQA-compliant primary source verification"

**File:** `apps/web/components/marketing/HeroSection.tsx`
**Lines:** ~92-94
**Current:** `"VitalCV automates NCQA-compliant primary source verification — generating audit-ready credential artifacts that cut onboarding from months to days."`
**Problem:** "NCQA-compliant" is an unearned certification claim. "audit-ready" without SOC 2 or formal audit backing.
**Fix:** `"VitalCV automates primary source verification aligned to NCQA CR1-CR5 standards — generating credential artifacts that cut onboarding from months to days."`

### TP-09: HomeSections.tsx — "6.8M... every one needs credentialing"

**File:** `apps/web/components/marketing/HomeSections.tsx`
**Lines:** ~295
**Current:** `"6.8M licensed US healthcare workers — every one needs credentialing"`
**Problem:** Absolute market claim. Not every licensed worker needs third-party credentialing.
**Fix:** `"6.8M licensed US healthcare workers — and every employer re-verifies them from scratch"`

### TP-10: passport-review-truth.ts — DEA and ABMS in review display logic

**File:** `apps/web/lib/trust/passport-review-truth.ts`
**Lines:** 174-177, 238, 242-250, 468, 545
**Current:** Active code paths reference DEA_REGISTRATION domain and ABMS board certifications, including `buildMissingAuthorityItem` that creates missing DEA items in employer review.
**Problem:** These display DEA as a credential authority to employers despite it being outside the active source spine. Employer sees "No attached DEA registration proof is available" — implying VitalCV should have checked it.
**Fix:** Gate DEA/ABMS display behind feature flags. When DEA_REGISTRATION or BOARD_CERTIFICATION domains are encountered and the source is not in the active spine, display: "Source not yet integrated — not included in this review" with a lock icon rather than a missing-evidence framing.

### TP-11: passport-truth.ts — DEA in credential display mapping

**File:** `apps/web/lib/trust/passport-truth.ts`
**Lines:** ~200, ~228
**Current:** Maps `DEA_REGISTRATION` domain to "DEA registration" for holder-facing display
**Problem:** Implies DEA verification is a capability of the system.
**Fix:** Gate behind feature flag or show as "Not yet available" with lock icon.

---

## P2 — Fix Before Marketing Launch

### TP-12: GraphPreview.tsx (marketing app) — DEA as graph node

**File:** `apps/marketing/components/marketing/GraphPreview.tsx`
**Lines:** 12, 44-45
**Current:** DEA hardcoded as node in credential graph visualization. Copy states: "NPI, state licenses, board certifications, DEA registrations"
**Problem:** DEA and board certifications shown as connected, verified nodes in the graph.
**Fix:** Remove DEA node. Replace copy with: "NPI identity, exclusion status, Medicare enrollment, and state licensure"

### TP-13: VerifierSection.tsx (marketing app) — NCQA timeline claims

**File:** `apps/marketing/components/marketing/VerifierSection.tsx`
**Lines:** 4, 6
**Current:** "Stay within NCQA 180-day timelines automatically" and "Export audit-ready artifacts for accreditation"
**Problem:** Claims automated NCQA compliance and audit-readiness without certification.
**Fix:** "Track verification freshness against NCQA 180-day standards" and "Export credential evidence packets for review"

### TP-14: SecurityStandards.tsx (marketing app) — Standards as implemented

**File:** `apps/marketing/components/marketing/SecurityStandards.tsx`
**Lines:** 1-22
**Current:** OpenID4VCI, HAIP 1.0, ES256-only, DPoP + PKCE listed as implemented features
**Problem:** Presented as live capabilities without "targets" or "designed for" qualifier.
**Fix:** Add section header: "Standards We Build To" or "Compliance Architecture" to frame as design targets, not certifications.

### TP-15: HowItWorks.tsx (marketing app) — W3C VC as current capability

**File:** `apps/marketing/components/marketing/HowItWorks.tsx`
**Lines:** 12
**Current:** "Credentials are verified against primary sources and anchored as W3C Verifiable Credentials with ES256 signatures"
**Problem:** W3C VC issuance presented as current production capability.
**Fix:** "Credentials are verified against primary sources. The system is designed to issue W3C Verifiable Credentials with ES256 signatures." or verify that the issuer-api is actually producing VCs in production and keep as-is.

---

## Holder UI — Mock State Audit

### TP-16: passport/page.tsx — Sample readiness card (COMPLIANT)

**File:** `apps/web/app/passport/page.tsx`
**Lines:** 566-593
**Status:** PASS. Clearly labeled "This is a sample — enter your NPI to see real results" at line 591.
**Action:** No change needed.

### TP-17: passport/page.tsx — State board as "Access required" (COMPLIANT)

**File:** `apps/web/app/passport/page.tsx`
**Lines:** 256-281
**Status:** PASS. `formatLicenseState()` returns "Access required" for state board licenses. Correctly gated.
**Action:** No change needed.

### TP-18: onboarding/page.tsx — Redirect only (COMPLIANT)

**File:** `apps/web/app/onboarding/page.tsx`
**Lines:** 3-5
**Status:** PASS. Redirects to `/`. No misleading UI.
**Action:** No change needed.

---

## Employer Review Dashboard — Provenance Audit

### TP-19: ReviewClient.tsx — Provenance tracking (COMPLIANT)

**File:** `apps/web/components/review/ReviewClient.tsx`
**Lines:** 91-149
**Status:** PASS. Every credential row includes:
  - Source name (truth.sourceName)
  - Timestamp (observedAt or verifiedAt)
  - Coverage reason for gated/review_required states
**Action:** No change needed — but see TP-10 for DEA/ABMS items that shouldn't appear at all.

### TP-20: SourceHealthPanel.tsx — Source health display (COMPLIANT)

**File:** `apps/web/components/pilot-ops/SourceHealthPanel.tsx`
**Lines:** 147-149
**Status:** PASS. Displays source.name + source.lastSuccessAt for each spine source.
**Action:** No change needed.

### TP-21: Public profile proof artifacts (COMPLIANT)

**File:** `apps/web/app/p/[slug]/page.tsx`
**Lines:** 102-107
**Status:** PASS. NpiProfile type includes proof object with jsonUrl, pdfUrl, auditBundleJson, auditBundleDownload.
**Action:** No change needed.

---

## Summary

| Priority | Violations | Files |
|----------|-----------|-------|
| P0 | 7 items (TP-01 through TP-07) | ReadinessDemo.tsx, Hero.tsx, HeroSection.tsx |
| P1 | 4 items (TP-08 through TP-11) | HeroSection.tsx, HomeSections.tsx, passport-review-truth.ts, passport-truth.ts |
| P2 | 4 items (TP-12 through TP-15) | GraphPreview.tsx, VerifierSection.tsx, SecurityStandards.tsx, HowItWorks.tsx |
| Compliant | 6 items (TP-16 through TP-21) | passport/page.tsx, onboarding/page.tsx, ReviewClient.tsx, SourceHealthPanel.tsx, p/[slug]/page.tsx |

**Total violations requiring fixes: 15**
**Total compliant items: 6**
**Estimated effort: ~3 hours of focused Claude Code work**

---

## Execution Notes

All P0 and P1 fixes are copy/config changes — no schema migrations, no new packages, no API changes. These should be executed as a single Claude Code task wave with `pnpm lint` and `pnpm tsc --noEmit` validation after each file.

The P1 items in `passport-review-truth.ts` and `passport-truth.ts` require feature-flag gating rather than removal, since the DEA/ABMS domain types exist in the domain model and may be activated when those sources come online.

Do not remove domain types from `packages/domain-common` — only gate their UI display.
