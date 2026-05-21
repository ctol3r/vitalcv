# Verification Integrity Hardening

Binding rule for what visible verification, review, and readiness
surfaces are NOT allowed to claim. The wave normalizes six positive-
form certainty hits found on origin/main and ships a verifier that
blocks regressions.

Cut date: 2026-05-21.

## The rule

A visible institutional surface (anything under `apps/web/app/**`
and `apps/web/components/**` not under `_archive/`, `__tests__/`,
or `*.test.*`) MUST NOT use any of the following positive-form
claims **unless they derive deterministically from completed lane
evidence + explicit institution review**:

| Forbidden positive form | Why it is unsafe |
|---|---|
| `Credentials verified. Clear to proceed.` | Conflates substrate-side lane confirmation with institutional approval; the substrate cannot grant clearance |
| `Verified` (bare JSX label) | Manifest-tier shortcut; misrepresents per-lane state |
| `Approved` (status label) | Implies an institutional decision the surface cannot make |
| `Cleared` / `CLEARED` (status label) | Implies a substrate-side green light; only the institution clears |
| `Safe` / `SAFE` (status label outside merge-risk taxonomy) | Implies a guarantee no source can provide |
| `Clear to proceed` | Decision-grade language; the substrate is not a decision-maker |
| `Approved automatically` | Fake automation in the approval lane |

## Evidence-bounded status vocabulary (binding)

The visible status on any lane / review / readiness surface MUST
draw from this six-state set:

| Visible state | Meaning | Derivable from |
|---|---|---|
| `Review completed` | The receiving institution recorded a review outcome | Institution-owned action |
| `Review pending` | The receiving institution has not yet reviewed | No action needed; institution-owned |
| `Additional review required` | The substrate completed but a lane returned a stale-but-signed or access-required posture | Lane evidence + operator note |
| `Source unavailable` | An upstream registry could not be reached within the freshness budget | Lane timeout / network failure |
| `Verification incomplete` | One or more lanes have not completed | Lane state |
| `Requires institution review` | The substrate has finished what it can; the next step is institutional | Lane evidence + receiving institution's ownership |

Substrate-side lane states (`source_confirmed`, `evidence_pending`,
`continuity_restored`, `continuity_interrupted`) remain as defined
in `canonical-operational-language.md` (when merged). The
evidence-bounded states above are derived from the substrate states
+ the institution-owned action.

## Audit · what was repaired

Six positive-form certainty hits were found on origin/main and
repaired:

| File | Before | After |
|---|---|---|
| `apps/web/app/review/[entityId]/ConsoleWrapper.tsx:148` | `Credentials verified. Clear to proceed.` | `Lane evidence completed. Institution review still required before a final decision.` |
| `apps/web/app/review/[entityId]/ConsoleWrapper.tsx:147` | `Adverse finding detected. Manual review required before proceeding.` | `Adverse finding detected. Institution review required before proceeding.` |
| `apps/web/app/review/[entityId]/ConsoleWrapper.tsx:151` | `Primary identity verified. Additional sources pending` | `Identity lane source-confirmed. Additional sources require institutional access` |
| `apps/web/app/employer/dashboard/page.tsx:21-22` | `Approved` / `Rejected` (status labels) | `Marked Review-Complete` / `Not Eligible (Institution-Owned)` |
| `apps/web/components/employer/StartClinicianAction.tsx:343` | `Superbrain ... CLEARED ... unlocks` | `Source-resolution ... Source-confirmed ... unlocks; institution review remains required` |
| `apps/web/components/employer/VerifierCommandCenter.tsx:216` | `aria-label="Approved"` | `aria-label="Marked review-complete"` |
| `apps/web/components/hero/SandboxHero.tsx:129` | `VERIFIED` (bare label) | `SOURCE-CONFIRMED` |
| `apps/web/components/hero/SandboxHero.tsx:133` | `CLEAR` | `NO ADVERSE RECORDS` |

## Degraded-state visibility (binding)

A surface that renders any verification / review state MUST expose
the following degraded states when they exist; it MUST NOT collapse
them into a generic "pending" or hide them entirely:

| Degraded state | When it occurs | What the surface must show |
|---|---|---|
| `SOURCE_TIMEOUT` | Upstream registry exceeded the freshness budget | Lane name + "Source did not respond within budget" + operator note |
| `SOURCE_UNAVAILABLE` | Upstream registry returned an error or 5xx | Lane name + "Source unavailable" + operator note |
| `ACCESS_REQUIRED` | The lane requires institutional credentials we don't hold | Lane name + "Requires institutional access" + which credential class |
| `REVIEW_PENDING` | The receiving institution has the packet but has not reviewed | "Review pending with [institution]" + last-touch timestamp |
| `PARTIAL_COMPLETION` | Some lanes completed, others did not | Per-lane breakdown; no aggregate "verified" claim |
| `CONTINUITY_INTERRUPTED` | A lane returned stale-but-signed | "Stale-but-signed; institution dispositions on its own credential" |

These six degraded states are the **complete** set the surface may
render. Generic copy ("something went wrong", "please try again")
is not acceptable; the operator must see which lane failed and
what the next step is.

## Deterministic review posture (binding)

A surface that renders a posture (e.g. "ready to proceed",
"requires review") MUST derive that posture from:

1. **Completed lane evidence** — each lane has a recorded state
   from the canonical Continuity axis (`source_confirmed`,
   `evidence_pending`, etc.)
2. **Explicit institution review** — a recorded action by the
   receiving institution (queued / in_review / returned_to_operator /
   institution_owned per the canonical Review-ownership axis)
3. **Visible bounded certainty** — the surface explicitly shows
   the operator what was checked, what was not, and what remains
   pending

It MUST NOT derive a posture from:

- **Manifest-tier shortcuts** — a single "trust score" or "tier
  badge" that aggregates multiple lanes into one number
- **Implicit "good enough"** rules — if 3 of 4 lanes pass, do NOT
  flip the posture to "ready" without explicit institution review
- **Cached posture from a prior session** — every visible posture
  must be derivable from the current substrate read

## Surfaces deliberately NOT modified

| Surface | Reason |
|---|---|
| `_archive/*` trees | Retired code |
| `__tests__/*` | Tests may reference banned phrases for negative assertion |
| API route source code | API surfaces serve substrate clients; substrate vocabulary is appropriate |
| `docs/*.md` | Doctrine docs may enumerate banned phrases in rejection tables |
| Lane status values for OIG/LEIE in fixtures (`'CLEAR'` as a positive operational finding) | The hero label "CLEAR" was normalized; data-side string "CLEAR" as a lane outcome remains in fixtures for backward compatibility, mapped to "No adverse records" on render |

## Verifier behavior

`scripts/verify-verification-integrity.ts` walks
`apps/web/{app,components}` (excluding `_archive/`, `__tests__/`,
`*.test.*`), and scans each file for the banned positive-form
claims. Three sub-modes:

- `enforce` (default) — exits non-zero on any FAIL
- `report` — scan + summary; never exits non-zero
- `degraded-states-only` — scans for legitimate degraded-state
  exposure (renders NOTE entries when a verification surface does
  not import any of the six degraded states; not a FAIL)

## Governance

A new visible verification / review / readiness surface MUST:

1. Avoid every banned phrase in the table above
2. Use the binding evidence-bounded vocabulary
3. Expose degraded states (not hide them)
4. Derive posture deterministically from lane evidence + explicit
   institution review (no manifest-tier shortcuts)
5. Pass `pnpm verify:verification-integrity` (default = enforce)
   with zero FAILs

PRs that violate any of the five are rejected at Codex audit.
