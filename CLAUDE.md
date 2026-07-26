# VitalCV

Healthcare credentialing platform. pnpm + turbo monorepo. Apps in `apps/`, shared
packages in `packages/`. Auto-memory at `~/.claude/projects/-Users-christoler-vitalcv/memory/MEMORY.md`
persists cross-session learnings; read it before assuming context.

## Operating stack

When dispatched as part of a wave, roles are explicit:
- **Claude Code Desktop** = supervisor / merge gate (issues GO/NO-GO, never builds)
- **Claude Code Terminal** = primary builder (writes code, opens PRs, runs `gh pr merge`)
- **Codex** (`codex exec` v0.125+) = optional surgical verifier. Useful for a second opinion on a risky diff; **not** required before merge.
- Do NOT use OpenClaw, Browser, or Cowork for build/verify work.

**Merge gate (settled 2026-07-25):** green CI **plus real verification** — you must actually exercise the change (run the suite, hit the route, load the page, execute the script) and show the evidence. Green CI on its own is not enough: shell scripts, GPU paths, and dev-gated e2e specs run in no PR check. Codex is not a merge gate, and no verifier verdict substitutes for having exercised the change yourself.

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

## Commands

```bash
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
