# VitalCV Product & UX Audit — Release Candidate
**Date:** 2026-03-30
**Standard:** Can a first-time clinician and a first-time employer understand the wedge in under 60 seconds?
**Surfaces audited:** Homepage, /passport (NPI entry + readiness), /review + /review/request, /employers, /developers, /explore

---

## Top 7 UX Problems Still Hurting Wedge Conversion

**1. The wedge is broken at runtime — NPI lookup returns UNAVAILABLE across the board.**
Entering an NPI on /passport?npi=… returns "Identity: UNAVAILABLE, Sanctions (OIG): UNAVAILABLE, Enrollment (CMS): UNAVAILABLE" with a generic retry message. The homepage promises "See your readiness snapshot in about 10 seconds." The backend (Railway) appears unhealthy or the ingest pipeline is failing. A first-time clinician hits the single CTA, gets nothing, and leaves. This is a P0. Nothing else matters until this works.

**2. Explore page hangs on "Loading opportunities…" forever.**
/explore renders a hero ("Trust-Native Matching — Explore Clinical Opportunities"), a demo-data disclaimer, and then "Loading opportunities…" that never resolves. A clinician who clicks "Explore Roles" from the nav sees an infinite spinner. This page either needs to load real data or not exist in the nav.

**3. Employers page shows all zeros and an empty directory.**
0 employers, 0 openings, 0 role listings, 0 states. "Employer directory is empty right now." The page is structurally honest (it says "No employers were returned from the current directory yet") but showing a page of zeros to a first-time employer destroys confidence. If there's no directory to show, this page should not be linked from the primary nav.

**4. Employer review flow dead-ends at authentication.**
/review says "Request a passport review" → /review/request → "Sign in with employer workspace." An employer arriving for the first time cannot see what a review looks like without creating an account. There is no preview, no sample packet, no screenshot — just a sign-in wall. The wedge question "What do I get immediately?" has no answer for employers.

**5. No visible readiness state or packet anywhere on the live site.**
Because the NPI ingest is broken, there is no working example of the readiness dashboard, the credential lanes with source-backed statuses, or the employer-facing evidence packet. The homepage shows a static source-coverage table (NPPES: CHECKED, OIG: CHECKED, etc.) but this is a marketing illustration, not a live state. A first-time visitor cannot see the actual product.

**6. Homepage has two competing entry points with unclear hierarchy.**
The hero has "Start with NPI lookup" (anchored to the marketing copy). The nav has "Check Readiness" (same destination). Below the fold there is also "Explore Roles." For a first-time clinician, the question "What should I do next?" gets three possible answers on the same page. The wedge demands one path: NPI in → readiness out. Everything else is noise at this stage.

**7. Developers page is dense and buries the "what can I actually do right now" answer.**
The page opens with "Build against the current VitalCV API preview" — good framing. But it immediately shows API keys (no key generated), a webhook simulation (synthetic event), an interactive cURL sandbox, a widget SDK, three full SDK packages with code samples, a standards conformance section, and a governance API. A first-time developer cannot tell which of these actually work versus which are illustrative previews. The "Connected Organizations" section showing "No organizations connected yet" confirms nothing is live.

---

## Top 5 Trust-Language Problems Still Hurting Credibility

**1. "Trust-Native Matching" on /explore.**
This phrase implies a functioning matching engine powered by trust state. The page shows an infinite loading spinner. The gap between claim and reality is the widest on the entire site.

**2. "Portable across employers" (homepage step 3).**
The third step in the how-it-works flow says "Your readiness snapshot travels with you. Connected checks stay source-backed, and missing coverage stays visibly pending." No employer has accepted a VitalCV packet. Portability is an architectural property, not a demonstrated one. This should say something like "designed to be portable" or "reusable across employer reviews."

**3. SDK code samples presented as working integrations.**
The developers page shows `verifyPresentation({ vpJwt })`, `checkRevocation()`, `requestSelectiveDisclosure()`, `acceptPresentation()` — these suggest a full W3C VC/VP stack with selective disclosure and revocation checking. The disclaimer "sample integrations, not evidence that every downstream workflow is enabled" exists but is buried in small text above the code blocks. The code itself reads as production-ready.

**4. "Standards Conformance" section with OID4VCI, OID4VP, SD-JWT, HAIP.**
A "Run Conformance Suite" button implies these standards are implemented and testable. There is no evidence these protocols are operational. The section should be labeled "Target Standards" or "Planned Conformance" rather than presenting a run button.

