# OpenClaw Patch Set 1 Prompt

Use this as the first implementation pass for the VitalCV UI foundation migration.

```text
Use the skill at `skills/vcv-ui-foundation/SKILL.md`.

Treat these as binding constraints:
- `docs/VCV_UI_DOCTRINE.md`
- `ANTIGRAVITY.md`

Repo: VitalCV monorepo
Primary target: `apps/web`

Your job is to execute **Patch Set 1** only.
Do not attempt a giant rewrite. Make the smallest high-leverage changes that improve visual consistency and move the app toward the locked UI doctrine.

## Goals
1. Audit current UI usage in `apps/web`.
2. Classify the main routes into: public, clinician, verifier, ops.
3. Identify where Blueprint is currently used and whether each use is justified.
4. Identify duplicated or inconsistent shared primitives.
5. Implement the first small patch set that gives immediate visible improvement without introducing a new UI framework.

## Hard rules
- Do **not** introduce a new dominant UI library.
- Prefer local owned components under `apps/web/components/ui`.
- Keep Blueprint confined to dense internal workbench or ops-only surfaces.
- Do not let Blueprint styling leak into public marketing or clinician-facing flows.
- Do not add dashboard-first or ornamental flows that violate `ANTIGRAVITY.md`.
- Reuse the existing token direction unless there is a very strong reason to consolidate a local primitive.
- Keep changes reviewable and scoped.

## Required audit output before coding
First, inspect and summarize:
1. current shared primitives under `apps/web/components/ui`
2. current shell/layout files
3. current Blueprint imports/usages
4. top inconsistent buttons/cards/inputs/badges/page headers
5. top 3 highest-leverage files to change first

Then pause and choose a **single small patch set**.

## Patch Set 1 scope
Patch Set 1 should do only these kinds of things:
- standardize 1–2 shared primitives that are clearly duplicated or inconsistent
- clean up one high-visibility shell or layout inconsistency
- improve one public or clinician-facing flow with better consistency and clarity

Good examples:
- unify button variants
- unify card or status-pill styling
- standardize a page header pattern
- clean up a root shell mismatch
- remove an obviously misplaced Blueprint component from a non-ops screen

Avoid in Patch Set 1:
- broad route rewrites
- complex state management changes
- backend/API work unless strictly necessary for compilation
- introducing many new dependencies
- redesigning every screen at once

## Preferred execution order
1. audit
2. identify top 3 leverage points
3. choose the smallest valuable patch set
4. implement it
5. report what changed and what remains

## Deliverables
At the end, provide:
1. audit summary
2. route classification summary
3. Blueprint usage summary
4. exact files changed
5. what changed and why it aligns with the doctrine
6. what remains inconsistent
7. recommended Patch Set 2

## Decision filter
Before making any change, ask:
- Does this move VitalCV toward one coherent owned UI language?
- Does this preserve Antigravity?
- Does this improve speed, clarity, or trust at a blocking moment?
- Is this small enough to review cleanly?

If the answer is no, do not make the change.
```
