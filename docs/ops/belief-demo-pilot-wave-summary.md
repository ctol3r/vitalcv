# Belief / Demo / Pilot Wave Summary

What this PR shipped and what it intentionally did not.

## Scope (single PR, single branch `wave/openevidence-data-injection-demo-spine`)

### Routes created (new on `origin/main`)

| Route | Purpose |
|---|---|
| `/launch` | Belief-first public landing pad; 10-second hospital-operator scan; embeds RoiCalculator + EquityRetentionBlock |
| `/demo` | Demo index pointing to the three sub-flows |
| `/demo/clinician` | Six demo personas across rural/FQHC, locum, procedural, IMG, NP-restricted-state, telehealth |
| `/demo/employer` | Three-state review queue + interactive ROI calculator + equity research signals |
| `/demo/issuer` | Verification requests with audit trail + attribution disclosure |

All routes:
- Render without auth.
- Render without backend.
- Render without env vars.
- Pure server components (where possible) + RoiCalculator is client.
- Mobile-safe responsive layout via Tailwind.

### Components created

| Component | Used on |
|---|---|
| `apps/web/components/demo/RoiCalculator.tsx` | `/launch`, `/demo/employer` — interactive ROI with specialty/provider-count/originating-hospital controls |
| `apps/web/components/demo/EquityRetentionBlock.tsx` | `/launch`, `/demo/employer` — equity + retention research signals |
| `apps/web/components/employer-roi/EmployerRoiBlock.tsx` | (unused after RoiCalculator subsumed it; kept for backward refs) |

### Data modules

| File | Purpose |
|---|---|
| `apps/web/app/demo/_seed.ts` | Six demo personas (rural FQHC, locum, procedural, IMG, NP-restricted, telehealth) + employer queue + issuer requests. All NPIs marked synthetic; all display names carry `— DEMO`. |
| `apps/web/app/demo/_marketData.ts` | OpenEvidence-backed market signals (103/36/67/$2,700–$5,400) + workforce/equity research signals + specialty options + pure ROI math helpers |

### Scripts

| Script | Purpose |
|---|---|
| `scripts/founder-mode.sh` | One-command local-demo orchestrator (starts dev server, opens browser, optional public tunnel) |
| `scripts/public-demo.sh` | Public-URL tunnel via cloudflared (preferred) or localhost.run (fallback) |

Both scripts use the script-dir-relative `REPO_ROOT` (`$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)`) — no stale absolute paths.

### Env

| File | Purpose |
|---|---|
| `local-host/.env.demo.example` | Demo-only env template; all production secrets blank by design |

### Docs

| File | Purpose |
|---|---|
| `docs/ops/founder-demo-script.md` | 3-minute live-demo script |
| `docs/ops/public-demo-survival-runbook.md` | Public-URL setup + failure recovery |
| `docs/ops/belief-demo-pilot-wave-summary.md` | This file |

### Tests

| File | Coverage |
|---|---|
| `apps/web/__tests__/openevidence-demo-spine.test.ts` | 34 tests: ROI math (103−36=67, 67×$2700=$180,900, 67×$5400=$361,800), scaling, formatting, all 5 routes render, banned-phrase scan on 9 new files, bare-Verified scan, synthetic-data-labeled assertions, research-signal posture, script repo-path assertions |

## What this PR explicitly does NOT do

- Does NOT modify any production deployment (Vercel, DNS, Railway).
- Does NOT add a Prisma migration.
- Does NOT introduce new endpoints in `/api/*` (verifier-continuity routes already exist on `origin/main` — `/api/.well-known/{jwks,did,openid-credential-issuer,openid-configuration,trust-register,trust,verifier-manifest}.json`, `/api/receipt/*`, `/api/replay/*`).
- Does NOT modify the `/passport` page, ingest flow, or middleware.
- Does NOT fake any traction, metric, or testimonial. The
  `EquityRetentionBlock` renders research signals labeled as such; the
  `RoiCalculator` math is labeled "illustrative market benchmark — not a guaranteed VitalCV outcome."

## Truth-contract guarantees

| Check | Status |
|---|---|
| Banned-phrase scan on 9 new files | CLEAN |
| Bare-Verified label scan | CLEAN |
| Every synthetic NPI labeled "DEMO" | YES (asserted by tests) |
| Every persona `displayName` carries DEMO marker | YES (asserted by tests) |
| Every employer org carries DEMO marker | YES (asserted by tests) |
| Every issuer org / claimSummary carries DEMO marker | YES (asserted by tests) |
| ROI math arithmetic | Verified (4 numeric assertions) |
| Script repo-path references | No `~/vitalcv-omega4f-trigger`; uses `REPO_ROOT` derivation (asserted) |
| Production-secret leakage | Zero; demo env template has all secrets blank |

## Validation summary

- `pnpm install --frozen-lockfile` — succeeds in 12s
- `pnpm turbo build --filter='@vitalcv/trust-state'` + `--filter='@vitalcv/shared'` — succeeds (cached after first run)
- `pnpm --filter @vitalcv/web exec tsc --noEmit` — clean
- `pnpm --filter @vitalcv/web exec vitest run __tests__/openevidence-demo-spine.test.ts` — 34/34 passing
- `pnpm --filter @vitalcv/web build` — succeeds (direct path; turbo path trips pre-existing `@vitalcv/wallet-sdk` `./interoperability` missing module, confirmed on `origin/main` and not caused by this PR)

## Operator next steps

1. Review the PR.
2. `cd ~/vitalcv && scripts/founder-mode.sh --public` to verify the demo loads on a real device.
3. Run `codex exec` per the wave-execution skill before merging.

## Single closing claim

A working public-demo spine ships in this PR. The founder can pitch
tomorrow from `localhost`. The illustrative ROI calculator and equity
research signals are honest about their benchmark origin. Synthetic
data is labeled. No production secret, DNS, or Vercel mutation. The
codebase is no longer Codex-UNSAFE on the verifier-continuity gap
that flagged the missing `/launch` and `/demo` routes.