**5. "HMAC-signed callbacks" and "< 3 KB gzipped" widget claims.**
The drop-in widget SDK section claims HMAC-signed callbacks, auto-centered popup, zero dependencies, and a specific bundle size for a widget JavaScript file. This widget does not appear to exist at the advertised URL. Claiming specific technical properties of non-existent artifacts is the kind of overclaim that erodes trust with technical evaluators.

---

## Top 5 Things That Are Now Strong

**1. Homepage source-coverage table with honest status labels.**
The four-row source matrix (NPPES → CHECKED, OIG/LEIE → CHECKED, CMS PECOS → PENDING, CA State Board → ACCESS REQUIRED) is the single strongest trust signal on the site. It tells a clinician exactly what has been checked, what hasn't, and why — without hiding gaps. The footnote "Other lanes stay marked as access required, pending, or preview-only until a connected source actually runs" is excellent truth discipline.

**2. "Source-backed" instead of "Verified" throughout.**
The wave 1 UX rescue correctly replaced "Verified" with "Source-backed" across the UI. This is a meaningful distinction — VitalCV checks sources, it doesn't independently verify credentials. The language now matches the operational reality.

**3. Hero copy is grounded and specific.**
"VitalCV gives healthcare professionals a source-backed credentialing snapshot from NPPES, OIG, and available PECOS coverage in seconds" — this names exact sources, makes a time claim ("seconds") that is testable, and doesn't overclaim about what isn't checked. "No signup required to preview" removes friction honestly.

**4. Employer review page framing is operationally honest.**
"Review a source-backed readiness snapshot before making a hiring decision" positions the product correctly as decision support, not a decision oracle. "No login required to view a shared passport link" reduces friction. The two clear paths (shared link or NPI lookup) are the right entry points.

**5. "Demo data" disclaimer on /explore.**
The banner "Marketplace results may include seeded launch-cohort employers and opportunities during rollout" is the right approach — disclosing that data is synthetic rather than hiding it. This pattern should be applied more broadly.

---

## Clinician Experience Summary

A first-time clinician lands on the homepage and sees a clear value proposition: enter your NPI, get a source-backed credentialing snapshot in seconds, no signup required. The copy is honest and specific about which sources are checked (NPPES, OIG) and which aren't yet (PECOS pending, state boards access-required). The clinician clicks "Start with NPI lookup," enters their NPI, and hits a wall: all three source lanes show UNAVAILABLE with a generic retry message. The product's entire promise — instant readiness snapshot — fails at the single moment that matters. If the backend were healthy, the path from homepage to readiness state would likely be understandable in under 30 seconds. Right now it's understandable in 10 seconds — understandably broken.

---

## Employer Experience Summary

A first-time employer clicks "For Employers" in the nav and lands on a page showing zero employers, zero openings, and an empty directory. The page is honest about being empty but offers no reason to stay. If they navigate to /review, they see a clean framing — "Review a source-backed readiness snapshot before making a hiring decision" — but the only action available is "Request a passport review," which immediately requires workspace sign-in. There is no sample packet, no demo review, no screenshot of what an employer gets. The employer cannot answer "What do I get immediately?" because the answer is: nothing, until you create an account and a clinician shares a packet. The employer path needs either a sample/preview mode or the NPI lookup flow needs to work so the employer can generate a readiness snapshot themselves.

---

## Final Verdict

| Dimension | Rating |
|-----------|--------|
| **Understandable?** | **STILL CONFUSING** — The homepage copy is clear, but the product doesn't work when you click through. Understanding requires experiencing the readiness snapshot, and the snapshot is broken. |
| **Trustworthy?** | **STILL OVERCLAIMING** — The homepage and review framing have good truth discipline. But the developers page, explore page, and employers page collectively present capabilities (matching, SDKs, conformance, widgets) that don't exist yet. The gap between what's claimed and what works is still too wide. |
| **Usable?** | **STILL THEATRICAL** — The core wedge flow (NPI → readiness → packet → employer review) cannot be completed end-to-end on the live site. The explore page loads forever. The employer directory is empty. The developer tools are illustrative. Until the NPI ingest pipeline is healthy and returns real source data, the entire site is a theater set with no actors. |

---

**Bottom line:** The copy and framing improvements from the wave 1–5 work are real and significant — the homepage in particular has strong truth discipline. But the site currently cannot demonstrate its own wedge. Fix the backend ingest pipeline (P0), then hide or gate every page that shows zeros or infinite loading states. The wedge is one working API call away from being convincingly understandable.
