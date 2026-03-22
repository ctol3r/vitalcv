# OpenClaw Waves 3–6 Task Bundle

Use this after Patch Set 2 has landed cleanly.

```text
Use the skill at `skills/vcv-ui-foundation/SKILL.md`.

Treat these as binding constraints:
- `docs/VCV_UI_DOCTRINE.md`
- `ANTIGRAVITY.md`

Repo: VitalCV monorepo
Primary target: `apps/web`

You are executing a **4-wave task bundle**:
- Wave 3 = low-risk surface sweep + dead code cleanup
- Wave 4 = primitive discipline and route classification cleanup
- Wave 5 = verifier/internal shell normalization
- Wave 6 = consistency hardening and documentation of canonical UI ownership

Do **not** merge all waves into one giant rewrite.
Complete them sequentially. At the end of each wave, summarize findings, changed files, what remains, and whether to continue. If a wave reveals hidden complexity, stop after that wave and report cleanly.

## Global hard rules
- Do **not** introduce a new dominant UI framework.
- Do **not** expand Blueprint usage.
- Do **not** invent ornamental dashboard chrome.
- Prefer local owned components under `apps/web/components/ui`.
- Reuse existing `vt-*` token classes and current shell patterns.
- Preserve Antigravity: changes must improve clarity, trust review, or workflow speed — not create decorative surfaces.
- Keep changes small and reviewable.
- Do not refactor for taste alone.

## Global output format
After each wave, provide:
1. pre-check summary
2. files changed
3. exact changes made
4. why the wave aligns with doctrine
5. what remains inconsistent
6. go/no-go recommendation for the next wave

---
# WAVE 3 — Low-risk surface sweep + dead code cleanup

## Goals
1. Sweep `analytics/page.tsx` and `billing/page.tsx` for obvious off-doctrine background/text drift.
2. Delete `components/ui/foundry-primitives.tsx` if it still has zero imports and zero references.
3. Optionally extract a tiny shared verifier breadcrumb helper only if the win is immediate and near-zero cost.

## Required pre-check
Inspect and summarize:
- current background/text token drift in `analytics/page.tsx` and `billing/page.tsx`
- whether `components/ui/foundry-primitives.tsx` still has zero imports/usages
- whether verifier breadcrumb repetition is real and worth extracting now

## Scope
### Part A — low-risk surface sweep
For `analytics/page.tsx` and `billing/page.tsx`:
- replace obvious `bg-white`, `bg-slate-*`, `bg-zinc-*`, `text-slate-*`, `text-zinc-*` patterns that conflict with current surface doctrine
- prefer existing `vt-*` token classes and patterns already used in adjacent ops/internal surfaces
- do not re-architect page structure

### Part B — dead code deletion
If `components/ui/foundry-primitives.tsx` still has zero imports:
- delete it
- confirm no build/type regressions
- do not replace it with another placeholder

### Part C — optional breadcrumb cleanup
Only if extremely cheap:
- extract a tiny `VerifierBreadcrumb` helper or constant for the repeated verifier breadcrumb pattern
- keep it local and minimal
- skip this entirely if it adds complexity

## Avoid in Wave 3
- new sidebars or nav systems
- moving routes around
- large file splits
- registry work
- typography restyling

---
# WAVE 4 — Primitive discipline + route classification cleanup

## Goals
1. Standardize a small set of visibly repeated primitives.
2. Make route classification clearer where pages currently float between surface categories.
3. Improve consistency without broad rewrites.

## Required pre-check
Inspect and summarize:
- repeated page-header patterns across public, verifier, holder, and ops surfaces
- repeated status pill/badge variants and whether they are canonical or ad hoc
- repeated table shell patterns
- whether `dashboard/cv-builder` should be reclassified, moved, or deprecated
- whether `analytics`, `billing`, and `internal/*` now map cleanly to a surface type

## Scope
### Part A — page header standardization
If there are clearly duplicated page-header structures:
- create or standardize a minimal shared header pattern
- use it only where the duplication is obvious and high-value
- avoid giant abstraction; prefer small composable props

### Part B — status pill / badge consistency
- identify non-canonical status pills or badge patterns
- migrate the smallest high-visibility offenders to the canonical badge/status approach
- do not flatten legitimate special-purpose variants

### Part C — route classification cleanup
- document or lightly normalize the surface classification for `analytics`, `billing`, `internal/*`, and `dashboard/cv-builder`
- if `dashboard/cv-builder` is clearly misplaced, either move it to a more appropriate route if trivial or mark it deprecated with a clear note and leave route movement for later

## Avoid in Wave 4
- broad badge redesign
- huge table refactors
- navigation redesign
- multi-route moves unless nearly free and safe

---
# WAVE 5 — Verifier/internal shell normalization

## Goals
1. Reduce shell inconsistency across verifier and internal surfaces.
2. Decide where layout ownership should live for internal/ops routes.
3. Keep shared shell boundaries lean and purposeful.

## Required pre-check
Inspect and summarize:
- `app/(intelligence)/layout.tsx` and whether pages self-apply chrome there
- shell patterns for `analytics`, `billing`, `internal/*`, and verifier pages
- whether verifier pages repeat the same wrapper, action zone, or breadcrumb scaffolding
- whether a shared verifier sub-shell is justified or still premature

## Scope
### Part A — internal/ops shell discipline
- decide whether `(intelligence)/layout.tsx` should remain passive or own a shared shell boundary
- if the current pattern is drifting, apply the smallest viable shell normalization
- document the decision in comments or a small doc note if necessary

### Part B — verifier shell normalization
- only if clearly justified, extract a tiny verifier sub-shell or wrapper for repeated header/breadcrumb/action-zone structure
- keep it narrow and route-local
- do not add a sidebar unless there is an unmistakable existing pattern to reuse

### Part C — internal surface consistency
- ensure `analytics`, `billing`, and any nearby internal routes do not visually contradict the shell they belong to
- make only small wrapper or token corrections, not full rewrites

## Avoid in Wave 5
- portal framework work
- workspace redesign
- new global nav
- big auth rewrites

---
# WAVE 6 — Consistency hardening + canonical ownership docs

## Goals
1. Harden the UI foundation so future contributors do not reintroduce drift.
2. Document the canonical ownership boundaries for primitives and shells.
3. Leave the repo in a cleaner state for future waves.

## Required pre-check
Inspect and summarize:
- current shared primitives under `apps/web/components/ui`
- any remaining obvious duplicate button/card/badge/input/table shells
- any remaining off-doctrine background/text patterns in high-traffic surfaces
- whether current docs are enough to guide future contributors without confusion

## Scope
### Part A — canonical ownership note
Create or update a small internal doc under `docs/` that clearly states:
- canonical primitives to use
- deprecated/legacy components to avoid
- which shell owns which surface type
- where Blueprint is allowed and not allowed
- how Antigravity constrains UI additions

### Part B — tiny consistency hardening
- fix any final obvious high-traffic inconsistencies that are small and reviewable
- examples: one rogue raw button, one rogue raw card, one rogue page shell mismatch
- keep this tiny and pragmatic

### Part C — leave-behind guidance
At the end of Wave 6, provide a short next-step list with:
- what is now stable
- what still needs a larger design/architecture decision
- what should be protected by future linting, codemods, or visual review if the team chooses to go further later

## Avoid in Wave 6
- giant cleanup PRs
- speculative future abstractions
- introducing Storybook/process overhead unless already present and trivial to extend

---
# Final decision filter for every wave
Before making any change, ask:
- Is this obvious drift, dead code, or repeated friction?
- Is this the smallest useful move?
- Does it make the UI more coherent without widening scope?
- Does it preserve Antigravity and avoid decorative complexity?
- Would this still be worth doing if there were only 20 minutes available?

If not, skip it.
```
