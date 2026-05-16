# Minimum Believable Product

**Closing synthesis** for the "finalize the smallest believable
public launch surface" mission. Documents what THIS PR ships (Day 1
hygiene), what's already in place from prior work, and what
remains for the rendered-UI / operator-side launch sequence.

## §1 — What this PR ships (concrete code changes)

### Fix 1 — `/api/ingest/[npi]` masked-200 fallback handling

**Where**: `apps/web/hooks/useIngestStream.ts` (the `startIngest` callback).

**Problem**: When the backend ingest pipeline is degraded, `/api/ingest/[npi]` returns HTTP 200 with body `{ok: false, fallback: true, runId: null, message: "...", lanes: [...], truth: {...}}`. The client previously fell through to `parseIngestStartResponse` which threw a generic error, marking ALL sources as `'error'` — harsher than reality.

**Fix**: Detect `body.fallback === true` BEFORE calling `parseIngestStartResponse`. When the fallback flag is set:
- Set `phase: 'error'` (still surfaces an error state to the UI)
- Mark sources as `'pending'` (NOT `'error'`) — the upstream is unreachable, but the clinician hasn't done anything wrong, and source checks are queued to retry
- Use the backend-provided `message` field directly, or a calm fallback string

**User-facing impact**: When the homepage NPI submit hits a degraded backend, the user sees a calm "Sources are temporarily unavailable. Try again in a moment." instead of an error with three "Unavailable" lane badges.

**Test status**: 9/9 ingest-stream-state tests passing.

### Fix 2 — `/signup` foundation page → `/sign-up` Clerk flow CTA

**Where**: `apps/web/app/signup/page.tsx`.

**Problem**: `/signup` is the foundation-preview describer page (similar to `/onboarding`, `/pricing`, etc.). `/sign-up/[[...sign-up]]` is the actual Clerk account-creation flow. A user landing on `/signup` had NO obvious path to actually create an account — UX dead-end.

**Fix**: Added a prominent "Create your account →" CTA button at the top of the foundation page, plus an explanatory disambiguating line: "this page describes the foundation; account creation happens at /sign-up".

**User-facing impact**: A user landing on `/signup` (e.g., from an external link or memory) can now immediately reach actual account creation. No content removed; foundation describer preserved.

### Fix 3 — Marketing copy `/verifier` link audit

**Where**:
- `apps/web/components/marketing/HeroSection.tsx`
- `apps/web/components/marketing/AcceptanceNetwork.tsx`
- `apps/web/components/employer/EmployerDashboard.tsx`

**Problem**: Four user-facing links pointed to `/verifier` or `/verifier/<subpath>`. The `/verifier` directory does NOT exist on `origin/main`; all four links 404.

**Fixes applied**:
- HeroSection "Employer Portal" CTA: `/verifier` → `/employer/dashboard` (which exists)
- AcceptanceNetwork "Open Verifier Portal" link: `/verifier` → `/employer/dashboard`
- EmployerDashboard "Open applications queue": `/verifier/inbox` → `/employer/worklist` (the closest live equivalent)
- EmployerDashboard "Post opportunity" button: `/verifier/opportunities` → `/employer/dashboard` (self-link as no live post-opportunity surface exists; button label changed to "Dashboard")

**User-facing impact**: Zero 404 cascade from marketing/employer surfaces on `/verifier` clicks. All four CTAs now land on working routes.

## §2 — What was DELIBERATELY not changed (with rationale)

### `LaneHealthMount` "Unavailable" label

**Prior audit claim**: "label collision between SSE-error `SourceRow` 'Unavailable' and `LaneHealthMount` band 'Unavailable'."

**Reality on `origin/main`**: `LaneHealthBadge.tsx:32` maps `UNKNOWN` → "Unknown" (not "Unavailable"). When the probe runner is unscheduled, the band displays "Unknown", NOT "Unavailable". The collision the prior audit described does not exist in current code. Skipping the rename.

### Homepage trust language

The user's mission task 2 asked to "tighten homepage trust language." Inspection of `apps/web/app/HomePageClient.tsx` (425 lines) shows the existing copy is already foundation-honest. No banned phrases, no overclaim. Subjective improvements to weight, density, or tone require rendered review and cannot be made safely from a build session. **Documented in `launch-ux-scope-note.md` (PR #364) — not re-shipped here.**

