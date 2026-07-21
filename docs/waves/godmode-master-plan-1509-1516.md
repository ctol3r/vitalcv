# God Mode Master Plan — Waves 1509–1516

**Source:** `godmode waves 1509-1516.pdf` (Dropbox, 2026-07-20). The PDF is image-only
(no text layer, 250px-wide render); this file is a transcription so the plan is
searchable, diffable, and citable. Items marked **[?]** were ambiguous in the scan and
must be confirmed against the source before they are treated as authoritative.

**Scope:** 8 waves, 39 atomic tasks, one owner each. Primary executor: Claude Code.

**Grounded in:** `docs/audits/base-0-current-state-2026-07-20.md` (Wave 0 contract).
This plan *continues* that contract — it recounts, reconciles, and hardens what exists.
It does **not** re-decide manifest dispositions or founder decisions.

**Sources of truth:** base-0 contract · `docs/design/homepage-composition-manifest.md` ·
`docs/ops/release-required-checks.md`

---

## Audit synthesis — what the review found

**Security (launch blockers)**
- G1 — backend trusts `x-clerk-user-id` / `x-user-role` / `x-org-id` headers unverified. Highest-priority open gap.
- G2 — verifier RBAC in shadow mode (`VERIFIER_RBAC_ENFORCED=false`).
- G3 — rate limiting in-memory, no trust-proxy keying.
- Sentry disabled in prod; transport-auth PR held.

**Product (small, not massive)**
- Story rail is DEV-ONLY — prod 404s the harness. Highest-value mount.
- `StickyProductStory` runs a forbidden second scroll model.
- ACT-1.3 requirement ledger + 1.4 start events are tested services with **zero HTTP routes**. Two unconnected start paths in the tree.
- `ProofPacketInspector` unmounted in product (design reference only).
- Scene registry declares 6 chapters; homepage renders no `#start` anchor.

**Live site & data lanes**
- CMS lane **Partial**; state licensure source-gated; employment history + board cert unconnected; no incident feed; no measured uptime.
- `/verify` revocation pinned "unknown"; trust key rotation "N/A".
- Homepage copy is doctrine-honest — **preserve exactly**. NUM-1.5/1.6 still open.

**Repo evidence**
- 6 dead `components/home` components; synthetic 12–14 clinician roster dormant in tree.
- ~101 `.playwright-cli/` artifacts committed; `temp_build_skip.sh`.
- ~6 phantom dist-only packages (claims, idempotency, rate-limiter, tracing, …).
- vitest 1.6→4.1 is a real migration; student/no-NPI lane PR rotting far behind.

---

## Founder decisions — gates, not tasks

| ID | Decision | Blocks |
| --- | --- | --- |
| **FD-1** | Opportunity model — employer-created roles vs ATS integration vs concierge import | EMP-0.3+ (Wave 1516 E3) |
| **FD-2** | Public verification scope — NPI-only snapshot vs consent-link richer view vs split public/employer detail | `#748` merge (Wave 1516 E2 merge step) |
| **FD-3** | Pilot metric threshold — minimum cohort/window before any "faster start" claim renders | outcome-metric slice (Wave 1513 P2 ships coverage-only until set) |

*No task below waits on a decision except where marked. Everything else is executable today.*

---

## Ground rules (apply to every task)

- Claim your bundle in `docs/audits/base-0-current-state-2026-07-20.md` §9 **before** writing code; re-read `git log origin/main` immediately before merging.
- Homepage work obeys the composition manifest's dispositions and the one-open-homepage-visual-PR rule (`docs/ops/release-required-checks.md`). Never re-decide a manifest disposition.
- **Doctrine honesty:** no invented numbers, no pilot outcomes until FD-3 is set, gated lanes always read as gated. `check-claims` is not optional.
- Gates before commit: `pnpm lint` · `pnpm tsc --noEmit` · `pnpm check-claims` · `pnpm check-tokens` · `pnpm --filter web build` · focused tests for touched surfaces.
- Read every file before editing; verify against `origin/main`, not memory or a working branch.
- `prisma migrate` stays founder-gated. Schema changes ship as migration files + a founder note, never auto-applied.
- One commit per task; archive before/after evidence in `docs/design/waves/<wave>/`.

---

## Cross-wave dependency graph

