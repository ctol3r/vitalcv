# Wave 250 — Wallet Hardening Report

**Branch:** `feat/wallet-hardening` (off `origin/main`, separate from PR #444) · **Date:** 2026-06-21

Scope: the **pre-existing** Wallet surface (not authored in the Career Evidence waves). Targeted hardening only — no redesign, no new frameworks.

---

## What was hardened

`apps/web/components/wallet/CredentialWallet.tsx` (the canonical credential wallet; live, no tests on `main`):

| C | Finding | Fix |
|---|---|---|
| C5 Security | DELETE call interpolated `credentialId` into the URL **unencoded** (`/api/credentials/${credentialId}`) — path-injection surface | extracted `walletDeletePath`/`walletFetchPath` helpers that `encodeURIComponent` both identifiers; component now uses them |
| C4 A11y | refresh + remove buttons were **icon-only with only `title`** (no accessible name) | added `aria-label` (+ `aria-busy`, `type="button"`) to both |
| C2 Tests | **no wallet tests existed on `main`** | added `credential-wallet.test.tsx` — encoding/path-injection coverage for the security fix |

## Audited, deliberately NOT changed

| Surface | Finding | Decision |
|---|---|---|
| `components/wallet/WalletPassport.tsx` | buttons already have accessible names ("Retry" text; existing `aria-label`); `npi` already `encodeURIComponent`-d in fetch | no change needed |
| `components/clinician/WalletDashboard.tsx` | **dead code — 0 importers** | flagged for removal; not deleted without owner confirmation |
| `packages/wallet-sdk` | real SDK (OID4VP/selective disclosure); `wallet-sdk` was previously **removed from web deps** | out of scope for a UI hardening pass; no change |

## Validation (C1, C5, C7)

| Check | Result |
|---|---|
| C2 new tests | 2/2 pass (security/encoding) |
| C1 typing | my files clean; `next build` typechecks green |
| C6 ESLint (jsx-a11y on the new labels) | clean |
| C5 build | `pnpm turbo run build --filter @vitalcv/web` → 13/13 tasks, exit 0 |

> **Note:** running `tsc --noEmit` standalone in a fresh worktree reports ~35 implicit-`any` errors in *unrelated* files (`PassportEntityClient.tsx` etc.) — these are pre-existing on `origin/main` and surface only because the `@vitalcv/trust-state` dist isn't prebuilt in a bare worktree; the real `next build` (which prebuilds dists) is clean. Not introduced by this change.

## Merge readiness (C7)

This is a small, surgical, **separate** PR against `main` (not entangled with PR #444). It is build-clean, typed, and the security fix is tested. Per doctrine it still requires a **Codex SAFE verdict** before merge.

## Honest scope note

The Wallet is a large pre-existing surface (~2,000 LOC across 4 components + an SDK). This pass hardens the highest-value, lowest-risk issues in the live credential wallet. A fuller hardening (dead-code removal, SDK review, a jsdom test-env for interactive component coverage) would be follow-on work and is listed above as audited findings, not silently changed.
