# Codex handoff ledger

Append-only. **Newest entry at the top.** One entry per work order is recorded
in the same pull request as its implementation or takeover evidence.

## WO-6 · API production surface probe — RESCUED IN #1370

- **Date:** 2026-08-13
- **Claim-check and stale-stack classification:** #1370 is the sole open PR for
  the anonymous API production-surface probe. Its product, disclosure-boundary,
  organization-binding, and market-evidence ancestors already landed on
  `main`; Codex classified those commits as LANDED and rebased only the two
  UNIQUE probe and ledger commits onto production baseline `253091496`.
- **Change:** Adds a dependency-free, anonymous API probe and a single shared
  public/guarded-surface contract consumed by both the post-deploy workflow and
  a real-app backend test. The workflow records a deployment receipt after its
  existing exact-SHA wait; the probe never sends credentials or performs a
  mutation. `/readyz` now fails closed: only HTTP 200 with `status: ready` can
  satisfy the deployment contract, so database-unready HTTP 503 cannot produce
  a false-green release.
- **Verification:** The focused real-app contract passes **45/45** through the
  real PostgreSQL harness, including the exact ready payload and an explicit
  assertion that HTTP 503 is never accepted. Curated public and guarded routes,
  plus any newly exposed undeclared route, are exercised through the real app;
  the larger census verifies mounted-route and tenant-boundary state without
  issuing 100-plus side-effectful requests inside the parallel database suite.
  The unrelated post-response investigator recovery is mocked to finish
  immediately so it cannot outlive the contract test. The census explicitly
  records the two issuer JWKS routes that answer 200 when the issuer-key secret
  is configured; they remain outside the curated availability probe because
  production baseline `253091496` returned 500 while that key was unavailable.
  The tightened read-only probe also passed every declared check against
  `https://api.vitalcv.com` at production SHA `253091496`: `/health` and
  `/api/version` agreed on the exact SHA, `/readyz` returned 200/ready, declared
  public routes answered as contracted, and all ten guarded routes returned
  `401 organization_context_required`. The final local gate passes typecheck,
  build, **464 web files / 4,505 tests**, and the real-PostgreSQL backend at
  **343 suites / 2,751 tests**. The web aggregate's 45 database-gated tests are
  exercised separately by the CI `web-quality` PostgreSQL step.
- **Next gate:** Require refreshed-head CI, including the PostgreSQL web-quality
  step, every required check green, and `CLEAN` before merge. After merge,
  require the workflow receipt and a live probe against the exact deployed main
  SHA.

## WO-11 · Land August 2026 market evidence — LANDED #1366

- **Date:** 2026-08-13
- **Claim-check and stale-stack classification:** #1366 is the sole open PR for
  the August market-evidence intent. Its previous branch contained an older
  stack whose product, directory, FTO, and name-clearance commits already
  landed on `main`. Codex classified those commits as LANDED and rebased only
  the one UNIQUE market-evidence commit onto production baseline `1b9632b24`;
  no stale stack content was retained.
- **Change:** Adds the dated five-ring market evidence brief, links it from the
  strategy index, records the bounded Axuall presentation-exchange design-around
  in `CLAUDE.md`, and extends governance-citation coverage to Markdown links in
  the operating and strategy documents.
- **Truth boundary:** The brief is rank-5 supporting research. Competitor,
  market, and regulatory figures remain attributed research and do not license
  public VitalCV outcome, verification, speed, compliance, or readiness claims.
- **Verification:** Focused governance and sitemap suites pass **2 files / 20
  tests**; copy and public-claims checks pass; `pnpm typecheck` and `pnpm build`
  pass. The first aggregate run found `/trust` freshness still stamped
  `2026-08-10` after #1372 changed that route; with no other open repair, this
  PR updates the factual sitemap date to its Git-derived `2026-08-14`. The
  corrected aggregate run passes **464 web files / 4,505 tests** plus the real
  PostgreSQL backend harness at **344 suites / 2,722 tests**. Merge required
  checks and `CLEAN` passed; #1366 merged as `253091496`, Railway reported that
  exact SHA, `/trust` published the corrected `2026-08-14` sitemap date, and the
  production-browser audit passed.

## WO-8 · Direction D homepage recovery — OPEN