```
1509 SECURITY   ─────────►  (independent, ship first)
1510 RAIL mount ── 1511 ROLODEX/scene   (homepage scene, strictly serial)
1512 ACT routes ── 1513 PROOF + NUM     (product spine, serial pair)
1514 DATA LANES ─────────►  (independent of homepage sweep; G1 before G2)
1515 HYGIENE    ─────────►  (anytime; C1/C2 must not race 1510/1511 in components/home)
1516 EMP/GRAPH  ─────────►  E1 now + E2 ADR now, merge after FD-2 · E3 after FD-1
```

Run 1509 and 1510 in parallel lanes; 1514 and 1515 are CI-safe. Nothing in 1516 blocks the rest.

---

## W1509 — Security core: close G1/G2/G3, restore observability

*The header-trust gap makes every backend role check spoofable. This wave ends header-trust
authn, flips RBAC out of shadow, makes rate limiting real, and turns error telemetry back on.*

### S1 — G1: verified transport auth, kill header trust
`security(g1): backend — verify Clerk JWT, stop trusting identity headers` · effort M

Read the G1/ASVS scorecard and the held transport-auth PR first — this supersedes it.
In `apps/api/backend`: add auth middleware that verifies the Clerk session JWT (JWKS from
Clerk, aud/exp checks) and derives userId/role/orgId from **verified claims only**. Remove
every read of `x-clerk-user-id`, `x-user-role`, `x-org-id` from request handling (grep the
full backend; expect middleware + scattered route reads).

Ship behind an env flag with `log` mode (compare header vs verified claim, log divergence)
and `enforce` mode (4xx on missing/invalid token for protected routes; public trust/verify
endpoints stay tokenless per the trust doctrine).

Tests: valid token → claims derived; forged headers ignored; tampered token → 401; public
endpoints unaffected. Update the scorecard row. Close the superseded PR pointing here.

- ✅ Zero remaining reads of the three identity headers outside the log-mode comparator.
- ✅ Enforce mode green in staging log review; scorecard G1 updated; superseded PR closed.

### S2 — G2: flip verifier RBAC out of shadow mode
`security(g2): verifier RBAC — enforce after shadow log review` · effort S

Pull the shadow-mode denial logs for `VERIFIER_RBAC_ENFORCED=false` and write a one-page
review to `docs/security/G2-shadow-review.md`: every would-have-denied request, whether it
was legitimate, and the fix if so. Resolve legitimate ones (role grants or route-class
corrections in `lib/auth/roles.ts`) — also fix the misleading `/employers` VERIFIER gate
comment at `lib/auth/roles.ts:37`. Then set `VERIFIER_RBAC_ENFORCED=true` in deploy config,
keeping the env override as rollback. Regression test asserting enforcement is on by default
in production config.

- ✅ Shadow review committed; zero unexplained would-deny entries.
- ✅ Enforced in prod config with tested rollback; `roles.ts` comment corrected.

### S3 — G3: durable, correctly-keyed rate limiting
`security(g3): rate limiting — trust proxy keying + durable store` · effort M

Replace the in-memory limiter: enable Express trust proxy for Railway's proxy depth so keys
derive from the real client IP; key authenticated routes by verified userId (from G1) instead
of IP; back the store with Redis if available in the Railway env — otherwise a per-instance
store with a documented limitation note. Tighten limits on the expensive public lanes
(`/api/passport/npi/:npi`, receipts, verify) with honest 429 bodies. Tests: key derivation
behind proxy, per-user vs per-IP buckets, 429 shape.

- ✅ Keys survive proxy hops; authenticated buckets are per-user.
- ✅ Store choice + limits documented in `docs/security/`; scorecard G3 updated.

### S4 — MS-1: re-enable Sentry in production
`ops(ms-1): sentry — re-enable with PII scrubbing` · effort M

Sentry configs exist (`apps/web/sentry.*.config.*`) but prod is disabled. Re-enable for web +
api with `beforeSend` PII scrub (strip NPI values, names, emails, auth headers from events and
breadcrumbs), sampled tracing (0.1), release tagging from the build SHA, and env-gated DSN so
preview builds stay silent. Document what is and is not captured in `docs/ops/observability.md`
— this is a healthcare-adjacent product; **the scrub list is the review artifact**.

- ✅ Errors flow from prod web + api with release tags; scrub tests prove no NPI/name/email in payloads.

### S5 — Security regression gate
`ci(security): gate — header-trust and shadow-mode regressions fail CI` · effort S

