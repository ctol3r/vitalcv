# Institutional Trust Primitive Map

Forensic inventory of the design archive, mapping each surface to canonical
reusable primitives or rejecting it as non-canonical. This document is the
audit trail for the `feat/institutional-trust-primitives` wave.

## Source archive

```
Dropbox/vitalcv (7)/
  Trust Primitives.html                  # canonical visual grammar — primary source
  Lineage Header.html                    # six-cell header anatomy
  Lineage Row.html                       # row anatomy (six primitives per claim)
  Failure Taxonomy.html                  # five failure modes A/B/C/D/E
  Degraded State Semantics.html          # plane ownership + severity S0–S4
  Replay Chronology Topology.html        # chain topology + chronology grammar
  Institutional Replay Ledger.html       # operational-history surface
  Institutional Receipt.html             # signed-receipt evidentiary register
  Human Trust Surface.html               # plain-language verifier onboarding
  Trust State Register.html              # three-state visual register
  Trust State Transitions.html           # S0/S1/S2/S3 state machine
  Visual Grammar Canon.html              # visual rules
  Receipt Reading Doctrine.html          # how to read a receipt
  Replay Memory.html                     # memory model for replay
```

## Reading-order contract (binding)

Every trust surface composes the same six primitives in the same order:

```
OBJECT → OWNERSHIP → CHECKED_AT → CHANNEL → REPLAY → RUN_ID
```

Surfaces compose; they never invent. This contract is encoded in
`apps/web/lib/trust/replay-grammar.ts` as a tuple type that fails the build
if any consumer attempts to reorder or omit a slot.

## Three trust states (binding)

| State | Border | Authority | What it means |
|---|---|---|---|
| `preview` | dashed paper border | none | anonymous exploration; no claim asserted |
| `snapshot` | solid ink-700 | internal | authenticated; ownership claimed; not yet signed |
| `signed` | inverted ink-950 + dark cap | issuer-bound | issuer-signed; re-verifiable offline |

## Five failure modes (binding)

| Mode | Letter | Plane | Owner | UI state |
|---|---|---|---|---|
| Source unreachable | A | Upstream | upstream registry | dashed lane chip · stale checked_at |
| Anonymous restriction | B | Policy | VitalCV policy + holder | greyed; sign in to verify |
| Infrastructure outage | C | Verifier | VitalCV (paged) | black status banner |
| No adverse findings | D | Subject (outcome) | nobody — system worked | solid lane chip · 0 records |
| Issuer unavailable | E | Cryptographic | VitalCV keyholder quorum | inverted black banner |

Severity hierarchy is **plane ownership, not danger**:
`S0=D (success) · S1=A · S2=B · S3=E · S4=C`.

Mode D is **success**, not failure. Mode D copy is "no adverse findings",
**never** "no findings" or "no results".

## Canonical primitives extracted

Implemented under `apps/web/components/trust/primitives/`:

| Primitive | Source | What it renders |
|---|---|---|
| `LineageHeader` | Lineage Header.html · Trust Primitives §01 | Six-cell mandatory-reading-order header |
| `LineageRow` | Lineage Row.html · Trust Primitives | One claim row · six labeled primitives |
| `TrustReceipt` | Institutional Receipt.html | Signed evidentiary register (dark plane) |
| `ReplayTimeline` | Replay Chronology Topology.html · Trust Primitives §02 | Chain head ← prev hashes with σ defer notches |
| `DegradedStatePanel` | Degraded State Semantics.html · Failure Taxonomy.html | Mode A/B/C/D/E surface with owner + action |
| `FailureTaxonomyBadge` | Failure Taxonomy.html · Trust Primitives §05 | 5-mode chip (A/B/C/D/E + plane) |
| `OwnershipStateBadge` | Trust Primitives §04 | subject · delegated · unbound (3 fixed values) |
| `TierBadge` | Trust Primitives §03 | T1 self-attest · T2 third-party · T3 authoritative · T4 issuer-signed |
| `CheckedAtStamp` | Trust Primitives §07 | ISO 8601 UTC + relative age; degraded = dashed left border |
| `HumanReviewLane` | Human Trust Surface.html · Trust Primitives §08 (run_id) | Manual-operator lane wrapper |
| `RevocationStateBanner` | Trust State Transitions.html · StatusList2021 cell | Hard interruption / revoked credential break |

