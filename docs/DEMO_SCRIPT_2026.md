# VitalCV Demo Script — updated 2026-07-27

> **Live product demo is unavailable.** Do not demo against a real clinician's NPI.
> Use the founder-only video plus the narrative below for this submission. A live
> walkthrough returns once there is an explicitly consented, founder-controlled
> clinician fixture. See [Demo posture](#demo-posture).

## The Wedge (60-second version)

VitalCV is the verified clinician identity graph. It starts with an NPI and produces a
portable, audit-ready trust packet that an employer can accept as a head start — instead
of rebuilding from scratch.

---

## Demo posture

**What we use right now:** a founder-only recorded video, plus the honest product
narrative in this document.

**What we do not do:**

- ❌ Do not type a real clinician's NPI into a buyer-facing or recorded demo. Every NPI
  in the public registry belongs to a real registrant who has not consented to being a
  demo subject.
- ❌ Do not seed fabricated identities to stand in for one. Ten fabricated profiles were
  previously seeded onto real NPIs (`1003000126` and nine others); they misattributed
  those NPIs and blocked the real registrants from claiming them. They have been removed,
  and `seed-provider-intelligence.ts` now refuses to run against a non-local database.
- ❌ Do not describe a demo record as "pre-seeded" and "READY". That framing is what made
  fabricated data read as verified.

**What unblocks a live demo:** an explicitly consented, founder-controlled clinician
fixture — a real person who has agreed, in writing, to their record being shown. Until
that exists, the product walkthrough stays deferred.

---

## Narrative (what the product does)

Describe the flow; do not perform it against a real registrant.

1. **NPI is the identity anchor.** The clinician enters their own NPI. NPPES resolves
   identity; the OIG/LEIE exclusion check and PECOS enrollment check run against federal
   primary sources.
2. **The passport is the portable record.** Identity, readiness items, trust posture
   (score + band L0–L3 with a dimension breakdown), and a source-by-source detail view.
   Trust posture is computed from verified primary sources — not an AI score.
3. **The clinician shares, the employer receives.** One packet link; the employer does
   not request documents.
4. **The employer reviews a record, not a document pile.** Same posture the clinician
   sees, plus accept-as-head-start / request-refresh / route-to-review.
5. **Workforce context is enrichment.** Shortage geography and institutional coverage
   inform; they never gate readiness.

**What to say**: "This is the entire trust stack for a clinician — federal primary
sources, no uploads, no forms, no committee. Every dimension is explainable and every
source is named."

---

## What's Live Today

| Feature | Status |
|---|---|
| NPI → NPPES live lookup | ✅ Live |
| OIG LEIE sanctions check | ✅ Live |
| PECOS enrollment check | ✅ Live |
| Trust posture (L0–L3) | ✅ Live (surfaced in Passport + Review) |
| Portable packet / share | ✅ Live |
| Employer trust review | ✅ Live |
| MS16 PECOS 4-way status | ✅ Live |
| Document intelligence (OCR) | ✅ Live |
| Global Intelligence Map | ✅ Live |
| Nursys licensure check | ⚙️ Requires institutional access |
| FSMB board status | ⚙️ Requires institutional access |
| OFAC SDN check | ⚙️ Pipeline wiring pending (~1 sprint) |

## What to Avoid Saying

- ❌ "Here's a demo clinician" while showing a real registrant's NPI — they did not consent
- ❌ "Pre-seeded demo, READY" — seeded data must never be presented as a verified record
- ❌ "AI-powered credentialing" — it's primary-source verification, not AI
- ❌ "Fully automated credentialing" — trust posture informs, employers decide
- ❌ "Board certification verified" — ABMS not yet integrated
- ❌ "DEA verified" — DEA not yet integrated
- ❌ "Privileges approved" — VitalCV does not issue privileges
- ❌ "NCQA certified" — designed for NCQA alignment, not yet accredited

## What to Emphasize

- ✅ Verified from federal primary sources (NPPES, OIG, PECOS)
- ✅ Portable — clinician shares once, employers receive the same verified record
- ✅ Explainable — every dimension is named, every source is cited
- ✅ Head start — not a replacement for credentialing committee, but a verified foundation
- ✅ Trust posture — quantified, versioned, auditable
