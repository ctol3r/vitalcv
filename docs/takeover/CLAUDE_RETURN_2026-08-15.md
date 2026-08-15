# Claude Code return-from-vacation takeover — 2026-08-15

Authority: founder takeover directive `VITALCV_CLAUDE_CODE_RETURN_FROM_VACATION_TAKEOVER_2026-08-15.md`,
Wave C0 (Bundles C0.1–C0.4).

**Status: takeover archaeology only.** No product logic was changed. No PR was
merged. This document and its three companions are the Wave C0 deliverable and
the exit gate for it.

Companions:
- [`CURRENT_PRODUCT_REALITY.md`](CURRENT_PRODUCT_REALITY.md) — the loop a real user can actually complete
- [`OPEN_PR_TRIAGE.md`](OPEN_PR_TRIAGE.md) — all 8 open PRs classified
- [`CODEX_WORK_ACCEPTANCE_MATRIX.md`](CODEX_WORK_ACCEPTANCE_MATRIX.md) — preserve / improve / supersede

---

## C0.1 — Exact repository and production state

Every SHA below was read live on 2026-08-15, not taken from a document.

| Fact | Value |
|---|---|
| `origin/main` | `a8db9734cd60f26162c0f46e776389d8ac95abaf` |
| Production **web** `/api/version` `commit` | `a8db9734cd60f26162c0f46e776389d8ac95abaf` |
| Production **API** `/health` `git_sha` | `a8db9734cd60f26162c0f46e776389d8ac95abaf` |
| Ancestry | Exact equality on all three. Production is neither ahead nor behind. |
| Head commit | `feat(home): replace hero imagery with warm glass motion (#1387)` |
| Open PRs | 8 — all draft, all authored in the Codex cycle |
| Merged since 2026-08-08 | 57 |
| API health | `status: ok`, 306 requests, **0 errors**, p90 70ms, node v22.11.0 |

**Production is exactly current with `main`.** This is the healthiest baseline
state in this repository's recorded history — every prior takeover found drift.

### The governance finding: `main` has no branch protection

```
gh api repos/:owner/:repo/branches/main/protection
→ 404 "Branch not protected"

gh api repos/:owner/:repo/rulesets
→ []
```

`CLAUDE.md` instructs reading the required contexts live because "the list has
moved 2 → 5 → 7 → 14 in six weeks." **The list is now zero.** There are no
required status checks, no ruleset, and no protection object on `main`.

This is almost certainly a side effect of the repository going private on
2026-08-11 — GitHub drops branch protection on private repositories outside paid
plans. Nobody appears to have noticed, because the *symptom is invisible*: CI
still runs and still goes green, so PRs still look gated.

CI itself is healthy. PR #1388's head carries **17 successful check runs**
(Web E2E, Web E2E real auth, Backend Tests (Postgres), axe WCAG 2.2 AA, SCA,
design-lint, copy/claims/route guards). The checks run. They are simply no
longer *required*, and nothing would block a merge that skipped or failed them.

**Consequence for the merge gate:** the `CLAUDE.md` merge protocol — "read the
required contexts live, require zero pending and zero failing" — currently has
nothing to read. Until protection is restored, the gate is procedural only and
depends entirely on the operator enumerating check-runs by hand on the head SHA.
This is a founder action (repository settings), not a code change.

### Scheduled monitors: three red, and two of those reds are correct

| Workflow | State | Verdict |
|---|---|---|
| Release verify | Failing every ~30 min, all day | **Correct red, known cause** |
| Synthetic Reconcile | Failing hourly | **Correct red, same cause** |
| Production Auth Health | Last success 2026-08-11T17:55; failing today | **Unexplained — see below** |
| Source Health Probe | Intermittent (succeeded 20:32, failed 20:52, 21:28) | Unexplained |
| Public-copy drift probe | Failing | Unexplained |
| Agent Tick (shadow), Conflicting PR Sweep, Monitor Rescue | Passing | Healthy |

Release verify and Synthetic Reconcile both gate on `secrets.CLERK_SECRET_KEY_PROD`.
That secret has **never** been visible to the Actions runtime — the fault is
documented at length in `.github/workflows/release-verify.yml` and
`docs/deployment/clerk-rotation-2026-08.md`, a GitHub support ticket is open, and
the workflow deliberately reports red rather than the grey `skipped` that hid the
problem for its entire prior life. **That red is the system working.** Do not
"fix" it by widening a baseline or restoring the grey.

