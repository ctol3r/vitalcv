# VitalCV — First-Visit UX & Truth Audit
**Date:** 2026-03-27
**Target:** vitalcv.com (production)
**Auditor:** Claude Opus (Cowork)
**Verdict:** **NO-GO for wedge unification** — 3 P0 truth-drift issues must be resolved first.

---

## Executive Summary

The homepage is the strongest page on the site. NPI-first entry, honest source-coverage labels, and explicit "synthetic preview" / "preview only" markers make it clear what is real and what is not. That discipline collapses on **/explore** and **/employers**, where seeded demo data wears the clothes of live production data — active "Apply" buttons, "Hiring Now" badges, "Trust score 97," and fabricated Kaiser Permanente headcounts with no demo-data disclosure. **/interview** is a chromeless dead-end. **/developers** is rich but leaks internal wave numbers and shows a visible HTTP 401 on a gated section.

---

## Top 10 Issues (Ranked P0 → P2)

### P0 — Ship-blockers (fix before any external eyes)

**1. /employers: Kaiser card claims "38 open roles," "Trust score 97," "Verified since 2021-03-01" with ZERO demo-data disclosure**
Route: `/employers`
Component: Employer directory card (article element)
The /explore page has a "Demo data" banner. /employers has nothing. A visitor — or a YC reviewer — sees "Kaiser Permanente Northern California · 38 open roles · Actively hiring · Trust score 97" and takes it at face value. If Kaiser is not a real signed partner, this is the single highest-risk truth claim on the site. It looks like fabricated social proof.
**Fix:** Add the same "Demo data / launch-cohort" banner from /explore, or strip the hard numbers until they come from a real feed.

**2. /explore: "Opportunities You're Already Matched For" headline on an unauthenticated page with no NPI context**
Route: `/explore`
Component: Hero heading
No NPI has been entered. No matching has occurred. The headline claims personalized matching that does not exist. The subtitle reinforces it: "Every role maps to your readiness state." There is no readiness state yet.
**Fix:** Change to "Open Roles" or "Explore Available Roles." Reserve "matched" language for post-NPI-lookup states.

**3. /employers: Internal dev note visible to public users**
Route: `/employers`
Component: "Launch note" section near bottom
Literal text: *"Use this surface for real counts, not synthetic demo claims."* This is an internal engineering instruction rendered on a public page. It simultaneously tells the visitor you have synthetic data AND tells them you're trying to hide it. Devastating in a trust product.
**Fix:** Remove the launch-note section from the production build entirely.

---

### P1 — Must fix before real clinicians or employer demos

**4. /interview: Chromeless dead-end page — no nav, no header, no footer**
Route: `/interview`
Component: Entire page (gate/fallback state)
Visiting /interview without NPI context shows a plaintext message with no site header, no footer, no navigation. It looks like a broken deployment, not an intentional gate. The homepage links to it ("Preview Interview Packet") so real users will hit this.
**Fix:** Wrap the gate message in the standard layout shell. Add the NPI input inline so the user can resolve context without navigating away.

**5. /explore: "Apply with VitalCV" buttons and "Hiring Now" badges active on seeded demo data**
Route: `/explore`
Component: Role cards (button "Apply with VitalCV", badge "Hiring Now")
Every one of the 5 demo roles has an active "Apply with VitalCV" button and a "Hiring Now" badge. What happens when someone clicks Apply? If it dead-ends or errors, you've trained the user that your CTAs don't work. If it goes through, you've accepted a fake application to a fake role. Either outcome is bad.
**Fix:** Disable or visually mute the Apply button on demo roles. Change "Hiring Now" to "Example listing" or remove it.

**6. /employers: Internal-facing language visible in public copy**
Route: `/employers`
Component: Headings and descriptions throughout
"Launch-safe entry point for hiring teams and clinician demos," "launch-day queue state," "operator dashboard with route checks, counts, graph truth, and launch alerts" — this reads like an internal ops wiki, not a public employer page. First-time visitors have no idea what "graph truth" or "launch-day queue state" means.
**Fix:** Rewrite all three entry-point descriptions (Clinician / Employer / Verifier) in user-facing language.

**7. /developers: "HTTP 401" displayed for HealthStart Control Inheritance section**
Route: `/developers`
Component: HealthStart · Wave 118 section
The section renders "HTTP 401" as visible content. This is either a failed API call rendered as UI or a placeholder. Either way it looks broken.
**Fix:** Gate the section behind auth and show a "sign in to view" message, or remove the section until it works.

