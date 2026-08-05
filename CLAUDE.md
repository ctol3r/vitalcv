# VitalCV

Healthcare credentialing platform. pnpm + turbo monorepo. Apps in `apps/`, shared
packages in `packages/`. Auto-memory at `~/.claude/projects/-Users-christoler-vitalcv/memory/MEMORY.md`
persists cross-session learnings; read it before assuming context.

## Operating stack

When dispatched as part of a wave, roles are explicit:
- **Claude Code Desktop** = supervisor / merge gate (issues GO/NO-GO, never builds)
- **Claude Code Terminal** = primary builder (writes code, opens PRs, runs `gh pr merge`)
- **Codex** (`codex exec` v0.125+) = optional surgical verifier. Useful for a second opinion on a risky diff; **not** required before merge.
- **`pr-shepherd`** (`.claude/agents/pr-shepherd.md`) = PR landing. Owns the loop from red-or-stalled to genuinely green and merged: triage, CI diagnosis, fix, re-verify against the head SHA, merge, post-merge deploy confirmation. Delegate a failing or stuck PR here rather than re-deriving the gate topology.
- Do NOT use OpenClaw, Browser, or Cowork for build/verify work.

**Merge gate (settled 2026-07-25):** green CI **plus real verification** — you must actually exercise the change (run the suite, hit the route, load the page, execute the script) and show the evidence. Green CI on its own is not enough: shell scripts, GPU paths, and dev-gated e2e specs run in no PR check. Codex is not a merge gate, and no verifier verdict substitutes for having exercised the change yourself.

**"Green" is a claim about a SHA, not a PR.** Read the required contexts live (`gh api repos/:owner/:repo/branches/main/protection --jq '.required_status_checks.contexts[]'` — the list has moved 2 → 5 → 7 → 14 in six weeks) and enumerate conclusions from `commits/<head-sha>/check-runs`. A `CONFLICTING` PR skips every `pull_request` gate and displays ~3 push checks that look green; a push to a closed PR runs zero workflows silently. Require zero pending, zero failing, and `mergeStateStatus == CLEAN`. Never `gh pr merge --auto`.

## Founder visual gate (active 2026-08-02)

Public-facing visual work is governed by
[`docs/ops/FOUNDER_VISUAL_GATE.md`](docs/ops/FOUNDER_VISUAL_GATE.md).

For `/`, `/employers`, `/trust`, `/pilot`, `/onboarding`, `/explore`, shared
public chrome, and public experience components:

- name one creative owner;
- attach desktop and mobile before/after evidence;
- attach recordings for motion or scroll-controlled behavior;
- document duplicate-intent searches before creating a component;
- do not describe an unmounted design-system component as a customer-facing
  improvement;
- keep the PR in draft until the founder comments
  `FOUNDER VISUAL DECISION: GO`;
- do not begin a parallel homepage composition while the recovery freeze is
  active.

Green CI, design lint, accessibility checks, and source-truth checks do not
prove visual quality. Founder approval is required in addition to the normal
merge gate. Security, privacy, outage, source-truth, and data-loss fixes may
proceed without visual approval when they avoid unrelated visual recomposition.

## VitalCV Strategy Contract

**Read [`docs/strategy/README.md`](docs/strategy/README.md) and both canonical
documents before changing any of the following:**

- Homepage messaging
- Navigation
- Customer-facing terminology
- Product naming
- Clinician onboarding
- Job discovery
- Apply flows
- Employer candidate review
- Roadmap priorities

Canonical (founder-approved 2026-08-04):

- [`docs/strategy/vitalcv-category-strategy.md`](docs/strategy/vitalcv-category-strategy.md) — the full rationale
- [`docs/strategy/vitalcv-strategy-operating-brief.md`](docs/strategy/vitalcv-strategy-operating-brief.md) — the day-to-day decision contract

> VitalCV is the portable professional identity and employment network for clinicians.

The reusable clinician profile is the product; NPI is the acquisition wedge;
`Apply with VitalCV` is the canonical transaction; employer acceptance
intelligence is the long-term advantage. North star: **clinician starts enabled
by a reused VitalCV profile** — not profiles created, checks run, or packets
generated.