Extend `.github/workflows/security-audit.yml` to grep the backend for reads of the three
retired identity headers outside the comparator, assert `VERIFIER_RBAC_ENFORCED` defaults true
in prod config, and fail on any new in-memory rate-limit store import. Wire into required
checks per `docs/ops/release-required-checks.md`.

- ✅ Catches on a deliberate regression branch, green on main, listed as a required check.

---

## W1510 — Mount the story rail (highest-value build)

*The rail engine is real, tested, and unreachable in prod. This is a **mount + migrate**, not a
build — base-0 §3.1 forbids adding a second rail. One homepage visual PR at a time.*

### H1 — Lane claim + pre-mount baseline
`design(HOME-2.0): baseline — pre-mount visual + a11y snapshot` · effort S

Claim the bundle in the base-0 lane table. Confirm no other homepage visual PR is open. Capture
the pre-mount baseline: run the existing scene-degradation / homepage-motion / scroll-headings /
visual-density specs and the axe WCAG job against main, archiving to
`docs/design/waves/1510/BASELINE.md` with screenshots at the three scene tiers. **Do not rebuild
baselines that exist** — extend only where the rail introduces states current specs don't cover
(horizontal scroll position, rail keyboard nav).

- ✅ Lane claimed in the same PR; baseline artifacts committed; zero product-code changes.

### H2 — Mount `HorizontalStoryRail`, retire the manifest casualties
`design(HOME-2.1): homepage — mount story rail, retire HeroLoopPills + ScrollFocusManifesto` · effort M

Migrate `HorizontalStoryRail` out of `app/dev/story-rail` into the homepage per the composition
manifest. The manifest already rules the dispositions: `HeroLoopPills` and `ScrollFocusManifesto`
**retire** when the rail lands — delete their mounts (and the components if nothing else imports
them). The composition gate makes mounting rail navigation without retiring the dot rail a CI
failure, so this is **one commit, not two**.

Keep the `/dev/story-rail` harness working against the migrated component (imports move, guard
stays). Preserve every piece of doctrine-honest copy verbatim — the rail changes choreography,
not claims. Chapter content comes from the existing story sections; wire the rail to
`ChapterProgressProvider` (the one scroll driver) — do not let it grow its own listener.

- ✅ Rail LIVE on the homepage; `HeroLoopPills` + `ScrollFocusManifesto` gone; composition gate green.
- ✅ `check-claims` byte-clean; harness still renders; no new scroll listeners outside ChapterProgress.

### H3 — Fix the phantom `#start` chapter
`design(HOME-2.2): scene — reconcile start chapter with rendered anchors` · effort XS

`registry.ts` declares six chapters (`wallet, evidence, matcha, apply, employers, start`) and
`CHAPTER_DOM_IDS` lists six ids, but no `#start` anchor renders — the driver silently skips it.
Decide with the rail now mounted: either the rail's closing section **is** the start chapter (add
the anchor there) or the chapter is dead (remove it from `registry.ts` + `CHAPTER_DOM_IDS`). Add a
test asserting every registered chapter id resolves to a rendered anchor so the discrepancy class
can't recur.

- ✅ Registry and DOM agree; new invariant test green and fails if they diverge again.

### H4 — Post-mount regression + baseline re-anchor
`design(HOME-2.3): regression — post-mount visual/a11y re-anchor` · effort M

Re-run every spec against the mounted rail at all three scene tiers plus reduced motion and mobile
(390px). The rail **must degrade**: static tier renders chapters as a vertical document flow with
no horizontal dependency; keyboard tab reaches every chapter; axe stays clean. Archive to
`docs/design/waves/1510/POST.md` and re-anchor the visual baselines the next homepage wave diffs against.

- ✅ All tiers + reduced motion + mobile pass; baselines re-anchored; POST.md committed.

---

## W1511 — Rolodex + scene residuals: one scroll model

*Deletes the last competing scroll driver and finishes the scene system's open residuals.*

### R1 — Delete `StickyProductStory`'s private driver; Rolodex rides the rail
`design(ROLO-3.0): story — retire private scroll driver, mount rolodex on rail` · effort M

