# Wallet-SDK Archaeology

Audit of the wallet-sdk build failure that blocked CI convergence
across the session-created PR stack, the actual root cause, and the
minimal repair shipped in `fix/ci-unlock-and-stack-convergence`.

## Exact root cause

`packages/wallet-sdk/src/index.ts` (origin/main) ended with:

```ts
// Wave 133: version + diagnostics
export * from './version';
export * from './diagnostics';
export * from './interoperability';   // <-- orphan: source file never landed
```

`./version.ts` and `./diagnostics.ts` exist under
`packages/wallet-sdk/src/`. `./interoperability.ts` (or
`./interoperability/index.ts`) does not -- the re-export pointed at a
file that was never committed.

`tsup src/index.ts --format cjs,esm --dts --clean` (the package's
`build` script) fails with:

```
src/index.ts:351:14: ERROR: Could not resolve "./interoperability"
DTS Build error
```

## Why this collapsed convergence

The failure is **transitive**. `pnpm turbo build` runs every package's
`build` script. When `@vitalcv/wallet-sdk` build fails, turbo marks
the package errored. Any downstream task that declares
`dependsOn: ["^build"]` for wallet-sdk halts. The web app does NOT
import wallet-sdk at runtime (the only real consumer is
`apps/mobile/src/services/WalletSyncService.ts`), so `pnpm --filter
@vitalcv/web build` succeeds in isolation. But operator workflows
that run `pnpm turbo build` against the entire workspace fail.

The truth-constrained wave (PR #391) documented wallet-sdk as
**"not dead, not orphaned"** -- correct as a structural finding, but
the diagnostic never invoked `pnpm --filter @vitalcv/wallet-sdk
build`. The orphan re-export sat dormant until this convergence wave
explicitly ran the build.

## Affected PRs

Every session-created PR is built on top of `origin/main`, which has
this defect. All 17 session PRs (#381 - #397) **inherit** the
wallet-sdk failure when `pnpm turbo build` is run end-to-end. The
inheritance is symmetric -- no PR introduced the defect, no PR
removed it before this one.

## Inherited stack failures

| Stack chain | Failure mode |
|---|---|
| Trust canon (#382 -> #383 -> #386 -> #395) | wallet-sdk unrelated to imports; chain tsc/lint/vitest pass; turbo-build still blocked |
| Discovery / protocol (#384 / #392 / #393) | wallet-sdk unrelated to imports; chain passes; turbo-build still blocked |
| Core scaffold (#388 -> #389 -> #390 -> #392) | same |
| Governance (#391 / #394 / #396 / #397) | same |
| Standalone (#381, #385, #387) | same |

The web-only tsc + vitest commands the session has been using
(`pnpm --filter @vitalcv/web exec tsc --noEmit`,
`pnpm --filter @vitalcv/web exec vitest run`) all bypass the
turbo-build path and consequently never tripped the failure.

## Why convergence collapsed

Three reinforcing factors:

1. **Web-filtered validation hid the defect.** Session waves ran
   `pnpm --filter @vitalcv/web ...` which never invokes the wallet-sdk
   build.
2. **Wallet-sdk's only real consumer is offstage.** `apps/mobile`
   isn't part of the web stack's validation path; mobile builds are
   typically run separately, after the web-side checks pass.
3. **No top-level `pnpm turbo build` gate** ran in the session. Each
   wave validated its own surface; nothing exercised the union.

The session's truth-audit (PR #391) and repo-reality audit (PR #394)
both correctly described wallet-sdk's structural state but neither
required a build invocation. That's the audit-gap this wave closes.

## What was repaired

A single line was removed from `packages/wallet-sdk/src/index.ts`:

```diff
- export * from './interoperability';
+ // Note: the prior `./interoperability` re-export referenced a file
+ // that was never landed. Removed in
+ // fix/ci-unlock-and-stack-convergence to restore the build. Future
+ // interoperability surfaces will be wired through a declared
+ // workspace package, not via this dangling re-export.
```

Validation:

```
$ pnpm --filter @vitalcv/wallet-sdk build
ESM dist/index.mjs 6.30 KB
ESM ⚡️ Build success in 52ms
CJS dist/index.js 7.59 KB
CJS ⚡️ Build success in 52ms
DTS Build start
DTS ⚡️ Build success in 255ms
DTS dist/index.d.ts  6.99 KB
DTS dist/index.d.mts 6.99 KB
```

## Why this is the minimal repair

- Zero behavior change. No symbol exported by wallet-sdk was actually
  defined under `./interoperability` -- the re-export was unbacked.
- Zero downstream consumer impact. The only real consumer
  (`apps/mobile/src/services/WalletSyncService.ts`) imports
  `VitalCVWallet` and `WalletCredential`, both shipped from
  `index.ts` directly.
- Zero protocol expansion. Future interoperability surfaces will be
  wired through a real workspace package (as the comment in the
  repaired line states), not via a dangling re-export.

## Remaining risk surfaces

1. **No CI guard yet.** Until `pnpm verify:ci-convergence` is wired
   into a pre-merge or pre-push hook, a future contributor can
   reintroduce a similar dangling re-export. This wave ships the
   verification command; wiring it into a hook is a separate
   operational wave.
2. **`apps/api`, `contracts`, `credential-demo` carry legacy bare
   `main: index.js` declarations** that the verify-workspace-exports
   check classifies as NOTE (legacy umbrella, no runtime impact).
   Cleaning these is out of scope for a convergence wave but tracked
   as a hygiene follow-up.
3. **Build-artifact dependencies** for 17 workspace packages remain
   "not materialized" until `pnpm turbo build` runs. The script
   classifies them WARN; they are not blockers because turbo
   regenerates them on demand.
