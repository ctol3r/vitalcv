# Provenance Navigation Boundaries

Authoritative boundary document for the canonical pane-navigation
system shipped in `feat/canonical-provenance-navigation`. Defines which
surfaces own pane navigation, which surfaces may embed it, and which
must explicitly reject it.

The canonical contract lives in:

```
apps/web/lib/trust/navigation-contract.ts
apps/web/lib/trust/panes.ts
apps/web/components/trust/StackedPaneLayout.tsx
apps/web/components/trust/LineageBacklinks.tsx
apps/web/components/trust/navigation/*
```

## What qualifies as a provenance pane

A pane is provenance-eligible **only** if it represents one of the
five closed categories:

| Category | What it represents |
|---|---|
| `receipt` | a signed evidentiary artifact (σ-anchored) |
| `audit` | an audit row · σ verdict against a receipt |
| `claim` | a single source-of-record check |
| `lineage` | a lineage key · subject + lane binding |
| `entity` | a passport / NPI · subject of record |

Anything else — settings, marketing copy, dashboard cards, onboarding
overlays, generic content modals — does **not** belong in the pane
stack. The type system rejects unknown kinds at compile time
(`PaneKind` is a closed union over `PANE_KINDS`).

## Navigation ownership

```
Canonical owner of pane navigation:
  /trust/panes/[receiptId]

Routes that MAY embed the StackedPaneLayout
(must not introduce new pane categories):
  /verify/receipt/[receiptId]
  /receipt/[receiptId]
  /dossier/[receiptId]
  /passport/[id]

Routes that MUST NOT embed pane navigation
(use route-level navigation; pane stack is invalid here):
  /signup
  /onboarding
  /for/*               (marketing personas)
  /get-ready
  /pilot
  /settings/*
  app shell / navigation chrome / global layout
```

## Per-route audit

### Canonical owner

- **`/trust/panes/[receiptId]`** — implemented in PR #385. Owns the
  `StackedPaneLayout`, demos all five categories. Future expansion
  belongs here, not in a parallel route.

### Recommended adoption

The following routes already render replay/lineage/receipt artifacts.
They are eligible to embed `StackedPaneLayout` (or the navigation
primitives standalone) in a follow-up wave. Adoption is optional and
should be **additive**: keep the existing surface, add an "open in
stacked view" affordance.

| Route | Today | Adoption recommendation |
|---|---|---|
| `/verify/receipt/[receiptId]` | dense replay-inspection summary + legacy `DegradationBar` | Add `ProvenanceTrail` at top, link "open as stack" → `/trust/panes/{receiptId}` |
| `/receipt/[receiptId]` | 7-zone receipt page + print PDF flow | Add "open as stack" link; do NOT replace zones (load-bearing for PDF) |
| `/dossier/[receiptId]` | demo dossier with chain-of-custody table | Add link; chain rows can each push a `claim-` pane |
| `/passport/[id]` | client-component hydration with SSE | Defer until passport adapter to lineage exists |

### Explicitly rejected

These routes **must not** embed pane navigation. They are workflow,
marketing, or settings surfaces — provenance panes are an exploration
metaphor for trust artifacts, not a generic UI pattern.

| Route | Why rejected |
|---|---|
| `/signup` | identity-establishment workflow, no provenance artifacts |
| `/onboarding/*` | linear flow, not exploration |
| `/for/cvo`, `/for/payer`, `/for/staffing-exchange` | marketing personas |
| `/get-ready` | conversion funnel |
| `/pilot` | lead-capture form |
| `/settings/*` | configuration surfaces |
| `/clinician/activation` | linear processing flow |
| global app shell (nav, sidebar, header) | provenance is route-scoped, not session-scoped |

If any of the rejected surfaces ever require a pane-stack metaphor,
**route the user to `/trust/panes/...`** rather than embedding a
parallel pane system.

## Navigation contract summary

The full contract is in `apps/web/lib/trust/navigation-contract.ts`.
Key rules enforced by code + tests:

