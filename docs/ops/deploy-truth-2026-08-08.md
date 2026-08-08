# Deploy-truth report — Wave 1078

**Date:** 2026-08-08
**Wave:** 1078 — Production Truth & Strategy Promotion
**Question asked:** is the commit the founder approved the commit a visitor receives, and which deployment source is canonical?

---

## Verdict

**Production is converged with `origin/main`. There is no drift.**

| Surface | Reported SHA | Source of the reading |
|---|---|---|
| `origin/main` | `a6886d43d4213f6a7ebb4572273b1f72264d58a2` | `git rev-parse origin/main` |
| Web (vitalcv.com) | `a6886d43d4213f6a7ebb4572273b1f72264d58a2` | `GET /api/version` (no-store, cache-busted) |
| API (api.vitalcv.com) | `a6886d43d4213f6a7ebb4572273b1f72264d58a2` | `GET /health` → `git_sha` |
| `/status` page | `build a6886d4` | rendered HTML |

Three-way exact match, read from the running containers rather than inferred
from a workflow's colour. Machine-readable record: `docs/releases/a6886d4.json`.

## The drift described in the wave brief was a build-lag window, not a fault

The brief records `/status` at `80fca28` while GitHub main was `351c2c0`, and
asks why. The answer is that neither number describes a broken pipeline:

