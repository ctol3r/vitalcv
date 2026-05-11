# VitalCV Trust Boundaries

The canonical written contract that pairs with the live `/truth-boundary` surface
in `apps/web-v2`. If a claim is absent from the "verifies" list, treat it as not
verified. This doc and the rendered surface stay in lockstep via
`apps/web-v2/src/__tests__/truth-boundary.test.tsx`.

## VitalCV verifies

- NPI existence and status via live NPPES (CMS federal NPI registry).
- OIG / LEIE exclusion status (HHS OIG Exclusions database).
- Medicare enrollment status (CMS PECOS).
- Clinician session authentication (Clerk; IdPs configured in the Clerk Dashboard
  per the runbook at `docs/ops/clerk-google-oauth-runbook.md`).
- Credential issuance attribution (each issuance bound to the authenticated actor
  once the authenticated-manifest wiring lands).
- Replay lineage continuity (primitive shipped in PRs #312 and #313; wired into
  the response builder by W3-PR213A).
- Revocation state continuity (primitive shipped in PR #317 audit and PR #319
  durable schema; persistence wired by STATUS-PERSIST-WIRE).
- Verifier validation continuity via the `/api/receipts/verify` endpoint and the
  JWKS at `/.well-known/jwks.json` (see `docs/verifier-quickstart.md`).

## VitalCV does not verify

- Clinical competence or skill.
- Malpractice history detail (gated; NPDB requires institutional access).
- Employer-specific privileging.
- Board certification claims without an attached source receipt (self-asserted
  unless a receipt is present).
- Continuing education credits (self-asserted; no automated source feed).
- Workplace history (employer, dates, role) unless source-verified by a
  participating employer.
- State board action history beyond what is in the public LEIE (coverage varies
  by jurisdiction).

## Fail-closed semantics

- Unverifiable claims are rejected (verifier returns `{ verified: false }` with
  HTTP 422 — see `apps/web/app/api/receipts/verify/route.ts`).
- Revoked credentials are rejected. Revocation is append-only:
  `CredentialStatusHistory` (PR #319) records every transition; the latest state
  is enforced, but the trail is permanent.
- Replayable presentations are rejected. `VerifierNonce` table (schema present
  on origin/main) holds the used-nonce set; replay rejection is application-
  level + DB-enforced.
- Degraded verification is surfaced explicitly: the trust-boundary surface
  marks each backing system as `ok`, `ambiguous`, `failed`, or `unknown` —
  never substitutes a healthy label for a degraded one.
- Empty JWKS is treated as "no signature trust available" by verifiers — never
  as trust-by-default.

## State legend

These 7 states are the canonical verification vocabulary. The rendered surface
shows them in the matrix legend section:

| State | Meaning |
|---|---|
| **Source-verified** | Checked against a federal/state authority of record at time shown. Unambiguous. |
| **Source-linked** | Identifier resolved to a public source record, but the underlying claim is not source-checked. Identity binding only. |
| **Self-attested** | Provided by the clinician or an authorized actor. Not source-checked. |
| **Unavailable** | No source check attempted (source not integrated, or returned no record). Absence is NOT a clean signal. |
| **Revoked** | Source authority has explicitly revoked. History is append-only. |
| **Expired** | Source-verified at issue; validity window elapsed. Re-verify before reliance. |
| **Degraded — source unreachable** | Last-known state shown; source authority was unreachable on most recent check. Treat as last-known-good. |

## Trust language doctrine

- Never use the bare word "Verified" — always compound forms (`Source-verified`,
  `Source-linked`, `Source-backed`).
- Never use marketing prose, hedging ("typically", "usually"), or aspirational
  claims. State the system as built, not as intended.
- Never use crypto jargon (`hash`, `blockchain`, `immutable`) in user-facing
  copy — say `digest`, `append-only`, `tamper-detectable`.
- Never use AI hype language (`intelligent`, `automatic`, `smart`). Be specific
  about what runs deterministically.
- Banned phrases are enforced per `CLAUDE.md` (the repository-level truth
  contract) — that file is the canonical list. Lockdown tests in this PR and
  prior PRs assert the absence of every banned phrase on every user-facing
  surface. Do NOT enumerate the banned list in user-facing docs (so the docs
  themselves don't trip the scan).

## Rendering

Live consumer surface: `apps/web-v2/src/app/truth-boundary/page.tsx` mounting
`apps/web-v2/src/components/TruthBoundary.tsx`. Lockdown:
`apps/web-v2/src/__tests__/truth-boundary.test.tsx`.

If this doc changes, update the rendered surface in the same PR (and vice
versa). The lockdown enforces that the doc references real source endpoints and
that the surface honors the language doctrine above.
