# Claude Design Alignment Audit

**Phase 2 of the final institutional convergence wave.**
**Branch:** `wave/canonical-route-map`. **HEAD:** `0fae815c`.
**Scope:** audit `origin/main` against the Claude Design six-slot
visual/semantic contract.

## The contract

Per session-carry, the institutional surfaces are required to render
in this order:

```
OBJECT → OWNERSHIP → CHECKED_AT → CHANNEL → REPLAY → RUN_ID
```

Combined with the four-rung authority ladder:

```
T1  Self-asserted          (clinician-typed, no verification)
T2  AI-inferred            (derived from clinician-uploaded artifacts)
T3  Source-checked         (federal/state registry primary-source verified)
T4  Issuer-signed          (cryptographically signed by issuing authority)
```

And the deterministic degraded-state taxonomy (degraded-state-foundation
on `origin/main`):

```
offline | upstream_unavailable | upload_failed
| source_probe_unknown | retry_required | local_draft_only
```

These three contracts are the design surface this phase audits.

## §1 — Per-primitive presence audit (origin/main)

A primitive is "PRESENT" only if its file lives on `origin/main`.

| Primitive | origin/main path | Status |
|---|---|---|
| `TrustHeader` (six-slot composite) | `apps/web/components/trust/TrustHeader.tsx` | ABSENT — lives on unmerged Lane B stack |
| `TierBadge` / `TrustTierBadge` | `apps/web/design-system/components/TrustTierBadge.tsx` | PRESENT — T1–T4 enum + tier meta; `apps/web/design-system/components/ConfidenceTierBadge.tsx` is a sibling for prediction confidence |
| `ReplayLineage` | `apps/web/components/trust/ReplayLineage.tsx` | ABSENT |
| `RecentNpis` | `apps/web/components/trust/RecentNpis.tsx` | ABSENT |
| `ReplayIntegrityPanel` | `apps/web/components/trust/ReplayIntegrityPanel.tsx` | ABSENT |
| `RunIdentity` | `apps/web/components/trust/RunIdentity.tsx` | ABSENT |
| `CheckedAtStamp` | `apps/web/components/trust/CheckedAtStamp.tsx` | ABSENT |
| `IssuerAttribution` | `apps/web/components/trust/IssuerAttribution.tsx` | ABSENT |
| `OwnershipState` | `apps/web/components/trust/OwnershipState.tsx` | ABSENT |
| `DegradedStateBanner` | `apps/web/components/trust/DegradedStateBanner.tsx` | ABSENT (banner component); but the underlying policy `degradedStateFoundation.ts` IS PRESENT at `apps/web/lib/degraded-state/` |
| `TrustStateBand` / `LaneStateBadge` | `apps/web/design-system/components/LaneStateBadge.tsx` + `LaneStateLegend.tsx` | PRESENT (lane band primitives exist) |
| `FreshnessIndicator` | `apps/web/design-system/components/FreshnessIndicator.tsx` | PRESENT |
| `IdentityField` | `apps/web/design-system/components/IdentityField.tsx` + `IdentityFieldsCard.tsx` | PRESENT |
| `Timeline` | `apps/web/design-system/components/Timeline.tsx` | PRESENT |
| `ProviderCard` | `apps/web/design-system/components/ProviderCard.tsx` | PRESENT |
| `EvidenceTable` | `apps/web/design-system/components/EvidenceTable.tsx` | PRESENT |

**Presence summary on origin/main:** 7 of the 11 verifier-continuity-
specific primitives are ABSENT; the 4 that are PRESENT (`TrustTierBadge`,
`LaneStateBadge`, `FreshnessIndicator`, `IdentityField`) cover only the
T1–T4 tier ladder and lane-state band. The composite six-slot
`TrustHeader` that enforces OBJECT → OWNERSHIP → CHECKED_AT → CHANNEL →
REPLAY → RUN_ID rendering order has no implementation on `origin/main`.

## §2 — Six-slot order compliance per surface (origin/main only)

A surface is "COMPLIANT" only if the slots render in canonical order.