| Rule | Where enforced |
|---|---|
| Five closed pane categories | `PROVENANCE_PANE_CATEGORIES` (compile-time) |
| URL grammar `<kind>-<id>` with `[A-Za-z0-9_-]+` ids | `parsePanes` validator |
| Matuschak tree-path: push from index N truncates (N+1..end) | `pushPane` |
| Idempotent re-push (clicking same destination is a no-op) | `pushPane` |
| Cycle protection (never push a pane that already exists in stack) | `wouldCycle`, `safePush` |
| Max depth = 7 panes (mobile-friendly + comprehensible) | `MAX_PANE_DEPTH`, `enforcePaneDepth` |
| Truncation drops oldest panes, preserves active rightmost | `enforcePaneDepth` |
| Deterministic ordering for non-temporal lists | `deterministicallyOrderPanes` |
| Backlinks are always inbound, never imply trust endorsement | `BindingDirection`, `ProvenanceBinding` |
| Forward bindings visually distinct from inbound bindings | left-arrow vs right-arrow chrome |
| 40px sticky stack offset, 32rem pane width | `PANE_STACK_OFFSET_PX`, `PANE_WIDTH_REM` |
| Fast linear horizontal slide, no bouncy easing | `scroll-smooth` only |
| Strict `border-slate-900` borders, no shadows | every pane primitive |

## Chronology consistency

All four panes (receipt / audit / lineage / entity) render the same
canonical six-cell reading order via the `ProvenanceChronology`
primitive — which composes via `composeLineage(...)` and renders via
the existing canonical `LineageHeader` primitive (PR #382). The order
is binding:

```
OBJECT → OWNERSHIP → checked_at → CHANNEL → REPLAY → run_id
```

No pane renderer may invent a different order or substitute a slot.
The type system enforces totality.

## Backlink semantics

`ProvenanceBinding` is the single building block for any binding —
inbound or forward. `LineageBacklinks` (PR #385) composes inbound
bindings; a future "ProvenanceForward" surface would compose forward
ones. Both go through `ProvenanceBinding` so a reader can distinguish
direction by arrow alone.

| Direction | Arrow | What it represents | Where used |
|---|---|---|---|
| `inbound` | `←` | "what binds TO this pane" | `LineageBacklinks`, audit pane "Bound to" rail |
| `forward` | `→` | "what this pane references" | "open bound receipt" affordances |

## Cycle protection

Backlinks must never produce recursive pane explosions. When a user
clicks a backlink whose target is already in the stack, the caller
must NOT push a duplicate — `safePush` returns `cycled: true` and the
caller's responsibility is to surface the existing pane (scroll-into-
view) rather than open a new one.

## Pane-depth governance

`MAX_PANE_DEPTH = 7`. Rationale:

- 32rem pane width + 40px offset → on a 13" laptop at 100% zoom,
  ~3.5 panes are visible at once; 7 stacked panes leave a reasonable
  preview of the trail.
- Exploration paths beyond 7 hops nearly always indicate a navigation
  mistake or a runaway backlink chain.
- `router.push` × 7 remains navigable via browser back without
  exhausting the user's mental model of the back button.

Truncation drops the **oldest** panes (head of the array), preserving
the user's active rightmost pane. `enforcePaneDepth` returns
`{ panes, truncated }` so the caller can render the
`ProvenanceTrail` truncation chip and the user is never silently
surprised.

## Remaining gaps

1. `safePush` is wired in `navigation-contract.ts` but `StackedPaneLayout` still calls `pushPane` directly. Migrating the layout to `safePush` is a small follow-up so cycle protection + depth governance flow through automatically.
2. `ProvenanceTrail` is shipped but not yet rendered by `/trust/panes/[receiptId]/page.tsx`. Wiring is a tiny additive change reserved for the same follow-up.
3. The 7 navigation primitives are exported from `components/trust/navigation/`; the existing `PanesClient.tsx` still uses inline `PaneShell`/`Cell`. Migrating `PanesClient` to consume the navigation primitives is the next coherence wave (not this one).

## Truth contract

No new compliance / crypto / guarantee claims introduced. The
navigation contract is a typography + URL + truncation contract; it
makes no statements about underlying cryptography. Existing canonical
primitives (`LineageHeader`, `OwnershipStateBadge`, `TierBadge`,
`CheckedAtStamp`) carry whatever guarantees their callers provide.