- **Date:** 2026-08-11
- **Claim-check:** The production route resolves to `easy` when
  `PUBLIC_HOME_VARIANT` is unset; the live homepage served the dark `ezh-`
  composition at the start of this work. The implementation changes
  `apps/web/components/home/easy/`, not a rollback variant. A claim check of
  open and merged pull requests found no open `Watch it build` homepage
  implementation.
- **Change:** Added the dated EC-20 Direction-D route register, then rebuilt the
  served hero around the real NPI entry and one self-labelled record. The record
  names source-backed, clinician-controlled, access-required, and needs-review
  states; it is complete in server HTML and only gains its row assembly after
  hydration. The duplicate five-chapter homepage explainer is removed from the
  served composition. EC-10 shared chrome geometry is unchanged.
- **Truth and accessibility:** No real clinician, NPI, employer, source result,
  metric, or employer outcome is depicted. The illustration states that it is
  not a live result; the existing consent and institution-review boundary stays
  visible. The real NPI flow, keyboard access, and reduced-motion static frame
  remain covered.
- **Verification:** `pnpm check:design`, `pnpm check:copy`, `pnpm check:claims`,
  `pnpm typecheck`, a production `next build`, focused route tests (32 passed),
  and the production-build homepage Playwright suite (15 passed) all pass. The
  browser review measured 0px horizontal overflow at 390×844; the desktop
  implementation was reviewed at 1440×900. The pre-existing mobile shared
  chrome control cluster still overlays the viewport by its locked EC-10 design;
  it is recorded, not modified in this homepage-composition work order.
- **CI recovery (2026-08-13):** The restored remote gates found four server-frame
  assertions and two browser assertions still describing the retired dark,
  layered homepage. They now assert Direction D's light paper composition,
  Fraunces display/Geist reading contract, visible source states, and
  clinician-controlled disclosure boundary. `DESIGN.md` was regenerated after
  the Direction D tokens made its freshness test fail. `pnpm typecheck`, the
  production web build, focused Vitest (27 assertions), and focused production
  Playwright (26 browser checks) pass. The aggregate root command's web phase
  passes (460 files / 4,444 tests); its backend phase hit the known
  shared-worktree Prisma-generation collision while the isolated remote
  backend job is green. The next pushed head requires the full remote gate run
  before landing.
- **Gate:** Creative owner: Codex. Before merge, attach 390/1440 before-and-after
  screenshots, the reduced-motion capture, a motion recording, and review
  environment evidence to the PR. Production promotion remains outside this
  work order and requires explicit founder instruction plus exact-SHA proof.

## WO-10 · Trust Center source-record copy correction

- **Date:** 2026-08-12
- **Claim-check:** Checked open and recently merged pull requests plus remote
  trust-copy branches before editing. The older `hotfix/employer-trust-copy`
  and `trust-copy-pass` branches do not change this control card or its test.
- **Change:** Replaces the unsupported clinician source-observation correction
  promise with the exact implemented boundary: source-backed values retain their
  source and read time; clinicians may add self-attested profile information;
  VitalCV does not silently replace source records.
- **Verification:** The focused Trust Center test was run RED against the old
  card, then GREEN after the copy replacement. `pnpm check:copy` and `pnpm
  check:claims` cover the resulting public copy.
- **Scope boundary:** No clinician correction, review, attachment, overwrite, or
  dispute workflow was added.

## WO-4 · Remediate #1369 disclosure-boundary review findings — IMPLEMENTED LOCALLY, UNPUSHED

- **Date:** 2026-08-12
- **Finding and change:** The anonymous NPI timeline had remained a stated
  exclusion while reading and merging `acceptance` evidence. It now projects only
  the public-filtered passport collection and does not read or transform
  acceptance history, so acceptance labels, values, relationships, and derived
  recognition/trust effects do not cross the public boundary; public licensure
  evidence remains visible. The authenticated employer reader and the acceptance
  producer are unchanged.
- **Issuance boundary:** `POST /api/exchange/issue` now fails closed unless this
  deployment has a server-bound federation issuer and machine credential, and a
  timing-safe Bearer comparison succeeds. A caller may bind its request to that
  issuer but cannot select another configured federation member. The endpoint
  remains an explicit authorized exclusion from the public collection filter.
