# Architecture Compression Inventory

**WAVE 3 deliverable.** Inventory of what could safely be removed
from `apps/web` without breaking onboarding, auth, or signup.

This document does NOT delete anything. It catalogs candidates for
the operator to confirm per-item. Every line item explicitly states
the risk if removed.

## §1 — Definitely safe (zero runtime impact)

These can be removed in one pass without code review per item:

| Path | Reason | Risk if removed |
|---|---|---|
| `apps/web/app/_archive/**` (entire `_archive/` tree) | Walled off by Next App Router (`_`-prefix); zero routes; ~80 historical files | NONE — Next does not route these |
| Empty / placeholder dirs with no content | If `ls -la <dir>` returns no files | NONE if truly empty |
| Stale workflow files under `.github/workflows/` whose path filters match nothing on current main | Already-inert | NONE if path filters never fire |

**Risk profile**: zero. **Recommended action**: ship a `chore(repo)`
PR removing `apps/web/app/_archive/**` if the operator wants tighter
repo state. Shrinks `git clone` time + reduces grep noise.

## §2 — Probably safe (verify before removing)

| Path / Item | Reason it's a candidate | What to verify first |
|---|---|---|
| `apps/web/app/calibration/` | Internal; not publicly linked | Confirm no marketing/nav link → no external bookmark expected → safe to suppress (not delete; just remove from public nav) |
| `apps/web/app/autopilot/` | Internal | Same as above |
| `apps/web/app/roi/` | Internal or marketing-experimental | Same |
| `apps/web/app/pilot/` | Internal | Same |
| `apps/web/app/ops/` | Internal | Same |
| `apps/web/app/analytics-foundation/` | Internal | Same |
| `apps/web/app/investigate/` | Internal | Verify no Clerk-gated authenticated flow depends on this surface |

**Risk profile**: low. **Recommended action**: per-directory, run
`grep -rn "/<dir>" apps/web/components apps/web/lib` to find inbound
links. If zero, route can be deleted. If hits exist, just remove from
public nav and leave the route for authenticated callers.

## §3 — Looks like compression candidate but DON'T touch

| Path / Item | Why it looks removable | Why NOT to remove |
|---|---|---|
| 4 different backend-URL resolvers across ~40 files | Looks like duplication | Each works correctly today; consolidating is a medium-risk refactor that could introduce new bugs. Leave for a dedicated cleanup PR with full test coverage. |
| 213 API route files | Surface area is large | Each one has consumers; deleting requires per-route audit. Not a 1-pass compression. |
| Multiple Prisma models (~80) | Looks bloated | Each model has writers + readers; removing any requires migration analysis. Out of scope for compression. |
| Both `apps/web/app/sign-up/` and `apps/web/app/signup/` exist | Looks like duplication | One is canonical, the other should redirect — but DELETING either could break inbound bookmarks. Add a redirect, don't delete. |
| `apps/web/app/passport/page.tsx` is 841 lines long | Looks bloated | Page handles all terminal states + the SSE hydration flow; splitting is a UX refactor that needs rendered review. Don't touch. |
| `apps/web/app/HomePageClient.tsx` is 425 lines | Looks bloated | Marketing homepage; subjective decisions about copy + layout. Don't touch without operator UX direction. |
| Inline-resolver fallback to `localhost:4000` | Looks like a bug | It's an honest dev fallback when env unset. Production sets `BACKEND_URL`. Don't change without confirming production has the env set. |

**Risk profile**: medium-to-high. **Recommended action**: leave alone
unless a specific user-facing defect forces a change.

## §4 — Speculative systems that exist but aren't loaded

| Path / Item | What it is | Status |
|---|---|---|
| `apps/web/lib/issuer-verification/types.ts` (`ReceiptCandidate`, `PSVReceiptCandidate`, etc.) | The literal-typed issuer-verification chain | NOT speculative — required by issuer demo flow + truth contract |
| `apps/web/lib/replay/` (post-PR-α/β/γ) | Replay identity generator + reader helpers | NOT speculative — actively used by `/api/replay/*` |
| `apps/web/lib/degraded-state/degradedStateFoundation.ts` | Six-state taxonomy | NOT speculative — referenced by current UI |
| `apps/web/components/graph-system/` | Knowledge-graph workspace (large files) | NEEDS REVIEW — verify if linked from any public flow or only internal. If only internal: low priority. |
| `apps/web/components/intelligence-ops/` | Investigation/dashboard surface | INTERNAL — gated; not customer-facing on launch path |

**Action**: confirm `graph-system` and `intelligence-ops` are
intentionally kept. If yes, leave alone (they're isolated; not on
critical path).

## §5 — CI workflows that could be paused but not removed

Per `build-churn-audit.md` (survival branch §5):

| Workflow | Action |
|---|---|
| `source-health-probe.yml` cron at 15-min | Drop to hourly (24x cost reduction). DO NOT delete. |
| `monorepo.yml` overlap with `ci.yml` on `main` web/packages paths | Remove the duplicated paths from one of them. DO NOT delete either workflow. |
| `ci.yml` triggers on `feature/**`, `fix/**`, `wave/**`, `chore/**` push | Restrict to `main` push + PR. DO NOT delete the workflow. |

**Recommended action**: ship the 3 small workflow diffs from
`build-churn-audit.md` §5 as a separate PR. No deletions.

## §6 — Single safe compression PR (recommended scope)

If the founder wants ONE small "tighten the repo" PR, this is the
minimum-risk scope:

```
chore(repo): remove _archive/ tree + redirect /signup -> /sign-up

- Delete apps/web/app/_archive/** (walled off; zero runtime impact)
- Add /signup -> /sign-up redirect in next.config.mjs
- Suppress /verifier, /calibration, /autopilot, /roi, /pilot, /ops
  from any marketing nav links (if found by grep)
```

Total change: ~10–30 files modified, no test changes, no env
changes, no schema changes. Reviewable in <15 minutes.

This is offered as a **proposal**, not an action. The operator
should run the audit greps first to confirm the suppress-from-nav
list is complete.

## §7 — Compression decision flow

```
QUESTION: Can I safely remove this?

  Is it in §1 "definitely safe"?
    → YES, batch remove in one PR
  Is it in §2 "probably safe"?
    → YES, but verify per item first
  Is it in §3 "looks like a candidate but don't touch"?
    → NO, leave alone
  Is it in §4 "speculative but loaded"?
    → NO, it's actively used
  Is it in §5 "CI workflows"?
    → PAUSE not REMOVE
```

## §8 — What this inventory deliberately does NOT include

- Big-picture refactors (consolidating resolvers, simplifying middleware, etc.) — too risky for survival mode
- Frontend code-splitting / lazy-loading — UX work
- Backend Prisma model pruning — requires per-model audit
- Removing the `apps/marketing` app — out of scope; different domain
- "What if we rewrote this in [framework]" — speculative

The lens of this document: what's the smallest, safest set of removals
that meaningfully tightens the repo without risk.

## §9 — Verdict

**There is no architecture compression that meaningfully reduces
operational cost or complexity in survival mode.** The CI workflow
adjustments in §5 (per `build-churn-audit.md`) deliver the largest
operational saving. The `_archive/` removal in §1 is the largest
zero-risk repo cleanup. Beyond that, every candidate trades
non-trivial risk for marginal gain.

**Recommendation**: ship the small chore PR in §6 (if and only if
the operator wants tighter state), then leave the rest alone until
launch + ~30 days of operational data tells you what's actually
load-bearing.