`StickyProductStory` runs its own `useScroll`/`useTransform`/`useSpring` pipeline over a 300vh
runway (`styles/homepage-motion.css` ~§174–177) — the exact second scroll model base-0 forbids.
Replace it: the Rolodex 3D component renders inside the mounted rail's product-story chapter,
driven by `ChapterProgress` values only. Delete the private pipeline, the runway CSS, and the
sticky stage. The `#readiness` / `#matcha` / `#apply` anchors the driver discovers **must survive**
— they move onto the rail chapters. Keep the rolodex leaves/focus test green.

- ✅ Zero `useScroll` outside `components/home/scene`; anchors intact; leaf test green.

### R2 — Per-chapter scene reaction
`design(SHD-3.3): scene — ambient field reacts per chapter` · effort S/M

Wire `AmbientField` (and `GrainOverlay` intensity if the design calls for it) to the chapter blend
model in `scene/progress.ts` so the ambient scene shifts as chapters change — subtle hue/density
shifts per the six-chapter registry, honoring the static/canvas/webgpu tier ladder and
`prefers-reduced-motion` (static tier: no reaction). No new scroll listeners; consume
`ChapterProgress` context only.

- ✅ Visible chapter reaction at canvas/webgpu tiers; reduced motion unchanged; degradation specs green.

### R3 — VIS-4.5: contrast + visual regression closure
`design(VIS-4.5): regression — contrast sweep over scene states` · effort M

Sweep text contrast over every scene state the ambient field can now produce: sample the rendered
chapter backgrounds at their extremes and assert WCAG AA for all foreground text tokens (extend the
axe job with per-chapter snapshots rather than hand-checking). Fold results into the visual baseline
set. **This closes Wave 4 of the master plan.**

- ✅ AA holds at every chapter extreme; a failing combination blocks CI, not review.

---

## W1512 — ACT route layer: make activation callable

*ACT-1.3/1.4 are tested service layers with no way to call them, and two unconnected start concepts
live in the tree. This wave builds the HTTP surface and reconciles the start paths — the product's
core promise (accepted → start-ready → started) becomes real and end-to-end.*

### A1 — Routes for the requirement ledger (ACT-1.3)
`feat(ACT-1.3): api — activation requirement routes` · effort M

`services/activation/activationRequirementService.ts` + `requirementLifecycle.ts` (model
`ActivationRequirement`) have zero importers outside a sibling file. Add the route layer in
`apps/api/backend/src/routes`: GET requirements for an application (clinician + employer views),
POST create/update requirement state **through `requirementLifecycle` transitions only** (reject
illegal transitions with explicit errors), all authorized via the G1 verified-claim middleware with
employer-org scoping. Every mutation writes its auditEvent through the existing audit path. Follow
existing route conventions in the directory — read three neighbouring route files first. Contract
tests per route.

- ✅ Ledger fully drivable over HTTP; illegal transitions rejected; auditEvents verified in tests.

### A2 — Routes for start events (ACT-1.4)
`feat(ACT-1.4): api — start-ready / started event routes` · effort M

Expose `services/activation/startEventService.ts` + `startState.ts`: GET start state for an
application, POST start-ready (derived from the A1 ledger — reject if requirements outstanding),
POST record start, POST cancel. Emit the `START_READY` / `START_RECORDED` / `START_CANCELLED` audit
events the service already defines. Same auth + concurrency rules as A1. **Do not touch the legacy
confirm-start route yet** — that is A4's reconciliation.

- ✅ Full start lifecycle drivable over HTTP with `START_*` events discoverable; confirm-start untouched.

### A3 — Wire acceptance to the packet (ACT-1.2 unreachable branch)
`feat(ACT-1.2): review — acceptance carries applicationId + packetHash` · effort S

`POST /api/employer-review/:entityId/accept` supports `applicationId` + `packetHash` via
`packetAcceptanceGuard`, but `ReviewClient` posts only `{ acceptanceScope: 'pilot' }` — the linked
branch is unreachable from the UI. Thread the packet identity through: when the review was opened
from a shared packet, `ReviewClient` sends `applicationId` + `packetHash` so
`acceptanceSourceSnapshot` binds the decision to the exact evidence reviewed. Legacy scope-only path
stays for reviews without a packet. Test both branches; verify the acceptance auditEvent now carries
the packet binding.

- ✅ Packet-bound acceptance reachable from the real UI; scope-only fallback intact; events verified.

### A4 — Reconcile the two start paths
`feat(ACT-1.5): start — one start concept, confirm-start folded in` · effort M/L

