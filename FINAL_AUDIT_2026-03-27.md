# VitalCV — Final Brutal Audit
**Date:** 2026-03-27
**Auditor:** Claude Opus (Cowork)
**Scope:** vitalcv.com production + local HEAD (`0f75529c`, one commit ahead of prod deploy `0a38266e`)
**Method:** Source code analysis (4 parallel agents) + live site fetch (5 routes) + Vercel deployment state

---

## Deployment Note

Local HEAD (`0f75529c` — "public site rescue") is **not yet deployed to production**. The live site at vitalcv.com is running `0a38266e`. Several truth-cleanup fixes from the latest commit exist only in source, not on the live site. This audit reflects **what is live right now**.

---

## Route-by-Route Findings

### / (Homepage) — STRONG

The homepage is the best page on the site. "NPI first. Honest coverage." is a clear, honest headline. The NPI input is the single obvious action. Source coverage labels (NPPES: Checked, CMS PECOS: Pending, State Boards: Access required) are honest and specific. "Synthetic preview" and "Preview only" markers are present where they should be.

**Remaining issues:**
- Nav shows both "Get Ready" and "Get Started" — two labels for essentially one action. Minor confusion.
- "How It Works" section claims "Checked from live sources" — true for NPPES/OIG, misleading for state boards and PECOS which are stub/pending. The source coverage table downstream corrects this, but the marketing copy overpromises.
- NPI lookup is mock (first-digit deterministic) but the helper text says "Enter any NPI to preview a clinician credential profile" — "preview" does partial duty as a disclaimer but a first-time user will expect real data.

### /explore — DAMAGED

- **"Opportunities You're Already Matched For" is STILL LIVE.** This is the single worst copy on the entire site. No NPI has been entered. No matching has occurred. The headline claims personalized matching that does not exist for an unauthenticated visitor. This was flagged as P0 in the prior audit and remains unfixed on production.
- Demo data banner IS present (amber, "Marketplace results may include seeded launch-cohort employers"). Good.
- On the live fetch, the page showed "Loading opportunities…" with no role cards rendering. This means either the backend is down/empty or client hydration failed. Either way: a visitor sees a headline promising matched roles and gets a loading spinner.
- Source code confirms "Apply with VitalCV" buttons are bright emerald green with no disabled state on demo data. Auth gate is hidden inside a modal after click.
- "Hiring Now" badge uses a fallback: renders on every role that lacks a readiness label. On demo data, that's all of them.

### /employers — WORST PAGE ON THE SITE

- **Kaiser Permanente card: "38 open roles," "Trust score 97," "Verified since 2021-03-01"** — all hard-coded demo data with **zero disclosure**. No demo banner. No "example data" label. A YC reviewer or pilot partner sees this and takes it at face value. If Kaiser is not a signed partner, this is fabricated social proof on a trust product.
- **Internal dev note STILL rendered publicly:** "Use this surface for real counts, not synthetic demo claims." This is an engineering instruction visible to every visitor. It simultaneously confirms you have fake data AND shows you're trying to hide it. Devastating.
- **Internal jargon throughout:**
  - "launch-day queue state" (Employer entry card)
  - "graph truth" (Verifier card)
  - "operator dashboard with route checks, counts, graph truth, and launch alerts" (Verifier description)
  - "pilot reviewer," "marketplace truth," "live launch set"
- Clinician entry description is fine. Employer and Verifier descriptions read like an internal ops wiki, not a product page.

### /interview — FUNCTIONAL DEAD END

- **Chromeless.** No navbar, no footer, no layout shell. Dark background with a single message.
- Copy: "Interview mode needs a homepage NPI lookup before it can open." Followed by "Start with NPI lookup" CTA back to homepage.
- **No inline NPI input.** User must abandon the page entirely and navigate back to `/`. This is a hard dead end linked from the homepage ("Preview Interview Packet" CTA).
- The blocked state is intentional and the copy is honest, but the UX is hostile. A user who clicks "Preview Interview Packet" from the homepage hits a wall with no way to recover in-place.

### /developers — STRONG BUT LEAKY

- **Wave/phase numbers visible:** "Standards Conformance · Wave 114," "HealthStart · Wave 118," "Developer SDKs · Phase 7." Meaningless to external developers. Makes the product feel like an internal prototype.
- **HTTP 401 is NOT rendered.** Prior audit flagged this; it has been fixed (error is now caught and shown as "Failed to load controls").
- API sandbox is working: cURL area with syntax highlighting, mock response clearly labeled "Simulated preview payload."
- SDK docs are real: Verifier, Issuer, Wallet SDKs with method signatures and quickstart code.
- Some jargon without definitions: "HAIP compliance," "Trust band (L0–L3)," "Substrate trust state." Acceptable for a developer audience but could use a glossary link.

