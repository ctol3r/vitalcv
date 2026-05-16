# Conversion Fixes

**Conversion-optimization wave deliverable.** What was shipped in
this PR to improve signup + demo conversion, paired with what the
codebase already had right and what still requires rendered review.

## §1 — Pre-existing strengths (kept; do not regress)

The homepage on `origin/main` HEAD `7f7ace10` was already converting
better than typical:

| Strength | Where |
|---|---|
| Hero is direct + 2-line: "Enter your NPI. See what is ready." | `HomePageClient.tsx:83-87` |
| Single primary CTA: NPI input form (zero friction; no email/password gate) | `HomePageClient.tsx:96-160` |
| Foundation-honest microcopy: "No account required · Source-backed" | `HomePageClient.tsx:165-169` |
| No blockchain language | Codebase grep confirms |
| No "Coming soon" / TBD / placeholder text | Audit returned zero hits |
| No buzzword-driven hero copy | Confirmed |

**Do not regress these.** Subsequent UX work should preserve the
NPI-first, no-friction-form-fill hero.

## §2 — Concrete fixes shipped in this PR

### Fix A — Recruiter entry point on the homepage

**Where**: `apps/web/app/HomePageClient.tsx` — added a row of 3 inline
links below the existing preview-steps grid.

**What it adds**:
- "Hiring? See the employer view →" (primary recruiter CTA → `/demo/employer`)
- "Walk through three demos" → `/demo`
- "Why VitalCV" → `/launch`

**Conversion rationale**: the homepage was 100% clinician-facing.
Recruiters landing on it had no obvious path. The added row is
subtle (text links, not buttons; doesn't disrupt the hero) but gives
employers a one-click route to the relevant flow.

**Risk**: minimal — additive only; preserves the clinician-first
hero hierarchy.

### Fix B — `/launch` page (shipped in the same PR)

New page at `apps/web/app/launch/page.tsx` (created in Wave 1). The
focused public landing pad with:

- Direct hero: "Clinician readiness, source-honest."
- Three audience-segmented cards (clinician / employer / issuer) each pointing at the matching `/demo/*` route
- T1-T4 authority ladder explainer
- Explicit "What VitalCV does NOT do" section (anti-overclaim — builds trust)
- Working CTA: "Create your account" → `/sign-up`

**Conversion rationale**: serves visitors who arrive expecting a
classic landing page (vs the NPI-first hero on `/`). Provides the
3-audience pitch in one scroll.

### Fix C — `/demo/{clinician,employer,issuer}` flows

Three working demo flows from in-repo fixtures. No backend
dependency; no env vars; render identically on any machine running
`pnpm dev`.

**Conversion rationale**: prospects can see the product working in
<3 minutes without sign-up, without backend availability, without
operator coordination.

### Fix D — `/signup` foundation page CTA (already in PR #365)

A "Create your account →" button now lives at the top of the
foundation describer, pointing at `/sign-up`. Closes the prior UX
dead-end. Reference: PR #365.

### Fix E — `/api/ingest/[npi]` masked-200 fallback handling (PR #365)

Homepage NPI submit no longer throws cryptically when backend is
temporarily degraded. Calmer "Sources temporarily unavailable" state
with pending lanes.

## §3 — What this PR explicitly does NOT do

These require **rendered UI review** I cannot perform from a build
session. Documented in `launch-ux-scope-note.md` (PR #364) and
`minimum-believable-product.md` (PR #365):

- Mobile responsive polish (no device testing access)
- Color / weight / typography refinement (subjective; needs rendered review)
- Animation / motion calibration (same)
- Cross-device experience parity
- Click-through funnel A/B testing

The shipped changes are safe text + link additions; visual /
emotional decisions stay with the founder + tester pair.

## §4 — Anti-jargon scan

Per the mission's "REMOVE: overly technical language, blockchain
emphasis, speculative future messaging, jargon overload":

| Term | Where on `origin/main` | Verdict |
|---|---|---|
| "blockchain" | 0 hits in user-facing copy | OK — already removed |
| "verifiable credential" | Used inside `/issuer/*` demo-grade surfaces only | OK — those surfaces are demo-only |
| "decentralized identifier" / "DID" | Internal API metadata; not in marketing copy | OK |
| "JWKS" / "kid" / "ES256" | Internal API + ops surfaces; not in marketing copy | OK |
| "OID4VCI" | Internal; not user-facing | OK |
| "trust anchor" | Used in marketing copy ("authority ladder") in `/launch` | Acceptable — explained inline via T1-T4 ladder |
| "Source-backed" | Used throughout as the canonical positive trust phrase | KEEP — this is the product vocabulary |

**Verdict**: codebase is already largely jargon-clean on user-facing
surfaces. No removals needed.

## §5 — Speed-to-hire framing

The mission asked to "ADD: speed-to-hire messaging, recruiter pain
reduction, onboarding acceleration, trust/reusability framing." Where
each landed in this PR:

| Framing element | Location | Shipped? |
|---|---|---|
| Speed-to-hire | `/launch` hero subhead, `/demo/employer` "Move forward" / "Review recommended" / "Waiting on sources" state chips | ✓ |
| Recruiter pain reduction | `/demo/employer` 3-application queue with explicit highlights + cautions per application | ✓ |
| Onboarding acceleration | `/launch` employer card body: "Stop restarting verification" | ✓ |
| Trust/reusability framing | `/launch` issuer card body: "Verify once. Be re-used." + `/demo/issuer` "Confirmed result is re-usable by the next reviewer" | ✓ |

All four framings now live on the public surface without
overclaiming.

## §6 — Friction reduction inventory

| Friction point | Before | After this PR |
|---|---|---|
| Recruiter visiting `/` has no path | No employer-facing link | Added row of links to `/demo/employer`, `/demo`, `/launch` |
| Visitor wants to see full pitch without form-filling | Only `/` hero existed | `/launch` exists with full 3-audience pitch |
| Prospect wants to see flows without sign-up | No demo-flow surface | `/demo` + 3 sub-routes ship with fixtures |
| Homepage NPI submit crashes on backend errors | Cryptic error message + all sources marked Unavailable | Calm "Sources temporarily unavailable" + pending lanes (PR #365) |
| `/signup` dead-end | No path to actual sign-up | Direct CTA → `/sign-up` (PR #365) |
| `/verifier` 404 cascade | 4 broken inbound links | All redirected to `/employer/dashboard` or `/employer/worklist` (PR #365) |

## §7 — Conversion verdict

**The codebase is in unusually good conversion shape for a survival-
mode launch.** The pre-existing hero is direct; foundation-honest
copy avoids the common "overclaim → trust collapse" cycle. The
remaining wins are:

1. Day-2 founder rendered QA on real devices (mobile parity, motion calibration)
2. Per-route lean-public-surface cleanup (cognitive load reduction; tracked in `lean-public-surface.md`)
3. Real-user feedback loops post-launch

None of these requires further autonomous architecture work.