| Surface | OBJECT | OWNERSHIP | CHECKED_AT | CHANNEL | REPLAY | RUN_ID | Verdict |
|---|---|---|---|---|---|---|---|
| `/passport` (client page) | ✓ identity card | ✗ | ✗ | ✗ | ✗ | ✗ | NON-COMPLIANT (slots 2–6 absent) |
| `/passport/[id]` (entity client) | ✓ | partial | partial | ✗ | ✗ | ✗ | NON-COMPLIANT |
| `/trust` (institutional overview) | n/a — page absent on main | n/a | n/a | n/a | n/a | n/a | TARGET (lives on unmerged #355) |
| `/verify` (institutional inspector) | n/a — page absent on main | n/a | n/a | n/a | n/a | n/a | TARGET (lives on unmerged #345) |
| Receipt page (any) | n/a | n/a | n/a | n/a | n/a | n/a | TARGET (no receipt-rendering page exists) |
| Degraded state banner | n/a — banner component absent | n/a | n/a | n/a | n/a | n/a | TARGET |
| Ops surfaces (`/internal/metrics`) | object name partial | partial | ✗ | ✗ | ✗ | ✗ | NON-COMPLIANT |
| `/api/health` (JSON status) | `service: "web"` | ✗ | `timestamp` | ✗ | ✗ | ✗ | NON-COMPLIANT (JSON does not declare slot order) |
| Receipt JWT payload (on unmerged stack) | `sub` | `iss` + `kid` | `iat` | n/a (channel implicit) | `jti` carries runId on #349 | partial | TARGET-COMPLIANT |
| Chronology row (any UI) | n/a — no chronology page exists | n/a | n/a | n/a | n/a | n/a | TARGET |

**Compliance summary:** zero surfaces on `origin/main` render the six-slot
order today. The compliant target rendering ships on the unmerged Lane B
stack. The four lane-state / tier-ladder primitives that DO ship on
`origin/main` are slot-2-and-6 contributors (OWNERSHIP via the tier
badge, RUN_ID is not yet wired); they do not enforce ordering.

## §3 — Monospaced-identifier audit

Per the design contract, identifiers like `runId`, `lineageKey`, `jti`,
`kid`, `did:web:` should render in monospace and copyable form.

On `origin/main`:

- `RunId`/`lineageKey` identifiers do not appear in any UI (per agent #6 schema audit).
- `kid` is present in the legacy JWKS surface and in `signIssuerReceipt` header; no UI exposes it.
- `did:web:` does not appear in any UI on `origin/main`.

Verdict: monospaced-identifier rendering is N/A on `origin/main` (no
identifier is rendered in any UI). On the unmerged stack, `TrustHeader`
and `RunIdentity` primitives apply `font-mono` styling per session-carry.

## §4 — Failure taxonomy alignment

The Claude Design taxonomy (per session-carry) is the **A/B/C/D/E
five-state model** where `D` is "no adverse findings" rendered as
SUCCESS. The `origin/main` taxonomy is the **six-state degraded-state
foundation** at `apps/web/lib/degraded-state/degradedStateFoundation.ts`:

```
offline | upstream_unavailable | upload_failed
| source_probe_unknown | retry_required | local_draft_only
```

These are **not the same taxonomy**. They overlap conceptually but use
different state names and different cardinalities.

**Alignment verdict:** divergent. Closure options:

- (a) Document `origin/main`'s six-state model as the authoritative
  runtime taxonomy and retire the A/B/C/D/E framing from session memory.
- (b) Add a mapping table that translates A/B/C/D/E → the six runtime
  states, so the design contract and the runtime contract agree.

The honest action: do (a). The six-state model is the one with code on
`origin/main`; the A/B/C/D/E framing exists only in session memory and on
unmerged-PR component code.

## §5 — Per-axis verdicts (the 10 alignment axes from the brief)

| Axis | Verdict on `origin/main` | Evidence |
|---|---|---|
| 1. Lineage Header alignment | NON-PRESENT (no header primitive shipped) | §1 row 1 |
| 2. Replay Memory alignment | NON-PRESENT (no replay UI primitives shipped) | §1 rows 3–5 |
| 3. Verifier Reading Mode alignment | NON-PRESENT (no `/verify` or `/trust` page on main) | §2 rows for `/verify` and `/trust` |
| 4. Failure Taxonomy alignment | DIVERGENT (6-state runtime vs 5-state design contract) | §4 |
| 5. Trust State Register alignment | PARTIAL (LaneStateBadge + LaneStateLegend ship; full register UI does not) | §1 rows 10–11 |
| 6. Degraded-state semantics alignment | PARTIAL (foundation policy ships; banner UI does not) | §1 row 10, §4 |
| 7. Chronology readability alignment | NON-PRESENT (no chronology page; only DecisionCapsule-keyed `/api/decisions/npi/:npi/timeline`) | replay-payload-schema-audit §14 row trust-state-history |
| 8. Institutional scanability alignment | NON-COMPLIANT (six-slot order not enforced anywhere) | §2 |
| 9. Verifier readability alignment | NON-COMPLIANT (verifier surfaces target #345/#355 — absent on main) | §2 + verifier-continuity-normalization §1–§5 |
| 10. Replay readability alignment | NON-PRESENT (replay reader endpoints + replay UI primitives both absent) | replay-topology-gap-analysis §2 + §1 |

## §6 — Same-six-slot order across required surfaces

The brief requires the same six-slot order to exist on: replay pages,
receipt pages, verifier pages, trust pages, degraded states, ops
surfaces, status surfaces, receipts, chronology rows.

Audit:

| Surface category | Present on `origin/main`? | Six-slot order enforced? |
|---|---|---|
| Replay pages | No | n/a |
| Receipt pages | No (only JWT payload, not a page) | n/a |
| Verifier pages (`/verify`, `/trust`) | No | n/a |
| Trust pages (`/trust`, `/trust/doctrine`) | No | n/a |
| Degraded states (banner UI) | No (foundation policy yes, banner component no) | n/a |
| Ops surfaces (`/internal/metrics`) | Partial | No |
| Status surface (`/api/health`) | Yes (JSON) | No |
| Receipts (JWT payload) | Legacy only (non-canonical jti) | No |
| Chronology rows | No (only DecisionCapsule timeline JSON) | n/a |

**Aggregate verdict:** zero of nine target surface categories render the
six-slot order on `origin/main`. The order is enforceable only after
both (a) the unmerged Lane B stack lands (introduces `TrustHeader`
composite) and (b) the route-mounting stack lands (introduces the pages
that compose `TrustHeader`).

## §7 — Phase 2 closure

Phase 2 success criterion: "all runtime surfaces visually and
semantically behave like institutional infrastructure."

**Not met on `origin/main`.** The audit is converged (every gap has a
file-level evidence row), but the gap itself is wide. Closure does not
require new product concepts; it requires the same merge train named in
Phase 1 to land. No new architectural work follows from this audit.

The only NEW finding Phase 2 surfaces (not previously captured in
the 9 prior docs) is the **failure-taxonomy divergence** in §4. The
honest action is to retire the A/B/C/D/E framing from session memory and
update any unmerged-PR component code to consume the six-state
`DegradedStateKind` from `apps/web/lib/degraded-state/degradedStateFoundation.ts`.
That update belongs on the unmerged Lane B stack PR(s) and is a small,
mechanical change (string-to-string mapping per state).
