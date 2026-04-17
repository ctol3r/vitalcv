# VitalCV Public Shell Truth Audit — 2026-03-28

**Auditor:** Claude (Strategic + Technical Operator)
**Scope:** All public entry points post-truth-cleanup merge
**Verdict:** **NO-GO** — 4 P0 issues remain

---

## Executive Summary

The truth cleanup campaign (~15 commits) significantly improved the homepage hero and passport flow. The NPI-first entry, honest source-coverage labels ("Checked," "Pending," "Access Required," "Preview-only"), and unified `/passport` CTA are solid. However, the cleanup was concentrated on the top-of-funnel flow and **did not reach four other public pages** that still tell a fundamentally different story than the wedge. The partners page fabricates trust logos, the investors page renders hardcoded demo metrics as traction, and the homepage platform section still pitches a job board + AI matching engine. These cannot ship to anyone doing diligence.

---

## The 5 Key Questions

### 1. What does VitalCV do (as told by the live entry story)?

The homepage hero now tells it correctly: enter your NPI → get a source-backed readiness snapshot in ~10 seconds → carry that snapshot into a passport for employer conversations. The "How It Works" section reinforces this. **But scroll past the fold** and the story fractures — a "Platform" section describes a free job board, AI career matching (MATCHA), and clinic capacity intelligence. A visitor who reads the whole page gets two different products.

### 2. What should I do first?

**Depends which navbar you hit.** The layout `Navbar.tsx` sends you to `/passport` ("Check Readiness"). The marketing `Navbar.tsx` sends you to `/onboarding` ("Get Started"). Both are in the codebase. The homepage hero NPI input is the strongest CTA — but it competes with nav-level confusion.

### 3. What is still preview-only?

The hero and passport flow now label preview-only states explicitly and honestly. The `/labs` page distinguishes "Stable," "Preview," "Experiment," and "Internal" correctly. The developers page carries a "Developer Portal Preview" badge. **This is the cleanest part of the cleanup — well done.**

### 4. Does the developers page still imply a bigger company/product than the wedge?

**Yes, significantly.** Three full SDKs (`@vitalcv/verifier-sdk`, `@vitalcv/issuer-sdk`, `@vitalcv/wallet-sdk`) are documented with 20+ methods each. A drop-in widget claims to be hosted at `cdn.vitalcv.com`. Trust governance rules, conformance reports, HealthStart control inheritance (SaaS / PrivateVPC / GovEnclave profiles), and gateway connections all imply a mature platform with federation infrastructure. The "Preview" badge helps, but the volume of documented surface area reads like a Series B developer portal, not a seed-stage wedge.

### 5. Does any public entry point still feel like a different story than the real product?

**Yes — three pages feel like separate products:**
- `/partners` — a fully structured 3-tier partner program with revenue share, reseller margins, and fabricated "Trusted by" logos (Epic, Cerner, CAQH, Joint Commission)
- `/investors` — hardcoded `DEMO_METRICS` (12,847 credentials issued, 284 active verifiers) rendered without any "illustrative" label
- Homepage "Platform" section — pitches a job board and AI career engine

---

## Top 8 Remaining Issues

### P0 — Must Fix Before Merge (Credibility / Legal Risk)

**#1. Partners page: Fabricated "Trusted by" logos**
`app/partners/page.tsx:146-150`
The page renders "Trusted by leading healthcare organizations" with Epic, Cerner, CAQH, Nursys, ABIM, and Joint Commission names. VitalCV has zero partnerships with any of these organizations. This is the single most damaging finding — any healthcare insider who sees this will immediately distrust everything else on the site. Potential trademark risk.
**Fix:** Remove the entire "Trusted by" section. Replace with nothing, or "Standards we build against" with protocol logos (W3C, OID4VCI, etc.) instead of company names.
**Effort:** S

**#2. Investors page: Hardcoded demo metrics rendered as traction**
`app/investors/page.tsx:14-18`
`DEMO_METRICS` object renders 12,847 credentials issued, 284 active verifiers, 1,923 network nodes, and 2 federated networks. The variable is literally called `DEMO_METRICS` in code but renders on-page with animated counters and no "illustrative" or "projected" label. An investor who screenshots this has fabricated traction numbers from VitalCV.
**Fix:** Either (a) pull real metrics from the API and show actual numbers, or (b) remove the metrics section entirely, or (c) add a prominent "Illustrative — not live data" label. Option (b) is safest.
**Effort:** S

**#3. Homepage "Platform" section: Job board + MATCHA + Capacity Intelligence**
`components/marketing/HomeSections.tsx:680-696, 725-726, 765`
Six "platform pillars" are presented including "Free Specialty Job Board," "MATCHA — AI Career Matching," and "Clinic Capacity Intelligence." These are vision-state features that don't exist in the wedge. The headline "Not just credentialing. The infrastructure layer for all of US healthcare" directly contradicts the wedge framing. A YC reviewer reading this will see unfocused ambition, not a narrow wedge.
**Fix:** Remove or collapse the Platform section. If you want a vision teaser, move it below a clear "What's next" divider and label it explicitly as roadmap. The homepage should end after the Moneyball/Hypothesis section.
**Effort:** M