Two unconnected start concepts exist: the live `POST …/confirm-start` attestation (gated on
`ACCEPTED`, emits no `START_*` event) and the A2 `startEventService` path. Write a short ADR in
`docs/adr/` choosing the canonical model. *Recommended:* `startEventService` is canonical;
confirm-start becomes a thin adapter that records the attestation **and** drives the canonical state
machine, emitting `START_*` events. Migrate: existing confirm-start attestations get a documented
backfill plan (founder-gated migration file, not auto-applied). `ReviewClient`'s start action goes
through the canonical path. **Do not add a third concept.**

- ✅ ADR merged; one canonical start machine; confirm-start emits `START_*`; UI unchanged for users.

---

## W1513 — Proof + numbers: mount the inspector, make numbers live

### P1 — PROOF-5.1: `ProofPacketInspector` into the Apply chapter
`design(PROOF-5.1): apply — proof packet inspector mounted` · effort M

Reuse the `ProofPacketInspector` **component** (not the `/design/proof-packet` reference route —
that stays as living documentation per the recorded decision) inside the homepage Apply chapter:
illustrative fixture data only, labeled illustrative like the neighbouring chapter cards, no
per-clinician fetches. The design-reference guard invariants apply to the reference route only, but
the homepage mount must equally pass `check-claims` and the composition gate. Homepage zone: check
for an open homepage PR first and claim the lane.

- ✅ Inspector renders in Apply chapter with illustrative data; reference route untouched; gates green.

### P2 — NUM-1.5: dynamic numbers on live product surfaces
`feat(NUM-1.5): metrics — live system numbers replace static literals` · effort M

The `EvidenceMetric` primitive has four source classes. Wire the **"live system fact"** class to real
reads: source-lane count and readiness-dimension coverage come from the same backend facts `/status`
derives from, with build-time fetch + revalidate so the homepage never blocks on the API. **Hold the
FD-3 gate:** no time-to-start or outcome metric renders until the founder sets the pilot threshold —
coverage and lane facts only. Every dynamic number keeps its named source line. `check-claims` must
pass with the numbers mocked at extremes (0 lanes, all lanes).

- ✅ Lane/coverage numbers read from the system, not literals; FD-3-gated data absent; claims gate green at extremes.

### P3 — NUM-1.6: metric analytics
`feat(NUM-1.6): analytics — metric render + interaction events` · effort S

Instrument the metric surface: which numbers render (value + source class), NPI form
starts/completions, and chapter-reach depth from `ChapterProgress` — **through the existing analytics
path (find it; do not add a new vendor)**. No PII: NPI values never leave the client in analytics
events. Document the event schema in `docs/ops/metrics-analytics.md` so pilot reporting
(`scripts/pilot-kpi-report.sh`) can consume it.

- ✅ Events observable in staging; schema documented; zero-PII payloads (test asserts).

---

## W1514 — Data lanes + status honesty: widen what's source-backed

*The live status page admits a lane is Partial and licensure is gated. This wave widens real coverage
and gives status a memory (incidents, measured uptime).*

### D1 — Rebase + merge the NPPES licensure + Doximity PR
`feat(lanes): nppes licensure + doximity — rebased` · effort M

Self-contained and honest by construction (self-reported label, never a status) but ~148 commits
behind, and the profile surfaces it touches have been reskinned. Rebase onto main, resolve conflicts
in favour of current surface structure, and re-verify the three host-validation sync points survive
the rebase. The self-reported label must render exactly as designed (`check-claims`). If the rebase
exceeds the PR's own diff in size, stop and re-cut instead.

- ✅ Merged or deliberately re-cut; sync points verified; labels honest; gates green.

> **Status 2026-07-20: SHIPPED.** Merged as `52af2a85b` (`#636`). This task is closed — do not re-run.

### D2 — CMS lane: from Partial to full coverage
`feat(lanes): cms — full dataset coverage + freshness surfacing` · effort M

Diagnose why `/status` reports the lane as "Available for some records, being expanded": read the
adapter in `packages/source-adapters` and the ingest path. Likely causes: partial CMS snapshot,
name-match-only fallback, or missing monthly refresh. Fix the root cause: full CMS dataset ingest
with a scheduled monthly refresh (CMS publishes monthly), NPI-first matching with the name-match path
clearly labeled lower-tier, and per-record `checked_at` surfaced so `/verify` shows freshness. Flip
`/status` copy to Available **only when the lane actually is** — the page's honesty is the product.

