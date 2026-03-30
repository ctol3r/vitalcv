# VitalCV — Wave 27 Buyer/Operator Audit
**Date:** 2026-03-28
**Auditor posture:** Two simultaneous lenses — (A) VP of Credentialing / Staffing Ops at a regional health system, and (B) Internal operator trying to run the first pilot case with a real buyer
**Scope:** Live site (main SHA `6de6c656` / Railway SHA `18162024c`) + pilot docs + source branches
**Method:** Live site fetches (5 routes), source code inspection, pilot doc review, runbook walkthrough
**Critical context:** `feat/buyer-conversion-wedge` and `fix/public-shell-parity` are NOT yet merged to main. The `/pilot` page, employer CTA, and pillar tightening from commit `2cb137df` are NOT live. This audit reflects what is on production right now.

---

## THE FIVE BUYER QUESTIONS

### 1. What is VitalCV?

**What the live homepage actually tells a buyer:**
"NPI first. Honest coverage." — a source-backed readiness snapshot from NPPES, OIG, and PECOS in ~10 seconds.

**Verdict: BARELY PASSES.**
The headline is honest and narrow. A clinician gets it immediately. A buyer — a VP of Credentialing who lands on this page — sees a tool that resolves NPI identity and sanctions in 10 seconds. That's credible and specific. What's missing: zero explicit framing for the *employer* persona. The hero speaks to clinicians. The buyer has to self-translate "what this means for my team" with no help. There is no above-the-fold line that says "Your team stops manually querying NPPES, OIG, and PECOS portals." That sentence does not exist anywhere on the homepage.

---

### 2. What should I do first?

**As a buyer (credentialing director):**
The nav says "Check Readiness" — which is the clinician action. "For Employers" exists in the nav and routes to `/employers`. The `/employers` page shows a Kaiser Permanente card with "38 open roles" and "Trust score 97" with **zero demo-data disclosure**. There is no "Request pilot access" CTA on the live `/employers` page — that's in the unmerged `feat/buyer-conversion-wedge` branch. The buyer's conversion path on production is: nothing.

**As an operator (me, trying to run the first pilot):**
The runbook says: go to vitalcv.com, enter NPI, get readiness, click "View Passport," navigate to `/review/request`, fill in NPI + context, get contextId, share the review link. The demo script lists specific NPIs that work. This is clear and executable.

**Verdict: BUYER = BROKEN. OPERATOR = FUNCTIONAL.**
A buyer who visits the live site today has no clear next step that is addressed to them. The runbook is well-structured and an operator can follow it. These are two entirely different states of readiness on the same live domain.

---

### 3. What do I get in the next 60 seconds?

**Tested path:** vitalcv.com → enter NPI → readiness snapshot.

The homepage delivers. The NPI input is the first thing you see. The source coverage table (NPPES: Checked, OIG: Checked, PECOS: Pending, CA Board: Access Required) is honest and specific. The "No signup required to preview" line is correct. The readiness reveal uses SSE streaming — NPPES appears first (~1s), OIG next (~2s), PECOS next (~3s). Each lane has a label: Checked / Pending / Access Required. This is the strongest part of the entire product surface.

**Critical flaw:** `/passport?npi=1003000126` does NOT pre-populate from the URL param. The page renders a blank form ("Check your readiness" + NPI input) regardless of the `npi=` param. This means the runbook step "navigate to /passport?npi=[NPI]" doesn't work as described — the operator must re-enter the NPI manually. This is a usability bug in the demo flow.

**Verdict: 60-SECOND PROMISE WORKS FOR NPI LOOKUP. PASSPORT URL DEEP-LINK DOES NOT.**

---

### 4. Can I understand what is proven vs. missing?

**Source coverage honesty:** Yes, and this is genuinely good. The four-lane source table (Checked / Pending / Access Required) is the most credible thing on the site. A buyer sees it and understands exactly what VitalCV has and doesn't have. No one can accuse you of hiding the state board gap.

**Claims credibility gaps (still live on production):**

| Claim | Location | Problem |
|-------|----------|---------|
| Kaiser Permanente card: "38 open roles," "Trust score 97," "Verified since 2021-03-01" | `/employers` | Zero demo-data disclosure. No amber banner. Fabricated social proof on a trust product. |
| "Use this surface for current directory counts..." | `/employers` (bottom) | Internal operator note rendering publicly. Confirms fake data exists AND that someone tried to hide it. Devastating. |
| Partners page: "Trusted by — Epic, Cerner, CAQH, Nursys, ABIM, Joint Commission" | `/partners` | VitalCV has zero partnerships with these organizations. Potential trademark exposure. |
| Partners page: 3-tier program with "up to 30% reseller margin," "deal registration portal," "dedicated partnership manager" | `/partners` | This infrastructure doesn't exist. If a real channel partner applies, there's no one to onboard them. |
| Investors page: "0+ Credentials Issued," "0 Active Verifiers" — unlabeled counters | `/investors` | The prior audit flagged hardcoded `DEMO_METRICS` at 12,847/284. These now show as zero but are still unlabeled. Zero is the correct number — but an unlabeled counter sitting at zero reads as broken, not honest. |

