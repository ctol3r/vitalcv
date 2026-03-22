# OpenClaw Patch Set 2 Prompt

Use this after Patch Set 1 has landed cleanly.

```text
Use the skill at `skills/vcv-ui-foundation/SKILL.md`.

Treat these as binding constraints:
- `docs/VCV_UI_DOCTRINE.md`
- `ANTIGRAVITY.md`

Repo: VitalCV monorepo
Primary target: `apps/web`

Your job is to execute **Patch Set 2** only.
Keep this tight, reviewable, and implementation-first.

## Context from Patch Set 1
Patch Set 1 already:
- cleaned `/investors` and `/partners` so they no longer clash with the dark global chrome
- removed the duplicate ops-route source of truth in `RootChrome`
- confirmed Blueprint is not currently contaminating production surfaces

Patch Set 2 should now address the next two structural inconsistencies:
1. token drift inside `foundry-primitives.tsx`
2. missing shell discipline for `/verifier/*`

## Goals
1. Replace hardcoded surface colors in `foundry-primitives.tsx` with the correct VitalCV token classes or token-backed values.
2. Add a minimal `app/verifier/layout.tsx` so verifier routes have an intentional shell instead of bare passthrough.
3. Keep the implementation small, clean, and aligned with the existing app structure.

## Hard rules
- Do **not** introduce a new UI framework.
- Prefer existing local components and shells.
- Do **not** redesign verifier flows broadly.
- Do **not** add ornamental dashboard patterns.
- Do **not** create a second visual language for verifier routes.
- Do **not** add complex auth plumbing unless there is already an obvious existing pattern to reuse.
- Preserve Antigravity: verifier UI should support trust review and acceptance, not become generic admin clutter.

## Required pre-check
Before coding, inspect and summarize:
1. where `foundry-primitives.tsx` is used
2. whether there is an existing `AppShell`, auth gate, workspace shell, or ops shell pattern already reusable for verifier routes
3. what current `/verifier/*` routes exist and how much chrome they already self-apply

Then choose the smallest viable patch.

## Patch Set 2 scope
### Part A — token cleanup
In `foundry-primitives.tsx`:
- find hardcoded hex surface colors such as `#0d1421` or equivalent off-token values
- replace them with VitalCV token classes or token-backed styles already used elsewhere
- do not change component semantics unless necessary
- do not restyle unrelated components

### Part B — verifier layout
Create `apps/web/app/verifier/layout.tsx` that:
- gives verifier routes a clear shell boundary
- uses the lightest viable wrapper consistent with current app architecture
- reuses existing shared shell/layout components where possible
- avoids over-building

Good outcomes:
- consistent background and spacing
- stable header/action area pattern
- optional auth/workspace gating only if an existing pattern is easy to reuse

Bad outcomes:
- giant new shell framework
- duplicated nav logic
- verifier pages suddenly looking like a different product

## Optional only if trivial
If, after the two main fixes, there is a tiny obvious cleanup in `analytics` or `billing` that matches the exact same token-drift problem and costs almost nothing, include it.
Otherwise, leave it for Patch Set 3.

## Deliverables
At the end, provide:
1. short pre-check summary
2. files changed
3. exact token-drift fixes made
4. what the new verifier layout does
5. why the patch aligns with the doctrine
6. what remains inconsistent
7. recommended Patch Set 3

## Decision filter
Before every change, ask:
- Does this reduce UI drift?
- Does this create clearer shell discipline?
- Is this the smallest useful move?
- Does it keep verifier UX purposeful and trust-oriented?

If not, do not make the change.
```