Customers should need to remember four things: **VitalCV**, **your VitalCV
profile**, **VitalCV Jobs**, **Apply with VitalCV**. Wallet, passport, dossier,
Trust Passport, Evidence OS, recognition, snapshot, receipt, holder, PSV, trust
tier, SD-JWT, blockchain and knowledge graph are infrastructure vocabulary —
keep them out of the homepage, primary navigation, onboarding headings, major
CTAs and acquisition copy. **Do not mass-rename backend classes, schemas, APIs
or audit records to match the marketing vocabulary**; the strategy does not ask
for that.

Precedence when instructions conflict: founder instruction in the current task →
operating brief → category strategy → **security, privacy and truth contracts** →
existing implementation and older strategy documents. Note the fourth rank: these
documents govern what the product SAYS IT IS. They never license a claim the
truth contract forbids (see [Truth contract](#truth-contract-issuer--psv-chain)
and its banned strings) and never relax a security boundary. `docs/strategy/`
still contains older mandates that claim homepage authority; each carries a
superseded notice.

Before adding any customer-facing term or feature, run
[`docs/strategy/product-decision-filter.md`](docs/strategy/product-decision-filter.md).

## Branch cutting (worktree fleet caveat)

Local `main` is held by `/Users/christoler/vitalcv-omega4f-trigger`, and ~80 other worktrees exist (`~/.codex/worktrees/*` for the Codex fleet, plus dozens of `vitalcv-*` feature trees). **Never** `git checkout main && git pull origin main` — it fails. Instead:

```bash
git fetch origin main
git worktree add -b <feature-branch> /tmp/vitalcv-<slug> origin/main
cd /tmp/vitalcv-<slug>
pnpm install                      # workspace symlinks + deps
pnpm turbo run build --filter @vitalcv/web   # prebuilds @vitalcv/trust-state dist/, required before pnpm --filter web build works
```

Do not remove worktrees you didn't create — they are load-bearing.

## Deployment (Railway — Vercel is deprecated)

**Railway is the canonical deployment platform; GitHub is the source of truth.** Vercel is legacy — do not add Vercel assumptions, and do not block work on Vercel previews/checks. There is no hard Vercel dependency (0 `@vercel/*` packages). See `docs/deployment/railway-migration.md` and `railway-env.md`.

- **API** deploys from root `railway.toml` (+ `nixpacks.toml`, `apps/api/Dockerfile`): `pnpm turbo build`, `prisma migrate deploy`, health `/health`.
- **Web** deploys from `apps/web/Dockerfile` (+ `apps/web/railway.toml`): `next start -p $PORT`, health `/api/health`. Both auto-deploy on push to `main`; `.github/workflows/deploy-api.yml` + `deploy-web.yml` wait + smoke-test.
- **Required web env:** set `BACKEND_URL` (e.g. `https://api.vitalcv.com`) — `getBackendBase()` uses it for server-side reads and it overrides the Docker build default `NEXT_PUBLIC_API_BASE=http://localhost:4000`. Without it, live-data surfaces (e.g. `/ops/engine`) read the wrong base.
- Deploy metadata: prefer `RAILWAY_*` env (`RAILWAY_ENVIRONMENT`, `RAILWAY_GIT_COMMIT_SHA`, `RAILWAY_GIT_BRANCH`); `VERCEL_*` reads remain only as backwards-compatible fallbacks.

## Commands

```bash
# Build workspace deps ONCE per fresh worktree before running any vitest.
# Vitest resolves @vitalcv/* through package.json main/exports, which point at
# dist/. Skip this and 25 suites fail with "Cannot find module" errors that
# blame the packages, not the missing build. A globalSetup check now says so
# outright instead of letting you debug phantom failures.
pnpm turbo build --filter='!@vitalcv/web'

# Run a focused vitest suite in apps/web
pnpm --filter @vitalcv/web exec vitest run __tests__/<file>.test.ts

# Build apps/web (requires turbo for workspace dep prebuild)
pnpm turbo run build --filter @vitalcv/web

# Validate the Knowledge Trust Graph JSON
node -e "JSON.parse(require('fs').readFileSync('docs/architecture/vitalcv-knowledge-trust-graph.json','utf8')); console.log('graph json ok')"

# Typecheck / lint
pnpm typecheck      # turbo typecheck
pnpm lint           # turbo lint
```

Tests use vitest 4.x (not Jest). React 19 + Next 15 App Router. Server components are async; tests render via `react-dom/server` `renderToStaticMarkup` (see `apps/web/__tests__/issuer-receipt-candidate.test.ts` for the pattern).

## Truth contract (issuer / PSV chain)

The issuer verification chain (`apps/web/lib/issuer-verification/`) enforces hard invariants. Do not weaken them.

- `ReceiptCandidate.decisionGrade` is the **literal** `false`. `proofTier` is the literal `'receipt_candidate'`. Do not widen to `boolean` or other strings.
- `PSVReceiptCandidate` (output of accepted policy review) is also literal `decisionGrade: false`, distinct `proofTier: 'psv_receipt_candidate'`. Promotion to a real `PSVReceipt` is a separate gated wave.
- Only `accept_candidate` (under `policyReview.ts`) may produce a `PSVReceiptCandidate`, and only when `reviewState === 'ready_for_policy_review'`. Five gates fire in order: action, wrong_office, unable_to_verify, conflict_review, ready state, legally_only-needs-limitation-note.
- Issuer-verification helper modules (`receiptCandidate.ts`, `policyReview.ts`) are **pure transforms**: no fetches, no DB writes, no audit-event writes. The review surfaces under `apps/web/app/issuer/{review,policy-review}/[requestId]/page.tsx` are demo renders only — `recordedBy: 'demo'` and copy explicitly disclaims a real audit row.
- Authoritative truth source: `docs/architecture/vitalcv-knowledge-trust-graph.{md,json}`. Boundaries are numbered (1–28 as of `657f041c`); add new ones, do not rewrite old ones.

### Banned strings (no copy may contain these except as test split-join constants)

`automatically verified`, `guaranteed verification`, `complete credentialing`, `instant credentialing`, `legally accepted`, `risk transferred`, `final verification without review`, `source confirmed before response`, `certified compliant`, `HIPAA compliant`, `SOC2 certified`. No status label may be the bare word `Verified`.

## Architecture

- **Apps**: `apps/web` (Next 15 App Router, primary), `apps/api/backend`, `apps/marketing` (separate, do not pull web changes into it), `apps/issuer-api`, `apps/verifier-api`, `apps/router`, `apps/admin-api`, `apps/mobile` (do not modify in issuer waves).
- **Packages**: `packages/domain-common` is the barrel for domain types — re-export with the `type` keyword (`isolatedModules: true`). `packages/trust-state` ships from `dist/` and must be turbo-built before `apps/web` build works.
- **`@types/react` override** in root `package.json` resolves Radix UI + React 19 conflicts. `.npmrc` has `public-hoist-pattern[]=@types/*` so `@types/node` reaches all packages.

## Gotchas

- Green CI is not evidence the code works. Anything CI does not execute — shell scripts, GPU/WebGPU paths, dev-gated e2e specs that 404 under a production build — must be run by hand before merge.
- When a build complains `Module not found: Can't resolve '@vitalcv/trust-state'` in a fresh worktree, run `pnpm turbo run build --filter @vitalcv/web` (not just `pnpm --filter @vitalcv/web build`) — turbo prebuilds the workspace dep's `dist/`.
- Local `main` is often stale relative to `origin/main` because of the worktree fleet. Always diff against `origin/main`, not `main`, when checking PR scope.
- `next.config.mjs` enforces TypeScript and ESLint checks on build (no ignore flags); typecheck failures break deploys.
- Web app `tsconfig` needs explicit `"types": ["node", "react", "react-dom"]` to avoid stale `@types/minimatch`.