**Verdict: TRUST LAYER IS HONEST. CREDIBILITY LAYER HAS THREE P0 LANDMINES STILL LIVE.**

---

### 5. Can I understand how this reduces time to start?

**On the live site:** No. The homepage has no before/after comparison. There is no TTS framing, no "90 minutes → 15 seconds" copy, no FTE impact language. The value proposition is mechanism-first ("here's what we check") not outcome-first ("here's what this saves you").

**In the pilot docs:** Yes, and clearly. The Proof Pack, ROI Narrative, and Buyer Brief all articulate the 90 min → 15 seconds claim with real data (NPI 1003000126, 2026-03-28). The TTS cost model ($144K–$2.5M range, labeled as estimate) is well-calibrated. The state board limitation is honestly disclosed in every document. The ROI Narrative explicitly labels TTS reduction as a hypothesis until measured. This is the right discipline.

**Verdict: TTS STORY EXISTS IN DOCS, IS ABSENT FROM THE PRODUCT SURFACE.**
A buyer who only sees the website gets none of this. You're asking the outreach email to carry the entire value story — the site doesn't reinforce it.

---

## AUDIT BY SURFACE

### Homepage (`vitalcv.com`)

**What works:**
- "NPI first. Honest coverage." — clean, non-inflated headline
- Source coverage table is honest and specific
- "No signup required to preview" is correct
- Platform pillars (MATCHA, job board) are NOT visible on live — clean
- Nav primary CTA is "Check Readiness" — correct

**What doesn't work:**
- Entire page speaks to clinicians, not employers. The buyer has to translate.
- No before/after TTS framing above or below fold
- "For Employers" in nav routes to a directory page that reads like a developer test surface, not a buyer landing page
- No pricing signal whatsoever — not even "Contact us"
- No demo booking path (no Calendly, no "Book a 15-min call")

**Buyer rating: 5/10** — passes the smell test, fails the conversion test.

---

### Readiness Interaction (`/` — NPI flow)

**What works:**
- SSE streaming is responsive and feels fast
- Per-source status badges (Checked / Pending / Access Required) are correctly honest
- "No signup required" is true and visible
- Demo NPIs from the runbook (1003000126) work
- State board gap is surfaced clearly, not hidden

**What doesn't work:**
- `/passport?npi=[NPI]` URL param does NOT pre-populate the form. This breaks the runbook step "navigate to /passport?npi=[NPI]." An operator doing a live demo will hit a blank form instead of results.
- After readiness reveals, the transition to passport is unclear. The runbook says 'click "View Passport"' — this button exists but it's not visually prominent. In a screen-share demo scenario, an operator could lose the buyer here.
- PECOS showing "Pending" needs one additional sentence of explanation for a non-technical buyer ("PECOS refreshes quarterly — this is normal, not a problem").

**Operator rating: 7/10** — runnable with prep, fragile in a live demo without rehearsal.

---

### Passport (`/passport`)

**What works:**
- Identity / Sanctions / Enrollment grouping is logical
- Source attribution on each section is correct doctrine
- Page exists and loads for valid entity IDs

**What doesn't work:**
- `/passport?npi=[NPI]` doesn't work as a deep-link. URL param is ignored by the client-side render. The runbook references this URL pattern. It's broken.
- Passport is inspectable by the clinician, but there's no "share with employer" CTA that is obvious without account setup. A buyer in a demo can't cleanly trigger this step.
- "Trust Score 67/100" for NPI 1003000126 — what does 67 mean to an employer? There is no score key or interpretation guide visible to the employer. "L2 (Credentialed)" is better copy but appears only in the proof pack, not necessarily in the UI.

**Inspectability rating: 6/10** — technically correct, contextually incomplete.

---

### Employer Review (`/review/request`)

**What happens on production:**
The page renders a sign-in gate: "Employer review requests require an employer workspace. Sign in to create a review context and generate a shareable link."

**What this means for a live demo:**
An operator cannot show the employer review flow to a buyer without being signed in with an employer workspace. If you're doing a screen-share demo and navigate to `/review/request` unauthenticated, the buyer sees a wall, not a workflow. This is the most critical demo-flow issue. The demo script says "navigate to /review/request" — it will hit this gate.