The unexplained failures share a signature worth recording: `conclusion: failure`,
**zero steps executed**, no logs retrievable, ~2 second duration. Production
Auth Health only curls `/api/version` and `/api/health/auth`; both return HTTP 200
right now (`/api/health/auth` reports `status: ok`, `runtimeSecretKey: true`), so
the script itself cannot be the cause. A job that fails before its first step
generally means the runner never accepted it. Every failure today falls after
~20:45, and successes cluster before it.

**Hypothesis, not a finding: Actions minutes or a spending limit were reached
today on the now-private repository.** I could not confirm it — the billing
endpoint needs a `user` OAuth scope this session does not hold, and I did not
change token scopes to get it. **Founder action:** check
Settings → Billing → Actions minutes. If that is the cause, it compounds the
protection gap: unprotected `main` plus a CI budget that can silently stop
gating PRs mid-day.

---

## C0.2 — Codex handoff ledger reconciliation

`docs/ops/CODEX_HANDOFF_LEDGER.md` exists on `main` and is high quality — each
work order records a claim-check, an explicit truth/authority boundary, an
evidence directory, and named test counts. It is the best handoff artifact this
repository has produced.

**Its status labels are stale.** Eight work orders are headed `— OPEN` whose
implementations are merged and deployed:

| WO | Ledger says | Reality |
|---|---|---|
| WO-17 warm-glass homepage | OPEN | **LANDED** #1387 → in production |
| WO-16 NPI-to-opportunity activation | OPEN | **LANDED** #1385 |
| WO-15 employer packet review | OPEN | **LANDED** #1383 |
| WO-13B-F1 mobile title containment | OPEN | **LANDED** #1379 |
| WO-13B discovery controls | OPEN | **LANDED** #1376 |
| WO-14 opportunity detail + MATCHA | OPEN | **LANDED** #1375 |
| WO-13 public opportunity field | OPEN | **LANDED** #1374 |
| WO-12 human+tactile homepage | OPEN | **LANDED** #1373 |
| WO-8 Direction D homepage recovery | OPEN | **LANDED** #1371 |
| WO-4 disclosure-boundary remediation | IMPLEMENTED LOCALLY, UNPUSHED | **Needs live check** — see risk #7 |

Classification: `MERGED_BUT_LEDGER_STALE` for all nine; `NEEDS_LIVE_VERIFICATION`
for WO-4.

The pattern is structural, not careless: each entry's "Next gate" is written
*before* merge and nothing rewrites the heading *after*. **Recommended fix** —
make the status a derived line (`Landed in #NNNN @ SHA`) appended by the same PR
that merges, rather than a heading that must be edited later. Do this inside the
next related implementation PR, not as a standalone docs churn PR.

Three ledger-adjacent files sit **uncommitted** in the primary working tree
(`docs/ops/CODEX_ACTION_PLAN_2026-08-11.md`, `CODEX_HANDOFF_LEDGER.md`,
`CODEX_HANDOFF_PROTOCOL.md`, dated Aug 11). They are untracked there only because
that tree sits on an older branch; the ledger *is* on `main`. No action beyond
awareness.

---

## C0.3 — Live surface audit

All ten probed public surfaces return HTTP 200 from production at the current SHA:

| Route | HTTP | Bytes | Time |
|---|---|---|---|
| `/` | 200 | 80,007 | 0.13s |
| `/explore` | 200 | 175,253 | 0.18s |
| `/employers` | 200 | 127,391 | 0.23s |
| `/onboarding` | 200 | 68,651 | 0.13s |
| `/pilot` | 200 | 115,407 | 0.14s |
| `/trust` | 200 | 120,855 | 0.13s |
| `/status` | 200 | 85,022 | 0.15s |
| `/verify` | 200 | 62,266 | 0.12s |
| `/pricing` | 200 | 94,634 | 0.13s |
| `/directory/1003000126` | 200 | 120,338 | **8.31s** |

**`/directory/[npi]` is 45× slower than every other surface.** 8.3 seconds is a
bounce, and this is the acquisition wedge — the page the sitemap points crawlers
and cold clinicians at. It is the single highest-leverage performance defect on
the public product. Cause not yet diagnosed (likely a synchronous NPPES read on
the request path); diagnosing it is Wave C1 work.

Viewport, keyboard, zoom, reduced-motion and no-JS checks were **not** re-run in
this wave. Codex's per-WO evidence directories already carry production-build
captures at 390/768/1440/1728 with computed contrast and overflow for each
merged surface, and re-deriving them adds cost without adding certainty. They are
re-verified when a surface next changes.

---

## C0.4 — Delta against the 2026-08-11 audit

