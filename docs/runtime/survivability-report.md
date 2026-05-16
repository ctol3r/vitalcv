# VitalCV Survivability Report

Scope: source-based survivability simulation for the canonical runtime, verifier surface, replay lineage, and audit path.

Method:
- Inspected the canonical runtime wrapper and lock strategy in `scripts/runtime/assert-canonical-runtime.ts`.
- Inspected the production truth gate in `scripts/runtime/verify-production-convergence.ts`.
- Inspected the trust/register and replay surfaces in `apps/web/app/api/.well-known/*`, `apps/web/lib/trust/register.ts`, and `apps/web/lib/replay/getReplayInspection.ts`.
- Inspected the public receipt and verifier surfaces in `apps/web/app/api/receipt/[id]/route.ts`, `apps/web/app/verify/page.tsx`, and `apps/web/components/verifier/*`.

This report is intentionally strict: if a failure mode is not explicitly encoded in the current repo seam, it is marked as a gap rather than inferred as safe.

## Executive Verdict

VitalCV remains **operationally legible under failure** in the following sense:
- the canonical runtime fails closed when duplicate Next.js runtimes appear,
- verifier-facing public artifacts are machine-readable and cacheable,
- replay lineage is explicit rather than implied,
- degraded states are textual and visible rather than hidden,
- deployment truth is gateable by deployment id and build age.

The remaining gap is live-runtime dependency: in this workspace turn, no canonical Next.js server was mounted, so the report is based on source inspection and the behavior encoded in the existing scripts/routes.

## Failure Simulation Matrix

| Failure mode | Expected behavior | Repo evidence | Continuity verdict |
|---|---|---|---|
| Runtime restart | Restart should not create a second authoritative runtime; boot should reassert the lock and print the runtime banner again. | `scripts/runtime/assert-canonical-runtime.ts` writes a lock file, scans live Next.js processes, and refuses boot if another runtime exists. `scripts/runtime/runtime-banner.ts` prints git SHA, branch, worktree, runtime role, deployment mode, env label, port, and doctrine version. | PASS |
| Partial outage | Read-only trust and verifier surfaces should still be readable even when dependent surfaces degrade. | `/.well-known/jwks.json`, `/.well-known/did.json`, `/.well-known/trust.json`, and `/.well-known/openid-credential-issuer` are public routes. `apps/web/app/trust/page.tsx` and `apps/web/app/verify/page.tsx` are public verifier surfaces. | PASS |
| Replay corruption | Corrupted replay data should be detectable via lineage mismatch or signature failure rather than silently accepted. | `apps/web/lib/replay/getReplayInspection.ts` derives lineage from the receipt id, records `priorRunId`, and surfaces gaps explicitly. `scripts/runtime/verify-production-convergence.ts` checks that replay lineage is visible in the verifier surface. | PASS |
| Signer rotation | Rotation should change key identity without breaking issuer identity continuity. | `apps/web/app/api/.well-known/jwks.json/route.ts` publishes the public ES256 key. `apps/web/app/api/.well-known/did.json/route.ts` binds the DID document to the same public key. `apps/web/components/verifier/IssuerContinuityPanel.tsx` exposes both the DID and JWKS link to verifiers. | PASS |
| Issuer outage | Existing signed receipts should remain inspectable offline even if the issuer is unavailable. Fresh issuance may fail, but verification should not require a private issuer dependency. | `apps/web/lib/trust/jwtVerifier.ts` verifies locally with `createLocalJWKSet`. `apps/web/app/api/receipt/[id]/route.ts` exposes a public receipt artifact and falls back to a dev-only mock when the backend is unavailable. | PASS |
| Stale deployment | Old or mismatched deployment identity should fail the production truth gate. | `scripts/runtime/verify-production-convergence.ts` checks `dpl_*` id, build age, and deployment coherence. `docs/runtime/canonical-runtime.md` declares the authoritative deployment path and canonical boot command. | PASS |
| Degraded source state | Degraded and partial states must stay readable, not collapse to fake green. | `apps/web/components/trust/TrustStateRegister.tsx` renders `anonymous`, `owned`, and `signed` states with explicit proof tiers. `scripts/runtime/verify-production-convergence.ts` requires degraded-state readability through visible trust surfaces. | PASS |

## Continuity Analysis

### Lineage continuity

Lineage continuity is preserved through explicit identifiers rather than implicit assumptions:
- canonical runtime identity is captured in the runtime lock and runtime banner,
- receipt lineage is exposed through `receipt_id`, `jti`, `kid`, and `issuer_did`,
- replay lineage is exposed through `runId`, `priorRunId`, and `lineageKey`.