**Verdict: EMPLOYER REVIEW FLOW IS AUTH-GATED AND INVISIBLE TO UNAUTHENTICATED BUYERS.**
In a screen-share pilot demo with a credentialing director who has no VitalCV account, you cannot show them what happens when they receive a review request. This needs a pre-authenticated demo workspace or a read-only preview mode.

---

### Partners Page (`/partners`)

**Live status:** "Trusted by — Epic, Cerner, CAQH, Nursys, ABIM, Joint Commission" is LIVE.
This is the single highest-risk page on the entire site. Any healthcare industry professional recognizes these organizations. Any one of them could trigger a cease-and-desist for implied endorsement. A YC partner who sees this will not ask about the product — they will ask about the legal exposure.

**Status:** P0. Must be removed before any external demo or buyer conversation that includes a link to the site.

---

### Pilot Proof Pack Docs

**Quality:** High. The proof pack is disciplined. Real data (NPI 1003000126, 2026-03-28T22:29Z). Limitations honestly labeled. TTS reduction marked as hypothesis. State board gap disclosed on every page. The ROI Narrative's cost model is conservatively calibrated with explicit "estimate" labels. The PILOT_PACK_INDEX document correctly scopes to one buyer / one workflow / one KPI.

**Usability:** Good for an operator who reads it in advance. Not self-explanatory for a first-time user. There's no "start here" indicator on the `/docs` folder. The three pilot documents are not linked from anywhere on the live site.

**Rating: 8/10** — solid content, zero discoverability.

---

### Runbook / Checklist / Tracker

**REAL_PILOT_RUNBOOK.md:** Well-structured. Simulation vs. real pilot distinction is explicit and enforced. Event chain (5 steps) is clearly documented. The outcome capture `curl` command works against the Railway backend. Pre-flight checks are specific and executable.

**REAL_PILOT_CHECKLIST.md:** Usable. Checkbox format. "Known Expected States" section correctly pre-handles the PECOS/state board confusion before the call.

**REAL_PILOT_EXECUTION_TRACKER.md:** Correct structure. One issue: the "Clinician Name" field in the demo script refers to "Sarah Chen MD" for NPI 1003000126. The live Proof Pack correctly identifies this NPI as "ARDALAN ENKESHAFI." The demo script is inconsistent with the proof pack. Whoever briefs a buyer using the demo script will say the wrong name.

**Operator usability: 7/10** — runnable by a prepared operator, has two specific traps (NPI deep-link broken, auth gate on review).

---

## TOP 5 MUST-FIX BEFORE FIRST LIVE PILOT

These are blocking. Any one of them can kill a buyer conversation or create legal/credibility damage.

### #1 — Partners page "Trusted by" logos: REMOVE IMMEDIATELY (P0 | XS | Legal/credibility risk)
Epic, Cerner, CAQH, Nursys, ABIM, and the Joint Commission are listed as organizations that trust VitalCV. None of them do. This is the highest-risk page on the site. It takes one healthcare executive to screenshot this and forward it to their legal team. Remove the "Trusted by" section entirely. Replace with nothing, or "Standards we build against" with protocol/standards logos only (W3C, OID4VCI, FHIR). This is a one-line code change with outsized credibility protection.

### #2 — `/employers` page: Kaiser card zero-disclosure and internal dev note (P0 | S | Credibility)
Two issues on the same page:
- Kaiser Permanente card shows "38 open roles," "Trust score 97," "Verified since 2021-03-01" with zero disclosure that this is demo data. Add the same amber demo-data banner that exists on `/explore`.
- "Use this surface for current directory counts and public role coverage. Employer cards and counts are pulled from the current directory feed." — this internal-facing note is rendering publicly. Delete it from the production build immediately.

### #3 — `/passport?npi=[NPI]` URL param not respected (P0 | S | Demo-flow breakage)
The runbook, demo script, and buyer brief all reference navigating to `/passport?npi=[NPI]` as a way to land directly on a clinician's passport. The live page ignores the URL param and renders a blank form. Every step of the demo flow that expects a NPI-prefilled passport will fail. Fix: read the `npi` search param on component mount and auto-trigger the ingest flow if present.

### #4 — No buyer conversion path exists on the live site (P0 | M | Revenue)
`feat/buyer-conversion-wedge` with the `/pilot` page and employer CTA is NOT merged to main. The live `/employers` page has no "Request pilot access" CTA. The live homepage has no "For credentialing teams" entry point. A buyer who visits the site has nowhere to go. The `/pilot` page (which routes to `mailto:pilots@vitalcv.com`) is implemented and correct — it just isn't live. Merge `feat/buyer-conversion-wedge`.

