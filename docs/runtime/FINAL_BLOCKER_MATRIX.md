# Final Blocker Matrix

## Eliminated Low-Complexity Blockers

- `/trust/graph` now exists.
- `/trust/schema` now exists.
- `/trust/doctrine` is surfaced through trust navigation.
- `/.well-known/trust.json` now advertises trust, schema, doctrine, status, and verify URIs.
- `/status` now lists the trust graph and schema surfaces.
- `apps/web/app/api/status/route.ts` now advertises the discoverability endpoints.

## Remaining Blockers

| Blocker | Severity | Notes |
|---|---|---|
| Mounted canonical runtime proof | Institutional | No local Next.js server was running on 3030 or 3000 during this sweep. |
| Live HTTP verification | Institutional | Discovery routes are source-verified, not live-verified here. |
| Deployment propagation verification | Operational | No live deployment check was executed in this workspace. |
| Scheduler ownership verification | Operational | Scheduler activation is not live-probed in this turn. |
| Replay persistence under restart | Operational | Source is coherent, but runtime proof is pending. |
| Env var completeness | Operational | Not live-checked in this turn. |

## Fast-Path Fixes

1. Mount the canonical runtime on the authoritative port and re-run the verifier sweep.
2. Probe all discovery endpoints with a single command against the mounted runtime.
3. Confirm the deployment id and build age against the mounted runtime.
4. Verify replay inspection and receipt continuity routes live.
5. Confirm the scheduler and probe ownership from the runtime environment.

## Verdict

**Remaining blockers: reduced to runtime proof and deployment proof**