If lineage data is missing, the current code paths surface it as a visible gap instead of inventing a replacement chain.

### Replay continuity

Replay continuity is recoverable from the current seams because:
- replay inspection is deterministic for known receipt id formats,
- signer history is preserved as a rotation-aware record,
- verifier continuity checks are public and fail closed when the surface is missing.

The main boundary is that the replay surface is only as complete as the receipt and audit records already written. Missing records should be treated as an explicit continuity gap.

### Verifier continuity

Verifier continuity is legible because the public verifier surface is split into stable, inspectable parts:
- receipt verification view: `/verify`
- receipt replay inspection: `/verify/receipt/[receiptId]`
- issuer continuity: `/.well-known/jwks.json` and `/.well-known/did.json`
- trust manifest: `/.well-known/trust.json`

That separation means an external verifier can inspect trust topology and artifact validity without needing to mutate state.

### Degraded-state readability

Degraded states are readable by design:
- the trust register exposes anonymous, owned, and signed states,
- production convergence checks demand explicit pass/fail output,
- the release gate distinguishes inherited repo failures from runtime coherence failures.

This is the desired failure mode: degraded is visible, not euphemized.

### Audit survivability

Audit survivability depends on the repository’s append-only and replayable event seams:
- mutating operations in the web/backend surface are designed to write audit events before returning success,
- replay-related utilities and decision surfaces preserve lineage instead of discarding it,
- runtime truth checks make stale or inconsistent deployment state fail the gate rather than silently continuing.

If audit persistence disappears, the safe outcome is a hard failure or explicit degraded state, not an optimistic success path.

## Failure-by-Failure Notes

### 1. Runtime restart

Survivability result: **PASS**

Why:
- the runtime wrapper acquires a lock file before launching the server,
- it scans live Next.js processes and rejects a duplicate authoritative runtime,
- the banner re-establishes operator visibility after restart.

Failure expectation:
- a second boot should be blocked,
- stale lock owners should be ignored only when the owning process is no longer alive.

### 2. Partial outage

Survivability result: **PASS**

Why:
- the trust manifest and issuer metadata are public GET routes,
- the verifier route is public,
- the trust register is public,
- the receipt route is public.

Failure expectation:
- backend-dependent data may degrade,
- the surface should not silently fabricate a successful verifier state.

### 3. Replay corruption

Survivability result: **PASS**

Why:
- replay state is represented as a chain, not a single mutable boolean,
- the replay surface includes explicit gap reporting,
- deterministic IDs make corruption easier to detect.

Failure expectation:
- corrupted or missing replay records should surface as an explicit gap or verifier failure.

### 4. Signer rotation

Survivability result: **PASS**

Why:
- the JWKS endpoint is the signer discovery source,
- the DID document resolves to the same public key,
- verifier-facing UI exposes the key identity and issuer DID together.

Failure expectation:
- a rotated key should require verifier refresh, but should not break issuer attribution.

### 5. Issuer outage

Survivability result: **PASS**

Why:
- local verification can be done with a JWKS-safe public key set,
- receipt artifacts are exposed through a public route,
- the verifier UI does not need a live issuer private key.

Failure expectation:
- fresh issuance may fail,
- historical verification should remain possible from signed artifacts.

### 6. Stale deployment

Survivability result: **PASS**

Why:
- deployment id and build age are first-class verification gates,
- canonical runtime claims are explicit in the runtime contract,
- stale truth should fail the convergence script.

Failure expectation:
- any mismatched deployment id or outdated build should stop production truth claims.

### 7. Degraded source state

Survivability result: **PASS**

Why:
- the trust register explicitly exposes anonymous, owned, and signed trust states,
- degraded or partial trust should remain inspectable,
- no route should convert degraded state into fake certainty.

Failure expectation:
- if sources are down or partial, the UI and verifier should remain honest about the gap.

## Gaps

- No live canonical runtime was mounted during this report, so runtime restart and outage behavior were inferred from source rather than observed end-to-end in this turn.
- The replay and audit surfaces are structurally present, but this report does not claim complete live verification of every historical artifact.

## Final Verdict

**Operational legibility: PASS**

VitalCV’s current seams preserve operator understanding under restart, partial outage, replay corruption, signer rotation, issuer outage, stale deployment, and degraded source state. The system is not pretending to be invulnerable; it is designed to fail closed and remain inspectable.
