# VitalCV Buyer Surface Audit — 2026-03-28

**Auditor posture:** VP of Credentialing at a 400-bed system, evaluating whether to pilot VitalCV for provider onboarding. Has 10 minutes and zero patience for vaporware.

---

## 1. WHAT DOES VITALCV DO FOR ME OPERATIONALLY?

### What the page says
The marketing site (/verifier) makes three operational promises:

1. **Replace manual PSV with cryptographic proof** — verify in seconds, not weeks.
2. **Portable evidence bundles** — signed, timestamped artifacts per verification.
3. **Single API integration** — one endpoint, structured output, DPoP-bound.

The web app homepage adds market-framing stats: 45–90 day cycles, $9K/day unfilled slots, 1-in-5 apps have errors.

### What's actually clear to a buyer
**Partially clear.** The /verifier page does a reasonable job explaining the *mechanism* (submit NPI → get evidence bundle → store or forward). The security guarantees section (ES256, HAIP 1.0, DPoP, zero PHI) is unusually strong for this stage — a compliance officer would notice this positively.

### What's missing operationally
- **No workflow integration story.** A credentialing director needs to know: does this plug into my CVO? My AMS? My Cactus/Modio/symplr instance? The "one endpoint" claim is developer-facing, not ops-facing.
- **No before/after timeline.** "Seconds not weeks" is stated but never shown concretely. No "Day 1 → Day 3 you're live" narrative.
- **No FTE impact framing.** Buyers think in headcount. How many credential specialists does this replace or redeploy?
- **No NCQA/Joint Commission language.** The compliance badges say "HIPAA-aligned" and "ONC 21st Century Cures" but never mention NCQA CVO standards, Joint Commission HR chapter, or CMS CoPs — the frameworks buyers are *actually audited against*.

---

## 2. WHAT SHOULD I CLICK NOW?

### Primary CTAs found

| Surface | CTA Text | Destination | Friction |
|---------|----------|-------------|----------|
| Marketing hero | NPI input field | /clinician?npi=... | **Clinician-first** — wrong persona |
| Marketing nav | "Try demo" | /demo | Good intent, unclear payload |
| /verifier CTA | "Try NPI lookup" | / (home) | Sends buyer *backwards* |
| /verifier CTA | "Request access" | https://app.vitalcv.com | External redirect, no context |
| /employers page | "Request pilot access" | /pilot | Correct intent |
| /employers page | "View proof" | /employers/[slug] | Shows employer detail, not buyer action |
| /review page | "Request a passport review" | /review/request | Correct but buried, tiny text (white/25) |
| Contact page | hello@vitalcv.com | Email link | No form, no calendly, no response SLA |

### Verdict: **Conversion path is broken for buyers.**

The primary CTA on the entire marketing site is an NPI input field — which is a *clinician* action. A VP of Credentialing landing on the homepage would see a text box asking for their NPI and have no idea what to do. The "Verifier →" link is a small underlined text link below the fold.

The /verifier page's own CTA ("Try NPI lookup") routes the buyer *back to the homepage*. "Request access" goes to an external app URL with no onboarding context.

The only correct buyer conversion point — "Request pilot access" on /employers — requires the buyer to navigate through a directory page that may show zero employers if the backend returns empty.

---

## 3. WHAT IS PROVEN VS. STILL PILOT-STAGE?

### Claims made on the surface

