# Operational Convergence Audit

Snapshot audit of operational vocabulary duplication across the
session's open PRs. The audit is authored once and refreshed only
when a wave merges or when a new wave introduces a divergent
taxonomy. The durable mechanism is
`scripts/verify-operational-convergence.ts`.

Cut date: 2026-05-21.

## Scope

- The five-axis canonical vocabulary in
  `docs/product/canonical-operational-language.md`
- All taxonomies shipped on open PRs #402, #403, #404, #407
- All taxonomies shipped on `docs/ops/*.md` and `docs/product/*.md`
- All component label maps under `apps/web/components/**` on the
  current branch

## Findings

### F1 · Duplicate "Attention needed" terminology

The phrase **Attention needed** appears as a label on:

- Wave 23 / `/ops` (Readiness axis × `requires_followup`)
- Wave 27 / `/operator` (Readiness axis × `requires_followup`)

**Disposition**: this is not duplication; it is canonical reuse.
Both surfaces map to the same canonical axis × state. **No action
required.**

### F2 · Overlapping continuity vocabulary

| Term | Used by | Canonical state |
|---|---|---|
| `Continuing` | Wave 27 | Continuity × `continuity_restored` |
| `Complete` | Wave 27 | Continuity × `source_confirmed` |
| `Confirmed` | Wave 23 | Continuity × `source_confirmed` |
| `Source-confirmed` | Wave 22 / Cedar fixture | Continuity × `source_confirmed` |

`Complete`, `Confirmed`, and `Source-confirmed` all map to the same
canonical state. The reconciliation table in
`canonical-operational-language.md` records this and accepts the
divergence: the surfaces have different audiences (`/operator`
operator-facing; `/ops` infrastructure-facing; `/demo/waste`
demonstration-facing). Forward convergence: when these three PRs
merge, a follow-up wave can pick ONE label and update the others.

**Disposition**: documented in reconciliation table; no destructive
change in this wave.

### F3 · Five-state vs six-state taxonomies

Several PRs declare a five-state taxonomy in their boundaries doc:

- Wave 22: `demonstrated` / `observed` / `simulated` / `unsupported`
  / `institution-owned`
- Wave 24: `executable` / `simulated` / `institution-owned` /
  `intentionally-incomplete` / `future-state`
- Wave 27: `executable` / `simulated` / `institution-owned` /
  `intentionally-incomplete` / `future-state`

These are **claim-state taxonomies**, not operational-axis
taxonomies. The canonical language doc accepts them as
documentation-only taxonomies (they describe what a doc claims,
not what a surface state means).

**Disposition**: kept; the canonical doc carves them out.

### F4 · "Verified" leakage

Spot-checked the open PR branches for the bare word `Verified`:
- Wave 23 `/ops` page uses "valid credential" not "Verified"
- Wave 24 `/employer/review` uses "CHECKED" / "CLEAR" not "Verified"
- Wave 27 `/operator` uses normalized labels (Ready / Pending review
  / Attention needed / Interrupted / Continuing / Complete)

No bare-word `Verified` leaked. The CLAUDE.md banned-strings rule
holds.

### F5 · Substrate jargon containment

The W23 progressive-disclosure pattern (substrate jargon only
inside `<details>`) is correctly used by Wave 27's `/operator` page
(disclosure links to `/ops` rather than duplicates inline). Wave 22
and Wave 24 routes do not surface substrate jargon at all.

**Disposition**: clean.

### F6 · Duplicate continuity primitives across waves

Wave 24's `ContinuityBridge` (in `components/continuity/`) is
distinct from Wave 27's `ContinuityAttentionCard` (in
`components/operator/`). Both name "continuity" but operate on
different layers:

- `ContinuityBridge` = route-to-route handoff with a `to`/`from`
  pair (used in `/holder` → `/verify`)
- `ContinuityAttentionCard` = per-lane state card (used in
  `/operator` per-lane grid)

The shared word "continuity" is intentional (both describe the
operational continuity of a clinician's evidence). The primitives
do NOT overlap functionally; the canonical doc records this
intentional reuse.

**Disposition**: not a duplication; documented above.

## Net posture

- One genuine duplication exists: `Confirmed` (W23) vs `Complete`
  (W27) vs `Source-confirmed` (W22) all map to the same canonical
  state. Resolution is deferred to a follow-up wave that runs after
  PRs #402, #403, #407 merge.
- No banned phrases leaked.
- No substrate jargon leaked outside progressive disclosure.
- No bare `Verified` leaked.
- Five-state and six-state taxonomies are intentional; they describe
  different things (claim-state vs operational-axis).

## Recommendations

1. **Hold this audit snapshot.** Re-author only when drift posture
   changes substantively (e.g. a wave merges or introduces a new
   axis).
2. **Run `pnpm verify:operational-convergence` locally before
   merging any user-facing wave.** The verifier scans for the
   canonical axes and confirms touched files use mapped labels.
3. **Defer label unification across `Confirmed` / `Complete` /
   `Source-confirmed`** until PRs #402, #403, #407 merge. A
   follow-up wave can then pick one label per surface.
4. **Use the canonical reconciliation table when adding new
   surfaces.** New waves MUST add a row to the per-wave table
   in `canonical-operational-language.md` if their labels diverge
   from the canonical axes.
