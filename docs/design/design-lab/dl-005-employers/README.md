# DL-005 — `/employers` workflow hierarchy

## Problem

**What is wrong now:** the six-stage workflow reads as a text wall. Recruiters scan;
the section rewards reading. But the cause turned out to be more specific than "long
copy" — it was **structural inconsistency**.

Each stage has a `body` and an optional `boundary`, and the renderer already gives
`boundary` its own treatment: mono, accent rule, muted, smaller. Three stages used it.
The other three **buried the same kind of qualifier mid-sentence inside `body`**:

- *"…every packet is measured against — nothing is graded against a hidden bar."*
- *"…freshness — checked reads as checked, gated as gated, blockers as blockers, never one green light over an unproven record."*
- *"…down to start-ready — every step attributable and recorded, auditable end to end."*

So half the grid rendered its honesty rail as a visible rail and half hid it inside a
longer paragraph. The result is a ragged rhythm where the densest cells are exactly the
ones whose qualifier is hardest to see.

**What the user should feel instead:** six stages that scan at a glance, each with its
limit stated where a limit is always stated.

**Design principle:** hierarchy — one job per slot. A qualifier belongs in the qualifier
slot, not mid-sentence in the body.

**Deliberately not changing:** every word of every truth claim (all seven verified
present verbatim after the change), the stage order, the vocabulary, the renderer, the
route, the CTAs. `packet` stays — the inventory classifies it *allowed when
task-specific*, and an employer handling a sealed packet is exactly that.

## The change

Three qualifiers moved from `body` into `boundary`. **No words added, removed, or
softened** — the same sentences, relocated to the slot designed for them. Bodies become
one scannable line each; all six stages now carry a boundary rail.

## Evidence

| | |
| --- | --- |
| `before-workflow-*.png` | production 2026-08-07 — 3 of 6 cells have the rail; stages 2, 4, 6 run visibly denser |
| `after-workflow-*.png` | this branch — 6 of 6, uniform rhythm, qualifiers legible |

Desktop 1440 and iPhone 14 for both.

## Verification

- Full suite **3368 passed**, 1 skipped, 0 failed.
- **All seven truth strings verified present verbatim** after the move:
  `not authority to act for it` · `Nothing is graded against a hidden bar` ·
  `No silent sourcing, no anonymous directory` ·
  `never one green light over an unproven record` · `not credentialing` ·
  `auditable end to end` · `checked reads as checked`
- `employer-workflow-preview.test.tsx` asserts the rendered boundary count equals the
  number of stages declaring one — it adapts from 3 to 6 and still passes its
  `>= 3` floor.
- `customer-language-guard` still passes: `/employers` keeps its decision boundary.
- `tests/` swept for the three changed strings — no e2e pins.

## Note

This wave found no new debt, which is worth recording: the section was structurally
sound and inconsistently applied, not badly designed. The fix was to use the system
already there.
