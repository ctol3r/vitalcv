# Dependabot backlog triage — 2026-08-07

**Enterprise-map B1 (supply chain) · ASVS G8 (SCA).**
Read-only triage of all 8 open Dependabot PRs. Nothing was merged or closed in
producing this report — dispositions below are recommendations; the merge and
close calls stay with the founder.

Evidence baseline: `origin/main` @ `f0b3749` (2026-08-07). "Still live" means
the vulnerable version is what the tree resolves **today** (root
`pnpm-lock.yaml`, `apps/api/bug-bounty/requirements.txt`, or the workflow pins
under `.github/workflows/`), not what it resolved when the PR opened.
Companion register: [dependency-remediation.md](dependency-remediation.md)
(gate policy: criticals block, highs report; `pnpm audit --prod` — dev-only
advisories never reach the merge signal).

## Summary

| PR | Bump | Age | Advisory-driven? | Still live on main? | Ships where | Conflicts? | Disposition |
|---|---|---|---|---|---|---|---|
| [#853](https://github.com/ctol3r/vitalcv/pull/853) | `@opentelemetry/core` 2.5.0 → 2.8.0 | 13d | Yes — baggage-header DoS (**not reachable in our code**, see below) | Yes by version | **Runtime** — deployed API (`apps/api`, `apps/api/backend`) | clean | **Merge (1st)** |
| [#891](https://github.com/ctol3r/vitalcv/pull/891) | `flask` 3.0.3 → 3.1.3 | 12d | Yes — 2 GHSAs | Yes (by version; not exploitable in context) | Runtime of `apps/api/bug-bounty` — **not deployed anywhere** | clean | **Merge** |
| [#1066](https://github.com/ctol3r/vitalcv/pull/1066) | `actions/cache` v4 → v6 | 4d | No — CI hygiene | Yes (`cargo-audit.yml` pins v4) | CI only | clean | **Merge** |
| [#574](https://github.com/ctol3r/vitalcv/pull/574) | `actions/github-script` v7 → v9 | 32d | No — CI hygiene | Yes (`openid-conformance.yml` pins v7) | CI only | clean | **Merge** |
| [#852](https://github.com/ctol3r/vitalcv/pull/852) | `vite` 6.4.1 → 6.4.3 | 13d | Yes — dev-server path traversal | **Yes** | **Dev-only** (3 workspaces, `devDependencies`) | clean | **Merge** |
| [#1076](https://github.com/ctol3r/vitalcv/pull/1076) | `postcss` 8.5.6 → 8.5.23 | 2d | Yes — 3 file-read GHSAs | **Yes** | **Dev-only** (web + marketing build toolchain) | clean | **Merge (last of the lockfile set)** |
| [#844](https://github.com/ctol3r/vitalcv/pull/844) | `next` 15.2.8 → 15.5.21 (`apps/marketing`) | 13d | Yes — 11 high advisories | **No — main is already past it (15.5.22)** | (was runtime) | **conflicts** | **Supersede & close** |
| [#582](https://github.com/ctol3r/vitalcv/pull/582) | `expo-notifications` 0.31.5 → 57.0.8 | 32d | **No advisory found** | n/a | Runtime of `apps/mobile` | clean, but SDK-broken | **Needs-work — do not merge as-is** |

## What main already remediated manually

The four manual remediations the backlog has to be read against, all on `main`:

| Commit | What it did | Bearing on this backlog |
|---|---|---|
| `865445f55` (#1029) | Next.js 15.2.8 → **15.5.22** across the workspace **including `apps/marketing/package.json`** — "clears 11 high advisories" (middleware/proxy auth bypass, SSRF in Server Actions on custom servers, DoS variants). `pnpm audit`: next 11 → 0. | **Fully supersedes #844** (which targets the older 15.5.21 and now conflicts on the only line it changes). |
| `d28fb85e2` (#1032) | axios 1.14.0 → 1.19.0 — 10 high advisories (prototype-pollution MITM, credential leak, ReDoS). | No overlap with the 8 open PRs; context only. |
| `af5713e5f` (#1031) | Expo SDK 52 → **53**, which moved the sole `tar` consumer to patched 7.5.22 (critical GHSA-23hp-3jrh-7fpw), ignore list back to empty. | Sets the precedent for how mobile deps get fixed: **whole-SDK alignment, not single-package forcing** — directly relevant to #582. The #808 forced-`tar` override that broke `@expo/cli` (reverted in #812) is the cautionary tale. |
| `f3a150e4e` | `pnpm.overrides` pin `cheerio>undici: ^7.28.0` — cleared the 4 backend-reaching undici highs, scoped so mobile's undici 6.24.1 is not dragged across a major. | No overlap; context only. |

None of these touched postcss, vite, @opentelemetry/core, flask, or the two
GitHub Actions pins — so those six PRs are **not** redundant.

## Per-PR triage

### #853 — `@opentelemetry/core` 2.5.0 → 2.8.0 · MERGE FIRST

- **Advisory:** [GHSA-8988-4f7v-96qf](https://github.com/advisories/GHSA-8988-4f7v-96qf)
  (CVE-2026-54285, moderate, CVSS 5.3) — unbounded memory allocation in
  `W3CBaggagePropagator.extract()`; an oversized `baggage` header drives
  memory growth. Fixed in 2.8.0 (8 KB cap per the W3C spec).
- **Still live:** yes by version — lockfile resolves `@opentelemetry/core@2.5.0`
  for the direct deps.
- **Honest reachability note — corrected during the merge pass.** The original
  draft of this report called #853 a live production-runtime vulnerability.
  That overstated it. Reading the code: `apps/api/backend/src/telemetry.ts:274`
  registers `W3CTraceContextPropagator` as the **sole** global propagator,
  `W3CBaggagePropagator` is never instantiated anywhere in the repo, and
  `parentContextFromTraceparent` extracts only the `traceparent` header.
  Confirmed empirically by exercising the app's own telemetry module on 2.8.0 —
  the registered global propagator reports fields `["traceparent","tracestate"]`
  and does not handle `baggage` at all. So the advisory is **not reachable
  through our code today**. The bump is still correct and worth landing (direct
  production dependency, raises the floor for both API importers so any future
  composite/baggage propagator inherits the fix), but it carries no incident
  urgency. Same spirit as `f3a150e4e`'s note that cheerio never opens a
  WebSocket.
- **2.7.1 `TraceState` behavioural change — no exposure.** The range's flagged
  breaking change (invalid `set`/`unset` now return the same instance) touches
  nothing here: `TraceState` has zero references across the repo.
- **Ships where:** **runtime.** `dependencies` (`^2.5.0`) of both
  `apps/api/package.json` and `apps/api/backend/package.json` — the API that
  Railway deploys. It is the only open npm PR touching production dependencies,
  which is why it leads the three lockfile PRs.
- **Breaking major:** no (2.5 → 2.8 minor).
- **Residual after merge:** the lockfile keeps **two `@opentelemetry/core@2.2.0`
  copies** (transitive, via the experimental `@opentelemetry/instrumentation@0.211.0`
  / `otlp-*@0.208.0` line) — same count before and after the PR. The direct
  copy the app's propagator uses is the one being fixed, but a
  vulnerable-by-version copy stays in the tree until the 0.20x experimental
  packages are bumped. Worth a follow-up, not a blocker.
- **Verification for the merge gate:** build + test the API workspaces, boot
  the backend, hit `/health`, and confirm traces still export.

### #891 — `flask` 3.0.3 → 3.1.3 (`/apps/api/bug-bounty`) · MERGE

- **Advisories:** [GHSA-4grg-w6v8-c28g](https://github.com/pallets/flask/security/advisories/GHSA-4grg-w6v8-c28g)
  (signing-key selection order with `SECRET_KEY_FALLBACKS`, fixed 3.1.1) and
  [GHSA-68rp-wp8r-4726](https://github.com/pallets/flask/security/advisories/GHSA-68rp-wp8r-4726)
  (session not marked accessed on key-only operations, fixed 3.1.3).
- **Still live:** yes by version (`requirements.txt` pins `Flask==3.0.3`), but
  **not exploitable in context**: the app is a 30-line unauthenticated form
  handler that never touches sessions, never sets a secret key, and — checked
  against `railway.toml`, `nixpacks.toml`, `docker-compose.yml`, and every
  workflow — **is deployed nowhere**.
- **Breaking major:** no. 3.0 → 3.1 is a feature release (drops Python 3.8,
  raises Werkzeug/ItsDangerous/Blinker floors); trivial for an app this size.
- **Disposition:** merge for hygiene — one line, no lockfile interaction,
  conflicts with nothing. **Bigger question for the founder:** this app writes
  raw form input to `bug_reports.txt` and calls `app.run(debug=True)` when run
  directly. If it isn't part of a real bug-bounty intake plan, deleting
  `apps/api/bug-bounty/` retires the Dependabot surface entirely and is worth
  more than the bump.

### #1066 — `actions/cache` v4 → v6 · MERGE

- **Advisory:** none against our usage. This is the weekly `github-actions`
  version-update stream (labeled `ci`), not a security update. Upstream v5.0.4
  did patch the action's own bundled deps (minimatch ReDoS, undici fixes),
  which run in the CI runner — mild supply-chain hygiene value.
- **Still live:** yes — `cargo-audit.yml:66` still pins `actions/cache@v4`
  (the only usage in the repo).
- **Breaking major:** two majors, but the breakage surface is the action's
  internals (ESM migration, Node 24 runtime, minimum runner v2.327.1+). Our
  usage is the plain `path` + `key` shape caching one binary, and the job runs
  on GitHub-hosted `ubuntu-latest`, which satisfies the runner floor.
- **Verification:** watch the next `cargo-audit` scheduled run — confirm the
  cache step restores/saves (a miss falls back to `cargo install`, so the
  failure mode is slow, not broken).

### #574 — `actions/github-script` v7 → v9 · MERGE

- **Advisory:** none — same `github-actions` version-update stream. v8 moved
  the script runtime Node 20 → Node 24; v9 continues that line.
- **Still live:** yes — `openid-conformance.yml:312` still pins v7 (the only
  usage).
- **Breaking major:** two majors, but our inline script reads env vars,
  string-formats a table, and calls the stable `github.rest` comment API — no
  Node-20-only behavior. `ubuntu-latest` hosted runners meet the runner-version
  floor.
- **Verification:** the step only fires on `pull_request` — confirm the
  conformance comment posts on the next PR that triggers the workflow.

### #852 — `vite` 6.4.1 → 6.4.3 · MERGE (dev-only)

- **Advisory:** [GHSA-4w7w-66w2-5vf9](https://github.com/advisories/GHSA-4w7w-66w2-5vf9)
  (CVE-2026-39365) — dev-server path traversal in optimized-deps `.map`
  handling bypassing `server.fs` restrictions, fixed 6.4.2; 6.4.3 backports
  two more dev-server hardening fixes (Windows alternate paths, UNC paths in
  launch-editor-middleware). Exploitable only when the dev server is exposed
  (`--host` / `server.host`).
- **Still live:** yes — lockfile resolves `vite@6.4.1`.
- **Ships where:** **dev-only.** `devDependencies` (`^6.3.5`) of
  `apps/issuer-api`, `apps/verifier-api`, `packages/haip-config`. Nothing
  production-facing; also invisible to the merge gate (`pnpm audit --prod`).
- **Breaking major:** no (patch).
- **Verification:** turbo-build and vitest the three affected workspaces.

### #1076 — `postcss` 8.5.6 → 8.5.23 · MERGE (dev-only, last of the lockfile set)

- **Advisories:** a three-part chain of arbitrary-file-read fixes around
  attacker-controlled `sourceMappingURL` comments:
  [GHSA-6g55-p6wh-862q](https://github.com/advisories/GHSA-6g55-p6wh-862q)
  (CVE-2026-45623, < 8.5.12),
  [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849)
  (< 8.5.18), and the incomplete-fix follow-up CVE-2026-69153 (< 8.5.23,
  `opts.from` unset case). Plus an XSS fix (unescaped `</style>`) in 8.5.10
  and `fromJSON()` prototype-hijack hardening in 8.5.17.
- **Still live:** yes — lockfile resolves `postcss@8.5.6` for the direct spec.
- **Ships where:** **dev-only.** `devDependencies` (`^8.5`) of `apps/web` and
  `apps/marketing` — Tailwind/build toolchain. The PR is lockfile-only (the
  `^8.5` range already admits 8.5.23). Only relevant if the build pipeline
  ever processes untrusted CSS; it doesn't today.
- **Residual after merge:** transitive `postcss@8.4.31` (pinned inside
  `next@15.5.22`) and `postcss@8.4.49` remain — vulnerable by version but
  only reachable through Next's internal build path with attacker CSS. Not
  actionable by us; tracked upstream by Next.
- **Verification:** `pnpm turbo run build --filter @vitalcv/web` + the
  marketing build.

### #844 — `next` 15.2.8 → 15.5.21 in `/apps/marketing` · SUPERSEDE & CLOSE

- **Advisories:** the 11 high Next.js advisories (middleware/proxy authz
  bypass, SSRF in Server Actions on custom servers, DoS variants) — the same
  set enumerated in `865445f55` (#1029).
- **Still live:** **no.** Main upgraded `apps/marketing` to **15.5.22** —
  one patch *past* this PR's target — in #1029, verified there with a full
  turbo build, the apps/web vitest suite, and `pnpm audit --prod` showing next
  advisories 11 → 0.
- **Conflicts:** yes — the PR's single change (`apps/marketing/package.json`
  version line) collides with main's newer pin. There is nothing left for it
  to contribute.
- **Disposition:** close as superseded by #1029 / `865445f55`. No
  `@dependabot ignore` needed — future next advisories should still open PRs.

### #582 — `expo-notifications` 0.31.5 → 57.0.8 · NEEDS-WORK, DO NOT MERGE AS-IS

- **Advisory:** **none found.** Searched the GitHub advisory ecosystem for
  expo-notifications advisories; nothing matches 0.31.5. Dependabot's own
  metadata marks this `version-update:semver-major` — it is the version-update
  stream chasing latest, not a security fix. Of the whole backlog, this is the
  one with the worst risk-to-benefit ratio.
- **The version jump is an SDK realignment, not 57 majors:** Expo moved its
  package versions onto the SDK-aligned scheme; `expo-notifications@57.x`
  belongs to **Expo SDK 57**. The PR bumps only `expo-notifications` while
  `apps/mobile` stays on `expo ~53.0.0` / `react-native 0.79.6` — an
  SDK-mismatched pair that Expo does not support and `expo-doctor` will flag.
  It merges cleanly as text and breaks as software.
- **Ships where:** runtime dependency of `apps/mobile` (push notifications).
- **Right path:** a deliberate Expo SDK 53 → 57 upgrade wave using
  `expo install --fix` so the whole companion set moves together — exactly the
  shape that worked for the tar remediation (#1031) after the forced
  single-package override failed (#808, reverted #812). Note `apps/mobile` is
  also fenced off from issuer waves in CLAUDE.md, so this wants explicit
  scheduling.
- **Optional tidy-up:** comment `@dependabot ignore this major version` on the
  PR (or close it) to stop the weekly rebase churn until the SDK wave lands;
  Dependabot will reopen if told to, and a real expo-notifications advisory
  would still open a fresh security PR.

## Safe merge order

Three of the merge-recommended PRs rewrite `pnpm-lock.yaml` (#853, #852,
#1076). All eight currently merge clean against `f0b3749` (verified with
`git merge-tree` — only #844 conflicts), but **merging any lockfile PR will
invalidate the other lockfile PRs' hunks**, so serialize those and comment
`@dependabot rebase` between them. The non-lockfile PRs touch disjoint single
files and can land in any gaps.

1. **#853** `@opentelemetry/core` — the only production-runtime fix; take it
   before anything else can push it into another rebase cycle.
   *(rebase #852 and #1076 after it lands)*
2. **#891** flask — one line, no lockfile, independent.
3. **#1066** actions/cache — one line, workflow file, independent.
4. **#574** actions/github-script — one line, workflow file, independent.
5. **#852** vite — dev-only lockfile change. *(rebase #1076 after)*
6. **#1076** postcss — dev-only lockfile change, newest PR, goes last.
7. **#844** next/marketing — close as superseded (no merge).
8. **#582** expo-notifications — hold for an Expo SDK 57 wave (no merge).

Per the repo merge gate, green CI alone is not enough for any of these — the
verification step named in each PR section above is part of the merge, and
nothing in this report waives it.

## Residual risk after the backlog clears

- `@opentelemetry/core@2.2.0` ×2 remains (transitive, experimental otel
  0.20x line) — follow-up bump when the instrumentation packages release
  against core 2.8.
- `postcss@8.4.31` / `8.4.49` remain (pinned inside `next` et al.) — upstream's
  to fix; no direct exposure in our build.
- The ~80 pre-existing production highs tracked in
  [dependency-remediation.md](dependency-remediation.md) are untouched by this
  backlog — largely `apps/mobile` (undici 6.x among others); the Expo SDK 57
  wave that unblocks #582 is also the natural vehicle for a chunk of those.
- `apps/api/bug-bounty` exists as an unauthenticated Flask endpoint with
  `debug=True` in its `__main__` path. Undeployed today, but it is attack
  surface waiting for a deploy mistake — recommend deciding to keep-and-harden
  or delete.

## Merge log (2026-08-07, founder-authorised)

The founder authorised merging #853 through #1076 in the order above. Each merge
was gated on the repo standard — zero pending / zero failing check-runs read
live off the **head SHA**, `mergeStateStatus == CLEAN`, and real verification
performed locally, never `--auto`. Squash merge throughout, matching the repo's
single-parent history.

| PR | Merge commit | Head SHA gated | Verification performed |
|---|---|---|---|
| #853 | `2bb20f3e5` | `a168c467` (15/15 green) | `--frozen-lockfile` clean; 16/16 turbo build tasks; backend jest **2093 passed / 1 skipped / 0 failed** against real Postgres; app telemetry module exercised on 2.8.0 (init OK, traceparent ids correct, span emitted, clean shutdown); library baggage cap exercised with a ~3 MB header (1 ms, ≤8 KB honoured, ~0.2 MB heap) |
| #891 | `46ecc3f10` | `ec692d5e` (15/15 green) | Flask 3.1.3 installed in a clean venv; app booted; `GET /` renders the form and `POST /submit` writes the report |
| #852 | *(pending)* | — | Lockfile merge verified to **preserve** #853's otel 2.8.0 while removing vite 6.4.1 entirely; `--frozen-lockfile` clean; vite 6.4.3 resolves in all three importers; 4/4 builds and 7/7 test tasks green (haip-config 33 tests, verifier-api 4) |

Notes worth keeping:

- **Deploy supersession is expected.** Merging #853 started an API deploy for
  `2bb20f3e5`; merging #891 ~40 s later started one for `46ecc3f10` and the
  concurrency group cancelled the first. Nothing is lost — the surviving run
  contains both commits. Read a cancelled deploy here as "superseded", not
  "failed", and confirm the *latest* run instead.
- **CI runner contention** was heavy during this pass; several PRs sat 20+
  minutes with checks queued. That is a throughput problem, not a signal about
  the PRs.
- **`@dependabot rebase` comments do not work from this tooling** — the
  `@`-mention is neutralised before it reaches Dependabot, so the bot never
  acts. Use the PR *update-branch* API instead; it merges current `main` into
  the PR head and re-triggers CI, and it resolved the lockfile PRs' rebases
  correctly.

## Method

- Open Dependabot PRs enumerated via the GitHub API (8 total; matches the
  task list exactly — no unlisted stragglers).
- Liveness checked against `origin/main` @ `f0b3749`: resolved versions in
  `pnpm-lock.yaml`, `apps/api/bug-bounty/requirements.txt`, `grep` of
  `.github/workflows/` for action pins.
- Conflict status computed with `git merge-tree --write-tree origin/main <pr-head>`
  after deepening the clone (the shallow default produced false conflicts).
- Manual-remediation history from `git log -- pnpm-lock.yaml` and the commit
  bodies of `865445f55`, `d28fb85e2`, `af5713e5f`, `f3a150e4e`.
- Advisory identification from PR bodies (flask names its GHSAs directly),
  upstream changelogs, and the GitHub advisory database (links inline).