- ✅ Refresh scheduled + observable; match tiers labeled; status reflects measured reality.

### D3 — Re-validate the NPPES ingest fallback fix
`fix(ingest): nppes identity preservation — re-validated` · effort S

The PR claims a real fallback bug in `ingestOrchestrator.ts` where NPPES identity success is lost.
Read the diff against today's ingest/passport chain: **reproduce the bug with a test first**. If it
reproduces → merge the fix rebased, keeping the reproduction test. If later chains fixed it → close
citing the test that proves it. Either way the outcome is a test, not an opinion.

- ✅ Reproduction test committed; PR merged or closed with the test as evidence.

### D4 — Status memory: incident feed + measured uptime
`feat(status): incidents + measured availability` · effort M

`/status` checks only at page load and says "No public incident feed is published yet" and that it
does not publish uptime figures it has not measured. Give it a memory: persist the existing
deploy-health-probe + source-health-probe workflow results (they already run) into a small
availability ledger the status page reads → measured uptime per lane over a rolling 30 days, shown
**only once ≥30 days of data exist** (honesty rule). Add an incidents collection (markdown files in
`docs/ops/incidents/`, rendered on `/status`) with an `INCIDENTS.md` template. **No fabricated 99.9%**
— the number appears when it is real.

- ✅ Probe results persisted; uptime renders only past the 30-day threshold; incident pipeline documented.

---

## W1515 — Repo hygiene: delete the loaded guns

*Dead components, synthetic people, committed debug artifacts, phantom packages. Cheap to fix,
expensive to keep. C1/C2 must not race the homepage waves in `components/home`.*

### C1 — Delete the six dead home components
`chore(home): delete unmounted section components` · effort XS · **after H2 merges**

Delete the IMPLEMENTED-NOT-MOUNTED set: `ForEmployersSection`, `OutcomeTriad`, `SocialProofSection`,
`WhatWeCheckSection`, `WorkflowStoryTabs`, `PublicTruthSections` (+ its test-only reference) — verify
zero importers first with a repo-wide grep, and check none were resurrected by H2. Delete their tests
and any orphaned styles. If one turns out to be wanted for the rail, **that is a manifest change —
stop and flag**, don't keep it "just in case".

- ✅ Zero references remain; build + tests green; `components/home` contains only mounted code.

### C2 — GRAPH-8 prep: retire the synthetic roster
`chore(graph): synthetic roster → test fixtures` · effort S

`components/career-graph/data.ts` holds 12–14 synthetic "Dr. …" fixtures and `CareerGraph.tsx` has
zero non-test importers — a loaded gun for anyone grepping for a graph to reuse. Move the fixtures
under a `__tests__/fixtures/` path with a `SYNTHETIC-DATA` header comment, delete `CareerGraph.tsx` if
its only consumers are tests of itself (delete those too), and add a lint/CI guard failing any import
of the fixture path from non-test code.

- ✅ No synthetic people importable from product code; guard proves it; tests green.

### C3 — Purge committed debug artifacts
`chore(repo): purge debug artifacts + gitignore them` · effort S

Delete the ~101 committed `.playwright-cli/` page snapshots and `apps/api/temp_build_skip.sh` (read it
first — if anything in CI calls it, fix the caller). Add `.playwright-cli/` to `.gitignore`. Sweep for
similar committed debris (screenshot dumps, `.tar` files, editor droppings) with a size/pattern pass
and remove what's clearly non-source. **Do not touch `docs/`, `design-handoff/`, or `pilot-legal/`** —
those are deliberate records.

- ✅ Artifacts gone and ignored; CI green; deliberate records untouched.

### C4 — Phantom dist-only packages: build them or bury them
`chore(packages): resolve phantom dist-only packages` · effort M

~6 packages ship from `dist/` with no source in the repo (claims, idempotency, rate-limiter, tracing,
…). For each: find importers. **Imported** → recover/rewrite source into the package (read the dist to
re-implement) so the monorepo builds from source. **Unimported** → delete the package and its
workspace entry. Special case: if S3 replaced the rate-limiter package, fold that here. Update
`docs/architecture/package-status.md` to match reality.

- ✅ Every workspace package builds from source or is gone; package-status.md truthful; turbo build green.

### C5 — vitest 4 migration + settle the rotting PRs
`chore(test): vitest 1.x→4 migration` · effort M