### #5 — Employer review flow is auth-gated with no demo bypass (P0 | M | Demo-flow breakage)
`/review/request` requires an authenticated employer workspace. An operator running a live demo on a fresh session cannot show the employer review workflow to a buyer. Before any live pilot demo: either (a) pre-authenticate with a demo employer workspace and keep it open, (b) create a read-only preview mode that shows the review form without requiring auth, or (c) document the workaround explicitly in the demo script. Currently the demo script says "navigate to /review/request" with no auth warning. This will produce a sign-in wall in a live demo.

---

## TOP 5 SAFE TO DEFER

These matter but won't kill a first pilot.

### #1 — Investors page unlabeled zero-counters (P1 | XS)
The counters at 0 are honest (they were 12,847 in code; they're now zeroed). But an unlabeled counter at zero reads as broken, not truthful. Add "No data yet — pilot in progress" or simply remove the counters section until there's real data. Safe to defer because investors page is unlikely to be in the buyer demo flow.

### #2 — No TTS framing on the homepage (P1 | M)
The "90 min → 15 seconds" story lives entirely in the pilot docs and outreach emails. It's absent from the product surface. This is the single most compelling claim and should be above the fold for buyers. Defer because the pilot can run without it — the outreach email carries the story for now. Add before the first paid customer conversation.

### #3 — Demo script NPI name mismatch (P1 | XS)
`PILOT_DEMO_SCRIPT.md` calls NPI 1003000126 "Sarah Chen MD." `PILOT_PROOF_PACK.md` correctly identifies the same NPI as "ARDALAN ENKESHAFI." Fix the demo script. Safe to defer because it's a doc-only fix that an operator will notice and correct on first use.

### #4 — PECOS "Pending" needs buyer-facing explanation in UI (P2 | S)
"CMS PECOS: Quarterly enrollment data — Pending" is honest but jarring to a first-time buyer who doesn't know what quarterly refresh means. A single sentence ("PECOS data refreshes every 90 days — Pending means no active quarterly record, not an enrollment problem") in the passport UI would prevent 10 minutes of explanation per demo. Defer because the checklist already handles this conversationally.

### #5 — Partners page tier/revenue structure (P2 | M)
Even after removing the "Trusted by" logos, the 3-tier partner structure with 30% reseller margins implies operational capacity that doesn't exist. Safe to defer because buyers don't visit the partners page — it's for future BD infrastructure. Replace the whole page with a simple "Interested in integrating? Contact us" page when you have BD bandwidth.

---

## GO / NO-GO VERDICTS

### GO / NO-GO: First Pilot Execution

**CONDITIONAL GO — with operator pre-flight required.**

The core workflow is real and functional: NPI → readiness → passport → employer review → outcome capture. The Railway backend is healthy (SHA `18162024c`, status: ok). NPPES and OIG are live. The runbook is executable. The pre-flight checklist is specific. The KPI event chain is instrumented.

**But: do not attempt a live demo without these three pre-conditions:**
1. **Must-fix #3 resolved OR operator knows the workaround:** Pre-enter NPI manually on the passport page — do not rely on URL deep-link.
2. **Must-fix #5 resolved OR operator is pre-authenticated:** Keep an employer workspace session open before the call. Do not navigate to `/review/request` cold.
3. **Must-fix #1 and #2 resolved:** Remove "Trusted by" logos and Kaiser card disclosure before sharing the site URL with any external person.

Without these three, the pilot demo carries live credibility landmines and a broken demo flow.

---

### GO / NO-GO: Proof Pack in Buyer Conversations

**GO — with one condition: do not share the site URL until must-fix #1 and #2 are resolved.**

The proof pack documents (`PILOT_PROOF_PACK.md`, `PILOT_ROI_NARRATIVE.md`, `PILOT_BUYER_BRIEF.md`) are honest, disciplined, and grounded in real system data. The TTS claims are labeled as estimates. The state board gap is disclosed on every page. A credentialing director who reads these documents will get an accurate picture of what VitalCV does today.

The risk: if a buyer visits `vitalcv.com/partners` after reading the proof pack, they will see fabricated logos from companies they work with daily. That destroys the credibility the proof pack built. Fix the partners page first, then share the site URL. The proof pack alone — sent as a document, not linked to the live site — is ready to use now.

---

## ONE-SENTENCE VERDICT

> The core product works and the pilot docs are honest, but the site still has three pages (`/partners`, `/employers`, and the missing `/pilot` CTA) that will end the conversation before it starts — **it reads like a well-built prototype whose marketing layer hasn't caught up to its own discipline.**
