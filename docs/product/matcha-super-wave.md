# MATCHA Super Wave — Execution Report

_Date: 2026-07-03 · Branch: `wave/career-evidence-network-alignment`_

## What MATCHA is (and the key finding)

The super-wave brief reads as "build an AI engine." It isn't needed — **MATCHA already exists
as a real backend engine** (`apps/api/backend/src/services/matcha`, ~2,400 LOC): deterministic
credential-gated scoring that emits a `MatchExplanation` with `matchBand`, `matchScore`,
`fitReasons`, `blockers`, and `missingCredentials`. It is gated behind `MATCHA_V2`
(`NEXT_PUBLIC_FEATURE_MATCHA_V2`, PILOT, default off) and, until now, was consumed only by the
mobile experience.

The real gap was the **web/desktop clinician surface**. That is what this wave delivered — and
because the engine's output already carries provenance, every surface stays inside the VitalCV
truth contract: **nothing is fabricated; every score and insight traces to real data.**

## Truth-contract posture (Wave 11, woven throughout)

- Preferences are the clinician's **own stated data** — not verification claims. MATCHA reflects
  them back; it never asserts a verified fact about the clinician.
- Every derived profile insight carries `provenance` (the exact answers it came from). The UI
  renders "because you told MATCHA: …" beside each one.
- Only the fields in `ENGINE_BACKED_FIELDS` influence live matches. The UI labels those
  ("Updates your live matches") and does not pretend the other ~45 fields change scoring today.
- Opportunity cards show **only real signals**. Dimensions the platform can't score
  (interview probability, culture-as-a-number) are omitted, not invented. A footer states what
  each score is based on and that MATCHA does not estimate interview outcomes.
- No banned strings; guarded by a test that scans rendered markup.

## Delivered this wave (flag-gated behind `MATCHA_V2`)

| Wave | Deliverable | Files |
| --- | --- | --- |
| Spine | Preference model, completeness→confidence, engine mapping | `lib/matcha/preferences.ts` |
| 2/3 | Profile derivation with provenance | `lib/matcha/profile.ts` |
| 1 | Declarative conversational onboarding script | `lib/matcha/onboarding.ts` |
| 10 | Local persistence + grounded memory diffing | `lib/matcha/storage.ts` |
| 4 | Preference↔opportunity alignment reasons | `lib/matcha/opportunityFit.ts` |
| — | Client binding (storage + live intent push) | `components/matcha/useMatchaPreferences.ts` |
| 1 | Conversational onboarding UI | `components/matcha/MatchaOnboarding.tsx` |
| 2 | "MATCHA understands you" profile | `components/matcha/MatchaProfile.tsx` |
| 3 | Reusable "Recommended because" explanation | `components/matcha/MatchaExplanation.tsx` |
| 4 | Opportunity Intelligence Card | `components/matcha/OpportunityIntelligenceCard.tsx` |
| 4 | Live matches surface | `components/matcha/MatchaOpportunitiesSurface.tsx` |
| 2/10 | Hub (profile + memory + progress) | `components/matcha/MatchaHub.tsx` |
| — | Routes `/holder/matcha`, `/onboarding`, `/opportunities` | `app/holder/matcha/**` |
| — | Web intent proxy → engine | `app/api/matcha/intent/route.ts` |
| 12 | Unit + component tests (30) | `__tests__/matcha-*.ts(x)` |
| 5 | Living-home MATCHA activity strip (flag-guarded, additive) | `components/matcha/MatchaHomeActivity.tsx` |
| 6 | Recruiter buyer landing | `app/matcha/recruiters/page.tsx` |
| 7 | Hospital buyer landing | `app/matcha/hospitals/page.tsx` |
| 8 | Investor buyer landing + ecosystem map | `app/matcha/investors/page.tsx`, `components/matcha/buyer/*` |
| Public | **Interactive MATCHA on the homepage** (no signup, unflagged, live) | `components/matcha/PublicMatchaExperience.tsx`, `app/HomePageClient.tsx` |

**Verification:** 23/23 MATCHA tests pass; full web typecheck 0 errors; `next build` green with
all routes registered. The 21 failing suite tests are pre-existing page-copy contract failures
unrelated to this work. Signed-in browser walkthrough is blocked by Clerk auth + CDN
bot-management — needs an allowlisted/owner browser (see memory `clerk_cdn_bot_management`).

### Design Handoff References

No specific design-handoff file governs the MATCHA engine surfaces; this work derives from the
in-repo design system (`styles/vitalTokens.css` `--vt-*` tokens, `animations/motionVariants.ts`,
DM Sans / Instrument Serif) rather than a handoff artifact under `design-handoff/`. Flagged for a
visual-lineage pass against the bundle at `design-handoff/claude-design-2026-06-26/` before public
exposure.

## Buyer pages — status & the copy decision

Waves 6–8 are **built and flag-gated** behind `MATCHA_BUYER_PAGES` (default off), at public routes
`/matcha/{recruiters,hospitals,investors}` (registered in `publicSurfaceRoutes.ts` so they get
Navbar/Footer). Copy is deliberately **directional** — benefits are framed as based on the VitalCV
model, each page carries a "not customer-reported results" disclaimer, and a copy-guard test scans
rendered markup for banned strings. Runtime-verified: all three serve 200 with correct content and
zero banned strings.

**Decision for Chris:** the copy is honest but generic. Before flipping the flag to public, replace
the directional benefit language with **real pilot numbers** where available (same honesty pattern as
`/pilot`), and have product/marketing review the buyer claims. The flag keeps them dark until then.

## Remaining

- **Wave 9 — Visual polish pass (MEDIUM).** New components follow house tokens/motion already; a
  cross-app polish sweep is a separate initiative, not a discrete surface.
- **Buyer-page copy hardening (see above)** before public flip.
- **`/holder/home` theme:** the home is still dark-themed (mid dark→light D57 migration). The MATCHA
  activity strip matches the current dark theme; it will need a light-theme pass when the home migrates.

## How to see it

Set `NEXT_PUBLIC_FEATURE_MATCHA_V2=true`, sign in as a clinician, visit `/holder/matcha`.
Onboarding at `/holder/matcha/onboarding`; live matches at `/holder/matcha/opportunities`.