Treat the vitest 1.6→4.1 dependabot PR as a real migration: read the v2/v3/v4 breaking-change lists,
migrate configs (vitest shim, `apps/*/vitest.config.*`, `types/vitest.d.ts`) and any deprecated APIs,
keep coverage thresholds. **Land as its own PR, not a bump-merge.**

Then settle the student/no-NPI lane PR (231 behind): per base-0 the rebase costs more than a re-cut.
Extract the requirements into `docs/design/no-npi-lane-brief.md` (what the lane needs against today's
identity-tier ladder + signup gate) and close the PR referencing the brief. Decide deliberately;
nothing keeps rotting.

- ✅ vitest 4 green across workspace; bump PR closed by the migration PR; lane PR closed with the brief committed.

---

## W1516 — Employer activation + graph: execute to the decision line

*Everything executable before FD-1/FD-2 lands, plus the ADR that tees up the graph merge the moment
FD-2 is decided.*

### E1 — EMP-0.1/0.2: employer workspace foundations
`feat(EMP-0.1): employers — claimed workspace + requirements checklist shell` · effort M

Build the decision-independent employer slice: after the Type-2 NPI claim on `/employers`, a
claimed-workspace state (org identity from NPPES, claim recorded with the honest "not legal proof of
authority" label) and the role-requirements checklist surface the live `/employers` workflow promises
at step 2 — requirements defined against the four readiness dimensions, stored per org, measured
against incoming packets via the A1 ledger. **STOP at the opportunity boundary:** no role postings, no
ATS, no clinician-facing opportunity objects — that shape is FD-1. Auth via G1 verified claims; org
scoping enforced.

- ✅ Claim → workspace → requirements checklist works end-to-end; zero opportunity-model assumptions; honest labels intact.

### E2 — GRAPH-8.1 ADR + `#748` rebase-and-hold
`docs(GRAPH-8.1): adr — public verification scope options for FD-2` · effort M

Write the ADR that makes FD-2 decidable: a `docs/adr/` entry laying out the three scopes (NPI-only
snapshot / consent-link richer view / split public-employer detail) with, for each: what
`/verify/[npi]` shows, what `#748`'s bidirectional-relationship endpoint may expose, consent +
HIPAA-adjacency implications, and the revocation display question (`/verify` currently pins revocation
"unknown"). Recommend one; the founder decides. Then rebase `#748` so it is merge-ready the day FD-2
lands — **rebase only, DO NOT merge on CI-green**; the endpoint is public-by-NPI and merging is the
decision's consequence.

- ✅ ADR covers all three scopes + revocation; `#748` conflict-free on main and explicitly held.

### E3 — Post-decision execution brief
`docs(plan): wave 1517 briefs — post-decision bundles` · **decision-gated on FD-1/FD-2**

Run only when FD-1 and/or FD-2 are recorded. For each decision, cut the next task bundle (Wave 1517)
in the style of this document: EMP-0.3+ against the chosen opportunity model, GRAPH-8.2+ against the
chosen verification scope (including whether public `/verify` gains a real revocation check).
Reconcile against base-0's successor (write one if none exists — the mount-status contract must stay
current) before dispatching.

- ✅ Bundles exist only for decided questions; mount-status contract updated first.

---

## Anti-collision reminder (applies to every wave)

Parallel lanes killed two PRs in one day on 2026-07-20. **Before ANY task:** claim the bundle in
base-0 §9. **Before ANY merge:** re-read `git log origin/main`. Homepage-zone tasks (H2–H4, R1–R2, P1)
additionally require that no other homepage visual PR is open. **A task that discovers its target
already shipped stops and reports — it does not re-implement.**

---

## Definition of done — plan level

- ASVS G1–G3 closed on the scorecard; Sentry live; security gate in required checks.
- Homepage runs ONE scroll model with the rail mounted, Rolodex inside it, manifest casualties retired, contrast regression in CI.
- accepted → requirements → start-ready → started is drivable end-to-end over HTTP with one canonical start machine and full audit events.
- `/status` reports lanes that are measured, an incident pipeline, and uptime only once real; the CMS lane fully covered; licensure lane merged.
- Zero IMPLEMENTED-NOT-MOUNTED components in `components/home`; zero synthetic people importable; zero phantom packages; PR queue at zero undecided.
- FD-1 / FD-2 / FD-3 each have the artifact that makes them decidable, and nothing in the tree pre-empts them.