**#4. Partners page: Entire 3-tier partner program**
`app/partners/page.tsx` (full page)
Technology Partner, Integration Partner, and Channel Partner tiers with specific revenue shares ("up to 30%"), "Dedicated partnership manager," "Deal registration portal," and "Certified integration status." This implies operational infrastructure and BD capacity that a seed-stage solo-founder company cannot deliver. If a real integration partner applies, there's no one to onboard them.
**Fix:** Replace with a simple "Interested in integrating?" contact form or redirect to a Calendly link. Kill the tiers, kill the revenue share claims.
**Effort:** M

### P1 — Should Fix Before Merge (Confusion / Drift)

**#5. Two navbars with conflicting primary CTAs**
`components/marketing/Navbar.tsx` → "Get Started" → `/onboarding`
`components/layout/Navbar.tsx` → "Check Readiness" → `/passport`
Which one renders depends on the layout wrapper. On the homepage (which uses marketing sections), a visitor might see "Get Started → /onboarding" while the hero pushes them to `/passport`. The truth cleanup unified all CTAs to `/passport` — but the marketing navbar wasn't updated.
**Fix:** Update marketing `Navbar.tsx` to match layout navbar. Primary CTA: "Check Readiness" → `/passport`. Remove `/onboarding` from all public nav.
**Effort:** S

**#6. Homepage: "7M+ provider registry" in build signals**
`components/marketing/HomeSections.tsx:305`
"Live NPI verification via NPPES (7M+ provider registry)" — the truth cleanup was supposed to remove the 7M+ framing (per commit `df19d4b1`). It survived in the BUILD_SIGNALS array. This isn't a VitalCV metric — it's an NPPES fact — but it reads as VitalCV scale.
**Fix:** Change to "Live NPI verification via NPPES" (drop the parenthetical) or "Live NPI verification against the NPPES public registry."
**Effort:** S

**#7. Developers page: Drop-in widget claims non-existent CDN**
`components/developers/DropInSection.tsx`
Code snippet references `https://vitalcv.com/vitalcv-widget.js` with claims of "Zero dependencies, < 3 KB gzipped, Works in any CMS." If this script doesn't exist at that URL, the code example is broken on copy-paste. The "Preview" label helps but doesn't excuse a broken URL.
**Fix:** Either deploy the actual widget script, or change the URL to a placeholder like `https://cdn.example.com/vitalcv-widget.js` with a note that the widget is in preview, or remove the section.
**Effort:** S

**#8. Docs landing page: "Federation-native — interoperates with Nursys, CAQH, ABMS"**
`app/docs/page.tsx:53`
Claims federation interoperability with Nursys, CAQH, and ABMS. VitalCV has no federation agreements with these organizations. This is the same class of problem as the partner logos — naming real organizations as if integration exists.
**Fix:** Change to "Federation-native architecture — designed for interoperability with industry registries" or similar. Remove specific org names.
**Effort:** S

---

## Summary Matrix

| # | Page | Issue | Severity | Effort | Risk Type |
|---|------|-------|----------|--------|-----------|
| 1 | /partners | Fake "Trusted by" logos | **P0** | S | Legal + credibility |
| 2 | /investors | Hardcoded demo metrics as traction | **P0** | S | Investor fraud risk |
| 3 | Homepage | Platform section tells wrong story | **P0** | M | Wedge confusion |
| 4 | /partners | Full partner program that can't be delivered | **P0** | M | Operational overclaim |
| 5 | Nav | Two navbars, conflicting CTAs | **P1** | S | UX confusion |
| 6 | Homepage | "7M+ provider registry" survived cleanup | **P1** | S | Scale overclaim |
| 7 | /developers | Widget CDN URL doesn't exist | **P1** | S | Broken example |
| 8 | /docs | Federation claims with named orgs | **P1** | S | Credibility |

---

## Verdict: NO-GO

**The homepage hero + passport flow are clean.** The truth cleanup worked where it was applied. But it was applied to ~60% of the public surface. Four P0 issues remain, and three of them (#1, #2, #4) carry real credibility and legal risk if seen by investors, partners, or healthcare insiders doing diligence.

**To reach GO:**
1. Fix all 4 P0 issues (~2-3 hours of work, mostly deletion)
2. Fix P1 #5 (navbar unification, ~15 minutes)
3. Ideally fix P1 #6 and #8 (string changes, ~10 minutes each)

The remaining work is narrow — mostly removing things, not building things. One focused session gets this to GO.
