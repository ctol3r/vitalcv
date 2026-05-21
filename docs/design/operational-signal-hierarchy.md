# Operational Signal Hierarchy

Single-page reference for how surfaces lead with **one operational
signal** and **one primary action**, with all infrastructure-native
detail progressively disclosed.

The hierarchy is binding: any new institutional surface that
violates these rules is rejected at audit.

## Rule 1 · One primary signal per surface

Every institutional surface (`/ops`, `/holder`, demo routes that
expose a status read) MUST lead with exactly one
`PrimaryOperationalSignal`. The signal state is one of:

| State | User-facing label |
|---|---|
| `confirmed` | Confirmed |
| `pending` | Pending |
| `attention_needed` | Attention needed |
| `recently_reviewed` | Recently reviewed |
| `requires_followup` | Requires follow-up |

These five labels are the **only** user-facing operational
vocabulary. Substrate jargon (`survivabilityScore`,
`degradationOwnership`, `lineageKey`, `replay chronology`,
`issuer continuity`, `dedupeKey`, `actor_id`, `kid`, `JWKS`, `DID`,
`σ`, etc.) is forbidden on the primary surface and only allowed
inside a `ProgressiveTechnicalDisclosure`.

## Rule 2 · One primary action per surface

Each surface MUST contain at most ONE `InstitutionalPrimaryAction`.
The label MUST be drawn from the binding action vocabulary:

- `Review readiness`
- `Share continuity`
- `Continue onboarding`
- `Acknowledge review`
- `Open operator detail`

A surface with zero primary actions is allowed (read-only
narratives, summary panels). A surface with two or more primary
actions is a regression and must be split.

## Rule 3 · Quiet status strip carries axes, never numbers

`QuietStatusStrip` exists to give the operator a one-line read on
the underlying axes (identity, verifier continuity, issuance, source
health, invariants, alerts). Each entry shows:

- the axis name (plain English; no `DID`/`JWKS`/`kid`)
- one of the five user-facing labels

The strip does NOT carry raw numbers, percentages, or technical IDs.
If the operator needs them, they open the progressive disclosure.

## Rule 4 · Progressive disclosure is the ONLY allowed home for technical detail

Anything that uses substrate jargon -- replay survivability, signer
health, DID document URIs, JWKS endpoints, doctrine honesty scores,
canonical-JSON, ETag tables, hash-chain lineage, run-id chronology,
trust manifest paths -- lives inside a
`ProgressiveTechnicalDisclosure`. The disclosure is collapsed by
default. The summary line uses plain English ("Show operator
substrate", "Show passport, wallet, and credential detail").

A surface that renders substrate jargon outside a disclosure is a
regression.

## Rule 5 · No equal-weight panel grids

Equal-weight 3-up / 5-up / 8-up panel grids are forbidden as the primary visual element. The primary signal is the dominant block; the strip is secondary; the disclosure is tertiary.

Existing dense panels (replay continuity panel, verifier continuity
panel, degraded state topology map, runtime identity panel,
deployment convergence strip, source lane telemetry, chronology
integrity telemetry, etc.) are PRESERVED but moved into the
disclosure -- never deleted, never replaced.

## Rule 6 · Status vocabulary normalization

| Forbidden on primary surface | User-facing equivalent |
|---|---|
| `survivabilityScore: 95/100` | `Confirmed` (or `Requires follow-up` if score < 90) |
| `degradationOwnership: source_unreachable` | `Attention needed` |
| `lineageKey: 0xabc…` | not shown on primary surface |
| `replay chronology coherent` | `Confirmed` |
| `issuer continuity: ok` | `Confirmed` |
| `kid: dev-issuer-key-…` | not shown on primary surface |
| `JWKS endpoint operational` | not shown on primary surface |
| `dedupeKey active` | not shown on primary surface |
| `actor_id attribution complete` | `Confirmed` |
| `DID resolves` | `Confirmed` |

The forbidden labels remain in the data model (no protocol shift)
and remain visible inside the disclosure. They are simply not
allowed to leak into the primary read.

## Rule 7 · No crypto aesthetics on the primary surface

The primary surface uses a quiet, monochrome palette (slate / amber
single-axis tone). Green-on-black, neon dots, monospace blocks of
hex, "DID" / "JWKS" / "JWT" badges, and other crypto-aesthetic
chrome are forbidden on the primary read.

Crypto aesthetics are allowed INSIDE the technical disclosure
because operators reading the substrate detail need them. They are
forbidden OUTSIDE the disclosure.

## Rule 8 · Progressive disclosure is for detail, not novelty

The disclosure is a containment boundary for existing substrate, not
a place to introduce new panels. New panels should be:
1. Composed in `apps/web/components/signals/` if they belong to the
   primary surface
2. Composed in the existing panel directory (`components/ops/`,
   `components/wallet/`, `components/trust-state/`, etc.) if they
   belong inside the disclosure

This wave introduced ZERO new panels outside `components/signals/`
and ZERO substrate changes.

## Surface-by-surface compression record

| Surface | Before | After |
|---|---|---|
| `/ops` | 8 equal-weight panels at first read | 1 primary signal + 1 strip + (conditional) attention + 1 primary action; 8 panels live inside one disclosure |
| `/holder` (has_npi) | 6 equal-weight panels at first read | 1 primary signal + 1 primary action ("Review readiness"); 5 panels live inside one disclosure |
| `/holder` (no_npi) | unchanged | unchanged (already a single-CTA empty-state) |
| `/holder` (error) | unchanged | unchanged (already a single-CTA error state) |
| `/holder/readiness` | unchanged | unchanged (already a single split-pane, no equal-weight grid) |

## Primitives shipped

| Primitive | File | Role |
|---|---|---|
| `PrimaryOperationalSignal` | `apps/web/components/signals/PrimaryOperationalSignal.tsx` | One dominant signal block per surface |
| `AttentionRequiredPanel` | `apps/web/components/signals/AttentionRequiredPanel.tsx` | Conditional follow-up list; renders nothing when empty |
| `QuietStatusStrip` | `apps/web/components/signals/QuietStatusStrip.tsx` | Per-axis one-line strip |
| `ProgressiveTechnicalDisclosure` | `apps/web/components/signals/ProgressiveTechnicalDisclosure.tsx` | The only allowed home for substrate jargon |
| `InstitutionalPrimaryAction` | `apps/web/components/signals/InstitutionalPrimaryAction.tsx` | The one primary CTA |

Plus the pure compositor `apps/web/lib/signals/composeOperationalSignal.ts`
which translates the operator dashboard snapshot into the
user-facing signal state.

## Governance

A new institutional surface MUST:

1. Lead with a `PrimaryOperationalSignal`
2. Carry at most one `InstitutionalPrimaryAction`
3. Place any substrate jargon inside a `ProgressiveTechnicalDisclosure`
4. Use only the five binding labels (Confirmed / Pending / Attention needed / Recently reviewed / Requires follow-up)
5. Use only the five binding primary-action labels
6. Avoid equal-weight panel grids as the primary visual

PRs that violate any of the six are rejected at Codex audit. The
signal-integrity tests (`apps/web/__tests__/operational-signal-hierarchy.test.tsx`)
encode rules 1, 2, 4, 5, and 6 as machine-checkable invariants.