| Claim | Source | Status |
|-------|--------|--------|
| "6.8M licensed US healthcare workers" | TractionSection | **Market stat, not a product claim — acceptable** |
| "$9K/day unfilled physician slot" | TractionSection | **Industry stat — acceptable, widely cited** |
| "$4.2B US healthcare credentialing market, growing 11% YoY" | TractionSection | **Market stat — acceptable** |
| "~10s to first readiness snapshot" | TractionSection | **Product claim — needs validation** |
| "Live NPI verification via NPPES (7M+ provider registry)" | BUILD_SIGNALS | **True — NPPES integration is live** |
| "Cryptographic SD-JWT credentials — W3C VC + OID4VCI compliant" | BUILD_SIGNALS | **Partially true — implementation exists, full compliance unaudited** |
| "Employer acceptance flow — review and accept verified packets" | BUILD_SIGNALS | **Overstated — PR87 audit (2026-03-27) documented critical blockers in this exact flow** |
| "HIPAA-compliant audit ledger with continuous license monitoring" | BUILD_SIGNALS | **Overstated — "HIPAA-compliant" implies completed audit; badges say "HIPAA-aligned" elsewhere, inconsistent** |
| "Verify clinician credentials in seconds, not weeks" | VerifierHero | **Aspirational — only NPPES + OIG are live sources** |
| "Hardened by default. Audited to the wire." | SecurityGuarantees | **"Audited" implies third-party audit — none has occurred** |
| "TEFCA & ONC mandates are live" | WhyNowSection | **True but misleading — TEFCA doesn't mandate credentialing interoperability specifically** |

### Inflated claims flagged

1. **"Audited to the wire"** — This is the most dangerous claim. No third-party security audit has been completed. This phrase implies one has. A buyer's legal/compliance team would ask for the audit report and find nothing.

2. **"HIPAA-compliant audit ledger"** — "Compliant" vs. "aligned" distinction matters enormously. The compliance badges correctly say "HIPAA-aligned" but BUILD_SIGNALS says "HIPAA-compliant." Pick one; the correct one is "aligned" until you have a BAA and attestation.

3. **"Employer acceptance flow — review and accept verified packets"** — The PR87 audit from yesterday documents this flow has critical blockers. Claiming it's "built & working" on the homepage is factually inaccurate today.

4. **"Verify clinician credentials in seconds, not weeks"** — Only NPPES identity + OIG/LEIE exclusion are live. State board licenses, DEA, board certs, NPDB are not integrated. "Verify" implies full PSV replacement; current capability is partial identity + exclusion check.

---

## 4. DOES THE PAGE FEEL CREDIBLE AND COMMERCIALLY CLEAR?

### What works
- **Design quality is high.** Dark-mode operator aesthetic, clean typography, no visual junk. Feels like infrastructure, not a job board.
- **Security section is excellent.** ES256-only, DPoP, nonce lifecycle, HAIP 1.0 — this is the most credible section on the entire site. Technical buyers will respect this.
- **Problem framing is visceral.** "Every hospital reverifies you from scratch. Every time." is a good line. Pain stats are well-chosen.
- **Honesty in step descriptions.** The HowItWorks section on the web app has been carefully hedged: "Missing coverage stays visibly pending" and "appear only when those sources are actually available." This is good discipline.
- **Employer directory disclaimer.** The note at the bottom ("Counts reflect what is visible here so the directory does not imply broader coverage") is honest and well-placed.

### What doesn't work
- **Two apps, split personality.** Marketing site (apps/marketing) and web app (apps/web) have different navs, different hero copy, different design tokens. A buyer who clicks from one to the other will feel disorientation.
- **No pricing signal whatsoever.** Not even "Contact us for pricing" or "Starts at $X per verification." A buyer with budget authority needs *something* to anchor a business case.
- **Contact page is anemic.** One email address. No form. No Calendly. No "Book a demo" flow. For a product selling to healthcare enterprises, this is a hard stop. These buyers expect a sales conversation, not a mailto link.
- **"For Employers" leads to a directory, not a value prop.** The /employers page is an operational directory of current employers in the system. It's not a landing page explaining what VitalCV does for employers. A buyer clicking "For employers" expects to see ROI, use cases, and a demo — not a list of facilities that may be empty.
- **Jargon without translation.** "SD-JWT VC," "OpenID4VCI," "DPoP-bound tokens," "HAIP 1.0" — all correct, all meaningless to a VP of Credentialing. The security page serves developers and compliance engineers but not the buyer signing the contract.
- **No social proof.** Zero logos, zero testimonials, zero case studies, zero "trusted by" badges. At pilot stage this is understandable, but the site should at least show the YC badge prominently on the buyer surface, not just tucked into the contact page.