---

### P2 — Polish before broader launch or investor demos

**8. Nav/CTA confusion: Three entry points for the same action**
Routes: `/` (homepage), nav bar
Components: Nav "Get Ready" → /get-ready, Nav "Get Started" → /get-ready, Hero "Start with NPI lookup" → on-page form
A first-time visitor sees "Get Ready" and "Get Started" in the same nav bar, plus the hero form. These all do roughly the same thing but use different labels and destinations. Pick one entry point and one label.
**Fix:** Unify to a single CTA label ("Get Started" or "Check Readiness") across nav and hero.

**9. /developers: Internal wave/phase numbers visible to public**
Route: `/developers`
Components: "Standards Conformance · Wave 114," "HealthStart · Wave 118," "Developer SDKs · Phase 7"
Internal sprint/wave numbering means nothing to an external developer. It clutters the page and makes the product feel like an internal prototype.
**Fix:** Remove wave/phase numbers from public-facing headings. Keep them in internal docs if needed.

**10. /explore: "High transparency" badge on all 5 demo roles is meaningless**
Route: `/explore`
Component: Role cards
Every single role card shows "High transparency." When every item has the same badge, it communicates zero information and dilutes the trust-signaling system. On demo data, it's doubly meaningless.
**Fix:** Either vary the transparency rating across demo roles to show the range, or remove it from demo data entirely.

---

## Per-Page Quick Answers

### / (Homepage)
| Question | Answer |
|---|---|
| What is this? | A tool that checks your NPI and shows credential readiness. Clear within 5 seconds. |
| What should I do now? | Enter your NPI. Obvious. |
| What do I get in 30–60s? | A readiness snapshot with source-by-source status. Promised in "about 10 seconds." |
| Feels fake/dead/contradictory? | No — homepage is the strongest page. Honest labeling throughout. |
| Overstates coverage? | No — explicitly labels PECOS as "Pending" and state boards as "Access required." |

### /interview
| Question | Answer |
|---|---|
| What is this? | Unclear — just an error message. |
| What should I do now? | Go back to homepage. |
| What do I get in 30–60s? | Nothing. Dead end. |
| Feels fake/dead/contradictory? | Feels broken. No layout shell. |

### /explore
| Question | Answer |
|---|---|
| What is this? | A job board with 5 roles. |
| What should I do now? | "Apply" or "Calculate Fit" — but to demo roles? |
| What do I get in 30–60s? | A list of roles, but no readiness context without NPI. |
| Feels fake/dead/contradictory? | "Already Matched For" with no matching. "Apply" buttons on demo data. |
| Overstates coverage? | "Demo data" banner helps, but "Hiring Now" and "High transparency" badges contradict it. |

### /employers
| Question | Answer |
|---|---|
| What is this? | An employer directory — but it has 1 employer card. |
| What should I do now? | Three options shown, all in internal language. |
| What do I get in 30–60s? | Kaiser card with big numbers you can't verify. |
| Feels fake/dead/contradictory? | Kaiser "38 open roles" + internal dev notes = deeply contradictory. |
| Overstates coverage? | Yes — worst page on the site for truth drift. |

### /developers
| Question | Answer |
|---|---|
| What is this? | A developer portal with API sandbox, SDK docs, webhooks. |
| What should I do now? | Try the sandbox or read docs. Clear. |
| What do I get in 30–60s? | A working cURL sandbox and code samples. Actually good. |
| Feels fake/dead/contradictory? | HTTP 401 section feels broken. Wave numbers feel internal. |
| Overstates coverage? | No major overstatements. SDK/API docs match what exists. |

---

## Verdict: NO-GO for Wedge Unification

The homepage has achieved honest, source-backed copy discipline. But /explore and /employers undo that trust by presenting seeded data as production reality. Until:

1. The Kaiser card either reflects a real partnership or is labeled as demo data
2. "Already Matched For" is removed from the unauthenticated explore page
3. Internal dev notes are stripped from /employers

...the site cannot be safely shown to investors, partners, or pilot clinicians as a unified wedge. Fix the three P0s, then re-audit.

**Estimated effort:** P0 fixes are S–M (copy changes + 1 component gate). P1 fixes are M (layout wrapping, button state logic, copy rewrites). P2 fixes are S (label changes). Total: 1–2 focused task waves.