- **Verification:** Test-first RED reproduced the acceptance disclosure, the
  unclassified timeline route, anonymous issuance, and caller-selected issuer.
  GREEN: `pnpm --filter @vitalcv/web exec vitest run
  __tests__/recognition-timeline.test.ts
  __tests__/evidence-chain-disclosure-closure.test.ts
  __tests__/evidence-route-public-disclosure.test.ts
  __tests__/graph-routes-public-disclosure.test.ts
  __tests__/trust-exchange-route.test.ts` — **5 files / 61 tests pass**.
- **Next gate:** Run the repository pre-commit gates and `git diff --check`, then
  commit this review remediation without pushing. Any deployment that needs
  exchange issuance must provision the two server-only exchange-issuer settings;
  until then, the route returns its static unavailable response.
## WO-5 · Unblock #1364 — self-serve employer organization binding — OPEN #1364

- **Date:** 2026-08-11
- **Claim-check and rebase:** #1364 is the only open PR for the self-serve
  employer tenancy defect. Codex rebased its four commits directly onto current
  `origin/main` at `7de868d9d`, without merging any stale parent. The functional
  fix binds the setup user to the organization it just created; the data-only,
  idempotent migration backfills only unambiguous active memberships and preserves
  already-bound users.
- **Shared gate repair:** The failing backend check was reproduced under the
  CI-compatible Node 22 runtime. `hiringAutomationService` is a legacy
  `@ts-nocheck` module whose mixed Prisma value/type ESM import was elided by the
  ts-jest CommonJS transform, leaving `client_1` undefined before affected tests
  could execute. Its runtime `Prisma` namespace now uses an explicit CommonJS
  load and keeps `PrismaClient` type-only. The full run then exposed a second
  runtime-only Prisma field-name defect in the same module: the schema field is
  `isActive`, not `active`. Both repairs preserve the existing authorization and
  data semantics and remove the shared blocker for WO-6.
- **Verification:** After generating the backend client from the backend schema,
  the focused automation, Copilot strategy, self-serve DB/HTTP, and updated
  opportunity-service tests pass: **6 suites / 50 tests**, Node 22.20. The full
  real-Postgres backend harness passes **344 suites / 2,722 tests**; the aggregate
  root gate also passes (21 non-backend workspace tasks, 460 web files / 4,450
  tests, then the same backend harness). The unit mock now proves both
  existing-profile and create-profile flows call `User.update` with the resolved
  organization; the DB suites prove the resulting persisted behavior.
- **Next gate:** Run repository typecheck, build, and aggregate test gates on this
  rebased head; confirm the migration's second application is a no-op and that
  multi-org users remain unbound; then require `Backend Tests (Postgres)` and every
  refreshed head check to be green and `CLEAN` before merge.
## WO-4 · Rebase and land #1357 — ADR 0006 disclosure boundary — OPEN

- **Date:** 2026-08-11
- **Claim-check and rebase:** #1357 was the sole open disclosure-boundary
  follow-up and its stacked base `feat/g4-backlinks-adr0006` had already merged.
  Codex rebased the one-commit branch with `git rebase --onto origin/main
  feat/g4-backlinks-adr0006` after WO-3 landed at `7de868d9d`, then rebased again
  onto current `origin/main` at `e20b3d52d` after WO-5. `git range-diff
  3fd346a1^..3fd346a1 HEAD^..HEAD` reports the rebased commit as patch-equivalent;
  no stale base was merged in and `git diff --check origin/main...HEAD` passes.
- **Change:** Applies the explicit public-evidence allow-list before projection
  across the remaining NPI-keyed public route consumers, replaces raw internal
  error echoes with static client descriptions plus server logging, and adds
  structural and behavioral regression coverage for the route census.
- **Truth and authorization:** The route-level boundary does not make an
  NPI-keyed projection an authorization grant. Issuance, workspace configuration,
  and the product-owned timeline remain explicit, tested exclusions with their
  distinct authorization or product boundaries documented in the test.
- **Verification:** A public projection containing non-allow-listed data is
  exercised by `evidence-route-public-disclosure`,
  `graph-routes-public-disclosure`, and `evidence-chain-disclosure-closure`:
  **3 files / 49 tests pass**. `pnpm typecheck`, `pnpm build`, and diff checks
  pass. The aggregate root run passes 343/344 backend suites but repeats the
  unrelated, order-sensitive `pilot.routes` 500 result (its focused real-Postgres
  run is 6/6). This is recorded as a suspected suite-isolation defect and is not
  folded into the disclosure-boundary PR.