---

## TOP 5 MUST-FIX (before any external demo)

**1. /employers: Strip the Kaiser card or add demo-data banner** (P0, S effort)
Hard-coded "38 open roles" + "Trust score 97" with zero disclosure is the single highest-risk truth claim on the site. Either add the same amber demo-data banner from /explore, or remove the card until Kaiser is a real partner.

**2. /employers: Delete the internal dev note** (P0, XS effort)
"Use this surface for real counts, not synthetic demo claims" is literally instructions to yourself rendered on a public page. Remove the entire launch-note section from the production build.

**3. /explore: Kill "Already Matched For" headline** (P0, XS effort)
Replace with "Explore Clinical Opportunities" or "Open Roles." Reserve "matched" language for post-NPI states. This was flagged in the prior audit and remains live.

**4. /employers: Rewrite Employer + Verifier entry descriptions** (P1, S effort)
Replace "launch-day queue state," "graph truth," "operator dashboard with route checks, counts, graph truth, and launch alerts" with user-facing language. Example: "Review applicants and pending actions" / "Verify credentials and review trust evidence."

**5. /interview: Add layout shell and inline NPI input** (P1, M effort)
Wrap the blocked state in the standard navbar/footer. Add an NPI input field inline so users can resolve context without navigating away. The homepage links to this page — it cannot be a chromeless dead end.

---

## TOP 5 SAFE TO DEFER

**1. /developers: Remove wave/phase numbers from headings** (P2, XS)
Cosmetic. Developers won't be confused, just mildly puzzled. Fix before a formal developer launch.

**2. Homepage: Unify "Get Ready" / "Get Started" nav labels** (P2, XS)
Minor redundancy. Both work. Pick one and collapse them in a later polish pass.

**3. /explore: Downgrade "Apply" button on demo data** (P2, S)
The auth gate in the modal is functional. Ideally the button would be visually muted on demo roles, but the modal catch prevents actual damage.

**4. /explore: Vary "High transparency" / "Partial transparency" badges** (P2, XS)
Currently conditional on employer data status, which is fine. Low risk — the transparency system works, it just needs more demo data variety to demonstrate range.

**5. /developers: Add glossary for HAIP, trust bands, Substrate terms** (P2, S)
Developer docs are strong. A glossary link in the sidebar would help external devs, but core docs are self-contained.

---

## GO / NO-GO VERDICTS

### Pilot Demo: **CONDITIONAL GO**

The homepage and the core NPI → passport → interview flow work. The readiness snapshot is honest. Source coverage labels are accurate. The demo data banner on /explore is present.

**Condition:** Do NOT show /employers during a pilot demo. Route visitors directly from homepage → NPI lookup → readiness snapshot → interview packet. If you stay on the trust wedge path, the product holds up. The moment someone clicks "For Employers" in the nav, credibility collapses.

If you need to show /employers, fix items #1 and #2 first (Kaiser banner + dev note deletion). That's 30 minutes of work.

### Contractor Handoff: **GO**

CONTRACTORS.md is accurate and well-structured. The trust wedge path is clearly documented. The canonical backend flow (NPI → ingest → passport → review → employer decision) maps to real, working API routes confirmed by E2E tests. Source attribution rules are explicit. The "DO NOT reintroduce demo theater" warning is correct and necessary.

**Caveat:** Contractors must be told explicitly:
- Do not touch /employers until the demo-data banner and copy rewrite are done.
- The local HEAD (`0f75529c`) is ahead of production — deploy before handing off, or hand off from `main` after push.
- The `/explore` "Already Matched For" headline needs to be killed before any contractor work on that page.

---

## Estimated Effort

| Fix | Size | Time |
|-----|------|------|
| Kaiser demo banner | XS–S | 15 min |
| Dev note deletion | XS | 5 min |
| "Already Matched For" copy | XS | 5 min |
| Employer/Verifier description rewrite | S | 30 min |
| /interview layout + inline NPI | M | 1–2 hr |
| **Total P0+P1 blockers** | — | **~2–3 hr** |

---

**Bottom line:** The trust wedge works. The homepage is honest. The passport flow is real. But /employers is a credibility landmine, and /explore's headline is a lie on an unauthenticated page. Fix the 3 P0s (2 hours max), deploy, then hand off to contractors with confidence.