## Concepts rejected (non-canonical / not present in archive)

The mission listing names several primitives that do not appear in the
attached archive and have no operational semantics defined:

| Concept | Status | Reason for rejection |
|---|---|---|
| `Audit Ledger D52` | **rejected** | "D52" is not present in any archive file; there is no D52-numbered audit ledger spec. Existing `Institutional Replay Ledger` covers operational history. |
| `Operational Guardrails` (as named primitive) | **rejected as primitive** | Archive treats guardrails as *rules* on existing primitives (e.g. "never reorder cells", "never recolor on age", "never invent T5"), not as a renderable component. Encoded instead as type-level constraints and lint guards. |
| `Executive Share` | **rejected** | Not present in the archive. "Executive summary" appears in `Human Trust Surface.html` as a plain-language summary block (rendered by existing `EvidenceDisclosureCard`/`TrustContainerPanel`), not as a separate share primitive. |
| `Clinician Passport Revoked` (as bespoke primitive) | **collapsed** | Folded into `RevocationStateBanner` because revocation is a credential state (StatusList2021 bit), not a passport-specific surface. The existing `apps/web/app/passport/[id]` route renders the banner when the revocation bit is set. |

Adding bespoke components for these would be cargo-culting — they have no
defined semantics in the source archive.

## Visual semantic system

| Concept | Visual encoding (binding) |
|---|---|
| degraded | dashed border / interrupted continuity / honest age label |
| revoked | hard interruption (red lineage break, status bit 1) |
| human-reviewed | signed / manual / operator-lane chrome |
| replayable | deterministic chronology with head ← prev arrows |
| institutional | dense, quiet, high-signal (no gradients, no animation) |
| receipt surfaces | dark cryptographic register **only** when issuer-signed |

Explicit non-rules (binding):
- never yellow/orange/red for failure modes (only mode-A dashed slate)
- never animate state transitions
- never recolor on age (border degrades; text stays legible)
- never collapse states to "something went wrong"
- never reorder reading-order slots
- never invent a T5 tier
- never use "anonymous" or "guest" for `OwnershipState` (only `subject` / `delegated` / `unbound`)

## Replay grammar

```
Object → Ownership → checked_at → Channel → Replay → run_id
```

Encoded in `apps/web/lib/trust/replay-grammar.ts` as `LineageSlots` (typed
tuple) and `composeLineage(...)` (returns slots in canonical order). Any
attempt to render a lineage without all six slots fails the type-check.

## Failure / degradation grammar

Encoded in `apps/web/lib/trust/degradation.ts`:

- `FailureMode` discriminated union (`'A' | 'B' | 'C' | 'D' | 'E'`)
- `FailurePlane` (`'upstream' | 'policy' | 'verifier' | 'subject' | 'issuer'`)
- `Severity` (`'S0' | 'S1' | 'S2' | 'S3' | 'S4'`)
- `describeFailureMode(mode)` returns human-readable copy verbatim from the
  archive: title, owner, user-sees, action, plane, severity.

## Operational language

Encoded in `apps/web/lib/trust/institutional-language.ts`:

- Canonical phrase constants (`INSTITUTIONAL_PHRASES`)
- `BANNED_INSTITUTIONAL_PHRASES` runtime guard for dev-only assertions

## Integration boundaries

This wave **introduces** the primitives. It does **not**:
- create new routes
- modify existing trust-canon routes
- touch Prisma, env, or schema
- introduce CSS globals
- redesign existing trust-canon UI

A follow-up wave will additively wire primitives into existing routes
(`/passport/[id]`, `/verify/receipt/[receiptId]`, `/dossier/[receiptId]`,
`/review/[entityId]`) only where the primitive replaces an ad-hoc renderer
without changing surface behavior.

## Truth-contract status

No file in this wave introduces:
- bare "Verified" status label
- `automatically verified`, `guaranteed verification`, `complete credentialing`,
  `instant credentialing`, `legally accepted`, `risk transferred`,
  `final verification without review`, `source confirmed before response`,
  `certified compliant`, `HIPAA compliant`, `SOC2 certified`

Verified by `apps/web/__tests__/banned-verified-label.test.ts` and the
new `apps/web/__tests__/institutional-trust-primitives.test.ts`.
