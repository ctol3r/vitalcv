# Canonical Operational Language

Single canonical vocabulary for all institutional-surface waves. The
five axes below are binding; a wave that wants to use a different
term MUST add the term to this doc in the same PR.

Existing surfaces that shipped per-wave taxonomies (`/demo/waste`,
`/ops`, `/holder`, `/operator`, etc.) are reconciled when they
merge: each PR's per-wave terms map to a canonical axis state via
the **Reconciliation tables** at the end of this doc.

## Five axes

| # | Axis | Owner of progression |
|---|---|---|
| 1 | Continuity | Substrate (per lane) |
| 2 | Readiness | Cohort + clinician |
| 3 | Interruption | Operator + institution |
| 4 | Review ownership | Receiving institution |
| 5 | Deployment progression | Receiving institution |

Every visible state on every institutional surface MUST map to one
axis × one canonical state. Cross-axis mixing (e.g. using a
`continuity` term to describe a `review` state) is forbidden.

## Axis 1 · Continuity (per lane)

Used by federal-source lanes (NPPES, OIG/LEIE, PECOS) and any other
substrate-driven evidence stream.

| Canonical state | Meaning |
|---|---|
| `source_confirmed` | Lane resolved against the source registry within the freshness budget |
| `evidence_pending` | Lane is waiting on source data |
| `continuity_restored` | Lane recovered after a stale-but-signed posture or registry blip |
| `continuity_interrupted` | Lane is currently in a stale-but-signed posture |

User-facing labels are: **Source-confirmed** · **Evidence pending**
· **Continuity restored** · **Continuity interrupted**.

## Axis 2 · Readiness (cohort + clinician)

Used by per-cohort progress strips and per-clinician readiness
summaries.

| Canonical state | Meaning |
|---|---|
| `ready_for_review` | Clinician's federal-source lanes are complete; ready for receiving-institution review |
| `pending_review` | Clinician is in receiving-institution review on its own cadence |
| `recently_reviewed` | Receiving institution has reviewed; no operator follow-up due |
| `requires_followup` | Operator must look at this row now |

User-facing labels are: **Ready** · **Pending review** ·
**Recently reviewed** · **Requires follow-up**.

## Axis 3 · Interruption (operator + institution)

Used by interruption narratives and recovery panels.

| Canonical state | Meaning |
|---|---|
| `none` | No interruption present |
| `present` | An interruption is current (e.g. upstream registry slow) |
| `operator_acknowledged` | Operator has acknowledged the interruption locally |
| `institution_dispositioned` | Receiving institution dispositioned (e.g. accepted the stale-but-signed posture or re-fetched on own credential) |

User-facing labels are: **No interruption** · **Interruption
present** · **Operator acknowledged** · **Institution dispositioned**.

## Axis 4 · Review ownership

Used by review-progress panels.

| Canonical state | Meaning |
|---|---|
| `queued` | Receiving institution has not yet picked up the review |
| `in_review` | Receiving institution is reviewing |
| `returned_to_operator` | Receiving institution returned to operator for follow-up |
| `institution_owned` | Receiving institution has made an institution-owned decision |

User-facing labels are: **Queued** · **In review** · **Returned to
operator** · **Institution-owned**.

## Axis 5 · Deployment progression

Used by deployment-readiness summaries.

| Canonical state | Meaning |
|---|---|
| `not_started` | Clinician is in intake; no deployment work has begun |
| `preparing` | Deployment kit is being assembled |
| `awaiting_institution` | Institution-owned step (committee / privileging / final acceptance) is in flight |
| `deployment_ready` | Receiving institution has accepted; clinician is ready for first patient on the institution's own cadence |

User-facing labels are: **Not started** · **Preparing** ·
**Awaiting institution** · **Deployment ready**.

## Cross-axis rules

1. **One axis per state declaration.** A row that names a state MUST
   specify which axis. If a UI conflates two axes (e.g. an
   "Attention needed" badge that mixes continuity + readiness),
   the surface MUST split into two badges.

2. **Substrate jargon never appears on a primary surface.** Words
   like `survivabilityScore`, `dedupeKey`, `lineageKey`, `kid`,
   `JWKS`, `DID`, `replay chronology`, `degradationOwnership` are
   forbidden on the user-facing surface. They are permitted only
   inside a progressive-disclosure body that operators explicitly
   open.

3. **"Institution-owned" is binding.** Any state that the
   receiving institution owns MUST carry the literal phrase
   "institution-owned" somewhere on the surface. The phrase is
   load-bearing; it cannot be replaced by softer synonyms.

4. **Trustless / blockchain semantics are banned.** Words like
   `trustless`, `permissionless`, `decentralized`, `on-chain`,
   `crypto-native`, `web3` are not allowed on any institutional
   surface, even inside a disclosure body.

## Reconciliation tables

These tables map the per-wave taxonomies shipped on the currently
open PRs to canonical axes and states. Reconciliation is **forward**
only: a wave that merges later than this doc MUST conform; a wave
that already merged keeps its labels but its surface is reconciled
in a follow-up wave.

### Wave 22 (`/demo/waste`)

Per-wave taxonomy: `demonstrated` / `observed` / `simulated` /
`unsupported` / `institution-owned`.

This taxonomy is a **claim-state taxonomy**, not an operational
axis. It is allowed because it describes what the page claims; it
is reconciled by being kept on the `/demo/waste` page only.

### Wave 23 (`/ops`, `/holder`)

Per-wave taxonomy: `Confirmed` / `Pending` / `Attention needed` /
`Recently reviewed` / `Requires follow-up`.

| Wave 23 label | Canonical axis × state |
|---|---|
| `Confirmed` | Continuity × `source_confirmed` |
| `Pending` | Readiness × `pending_review` |
| `Attention needed` | Readiness × `requires_followup` |
| `Recently reviewed` | Readiness × `recently_reviewed` |
| `Requires follow-up` | Readiness × `requires_followup` |

### Wave 24 (`/pilot`, `/employer/review`, `/holder`, `/verify`)

Per-wave taxonomy: `executable` / `simulated` / `institution-owned`
/ `intentionally-incomplete` / `future-state`.

This is a **flow-state taxonomy**, not an operational axis. It is
allowed on doctrine docs (and only doctrine docs).

### Wave 27 (`/operator`)

Per-wave taxonomy: `Ready` / `Pending review` / `Attention needed`
/ `Interrupted` / `Continuing` / `Complete`.

| Wave 27 label | Canonical axis × state |
|---|---|
| `Ready` | Readiness × `ready_for_review` |
| `Pending review` | Readiness × `pending_review` |
| `Attention needed` | Readiness × `requires_followup` |
| `Interrupted` | Interruption × `present` |
| `Continuing` | Continuity × `continuity_restored` |
| `Complete` | Continuity × `source_confirmed` |

## Governance

A new wave introducing user-facing terms MUST:

1. Trace each term to one row in Axis 1-5 above
2. Update the per-wave reconciliation table when its labels diverge
3. Avoid substrate jargon outside a disclosure
4. Use the literal phrase "institution-owned" on every surface where
   the receiving institution owns the next decision
5. Avoid every banned phrase in the cross-axis rules

PRs that violate any of the five are rejected at Codex audit and by
`scripts/verify-operational-convergence.ts`.
