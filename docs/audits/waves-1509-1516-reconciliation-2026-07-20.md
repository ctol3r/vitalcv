# Waves 1509–1516 — reconciliation against `origin/main`

**Date:** 2026-07-20 · **Read at:** `origin/main` `5966537c2` (`#811`), re-checked at `280cf991d` (`#806`)

> `#806` merged *during* this reconciliation, moving A1/A2 from in-flight to shipped in
> the space of one session. That is the failure mode this document exists to prevent —
> re-read `git log origin/main` immediately before dispatching or merging anything below.
**Plan reconciled:** `docs/waves/godmode-master-plan-1509-1516.md` (39 tasks, 8 waves)
**Method:** every verdict below was read from `origin/main` via `git grep`/`git show`, plus
live `gh pr view` state. Nothing here is sourced from a working branch or from memory.

> **Why this document exists.** The plan was written on 2026-07-20 against the base-0
> contract, which is pinned to `83812d1a2`. `main` moved underneath both. **12 of 39
> tasks are already shipped, already in flight, or resolved by a different PR than the
> one the plan names**, and one task would cause damage if executed as written. The
> plan's own anti-collision rule applies: *a task that discovers its target already
> shipped stops and reports — it does not re-implement.*

---

## 0. The four things to read before anything else

1. **`C4` must not be executed as written.** Its premise — "~6 packages ship from `dist/`
   with no source" — is false. There are **zero** committed `dist/` directories on
   `origin/main`, and none of the named packages (`claims`, `idempotency`,
   `rate-limiter`, `tracing`) exist. `docs/architecture/package-status.md` already
   investigated and closed this on 2026-07-04 as a **stale-worktree false positive**.
   Every one of the 25 real packages has source. "Delete the unimported dist-only
   packages" against today's tree would delete real, imported source.