- `351c2c0` is the **parent** of the current `a6886d43d` (PR #1194).
- `a6886d43d` (PR #1195) merged after the audit was taken, and production
  followed it.

A snapshot taken during the minutes between a merge and a Railway rebuild will
always show the site trailing main. That is the deploy working, observed
mid-cycle. It is worth stating plainly because the corrective action for a lag
window and the corrective action for genuine divergence are completely
different, and the two are indistinguishable from a single reading.

**This is why the release record classifies by ancestry rather than equality.**
`behind` (deploy in flight), `ahead` (record generated against a stale intended
SHA), and `diverged` (the live container is not on this line of history — an
incident) are three unrelated situations that a boolean `converged: false` would
have flattened into one alarm.

## Canonical deploy source

**Railway is the deployment mechanism. `deploy-web.yml` is the assertion gate.
They do not cover the same set of commits.**

- Railway rebuilds `apps/web` on **every** push to `main`.
- `.github/workflows/deploy-web.yml` runs only on pushes touching
  `apps/web/**`, `packages/**`, `pnpm-lock.yaml`, the Dockerfile/railway.toml,
  `scripts/deploy-smoke.mjs`, or itself. When it does run it pins the Railway
  project/service IDs, requests the exact GitHub SHA, and refuses success until
  the public no-store `/api/version` reports that same full SHA.

The consequence, observed today: `a6886d43d` touched only
`.github/workflows/deploy-review.yml` and `docs/deployment/review-environment.md`.
No path matched, so **no `deploy-web` run exists for the commit currently in
production** — the last run is for `351c2c0`. Production still advanced, because
Railway does not consult the path filter.

**Operating rule:** the newest green `deploy-web` run is not an inventory of
what is live. Only `/api/version` is. Read the SHA; never infer it from a
workflow list. This is low-severity today — the unasserted commits are by
definition ones that changed no web code — but it means the assertion gate has
a coverage boundary, and that boundary should be known rather than discovered.

## Rollback path

Already documented and not restated here:
`docs/ops/railway-deploy-runbook.md` — "Rollback triggers" and the three-step
rollback hierarchy (Railway redeploy of the previous successful deployment →
`git revert` → force-push as last resort only).

Post-rollback, re-run both checks below and confirm the record reports
`converged` against the intended SHA.

## Verification performed

All three run against live production, cache-busted, on `a6886d43d`.

```bash
node scripts/deploy-smoke.mjs --base https://vitalcv.com --sha a6886d43d4213f6a7ebb4572273b1f72264d58a2
```
**19/19 PASS** — SHA/platform/environment/branch, auth health, DB health,
homepage release marker and cache policy, `/onboarding` never shared-cacheable,
`/employers` `/trust` `/status`, and source-lane parity across `/api/status`,
`/status`, and `/status/technical` (6 lanes agreeing on both).

```bash
node scripts/npi-smoke.mjs
```
**20/20 PASS** — new in this wave. Exercises the real career loop the homepage
runs, with a real NPI and a well-formed absent one. Notable readings:

- `1407202518` resolves live against NPPES, attributed and timestamped.
- `licensureStatus: unknown` while the `state_license` lane is `planned` — the
  honest state, cross-checked against the lane rather than a hardcoded string.
- `1999999992` (valid check digit, not in NPPES) returns `UNAVAILABLE` /
  `UNKNOWN`, **no invented name**, `exclusionClear: false`, and states
  `Identity not verified` as a blocker.

```bash
node scripts/release-record.mjs --write
```
**converged**, exit 0. Writes `docs/releases/<shortSha>.json` + `latest.json`.

### The guards were proven by making them fail

A guard that has only ever passed is not known to work. Both were run against
the payloads they exist to reject:

- `node scripts/npi-smoke.mjs --absent-npi 1407202518` → **exit 1**, 6 FAILs
  including `absent: no name is invented — FABRICATED: JACOB AARON`.
- `--sha <parent>` → `ahead`; a stub serving the parent → `behind`; an off-main
  commit → `diverged`; an unreachable service → `unknown` with a stated reason.

Both exit codes were read unpiped. `apps/web/__tests__/release-truth-scripts.test.ts`
(11 tests) locks all of this in by running each script as a subprocess against a
stub server, so the guards stay falsifiable rather than becoming string matches.

## What this wave did NOT change

No customer-facing copy, no UI, no route, no truth/consent/authz/employer-decision
semantics. Wave 1078's strategy promotion is founder-gated and is **not** included
— see the open decision below.

---

## Resolved — the homepage headline

**Founder decision, 2026-08-08: the live headline stays.**
*"Enter your NPI. VitalCV does the rest."* is canonical. The operating brief was
amended in this wave (its *Homepage message* section, plus a superseded-where-
conflicting notice on the homepage draft in the category strategy) so neither
document is still cited as authority for a hero it no longer describes.

"Your clinician profile. Ready for every move." is **not retired** — it remains
the clinician promise, and is the first alternative to test if the hero stops
converting. It is simply no longer the H1.

The conflict that produced this decision is recorded below, because the reasoning
is what stops it being re-opened.

---

Wave 1078 says to "promote the founder-approved Wave 1077 customer language only
after review". That promotion could not proceed as written, because **three
different headlines were in play and two of them were founder-approved at
different times.**

| Source | Headline | Status |
|---|---|---|
| Operating brief, `docs/strategy/vitalcv-strategy-operating-brief.md` (2026-08-04) | *Your clinician profile. Ready for every move.* | Canonical strategy document |
| **Live production today** | *Enter your NPI. VitalCV does the rest.* | Shipped 2026-08-08 via UX-V1 (#1190) with explicit founder visual GO |
| Wave brief's audit finding | *Get hired for the right opportunity—and start sooner* | **Not live.** Predates the UX-V1 cutover |

Two things follow:

1. **The audit's evidence for "live strategy drift" is stale.** The speed-claim
   headline it objects to is already gone. The finding was written against a
   pre-`c6a693641` homepage.
2. **The real conflict is newer and narrower.** The live headline leads with the
   NPI — the wedge — where the operating brief leads with the reusable profile —
   the asset. Both are founder-approved; the brief is older, the implementation
   is newer and shipped under a direct founder instruction to prioritise a
   visibly different homepage.

This was a positioning decision, not a drift repair, so the wave did not make it
unilaterally. Per the brief's own precedence order (founder task instruction →
operating brief → category strategy), the newer instruction governs — and the
founder confirmed it directly.

## Also unresolved: there is still no review URL

`reviewUrl` in the release record is `null`, and that is a finding rather than an
omission. PR #1194 built the pre-merge review environment; #1195 recorded that it
is blocked needing a `RAILWAY_API_TOKEN` secret (Railway project tokens are
environment-scoped). Until that lands, the program's rule — "do not merge or
alter production without founder GO after a review URL and functional evidence"
— can only be satisfied with rendered evidence and a local production build, not
a live review URL. See `docs/deployment/review-environment.md`.
