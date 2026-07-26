# VitalCV Release Manager Routine

**Status:** Canonical release process. Effective 2026-07-02 (Epic Wave 2H).
**Supersedes:** the universal "Codex SAFE before every merge" gate (replaced 2026-07-01 by the
risk-tier policy below, owner directive).
**Audience:** any session operating VitalCV releases (Fable acting as Release Manager), and Chris.

Every merge to `main` follows the same verified production loop. This document is the loop. It
standardizes what worked during Epic Wave 1 (production recovery) and Wave 2 (clinician platform
completion, #468–#491): classify risk before merging, verify production after merging, and treat
`pnpm check:deploy` as the drift oracle.

**Roles.** Fable owns execution and self-merges low risk. Codex (`codex exec`) reviews high risk.
Chris approves production-control changes. Browser/manual passes verify user journeys when they
change.

---

## 1. PR risk classification

Classify **every** PR before merge and state the tier + one-line rationale in the PR body or the
merge report. When a PR spans tiers, the highest-risk file in the diff sets the tier.

| Tier | Scope | Examples |
|---|---|---|
| **0 — Trivial** | Docs, route wiring, dead-link fixes, demo-data removal, copy changes, tests, small proven bugfixes | `docs/**`, adding a missing `page.tsx` for an existing nav link, deleting fake-data components |
| **1 — Product** | Clinician-facing surfaces, profile/readiness/passport UI, non-destructive API proxy wiring, a11y, route contracts | `/holder/*` surfaces, timeline, settings, UX states, recognition cards |
| **2 — Sensitive** | Auth/session/Clerk logic, security routes, credentialing/trust calculations, DB migrations/Prisma, billing, Docker/Railway/runtime files, major surface deletions, employer workflows on real data, PII/PHI handling | `middleware.ts`, `Dockerfile`, `railway.toml`, trust-state math, `.github/workflows/**` that deploy |
| **3 — Production control** | Prod env vars, Railway service config, DNS/domain, destructive data operations, disabling auth, irreversible migrations, real customer accounts | Setting `CRON_SECRET`, changing the web service's start command, dropping a table |

Two standing amplifiers, regardless of tier:

- **Truth contract:** any diff touching public copy must respect the banned-strings list and the
  literal-typed issuer chain invariants in `CLAUDE.md`. "Copy polish" waves have repeatedly broken
  test-pinned strings — restore the test-asserted string by default.
- **Design lineage:** every product PR body must contain a `Design Handoff References` section
  (exact handoff paths, or the literal line `No Claude Design handoff file used for this PR.`).
  See `docs/design/design-lineage-policy.md`.

## 2. Required checks by tier

| Check | Tier 0 | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|---|
| Focused vitest for touched area | ✅ | ✅ | ✅ | — |
| `pnpm turbo run build --filter @vitalcv/web` (or full `pnpm build` if diff is wider) | ✅ | ✅ | ✅ | — |
| Fable self-review of the full diff vs `origin/main` | ✅ | ✅ (heightened: regression proof) | ✅ | — |
| Narrow-diff confirmation (no unrelated files) | ✅ | ✅ | ✅ | — |
| Risk + rollback note in PR body | — | ✅ | ✅ | — |
| Codex `codex exec` review (3 audits: implementation / diff / copy) **or** explicit Chris override | — | only if uncertain | ✅ | insufficient |
| Browser verification of the changed journey | — | when the user journey changes | ✅ (targeted) | — |
| Chris approval | — | — | — | ✅ **stop and ask first** |
| Post-merge: Railway deploy wait + SHA + health + `pnpm check:deploy` | ✅ | ✅ | ✅ | ✅ |

Docs-only diffs (this file's tier): the build cannot be affected, so PR CI standing green +
self-review satisfies the tests/build rows — say so explicitly in the report rather than silently
skipping.

**Codex invocation gotchas** (Tier 2): `codex exec` hangs forever in background shells waiting on
stdin — always redirect `< /dev/null`, write output to a file (not a pipe), and pass
`-c model_reasoning_effort="medium"`. During a Codex usage-limit blackout, keep building CI-green
PRs but **queue** Tier 2 merges for the limit reset or an explicit Chris override — never
downgrade a Tier 2 to self-merge because the verifier is unavailable.

## 3. Merge procedure

**Branch cutting.** Local `main` is held by another worktree and ~80 sibling worktrees exist.
Never `git checkout main`. Always:

```bash
git fetch origin main
git worktree add -b <branch> /tmp/vitalcv-<slug> origin/main
cd /tmp/vitalcv-<slug>
pnpm install                                  # only if the diff needs building/testing
pnpm turbo run build --filter @vitalcv/web    # prebuilds @vitalcv/trust-state dist/
```

Diff against `origin/main`, never local `main` (it is stale by design).

**PR body must contain:**

1. What changed and why (scope in one paragraph).
2. `Tier: <n> — <rationale>`.
3. Verification evidence (test output, build result, probe results).
4. Risk + rollback note (Tier 1+).
5. `Design Handoff References` section (product PRs — see §1).

**Merge:**

```bash
gh pr create --title "<type(scope): summary>" --body-file <body.md>
# ...tier checks from §2...
gh pr merge <n> --squash --delete-branch
```

Merging to `main` **is** deploying: Railway watches `main` and auto-deploys both services, and
`.github/workflows/deploy-health-probe.yml` fires a source-health probe against production on
every main push. Do not merge anything you are not prepared to verify live in the next ten
minutes. Merge one PR at a time; finish its verification loop before merging the next.

## 4. Railway deploy verification

Production topology (canonical list lives in
`apps/web/lib/platform/deployment-integrity.ts` → `EXPECTED_SERVICES`):

| Railway service | Role | Builder | Domain | Health |
|---|---|---|---|---|
| `vitalcv-web` | web | DOCKERFILE | vitalcv.com | `https://vitalcv.com/api/health` |
| `delightful-essence` | api | NIXPACKS | api.vitalcv.com | `https://api.vitalcv.com/health` |
| `Postgres` | database | managed | — | (skips git checks) |

After merge, wait for the deploy to settle (typically 3–8 minutes for the web Docker build), then
confirm the new deployment:

```bash
railway status --json   # from /Users/christoler/vitalcv (the linked-CLI directory)
```

or just run `pnpm check:deploy` on a loop until the web row shows the new SHA (§5–6 — it wraps
status + SHA + health in one command).

**Hard-won Railway facts (Wave 1 incident, 2026-07-01):**

- `apps/web/railway.toml` is applied **on top of** the Docker image. A `cd`-based
  `deploy.startCommand` ran from the image's `WORKDIR` and crashed the container instantly with
  **no logs** (deploy log showed only "Stopping Container") — every web deploy failed for 5 weeks
  while prod silently served a stale build. **Never put a cd-based startCommand in railway.toml
  for a Dockerfile service.** Any change to `railway.toml`, `Dockerfile`, or start commands is
  Tier 2 minimum; changing them on the live service config is Tier 3.
- `railway logs` defaults to the last **successful** deployment, not the latest. To inspect a
  failed deploy: `railway deployment list -s <service> --json`, then pass the failed deployment ID
  explicitly.
- A deploy that "succeeds" in Railway's UI can still be the *previous* image serving traffic —
  which is exactly why SHA verification (§5) exists. Deploy-status green is necessary, never
  sufficient.

## 5. SHA verification

The question this answers: **is production actually running the commit I just merged?**

```bash
git rev-parse origin/main          # expected SHA (after your merge)
pnpm check:deploy                  # compares Railway's deployed commit to GitHub main HEAD
```

`check:deploy` fetches GitHub `main` HEAD and each service's `latestDeployment.meta.commitHash`
from Railway and reports per-service `commit=` columns. Pass criteria:

- `vitalcv-web` and `delightful-essence` both show the merged SHA (short form), `status=SUCCESS`.
- A mismatch **within 30 minutes of merge** is a *warning* (rollout grace — build still in
  flight). Re-run until it converges.
- A mismatch **beyond 30 minutes** is a drift **incident** (exit 1). Stop and treat as §10.

Never skip this step because health looks fine — the 5-week Wave 1 outage had a "healthy" site
serving a May build.

## 6. Health verification

```bash
curl -s https://vitalcv.com/api/health | jq .
curl -s https://api.vitalcv.com/health
```

The web health route reports `status`, a `backend` connectivity probe (`ok | degraded |
unreachable`), and config signals (Clerk mode should be `production`, `apiBase`, `sentry`).
Expectations:

- Web: HTTP 200, `status: "ok"`, `backend.status: "ok"`, `clerk.mode: "production"`.
- API: HTTP 200 on the **public** `/health` (the API's `/api/health` is auth-gated and 401s by
  design — probing it produces a false "degraded"; this burned us once already).

`pnpm check:deploy` probes both health URLs itself, so in practice §5 and §6 are one command; the
manual curls are for diagnosing *which* layer is unhappy when it reports drift.

## 7. Golden-path verification

The clinician golden path (`NPI → readiness → passport / proof packet → share → employer review →
acceptance`) is protected at two layers:

**Static (pre-merge, part of tests):** `apps/web/__tests__/holder-route-contract.test.ts` —
extracts every internal `href` from the holder/mobile surfaces and asserts each resolves to a real
App Router route. Run it whenever a PR touches holder surfaces, nav, or routes:

```bash
pnpm --filter @vitalcv/web exec vitest run __tests__/holder-route-contract.test.ts
```

**Live (post-merge):** probe the changed surface plus the golden-path spine. Minimum spot-check
after any Tier 1 merge (expect 200s, no error banners in the HTML):

```bash
for r in / /holder /holder/readiness /holder/timeline /holder/recognition /verify /trust; do
  printf '%-24s %s\n' "$r" "$(curl -s -o /dev/null -w '%{http_code}' https://vitalcv.com$r)"
done
```

Probe the **specific route you changed** as well — status 200 plus a grep for a string your change
introduced is the cheapest "my code is actually live" test and doubles as SHA confirmation.

Signed-in journeys: Clerk's CDN bot-blocks automated browsers (503), so signed-in production
walkthroughs are a Chris/manual step — request one in the report when auth-gated behavior changed;
do not silently claim it.

**Deep verification (optional, release-scale):** `pnpm release:readiness` runs the full PASS/FAIL
matrix (tests, build, truth scan, canonical-runtime check, verifier continuity `.well-known`
probes, replay lineage, ES256 receipt suite, degraded-state copy, anonymous-write scan) against a
local canonical runtime (`RELEASE_BASE_URL` overrides the probe target). Use it before declaring a
multi-PR wave closed, not per-merge.

## 8. `pnpm check:deploy` — the drift oracle

Detect-only integrity check (never mutates infra). Wraps §4–§6: Railway state via the linked CLI,
GitHub main HEAD, and both health probes, evaluated against `EXPECTED_SERVICES`.

```bash
pnpm check:deploy    # run from /Users/christoler/vitalcv — needs the linked Railway CLI
```

| Exit | Meaning | Action |
|---|---|---|
| 0 | No drift — every production service agrees | Continue |
| 1 | Drift **incident** (branch/commit/age/health/status divergence) | §10, and usually §9 |
| 2 | Could not read `railway status --json` — CLI not linked in this directory | `railway link`, or run from the primary checkout; this is a tooling failure, **not** a green light |

What it flags: wrong repo/branch (the stale-branch failure class), deployed commit ≠ main HEAD
past the 30-minute grace, deploy status FAILED/CRASHED, deploy older than 14 days, health
degraded/unreachable, cross-service branch/commit disagreement, missing services.

The same evaluation renders in the founder dashboard at `/admin/platform` (Railway GraphQL token
path), so Chris sees what the CLI sees.

**Cadence:** after every merge (mandatory); at wave start (baseline — do not build on top of an
already-drifted platform); when anything smells stale.

## 9. Rollback procedure

Primary mechanism: **revert commit on `main`** — Railway redeploys automatically, and
`check:deploy` stays truthful because `main` HEAD still equals what production should run.

```bash
git fetch origin main
git worktree add -b revert/<slug> /tmp/vitalcv-revert-<slug> origin/main
cd /tmp/vitalcv-revert-<slug>
git revert --no-edit <bad-sha>        # squash-merge PRs revert as one commit
gh pr create --title "revert: <original title>" --body "Rollback: <why>. Tier 0 (revert of <sha>)."
gh pr merge --squash --delete-branch
# then the full post-merge loop: deploy wait → SHA verify → health → check:deploy
```

Rules:

- A clean revert of a recently merged PR is **Tier 0** (proven-content rollback) — do not wait on
  a review to un-break production. Note the tier and reason in the PR body.
- Railway's dashboard "rollback to previous deployment" is the emergency path when a revert can't
  build (e.g. `main` is red). It intentionally creates SHA drift — `check:deploy` will (correctly)
  scream until you fix forward. Use only to stop active bleeding, then land the revert commit.
  Dashboard rollback is a Railway service-state mutation → **Tier 3, tell Chris**.
- Never roll back by force-pushing `main`, and never "fix" drift by editing Railway service
  config to point at a branch — that recreates the exact failure class §8 exists to catch.
- DB migrations don't revert with git. If the bad PR migrated the schema, rollback is Tier 2+
  (write a down-migration or fix forward) — see
  `docs/deployment/playbooks/templates/deployment-recovery.md` for half-applied deploy recovery.

## 10. Incident declaration criteria

Declare a **deployment incident** (stop merging, switch to recovery) when any of:

1. `pnpm check:deploy` exits 1 with severity `INCIDENT` (branch drift, commit drift beyond grace,
   FAILED/CRASHED deploy, stale deploy, service missing).
2. Web or API health endpoint is unreachable, or web reports `backend: unreachable`.
3. A golden-path route (§7 spine) returns 404/5xx in production.
4. The container exits instantly with no logs ("Stopping Container" only) — the
   startCommand/WORKDIR class; inspect the **failed** deployment's logs by explicit ID (§4).
5. Production is serving a SHA that was never on `main` (unknown provenance).
6. CI on `main` is red. Assume the red is **layered** — Wave 1 peeled three independent failures
   stacked on one another. Fix, re-run, expect the next layer; a green job after one fix is not
   proof the pipeline is healthy.

Incident response order:

1. **Stop the line** — no further merges until `check:deploy` is green again.
2. Identify the last-good SHA (`railway deployment list`, git log) and diagnose from evidence
   before mutating anything — a symptom that pattern-matches a known failure can have a new cause.
3. Decide fix-forward vs rollback (§9). Default: rollback if a golden-path surface is down or
   truth-contract copy is wrong in production; fix-forward for degraded-but-honest states.
4. Escalate to **Chris (Tier 3)** if recovery requires Railway service config, env vars, DNS, or
   anything irreversible.
5. Close the incident only when: `check:deploy` exit 0, both healths `ok`, golden-path spine 200s,
   and the incident + root cause are recorded (memory + report) so the class gets a permanent
   check.

For institutional-rollout incidents (pilot tenants), the escalation map in
`docs/deployment/playbooks/templates/rollout-escalation-map.md` governs beyond this document.

---

## The standard loops (quick reference)

**Tier 0/1:**

```
tests → build → Fable self-review → merge → Railway deploy wait
      → SHA verify → route/prod verify → pnpm check:deploy → report
```

**Tier 2:**

```
tests → build → risk assessment → codex exec review (3 audits) or Chris override
      → merge → Railway deploy wait → SHA verify → targeted production verification
      → pnpm check:deploy → rollback note in report
```

**Tier 3:**

```
stop → ask Chris (do not stage, do not "prepare", do not partially apply)
```

**The report** (every merge, no exceptions) states: PR + tier + rationale, checks run and their
results, deployed SHA match confirmed at both services, health status, which routes were probed
live, and — for Tier 1+ — the rollback plan. Report failures faithfully: if a check was skipped,
say so and why.

## Known gaps (follow-up automation, not built here)

- `scripts/deployment-integrity-check.ts` only reads the **linked CLI**; the token-based
  `fetchRailwayStatus()` path exists in the library but the script doesn't fall back to
  `RAILWAY_API_TOKEN`, so `check:deploy` can't run in CI yet.
- No single command chains merge → deploy-wait → SHA → health → golden-path; the loop above is
  manual. A `release:verify-deploy` script that polls until SHA convergence would remove the
  re-run-until-green step.
- `deploy-health-probe.yml` waits a fixed 60s after main push — it can probe the *old* deploy on
  slow Docker builds. It should poll for SHA convergence instead.
- Golden-path live verification (§7) is a hand-rolled curl loop; a production route-contract probe
  (the static test's route list, run against vitalcv.com) would make it one command.