| 2026-08-11 finding | Status | Evidence |
|---|---|---|
| `/trust` promises a correction path that does not exist | **FIXED** | Claim removed (#1372). `apps/web/__tests__/trust-center.test.tsx:77` now asserts `not.toContain('flag it and attach supporting evidence')`. Live `/trust` no longer contains it. |
| `POST /api/pilot/acceptance` unauthenticated, feeds org-unfiltered metric | **FIXED** | Retired in VCD-01d (#1353). `app.ts:2736` is now a tombstone comment. `verifierAcceptance.count()` is gone from `loadYcMetrics`. |
| `POST /api/hiring/accept` records acceptance with no packet linkage | **FIXED** | Closed in VCD-01e (#1356), with the reasoning left at the registration site. |
| Four acceptance emitters, three different scope keys | **PARTIALLY FIXED** | Down to **two**: `workflow-action` (application-scoped) and `employer-review/:entityId/accept` (entity-scoped). Still not one writer. |
| Start could exist without its audit row | **FIXED** | One start writer (#1352) — but PR #1384 proposes deleting it. See triage. |
| Self-serve employer org binding broken | **FIXED** | #1364. |
| Public evidence disclosure boundary | **FIXED** | ADR 0006 enforced (#1369), deployed boundary probed (#1370). |
| NPI binding is self-asserted, no possession proof | **STILL TRUE** | `apps/web/lib/get-ready/npi-binding.ts` validates 10 digits and NPPES-matches. Nothing proves possession. |
| `VerifierAcceptance` model | **REPLACED BY LESSER RISK** | Route retired; the model still exists at `schema.prisma:889` with no writer. Dead table, not a live defect. |
| `propagateDriftResponse` queries non-existent columns under `@ts-nocheck` | **UNKNOWN — REQUIRES TEST** | Not re-verified this wave. |

Codex closed every P0 that the 2026-08-11 audit named. That is the headline
result of this takeover, and it should change how the next wave treats this work:
**measure it before replacing it.**

---

## The real user loop, in one line

Full detail in [`CURRENT_PRODUCT_REALITY.md`](CURRENT_PRODUCT_REALITY.md). The
short version:

```
NPI → record → claim → account → profile → discover roles → [ WALL ]
```

**498 of 498 live opportunities are `applicationMode: "external"`.** Every role
in production is an ingested public-feed listing that sends the clinician to the
employer's own site. Zero roles support `Apply with VitalCV`.

The loop does not break because the code is missing. `POST /api/employer/opportunities`
exists, `/api/opportunities/[id]/apply` exists, and `opportunityTruth.ts:1486`
builds a requirement list for any non-feed listing. **The loop breaks because no
employer has ever created a role.** That is a go-to-market gap wearing a product
gap's clothes, and it changes what Wave C1 should be.

---

## Top 10 user-readiness blockers

1. **Zero integrated roles.** 498/498 external. `Apply with VitalCV` — the canonical transaction in the strategy — has no live inventory and therefore no live entry point. Everything downstream (packet, review, acceptance, start, reuse) is unreachable from the front door.
2. **No identity possession check.** NPI binding is self-asserted (C4.4). Anyone can bind any NPI. This gates any real pilot involving a real clinician.
3. **No clinician correction lane.** The false *claim* is gone; the *capability* still does not exist. Source observations cannot be contested by the person they describe (C5).
4. **No second-move / reuse path.** The thesis feature is unbuilt at product level. `reuseAcrossEmployers.e2e.test.ts` proves the `@vitalcv/psv` + `crs` + `audit` packages can express reuse with mocked sources — it does not prove a clinician can make an easier second application.
5. **Two acceptance writers**, keyed on different identifiers (application id vs entity id). Counting acceptances still means unioning an AuditEvent stream with an outbox stream.
6. **`/directory/[npi]` takes 8.3 seconds.** The acquisition wedge is the slowest page in the product.
7. **Zero credential requirements on any live role.** `credentialRequirements: []` for all 498 (correct — feed listings do not carry them). MATCHA evidence-fit and any Trust Compiler demo have nothing real to evaluate against.
8. **Zero compensation data.** `payRange: null` for all 498, honestly labelled `not_supplied`. Truthful, and a real weakness against HiringCafe-class discovery.
9. **Employer supply is 8 organizations, 65% one employer.** onemedical 130, charliehealth 28, twochairs 17, firsthand 12, then a tail of four.
10. **No operator console for a pilot.** The C0 operator gate (source health, identity collisions, correction review, mutation tracing) has no single surface; supporting a pilot still means SQL.

## Top 10 technical / architecture risks

1. **`main` is unprotected.** Zero required checks, no ruleset. The documented merge gate reads an empty list.
2. **CI may be silently budget-limited.** Unexplained zero-step failures after ~20:45 today. Unconfirmed; needs the billing page.
3. **PR #1384 deletes the one start writer** (`services/hiring/startWriter.ts`, 0 additions) that #1352 landed specifically so a start could not exist without its audit row. It substitutes `applicationStartCommandService.ts`. The replacement may well be better — but this is the exact invariant the repo has already had to fix once.
4. **Migration timestamp collision.** #1382 and #1378 both ship `20260814180000_*`. Prisma orders lexicographically so application order is deterministic, but both also edit `schema.prisma` — they will conflict textually, and a shared timestamp defeats human reading of migration order.
5. **#1382 credential-ops vs #1386 TrustSpec own the same business fact** — versioned institutional requirements. #1386 names this collision itself and rates it Critical. Unresolved, this is two policy models.
6. **Four-deep stacked PR chain** (#1378 → #1380 → #1381 → #1384), two of them `UNSTABLE`. Squash-merging any parent orphans its children; this repo has been bitten by exactly this.
7. **WO-4 disclosure-boundary remediation is recorded as implemented-but-unpushed.** Unpushed work looks landed in a ledger and does not exist in a repository.
8. **Dead `VerifierAcceptance` model** with no writer, still in the schema.
9. **`propagateDriftResponse` compiles only under `@ts-nocheck` and queries columns that do not exist.** Zero callers, so the OIG-drift revocation cascade is unreachable code that throws on first wiring. Not re-verified this wave.
10. **`explanation.whyThisMayFit` is boilerplate.** Every role returns the identical string "This employer profile includes source-backed requirement and freshness data." It is not false, but it is a fit explanation that explains nothing — and it is what MATCHA 1.0 will be measured against.

## Top 10 commercially important next actions

1. **Get one real employer to create one real role with structured requirements.** This single act converts an inert stack into a testable loop and is the precondition for C9–C14.
2. Restore branch protection on `main`, and confirm the Actions budget.
3. Decide the category question (#1377) — it blocks how every employer surface is worded.
4. Resolve TrustSpec policy ownership (#1382 vs #1386) before either lands.
5. Build identity possession, or scope the pilot to founder-verified clinicians and say so.
6. Fix `/directory/[npi]` latency — it is the top of the acquisition funnel.
7. Consolidate to one acceptance writer.
8. Build the correction lane, closing the gap the copy fix papered over honestly.
9. Instrument the reuse metrics before building reuse, so the second move can be *measured* as easier.
10. Widen employer supply past a 65% single-employer concentration.

---

## Proposed Wave C1 — and a correction to its stated scope

The directive scopes Wave C1 as "P0 truth, privacy, and security closure,"
premised on `/trust` still carrying an unbacked correction claim.

**That premise is out of date. Codex fixed it, and every other named P0, before I
returned.** C1.1 is closed. C1.2's highest-risk claims (opportunity truth) I
sampled directly and found honestly labelled throughout: `not_supplied`,
`unknown`, `not_stated`, real Greenhouse URLs, real observation timestamps, and
an explicit `limitation` string on every availability state.

Running C1 as written would spend a wave re-auditing closed findings.

**Recommended Wave C1 instead — "Restore the gate, then unblock the loop":**

- **C1.a — Restore the merge gate.** Branch protection on `main` with the check
  set that already runs green; confirm the Actions budget. *Founder action; I
  cannot change repository settings.* Nothing else should merge until this holds.
- **C1.b — Land the two clean, bounded PRs.** #1388 (visual removal, `CLEAN`,
  founder decision) and #1386 (docs-only after dropping one stale sitemap line).
  Both are low-risk and clear the board for the real triage.
- **C1.c — Resolve the two architecture decisions that block everything else:**
  policy ownership (#1382 vs #1386) and the acceptance/start writer question
  (#1384's deletion of the start writer). Both are founder-and-architect calls,
  not implementation.
- **C1.d — Fix `/directory/[npi]` latency.** Independently provable, no strategy
  dependency, and it is the acquisition wedge.

Truth and privacy work does **not** disappear — it moves to where the real gap
is: the correction lane (C5) and identity possession (C4.4) are capabilities to
*build*, not claims to retract.

**I am stopping here per the directive.** No implementation begins until this
report has been reviewed and Wave C1's scope is confirmed.