---

## 5. TOP BUYER-SURFACE ISSUES (Ranked)

| # | Issue | Severity | Fix Effort |
|---|-------|----------|------------|
| 1 | **No buyer-specific landing page.** /employers is a directory, not a value prop. Buyers need: problem → solution → proof → CTA. | CRITICAL | M |
| 2 | **Primary CTA is clinician-first.** Homepage NPI input is meaningless to a buyer. No "I'm an employer" path above the fold. | CRITICAL | S |
| 3 | **"Audited to the wire" claim.** No third-party audit exists. Legal liability risk. | CRITICAL | S (copy change) |
| 4 | **"HIPAA-compliant" vs "HIPAA-aligned" inconsistency.** | HIGH | S (copy change) |
| 5 | **"Employer acceptance flow" claimed as built — PR87 says otherwise.** | HIGH | S (copy change) |
| 6 | **No contact form / demo booking.** mailto: link is not a conversion mechanism for enterprise sales. | HIGH | S–M |
| 7 | **No pricing signal.** Buyers can't build a business case without an anchor. | HIGH | S |
| 8 | **CTA on /verifier routes buyer backward to homepage.** | MEDIUM | S |
| 9 | **No NCQA/Joint Commission/CMS CoP language.** Buyers think in audit frameworks, not protocol specs. | MEDIUM | S–M |
| 10 | **No social proof (logos, testimonials, YC badge on buyer pages).** | MEDIUM | S |

---

## 6. CONVERSION BLOCKERS (Buyer cannot proceed)

1. **No "Book a Demo" or "Talk to Sales" anywhere.** Enterprise healthcare buyers do not cold-email. They expect a calendared conversation. Without this, every interested buyer is a lost lead.

2. **Empty-state employer directory kills credibility.** If the backend returns zero employers, the /employers page shows a warning box saying the directory is empty. A buyer seeing this will close the tab.

3. **Review entry point is invisible.** The /review page — the actual employer workflow — shows a warning-toned card saying "Employer review opens from a real passport share link." The employer CTA ("Are you an employer? Request a passport review") is rendered at 25% white opacity, 12px text. This is functionally invisible.

4. **"Request access" on /verifier goes to app.vitalcv.com with no onboarding.** A buyer clicking this lands in the Clerk auth flow with zero context about what they're signing up for.

---

## 7. GO / NO-GO VERDICT

### **NO-GO for merge as buyer-ready surface.**

The current surface is technically impressive and architecturally sound, but it is not commercially functional for the employer/buyer persona. A VP of Credentialing arriving today would:

1. See an NPI input box they don't understand
2. Eventually find the /verifier page, which explains the mechanism well
3. Click "Request access" and land in an auth flow with no context
4. Leave

### Conditions for GO

To reach merge-ready for buyer surface:

1. **Fix the three inflated claims** (copy changes, < 1 hour): "Audited to the wire" → "Hardened by default"; "HIPAA-compliant" → "HIPAA-aligned" consistently; remove "Employer acceptance flow" from BUILD_SIGNALS or qualify it as "in development."
2. **Add a buyer CTA above the fold** on the homepage: "I'm an employer" → route to a dedicated /for-employers landing page (not the directory).
3. **Add a demo booking mechanism**: Calendly embed, Hubspot form, or at minimum a structured contact form that captures org name, role, and use case.
4. **Make /review/request discoverable**: Promote the employer review request to a primary CTA on the buyer landing page instead of hiding it at 25% opacity.

Items 1 and 2 are blockers. Items 3 and 4 are high-priority fast-follows.

---

*Audit conducted against: apps/marketing + apps/web buyer-facing routes, 2026-03-28.*
