# OpenClaw Patch Set 3 Prompt

Use this after Patch Set 2 has landed cleanly.

```text
Use the skill at `skills/vcv-ui-foundation/SKILL.md`.

Treat these as binding constraints:
- `docs/VCV_UI_DOCTRINE.md`
- `ANTIGRAVITY.md`

Repo: VitalCV monorepo
Primary target: `apps/web`

Your job is to execute **Patch Set 3** only.
Keep it surgical. This is a cleanup-and-consistency pass, not a redesign.

## Context from Patch Set 1 and 2
Already completed:
- `/investors` and `/partners` were brought back into surface/token doctrine
- `RootChrome` no longer keeps a duplicate ops-route source of truth
- `/verifier/*` now has a minimal layout with auth and shared ops chrome
- token drift in `foundry-primitives.tsx` was removed
- `foundry-primitives.tsx` is now known dead code with zero imports

Patch Set 3 should now focus on:
1. remaining ad-hoc background/token drift on low-priority internal pages
2. deleting truly dead UI code
3. tiny DRY improvements only where nearly free

## Goals
1. Sweep `analytics/page.tsx` and `billing/page.tsx` for obvious off-doctrine background/text patterns and bring them onto the correct VitalCV token surfaces.
2. Delete `components/ui/foundry-primitives.tsx` if it still has zero imports and no references.
3. Optionally extract a tiny shared verifier breadcrumb helper only if the win is immediate and the implementation is trivial.

## Hard rules
- Do **not** introduce a new UI framework.
- Do **not** broaden the patch into a larger IA or navigation redesign.
- Do **not** create a new abstraction unless it removes real repetition with near-zero cost.
- Do **not** replace working tokenized patterns just for style preference.
- Preserve Antigravity: no ornamental shells, no dashboard-first clutter.

## Required pre-check
Before coding, inspect and summarize:
1. current background/text token drift in `analytics/page.tsx` and `billing/page.tsx`
2. whether `components/ui/foundry-primitives.tsx` still has zero imports/usages
3. whether verifier breadcrumb repetition is real and worth extracting in this patch

Then choose the smallest viable patch.

## Patch Set 3 scope
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
- skip this entirely if it introduces complexity or unclear ownership

## Avoid in Patch Set 3
- new sidebars or nav systems
- moving routes around
- large file splits
- component registry work
- broad typography restyling

## Deliverables
At the end, provide:
1. short pre-check summary
2. files changed
3. exact token-drift fixes made
4. whether `foundry-primitives.tsx` was deleted
5. whether breadcrumb extraction was done or skipped, and why
6. what remains inconsistent
7. recommended Patch Set 4

## Decision filter
Before every change, ask:
- Is this obvious drift or dead code?
- Is this small and reviewable?
- Does this make the UI more coherent without expanding scope?
- Would I still make this change if I only had 15 minutes?

If not, skip it.
```
