# VitalCV Trust Doctrine

Version: 1.0
Canonical source of truth for runtime trust behavior.
Verified by: institutional readiness audit — 2026-05-12

---

## Seven Doctrine Points

1. **Anonymous reads:** PUBLIC
   - All verifier endpoints return data without authentication
   - /.well-known/* routes are unconditionally public
   - /verify, /receipt, /trust pages require no login

2. **Anonymous writes:** REJECTED — 401
   - /api/pilot-ops/events: session.userId required, 401 on missing
   - /api/track/apply: Clerk auth required, actor_id injected
   - /api/learning/track (backend): x-clerk-user-id required, 401 on missing
   - No anonymous durable write reaches the database

3. **Authenticated writes:** ATTRIBUTABLE
   - Every LearningEvent carries actor_id in metadata
   - Every PilotEvent carries actor_id
   - actor_id = Clerk userId, never fabricated

4. **Replay lineage:** COHERENT
   - Prisma upsert with dedupeKey — first write wins, restart-safe
   - Replay reconstruction survives server restart
   - actor_id persists across restarts
   - replayCorruptionContainment.ts: QUARANTINED/AMBIGUOUS states fail-closed

5. **Verifier continuity:** PUBLIC
   - /.well-known/jwks.json — no auth
   - /.well-known/did.json — no auth
   - /.well-known/trust.json — no auth
   - /.well-known/trust-register — no auth
   - /api/receipts/verify — no auth, POST
   - Any verifier can independently verify a receipt without contacting VitalCV

6. **Signed issuance:** ATTRIBUTABLE
   - signIssuerReceipt() embeds actorId as azp (RFC 9068) and vcv.actor_id
   - sub = NPI (subject identity)
   - azp = Clerk userId (authorized party — who triggered issuance)
   - vcv.provider_id = NPI binding
   - No receipt is issued without sub bound to a real NPI

7. **Degraded-state semantics:** EXPLICIT
   - No opacity-based degradation anywhere
   - Dashed borders = degraded/anonymous state
   - State labels: SOURCE_UNREACHABLE / ANONYMOUS_RESTRICTION / INFRASTRUCTURE_OUTAGE / NO_ADVERSE_FINDINGS / ISSUER_UNAVAILABLE
   - "No Adverse Findings" is SUCCESS (green), never failure
   - Degradation ownership always labeled: INFRASTRUCTURE-SIDE / ISSUER-SIDE / SUCCESS / UNBOUND

---

## Visual Grammar

Reading order is fixed: OBJECT → OWNERSHIP → CHECKED_AT → CHANNEL → REPLAY → RUN_ID

All DIDs, run IDs, key fingerprints, receipt IDs, and hashes are monospaced.

Dark surfaces (bg-gray-900) are reserved exclusively for the cryptographic plane (State C, signed artifacts).

Replay renders as evidence and chronology — not telemetry, not analytics.

---

## Operational Honesty

The operator console at /ops surfaces this doctrine in machine-checkable form.
The machine-readable doctrine endpoint is at /.well-known/trust-register.
