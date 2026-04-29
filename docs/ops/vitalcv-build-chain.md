# VitalCV Web Build Chain

> **TL;DR**
> Run `pnpm run build:web` (or `pnpm turbo run build --filter @vitalcv/web`) for any local web build. The bare `pnpm --filter @vitalcv/web build` fails in a fresh worktree because it skips the workspace prebuild step.

## Canonical local web build command

```bash
pnpm install --frozen-lockfile
pnpm run build:web
```

Equivalent direct invocation:

```bash
pnpm turbo run build --filter @vitalcv/web
```

`turbo`'s `build` task in `turbo.json` declares `"dependsOn": ["^build"]`, so it walks the workspace dependency graph and prebuilds every workspace package that `@vitalcv/web` imports — most importantly `@vitalcv/trust-state` — before invoking `next build`.

## Why the bare `pnpm --filter @vitalcv/web build` fails in a fresh worktree

Several modules under `apps/web/lib/trust/*` import `@vitalcv/trust-state`, which is a workspace package whose `package.json` declares:

```json
{
  "main": "dist/index.js",
  "types": "dist/index.d.ts"
}
```

i.e. the resolver expects the **compiled** `dist/index.js` artifact, not the raw `src/`. The pnpm workspace symlink alone is not enough — `dist/` only exists after running:

```bash
pnpm --filter @vitalcv/trust-state build
```

`turbo run build` handles this automatically via its task-graph `dependsOn: ["^build"]`. A bare `pnpm --filter @vitalcv/web build` does not — it just runs `next build` against an empty `dist/` and fails with:

```
Module not found: Can't resolve '@vitalcv/trust-state'
```

at every import site.

## Three supported local commands

| Command | What it does | When to use |
|---|---|---|
| `pnpm run build:web` | Wraps `pnpm turbo run build --filter @vitalcv/web`. Prebuilds workspace deps via turbo's task graph, then runs `next build`. | **Default.** Use this for every local web build. |
| `pnpm run build:web:direct` | Runs `pnpm --filter @vitalcv/trust-state build` then `pnpm --filter @vitalcv/web build`. No turbo. | Fallback when turbo's cache state is suspect or you want to inspect the trust-state build output independently. |
| `pnpm run build:check-chain` | Runs `scripts/check-web-build-chain.sh`, which exercises the canonical command and prints guidance. | CI smoke / local pre-commit check that the build chain still works. |

## CI behavior

GitHub Actions's `Web Quality` workflow already invokes the turbo path. CI is not affected by the bare-pnpm failure mode — but local contributors hitting it spend ~5–10 min before discovering the workaround. This doc + the new root scripts surface the canonical command.

## Known: `@vitalcv/shared` TS6059 rootDir issue (not fixed in this wave)

Tracked in **issue #195** (BUILD-CHAIN-1). `pnpm --filter @vitalcv/shared build` fails with:

```
../crs/index.ts(10,8): error TS6059: File '.../packages/crs/CrsEngine.ts' is not under 'rootDir' '.../packages/shared'.
crs/index.ts(1,75): error TS6059: File '.../packages/crs/index.ts' is not under 'rootDir' '.../packages/shared'.
```

This is a pre-existing package-boundary issue — `@vitalcv/shared`'s `tsconfig.json` declares `rootDir` as `packages/shared` but pulls source from a sibling `packages/crs` directory that lives outside that root. Candidate fixes are documented in #195 (broaden rootDir, separate package, or formalize project references). **Not fixed in this wave** because the correct fix touches the package boundary between `@vitalcv/shared` and `@vitalcv/crs` and warrants a separate, narrowly-scoped review. The web build does NOT depend on `@vitalcv/shared`'s tsc emit — it imports via the workspace symlink to the package's TypeScript source — so this bug does not block the web build chain.

## Quick reference

```bash
# Default — what every contributor should run
pnpm install --frozen-lockfile
pnpm run build:web

# If you suspect turbo cache, force a clean run
pnpm install --frozen-lockfile
pnpm run build:web:direct

# Smoke-check the chain
pnpm run build:check-chain
```