2. **The story rail already shipped** (`#800` / `8636c2d2e`, "W2 — the career journey
   rail goes live"). `H2` is done; `HeroLoopPills`, `ScrollFocusManifesto` and
   `StickyProductStory` are **deleted from the tree**, not merely unmounted. This also
   makes base-0 §2/§3.1/§3.2 and its Wave 2/3 rows stale — **the composition manifest is
   the current authority**, and it already reads "W2 EXECUTED".

3. **Two "no importers" claims in the plan are wrong**, and acting on them breaks CI:
   - `components/career-graph/data.ts` (C2) is read **off disk by literal path** by a P0
     quarantine guard: `apps/web/__tests__/evidence-network-quarantine.test.tsx:33-35`.
   - `components/home/PublicTruthSections.tsx` (C1) has a live test import, an entry in
     `scripts/public-entry-copy-sources.json:11`, and a hard assertion in
     `packages/domain-common/__tests__/wordingSafety.test.ts:113`.

4. **`S1` — the plan's "highest priority open gap" — is not a code gap.** The G1 JWKS
   middleware shipped in `#589` and is wired globally
   (`apps/api/backend/src/app.ts:3537`). It is sitting at `CLERK_JWT_VERIFICATION=off`.
   Closing G1 is an **ops flip on Railway**, blocked on observing one real
   `verified_match` in prod — not on writing middleware.

---

## 1. Verdict table

Legend: **SHIPPED** = done, close the task · **IN FLIGHT** = an open PR covers it ·
**PARTIAL** = real remaining work, smaller than the plan assumes · **OPEN** = as briefed ·
**VOID** = premise false, do not execute.

### W1509 — Security core

| Task | Verdict | Evidence / correction |
| --- | --- | --- |
| S1 G1 header trust | **PARTIAL** (ops) | `middleware/verifiedIdentity.ts` (JWKS, `off\|shadow\|enforce`) shipped `#589`; wired `app.ts:3537`. Design deviates deliberately: it **rewrites** `x-clerk-user-id` with the verified value rather than deleting reads, so 34 files still read the headers by design. Remaining = set `CLERK_ISSUER` + flip to `enforce` on Railway. Plan's "close `#556`" is stale — `#556` merged 2026-07-05 and is unrelated (workspace ids); it meant **`#506`**, which is open, DO-NOT-MERGE, and now superseded by `#589`+`#722`. |
| S2 G2 RBAC enforce | **PARTIAL** | Code complete. **Two** flags exist, not one: `VERIFIER_RBAC_ENFORCED` (`env.ts:165`) *and* `VERIFIER_RBAC_MODE` (`middleware/orgRoleGuard.ts:51`); both must flip. The `roles.ts:37` comment sub-task is **already done** (`#797`). Shadow review already exists as `docs/security/shadow-telemetry-2026-07-11.md` — but with **zero** verifier traffic sampled. `apps/web/__tests__/verifier/foundation-sweep-7.test.ts:88` pins `false` and must change in the same PR. |
| S3 G3 rate limiting | **PARTIAL** | `app.set('trust proxy', 1)` already landed (`#586`, `app.ts:3493`). Genuinely open and material: **`/api/passport/:npi` has no limiter at all** (`routes/passport.ts:1022`), nor do `/disclose`, `/embed.svg`, `/card.json`, `/export`. Three separate in-memory `Map` limiters; **no Redis dependency exists in the repo**. |
| S4 Sentry MS-1 | **DONE (code)** | Shipped in this wave — see §3. Remaining is the DSN env vars on Railway. |
| S5 Security CI gate | **OPEN** | `.github/workflows/security-audit.yml` is SCA-only. Must be built as a **ratchet** (no *new* header readers), not an absolute ban — 34 files read them today by S1's design — and sequenced after S2, since asserting `VERIFIER_RBAC_ENFORCED` defaults true fails until S2 lands. Watch the path-filter trap that `#811` just fixed for Web E2E. |

### W1510 / W1511 — Homepage

| Task | Verdict | Evidence / correction |
| --- | --- | --- |
| H1 baseline | **VOID as briefed** | A *pre-mount* baseline is no longer capturable — the mount happened in `#800`. Collapse H1 into H4 as a single post-rail archive. |
| H2 mount rail | **SHIPPED** `#800` | `HomePageClient.tsx:302` `<RailJourney />`; `RailJourney.tsx:22-35` publishes into `ChapterProgress` with no new listener; retired components deleted from tree; `/dev/story-rail` harness still gated. |
| H3 phantom `#start` | **PARTIAL** | All six `CHAPTER_DOM_IDS` now resolve (rail emits `id={chapter.id}`). The open half is the **invariant test** — nothing asserts registry↔DOM agreement. Bonus defect: `styles/homepage-motion.css:85-89` omits `#start` from the `scroll-margin-top` rule. |
| H4 post-mount regression | **OPEN** (S) | `docs/design/waves/` does not exist. Note none of the specs are screenshot-diff based, so "re-anchor baselines" means re-capturing the `shd-0-baseline` PNG set. |
| R1 kill second scroll model | **PARTIAL** | Core shipped with `#800`: zero `useScroll`/`useSpring` in `components/home`. Residual = **dead CSS** in `styles/homepage-motion.css` (`.sticky-product-story` incl. the 100vh+100vh runway at ~`:107`, `.story-observer*`, `.story-stage`, plus reduced-motion overrides at `:485`/`:508`). Plan's line numbers (174-177) are stale. |
| R2 per-chapter scene reaction | **PARTIAL** | `AmbientField` is fully wired to the blend model (`AmbientField.tsx:105-109,166`). Open: **`GrainOverlay` is hardcoded** to `getChapterScene('wallet').grain` in `HomePageClient.tsx` and never sees the blend; **`scrim` is computed and never consumed** (`progress.ts:134`) despite `SCENE_SCRIM_FLOOR` being test-asserted. |
| R3 VIS-4.5 contrast | **OPEN** (M) | The axe gate is much weaker than it looks: `a11y-gate.yml` runs **one** file, `__tests__/a11y/hero-routes.test.tsx`, against **five synthetic fixtures** — not the real homepage (its `<h1>` isn't even the live one) — and `color-contrast` is explicitly whitelisted at `:20-22`. Coordinate with `#801`, which edits the very `@theme` tokens this would assert against. |

### W1512 / W1513 — Product spine

| Task | Verdict | Evidence / correction |
| --- | --- | --- |
| A1 ledger routes | **SHIPPED** `#806` (`280cf991d`) | `#806` ships 6 routes in `routes/activation.ts`. Gaps it does **not** cover, which remain open: the **employer/org-scoped GET** (both `#805` and `#806` only expose an ownership-keyed read with uniform-404), it authorizes with a raw-header `requireClerkUserId` rather than verified identity, and it registers `activation.ts` in `audit-coverage-baseline.json` as a gate **exception**. |
| A2 start-event routes | **SHIPPED** `#806` (`280cf991d`) | Emits `START_READY/RECORDED/CANCELLED`; does not touch confirm-start. Residual: `GET /start-state` grants read to any `x-org-role` holder without checking that the role's org matches the application's tenant. |
| A3 packet-bound acceptance | **PARTIAL** | Backend is **already live on main** (`routes/employerActions.ts:409-465`, schema + migration present). Blocked in the web tier twice: the proxy allow-list rejects the fields (`app/api/employer-review/[entityId]/[action]/route.ts:120-128`) and `ReviewClient.tsx:1258` sends only `{ acceptanceScope: 'pilot' }`. Real blocker is a **surface-linkage decision** — `ReviewClient` is entity-keyed and has no `applicationId`. |
| A4 reconcile start paths | **OPEN** | Decision is drafted in `#806`'s `docs/design/act-7-activation-http-surface.md` ("Option 1 — Bridge") but is **not** a numbered ADR. Two constraints: `recordStart` only fires from `start_ready`, and `StartAttestation` has no `applicationId` column. **Hard-blocked on A3.** |
| P1 mount ProofPacketInspector | **OPEN** (S) | Clean insertion point — the Apply chapter's `JourneyCard` already renders an `Illustrative` label that `journey-rail.test.tsx` asserts. Homepage-visual PR: **blocked until `#801` lands**. |
| P2 NUM-1.5 live numbers | **OPEN** (S/M) | Every "live-system-fact" number is a literal: `MetricStrip.tsx:21-25`, `TimeToStartComparison.tsx:~118`. Real source is `apps/web/lib/trust/register.ts` (`getTrustRegisterSnapshot`), which `/status` already uses. Lane truth is currently duplicated in three places. |
| P3 NUM-1.6 analytics | **OPEN** (M) | Two analytics paths already exist — **no vendor needed**: PostHog funnel (`lib/analytics/funnel.ts`, with an existing `hashNpi()`) and first-party UX telemetry (`hooks/useUxTelemetry.ts` → `PilotMetricEvent`). The homepage fires exactly **one** event today; the hero NPI form is uninstrumented and `HOMEPAGE_VIEWED` is declared but never fired. |

### W1514 / W1515 / W1516

| Task | Verdict | Evidence / correction |
| --- | --- | --- |
| D1 NPPES licensure | **SHIPPED** | `#636` merged `52af2a85b`. All three host-validation points intact; `Self-reported to NPPES · not board-verified` renders. **Close the task.** |
| D2 lane → full coverage | **OPEN** (L) — **wrong target** | The `Partial` row is **OIG Exclusions** (`lib/trust/register.ts:80`), not CMS DCS. **CMS DCS and PECOS are not on `/status` at all.** Worse: `/status` (page) says `partial` while `/api/status` (`route.ts:116`) says `active/operational`, and `__tests__/status-source-lanes.test.ts:23` pins `active` — **one of them is lying**. Real DCS defect is a silent-failure fallback (`phase2Sources.ts:290` returns `_apiUnavailable` → zero claims, indistinguishable from "no record") plus an in-process-only monthly scheduler with no CI cron. |
| D3 ingest fallback | **SHIPPED (different PR)** | The fix is on main at `ingestOrchestrator.ts:176-200` via `#423` (`9f272c80c`) — **not** the `#420` the plan names — and main goes further with `effectiveResultStatus`. Both required tests exist. **Merging `#420` would risk reverting better logic.** Close `#420` citing `#423`. |
| D4 status memory | **OPEN** (L) | Probes exist but results are not persisted: deploy-probe output is log-only; source-probe writes to an in-memory `Map` that dies on cold start (`snapshotStore.ts:1-25`, self-documented). Also `routes/publicMetrics.ts:24` ships a hardcoded **`uptime: '99.99%'`** — a fabricated figure that directly contradicts `/status`'s stated doctrine. |
| C1 delete dead components | **PARTIAL** | 4 of 6 are clean (docs-only refs). `PublicTruthSections` has 3 live refs (see §0.3). `docs/design/shd-0-baseline.md:43` explicitly **retains** `WhatWeCheckSection` + `PublicTruthSections` — get a design ruling before deleting those two. |
| C2 synthetic roster | **OPEN** (M) | `CareerGraph.tsx` genuinely has zero importers — safe to delete. But `data.ts` is load-bearing (§0.3); moving it requires updating the literal `path.resolve` in the quarantine guard. Do **not** confuse with `packages/career-graph` (`@vitalcv/career-graph`), a different and live package. |
| C3 purge debug artifacts | **OPEN** (XS) | Confirmed: exactly **101** files under `.playwright-cli/`, no `.gitignore` entry. `apps/api/temp_build_skip.sh` is two lines (`exit 0`) and **nothing in CI calls it**. Extra debris found: `output/playwright/*.png`, `output/manual-audit-bundles/*` (confirm the latter isn't a deliberate pilot record). |
| C4 phantom packages | **VOID — do not execute** | See §0.1. Real (smaller) issues instead: 23 of 25 packages declare `"main": "dist/index.js"` with no committed dist, so resolution depends on turbo prebuild ordering; and four dirs under `packages/` have source but **no `package.json`**, so they aren't workspace members at all. |
| C5a vitest 4 | **OPEN** (M–L) | Three generations live simultaneously: `apps/web` is **already on `^4.0.18`**, four packages on `^3.2.1`, eight on `^1.6.0`. Highest risk is invisible in a dependency diff: a hand-written root `vitest/` directory (`index.d.ts`, `config.d.ts`, **no `package.json`**) that shadows the real package, plus a duplicate ambient `types/vitest.d.ts`. `apps/web/vitest.config.ts` uses CommonJS `require` in an ESM config. **No coverage thresholds exist** to preserve. |
| C5b settle no-NPI lane | **SHIPPED** | `#543` is already `CLOSED` (2026-07-20), superseded by `#807`. No brief needed. |
| E1 employer workspace | **PARTIAL** (L) | Claim flow + honest "not legal proof of authority" label are live. Missing: any **audited claim record** (zero hits for `ORG_CLAIM`/`ORGANIZATION_CLAIMED`), and the requirements shape is a seed-catalog tier (`L1/L2/L3`), **not** the four readiness dimensions — which exist only as marketing copy in `TimeToStartComparison.tsx`, with no server model. Nothing measures a checklist against packets. |
| E2 verification-scope ADR | **PARTIAL** | `#804` (ADR 0006) covers roughly a third and answers a narrower question — it scopes itself to the public NPI-keyed endpoint, does **not** enumerate the three scopes, has no HIPAA-adjacency analysis, and **no revocation treatment at all**. The base-0 premise is also stale: `/verify` no longer hard-pins `unknown` (`verify/[npi]/page.tsx:318-330`). `#748` is **57 commits behind and not rebased**; its green checks are from 2026-07-18. |
| E3 post-decision brief | **BLOCKED** | Correctly blocked on FD-1/FD-2. Nothing in the tree pre-empts it. |

---

## 2. Corrected executable slate

**Do not dispatch:** H1 (as briefed), H2, A1, A2, D1, D3, C4, C5b — shipped, void, or dangerous.
**Do not duplicate:** E2's ADR half (`#804`).

Ordered by value-per-risk, honouring the plan's own sequencing:

| # | Work | Why first | Effort |
| --- | --- | --- | --- |
| 1 | **S4 Sentry** | ✅ done in this wave | — |
| 2 | **C3 purge artifacts** | XS, zero-risk, no collisions | XS |
| 3 | **`publicMetrics.ts:24` fabricated uptime** | A live doctrine violation shipping a fake 99.99% | XS |
| 4 | **S3 rate limiting** | `/api/passport/:npi` unlimited is a real abuse surface | M |
| 5 | **P2 + P3 metrics** | Not homepage-visual zone, so unblocked by `#801` | M |
| 6 | **H3 + R1 + R2 residuals** | One small homepage cleanup PR after `#801` | S |
| 7 | **S5 ratchet gate** | After S2 flips, else red on day one | S |
| 8 | **D2 / D4 / E1 / C5a** | Genuinely large; schedule deliberately | L |

**Founder / ops actions — not code, and blocking:**
- Set `CLERK_ISSUER` + `CLERK_JWT_VERIFICATION=enforce` on Railway api → closes **S1/G1**.
- Flip `VERIFIER_RBAC_ENFORCED` **and** `VERIFIER_RBAC_MODE` → closes **S2/G2**.
- Set `NEXT_PUBLIC_SENTRY_DSN` (web) + `SENTRY_DSN` (api) → turns **S4** live.
- Decide **FD-1 / FD-2 / FD-3**; resolve the `/status` vs `/api/status` OIG contradiction.
- Design ruling: are `WhatWeCheckSection` / `PublicTruthSections` rail candidates (C1)?

---

## 3. What this wave shipped

**S4 / MS-1 — Sentry re-enabled with PII scrubbing.** The API was initialising Sentry
with **no `beforeSend`, no `sendDefaultPii: false`, and no release tag**, while this
backend routes NPIs in the path — so `request.url` and the Express transaction name
would have carried a looked-up NPI to Sentry on every 5xx.

- Canonical scrubber moved to `packages/shared/observability` (`@vitalcv/shared/observability`)
  so web and API share **one reviewed redaction list**; `apps/web/lib/observability/sentryScrub.ts`
  is now a thin re-export, keeping all existing import paths working.
- Added `request.url`, `transaction`, and `tags` scrubbing — the API-shaped PII carriers.
- Backend init now has `beforeSend` + `beforeSendTransaction` + `sendDefaultPii: false`
  + release tag; sampling aligned to 0.1 in production across all four processes.
- Session Replay pinned to `0` with the reason recorded: replay records the DOM and
  **does not pass through `beforeSend`**, so the scrubber would not protect it.
- `docs/ops/observability.md` is the review artifact the plan asked for.
- Gates: `sentry-scrub` 7/7 green · backend `tsc --noEmit` 0 errors · web tsc unchanged
  at the pre-existing 118 · `check:claims` PASS · eslint clean.

---

## 4. Incidental findings worth a ticket

- `pnpm --filter @vitalcv/shared build` **fails on pristine `main`** (TS6059 `rootDir`
  escape via `crs/index.ts`) and emits stray untracked `.js`/`.d.ts` into `packages/crs/`.
  Pre-existing; verified by stashing to a clean tree.
- `apps/api/backend` imports `@sentry/node` but declares it in `apps/api/package.json`,
  resolving only via hoisting.
- `app/dev/story-rail/StoryRailHarness.tsx:21-28` still uses a stale 6-chapter set
  including `recognition`, which is not in `registry.ts`.