- **Next gate:** Open a replacement PR from the rebased Codex branch rather than
  force-pushing the stale Claude source; require its refreshed head checks to be
  green and `CLEAN`. Resolve the pilot-suite isolation defect in its own bounded
  work order before treating repeated aggregate red runs as a disclosure failure.

## WO-3 · Merge #1358 — clinician-record distribution and removal controls — OPEN #1358

- **Date:** 2026-08-11
- **Claim-check:** Claude's `wave/clinician-record-distribution` is the sole
  open PR for this intent. Its 11 commits and all required prior checks were
  inspected; it is `CLEAN` against its target. The Codex takeover branch merges
  current `main` before any new evidence is added.
- **Change:** Removes a real clinician's identity from the pilot proof and
  noindexes it; makes the public CMS registry record discoverable only behind
  the runtime `DIRECTORY_SITEMAP=enabled` switch; adds an on-page claim handoff,
  bounded analytics, removal contact, exclusion/noindex behavior, and source
  provenance for the declared NPI seed.
- **Truth and privacy:** This does not claim a directory record is credentialing
  or a verification result. The sitemap stays disabled by default. The removal
  path stops VitalCV from advertising the record and marks it `noindex`; it does
  not claim to alter the underlying CMS filing.
- **Verification:** Existing PR checks are green. Fresh `pnpm typecheck`, `pnpm
  build`, and `pnpm test` pass on the current merge ref; final diff review and
  a new head-check run remain required before landing.
- **Next gate:** Add this ledger entry in #1358, require all refreshed head
  checks to finish green with a clean merge state, then land it. Production
  enablement of the sitemap is intentionally outside this merge and requires a
  founder decision.

## WO-1 · Merge #1362 — delete `verifyProduction.ts` — OPEN #1362

- **Date:** 2026-08-11
- **Claim-check:** Ran the protocol resume sequence against `origin/main` at
  `35574fd9e`. #1362 is the sole open PR for this intent and is `CLEAN`; no
  merged PR or unclaimed branch duplicates it. A full text search finds legacy
  mentions in two historical `.claude/settings.local.json` permission entries
  and explanatory backend comments, but no import, package script, workflow,
  or executable caller. The deleted script itself was the only executable
  implementation.
- **Change:** Removes the orphaned production-check script. It asserted route
  outcomes that the current tenant guard cannot produce and was not wired into
  a runnable repository path.
- **Verification:** `git diff --check origin/main...HEAD` exits 0. `git grep
  -n -i 'verifyProduction' HEAD` found only historical text references after
  the deletion, not a runnable caller. The PR head's 14 check runs all reported
  `success`, including Backend Tests (Postgres), Web Quality, both Playwright
  suites, axe, copy, claims, design, route, and workflow-contract gates.
  WO-2 landed the focused `/pricing` correction in `b861a4abf`; on this updated
  merge ref, fresh `pnpm typecheck`, `pnpm build`, and `pnpm test` all pass
  (4,401 web tests passed; the suite's seven environment-gated files remain
  intentionally skipped).
- **Gate:** The merge includes the current `main` ledger rather than overwriting
  it, avoids a force-push, and keeps the executable deletion as the only
  functional change in this work order.

## WO-2 · Merge #1365 — Axuall '891 FTO read and presentation-exchange tripwire — OPEN #1365

- **Date:** 2026-08-11
- **Claim-check:** The open and merged pull-request lists and remote branches were
  checked before takeover. No existing merged work carried this FTO record or its
  dormant-presentation guard.
- **Change:** Documents the Axuall '891 research constraint, adds a five-file
  deployed OID4VP baseline and tripwire test, and corrects the stale `/pricing`
  sitemap `lastModified` value that made the existing full test suite fail on
  current `main`.
- **Verification:** The focused tripwire suite passes cleanly. Three deliberate
  injections failed as intended: a new deployed `presentation_definition` path,
  a product-page import of `AcceptancePanel`, and a product caller of
  `/api/oid4vp`; each was removed before continuing. `pnpm typecheck`, `pnpm
  build`, and `pnpm test` all pass.
- **Scope boundary:** This records a research and regression boundary only. It
  does not activate OID4VP exchange, change product behavior, or remediate the
  separately identified unauthenticated-endpoint concern.
- **Next gate:** Push this ledger entry, require all head checks to finish green
  with a clean merge state, then land #1365. Its sitemap correction unblocks the
  existing WO-1 deletion PR from a known baseline test failure.
