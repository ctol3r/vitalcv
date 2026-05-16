# Canonical Runtime

This document defines the single authoritative VitalCV runtime contract.

## Authoritative Runtime

- Runtime role: `web`
- Authoritative port: `3030`
- Authoritative deployment path: `apps/web`
- Authoritative worktree: `/Users/christoler/vitalcv`
- Canonical boot command:
  - `pnpm --filter @vitalcv/web dev`
  - `pnpm --filter @vitalcv/web start`

Both boot commands are wrapped by `scripts/runtime/assert-canonical-runtime.ts` so they fail closed when another VitalCV Next.js runtime is already alive.

## Current Canonical Runtime Snapshot

As of this audit, the active Next.js server topology is:

| PID | Port | CWD | Git SHA | Branch | Worktree |
|---|---:|---|---|---|---|
| `38778` | `3030` | `/Users/christoler/vitalcv/apps/web` | `90766a7e985cae13b06d55162b532e88cfc0f863` | `wave-10a/docs-status` | `/Users/christoler/vitalcv` |

No shadow Next.js runtime was observed in the current process scan.

## Runtime Lock Strategy

- Lock file path: `${TMPDIR:-/tmp}/vitalcv/runtime/canonical-runtime.lock`
- Owner: the canonical boot wrapper process
- Contents: PID, child PID, port, cwd, repo root, worktree, git SHA, branch, role, deployment mode, env label, doctrine version, deployment id, command, and timestamps
- Acquire behavior:
  - refuse boot if the lock file is held by a live owner
  - refuse boot if any other live VitalCV Next.js runtime is already listening
  - write the lock before spawning the server command
  - update the lock with the child PID after spawn
  - delete the lock when the wrapper exits cleanly

## Forbidden Runtime Patterns

- Launching `next dev`, `next start`, or `next-server` outside `scripts/runtime/assert-canonical-runtime.ts`
- Starting a second VitalCV Next.js runtime while the canonical lock is held
- Booting from a non-authoritative worktree
- Booting on any port other than `3030` for the canonical runtime
- Treating an unlocked or stale runtime as authoritative without re-checking the live process table
- Using a shadow runtime for production verification or deployment truth claims

## Boot Enforcement

- `scripts/runtime/assert-canonical-runtime.ts` prints the authoritative runtime banner on startup
- `scripts/runtime/kill-shadow-runtimes.sh` terminates any non-canonical Next.js runtime that is still alive
- `scripts/runtime/verify-production-convergence.ts` verifies the deployment/runtime truth contract end to end
