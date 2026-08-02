# VitalCV current state — 2026-08-02

**Purpose:** the exact, evidence-backed baseline the National Evidence-to-Start
program is measured against. Every line below was observed, not inferred.

**Method note.** Nothing here says "production is current" on the strength of an
HTTP 200. The deploy-smoke receipt asserts the **exact commit SHA** the running
service reports, because this gate has previously certified a healthy 200 while
production ran code three merges old.

---

## 1. Commit and deployment identity

| Field | Value |
| --- | --- |
| Audit baseline SHA | `f9900b141def51610427bc3fa00ad89a5622b6b7` |
| Production web SHA | `f9900b141def51610427bc3fa00ad89a5622b6b7` |
| SHA assertion | **exact match** — `serving f9900b141def vs expected f9900b141def` |
| Platform | `railway` |
| Environment | `production` |
| Branch | `main` |
| Receipt | `artifacts/audit/pre-program-deploy-smoke.json` |

> `builtAt` is `null` in `/api/version`. That field previously returned the
> *request* clock, which made build time unfalsifiable; `null` is the honest
> value and is not a defect.

**Caveat recorded deliberately:** `main` advanced during this audit
(`f9900b141` → `865445f55`, PRs #1028 and #1029). The SHA assertion above was
true at the moment it was taken. It is a point-in-time proof, not a standing
claim.

---

## 2. Health

| Probe | Result |
| --- | --- |
| `/api/health/auth` | HTTP 200 · `status=ok` |
| `/api/health/db` | HTTP 200 · `db=ok` |
| deploy-smoke overall | **PASS**, 20 / 20 checks |

---

## 3. Public routes

All 13 audited routes returned **HTTP 200**.

| Route | Cache-Control |
| --- | --- |
| `/` | `s-maxage=300, stale-while-revalidate=31535700` |
| `/employers` | `s-maxage=300, stale-while-revalidate=31535700` |
| `/explore` | `s-maxage=300, stale-while-revalidate=31535700` |
| `/trust` | `private, no-cache, no-store, max-age=0, must-revalidate` |
| `/status` | `private, no-cache, no-store, max-age=0, must-revalidate` |
| `/status/technical` | `private, no-cache, no-store, max-age=0, must-revalidate` |
| `/onboarding` | `private, no-store` |
| `/api/status` | `no-store` |
| `/api/version` | `no-store, max-age=0` |
| `/api/health/auth` | `private, no-store` |
| `/api/health/db` | `no-store, max-age=0` |
| **`/evidence-network`** | **`s-maxage=31536000`** |
| **`/trust/attribution`** | **`s-maxage=31536000`** |

### Finding B4-1 — a one-year edge cache on two source surfaces

`/evidence-network` and `/trust/attribution` are served with a **365-day**
shared cache. Both are surfaces the source-runtime convergence wave is meant to
drive from live runtime truth.

**Runtime truth behind a one-year cache is not runtime truth.** Convergence
shipped onto these two routes would be invisible in production until the cache
expires or is manually busted, and a stale copy would keep asserting source
availability that the runtime no longer supports.

This is the same class of defect as the previously recorded case where the
public `/status` copy was the stale one. It is recorded here as a **blocker for
the source-runtime wave**, not for this PR.

---

## 4. Source-lane parity

`6 lanes agree` across all three surfaces:

- `/status` ↔ `/api/status`
- `/status/technical` ↔ `/api/status`

The lane-parity contract holds. No action required.

---

## 5. Baseline gates on clean `main`

Measured in an isolated worktree cut from `origin/main`, with the primary
working tree's 57 uncommitted paths excluded rather than stashed or discarded.

| Gate | Exit | Time |
| --- | --- | --- |
| `typecheck` | 0 | 14s |
| `check:design` | 0 | 1s |
| `check:claims` | 0 | 1s |
| `check:routes` | 0 | 0s |
| `check:canonical-source-adapters` | 0 | 2s |
| `check:workflow-contract` | 0 | 0s |
| `lint` | 0 | 12s |
| `test` | 0 | 224s |
| `build:web:direct` | 0 | 35s |

**Main is green.** No unexplained failing gate.

### Finding B4-2 — backend exit code disagrees with turbo

`pnpm --filter chai-vc-platform-backend test` exits **1** while reporting
`286 passed, 0 failed`. The same package under `pnpm test` (turbo, the CI path)
reports **success**, exit **0**.

Confirmed **pre-existing**: the backend package exits 1 with the concurrency
regression removed, at numbers identical to baseline (286 suites / 1924 tests).
It is not introduced by this PR.

Recorded rather than fixed: the CI path is green, so this is a reporting
discrepancy, not a broken build. But a package whose own `test` script exits
non-zero on a fully passing run will eventually be read as a real failure by
someone running it directly.

---

## 6. Historical issues — verified, not assumed

| Issue | Status |
| --- | --- |
| SourceRuntime 401 / 503 defects | **Not reproduced** — `/api/status` 200 + JSON |
| web/trust-state typecheck errors | **Not reproduced** — `typecheck` exit 0 |
| Local `/trust` and `/status` backend dependency failures | **Not reproduced** — both 200 |
| Source-lane disagreement between surfaces | **Resolved** — 6 lanes agree on all three |
| `actionEngineService` `action_id` uniqueness race | **CONFIRMED AND FIXED** — see §7 |
| Exact-SHA workflow credential gap | **Not reproduced** — exact-SHA assertion passed |
| Stale metadata describing retired visual mechanisms | **Not audited in this pass** |

The last row is stated as unaudited rather than clean. It requires comparing
served HTML and metadata against search-cached copies, which belongs to the
release wave.

---

## 7. The `action_id` race — confirmed, reproduced, fixed

**Defect.** `persistActionRecommendations` read the batch with `findMany`, then
branched per action: `create` on a miss, `update` on a hit. Two refreshes
overlapping inside that window both missed and both called `create`; the loser
raised **P2002** on `action_id` and failed the entire refresh. The engine
refreshes both on a schedule and on demand, so overlap is ordinary.

**A finding worth recording: `upsert` alone does not fix it.**

Prisma compiles `upsert` to an atomic `INSERT … ON CONFLICT DO UPDATE` only when
the create payload is flat. `actionCreateData` carries a nested
`statusEvents.create`, so Prisma falls back to a read-then-write inside a
transaction — which still races.

This was **observed, not predicted**: the upsert-only revision failed the
regression test with `Unique constraint failed on the fields: (action_id)`, at a
*narrower* window than the original code. That failure is itself the proof the
original races.

**Fix.** `upsert`, plus an explicit P2002 fallback to `update`. Losing the insert
race is not an error — it means a concurrent refresh already created the row, so
the correct response is to apply the update that was going to be applied anyway.
Any other error still propagates. Matched on the documented error **code**, not
the message, which is not a stable contract.

**Regression test.** `actionEngineConcurrency.test.ts`, against a real ephemeral
Postgres. It drives `refreshActionRecommendations` — the exported entry point
that actually runs twice at once — rather than the private helper, because
exporting the helper for a test would let the test pass while the real path
still raced. It asserts the **outcome** (both callers resolve; one row per
`action_id`; the metadata merge survives), not the mechanism, so a future fix
using a transaction or advisory lock keeps it green.

---

## 8. Open blockers entering the program

| # | Blocker | Owner wave |
| --- | --- | --- |
| B4-1 | One-year edge cache on `/evidence-network` and `/trust/attribution` | Source-runtime convergence |
| B4-2 | Backend package exit code disagrees with turbo on a passing run | Unassigned — recorded |
| B4-3 | Six unreachable scroll owners in retired film/rail/w1501 trees | CSS/design convergence |
| B4-4 | National licensure: **zero live routes**; blocked on FSMB/NCSBN access | Licensure L1 |

B4-3 detail: `ScrollMotion`, `ScrollScrubHeading`, `HorizontalStoryRail`,
`ChapterProgress`, `w1501/shared`, `useFilmProgress` each subscribe to scroll and
drive progression. None is reachable from `app/page.tsx`; they are kept alive by
importing each other. Not a live doctrine violation — dead code cannot own a
page's scroll — but real debt.

---

## 9. What this document does not claim

- That production is current **now**. `main` moved during the audit; §1 is a
  point-in-time proof.
- That signed-in clinician or employer flows work. Not exercised in this pass.
- That licensure has any live route. It does not.
- That the public metadata matches the shipped HTML. Not audited.