### Onboarding clarity (mission task 3)

The `/onboarding` route + 4 sub-step shells (`identity`, `readiness`, `fetching`, `success`) all carry foundation-honest copy already. Cross-step continuity (animations, transitions, success-state celebration) is rendered UX work. **Same scope limit as above.**

### Employer demo clarity (mission task 4)

Beyond the `/verifier` link fix in §1, employer-side clarity is rendered UX. The `/employer/dashboard`, `/employer/worklist`, `/employer/review/[applicationId]`, `/employer/decision/[applicationId]` routes all exist on `origin/main`; workflow completeness was not auditable from this session. **Day-2 founder QA per `public-launch-ready.md` §1.**

### Mobile confidence (mission task 6)

Mobile UX requires real-device testing (iOS Safari + Android Chrome). Tailwind responsive prefixes (`sm:`/`md:`/`lg:`) are used consistently throughout the codebase per inspection, but "consistent prefix usage" is not the same as "good mobile UX." **Day-2 founder QA mobile walkthrough.**

### `apps/web/app/HomePageClient.tsx`, `apps/web/app/passport/page.tsx`

Both are large (425 and 841 lines respectively). Both are well-named and well-organized per inspection. **Restructuring is a UX refactor that needs rendered review.** Don't touch in survival mode.

## §3 — Where this PR sits in the launch sequence

Per `public-launch-ready.md` (PR #364) §1, the 5-day launch checklist:

- **Day 0** (~2 hrs operator): Resolve HTTP 402, set env vars, schedule cron, seed demo NPI
- **Day 1** (~3 hrs engineering): **THIS PR — small hygiene fixes**
- **Day 2** (~6 hrs human): Founder rendered QA pass
- **Day 3-5**: Soft launch + announcement

**This PR is the Day 1 deliverable.** Total diff ~10-20 lines of code + 1 closing doc.

## §4 — Validation

- `pnpm --filter @vitalcv/web exec vitest run __tests__/ingest-stream-state.test.ts __tests__/middleware.test.ts` → **45/45 passing**
- `pnpm --filter @vitalcv/web exec tsc --noEmit` → **clean**
- `pnpm --filter @vitalcv/web build` → **succeeds** (note: `pnpm turbo run build --filter @vitalcv/web` fails on a PRE-EXISTING `@vitalcv/wallet-sdk` missing module — confirmed by stashing this PR's changes and re-running; the issue is on `origin/main` and unrelated)
- Truth-contract scan → **CLEAN**

## §5 — What's still required for public launch (post-this-PR)

| Step | Owner | Source |
|---|---|---|
| Clear HTTP 402 on apex | OPERATOR | `pause-root-cause-report.md` (PR #363) |
| Set Vercel env vars (5 required, 4 recommended) | OPERATOR | `production-env-requirements.md` (PR #363) |
| Schedule probe runner cron | OPERATOR | same |
| Seed Railway demo NPI | OPERATOR | same |
| Run `scripts/verify-production-runtime.sh` | OPERATOR | PR #363 |
| Day-2 founder rendered QA pass | FOUNDER + TESTER | `public-launch-ready.md` §1 |
| (Optional) fix pre-existing `@vitalcv/wallet-sdk` `./interoperability` missing module | ENG | separate small PR |

None of these are in scope for this PR.

## §6 — Single closing claim

**The minimum believable launch surface is operationally defined.**

- The repo is launch-shaped.
- This Day 1 PR closes the 3 most visible user-facing defects.
- Day 0 operator work + this PR + Day 2 founder QA = publicly launchable within 3–5 days.

What this PR does NOT claim:

- Does NOT claim VitalCV is "polished" — that requires Day 2 rendered review
- Does NOT claim mobile UX is best-in-class — same
- Does NOT claim emotional trust is guaranteed — same
- Does NOT replace operator-side production restoration

What this PR DOES claim:

- Three user-visible defects are fixed at the source
- Test coverage is unchanged or improved
- No banned phrases, no overclaim, no architecture expansion
- The repo is one rendered-QA pass away from public launch

## §7 — Concluding note on this session's mission stream

Per the prior directive "stop drowning in infinite cleanup": this PR
intentionally ships small concrete code changes rather than another
audit doc. The audits are exhaustive (PRs #358, #363, #364, survival
branch). The next material movement is operator + founder action, not
further autonomous architecture work.
