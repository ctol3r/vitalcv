# W3-PR209A — Real Passport Runtime Walkthrough

**Audit date:** 2026-05-11
**Origin tip:** `9eb5cdee feat(status): wire compliance evidence shape into /status page (DOCS-STATUS-1) (#230)`
**Scope:** Static trace of the clinician passport runtime from authentication through verifier-ready state. No product code changes.

## Flow trace

| Step | File | Real today? | Notes |
|---|---|---|---|
| 1. Clinician auth | `apps/web/middleware.ts` + Clerk | YES | Stack is **Clerk**, not NextAuth. `CLERK_PROVIDER_ENABLED` flag at `apps/web/lib/auth/clerkConfig` controls the SignedIn banner on `HomePageClient`. |
| 2. NPI ingest | `apps/web/app/passport/page.tsx` → `POST /api/ingest/:npi` | YES | SSE-driven progressive hydration via `useIngestStream`. Initial state in `createInitialIngestStreamState()` is **honestly empty** — `readiness: {}`, `sources: { nppes: 'pending', oig: 'pending', pecos: 'pending' }`, `isUsable: false`. No synthetic readiness. |
| 3. Readiness calc | `apps/api/backend/src/services/verticals/readiness/readinessEngine.ts` + `mergeReadiness()` in `apps/web/hooks/ingestStreamState.ts` | YES | Web layer is pure merge — only overwrites when SSE payload supplies a field. No client-side synthesis. |
| 4. Replay lineage generation | **MISSING ON THE PUBLIC CONTRACT** | NO | `PassportData` (apps/web/lib/trust/passport-contract.ts:91–211) has no `replayLineage` field. The SSE stream emits events but they're not persisted onto the passport payload — there is no place for the backend to attach an event sequence as proof. |
| 5. Credential issuance | `apps/api/backend/src/services/sd-jwt/sdJwtIssuer.ts` | YES | Real `jose`-signed SD-JWT with per-claim disclosures, holder-DID binding, contested-DID gate. |
| 6. Wallet hydration | `packages/wallet-sdk/src/index.ts` + `/api/credentials/wallet/{npi}/summary` | PARTIAL | Real API surface; offline VP envelope is non-cryptographic JSON (called out separately as the wallet blocker in W3-PR200A verdict). |
| 7. Verifier-ready state | `apps/web/app/api/passport/[npi]/route.ts` + `assertPassportData` | PARTIAL | Shape check only — does NOT verify that ambiguous states are preserved end-to-end. A backend coercion from `UNKNOWN → "verified"` would pass shape validation if the rest of the payload is well-formed. |

## Truth-contract observations on the runtime

**Honest:**
- `createInitialIngestStreamState()` emits no synthetic readiness, no fake source statuses, `isUsable: false` until proven.
- `PassportData.standing` carries explicit `UNCHECKED` / `UNKNOWN` enum members for `exclusionStatus` and `pecosEnrollmentStatus` — ambiguity is type-visible.
- `PassportData.authority.credentials[].stale` is required boolean, not optional — staleness cannot be hidden.
- `/api/passport/[npi]` route returns explicit `502 invalid_upstream_payload` on shape failure and `503 Passport unavailable` on upstream timeout — fail-closed at the proxy layer.

**Gaps (ranked by replay-integrity impact):**

1. **No replay-lineage field on `PassportData`.** The SSE pipeline carries an event stream (NPPES, OIG, PECOS, readiness updates) but the public passport payload has no field to embed the event sequence or a hash of it. A verifier reading `/api/passport/[npi]` cannot prove the readiness was derived from real source events. *Impact: highest. Without a lineage field, the passport is a snapshot without provenance.*

2. **`assertPassportData` does not enforce ambiguity preservation.** It checks shape but does not assert that, e.g., `standing.pecosEnrollmentStatus === 'UNKNOWN'` corresponds to `sources.checked` not containing `'pecos'`. A coerced-to-verified backend would round-trip cleanly. *Impact: high. Truth-contract drift is undetected at the boundary.*

3. **No `R-AMBIGUOUS` analogue on the response.** When the upstream backend partially succeeds (e.g., NPPES returns but PECOS times out), the proxy route surfaces individual `unknown` enum values but the top-level `PassportData` has no aggregate ambiguity flag. UI consumers must inspect every field. *Impact: medium. Per-field is correct but lacks a CI-gatable aggregate.*

4. **`/api/passport/[npi]` proxy has no schema contract with upstream.** It trusts `BACKEND_URL/api/passport/:npi` returns what `assertPassportData` expects. If the backend changes its shape, the failure mode is `502 invalid_upstream_payload` — correct, but no early warning. *Impact: low. Already fail-closed; just opaque.*

## Verdicts

**Strongest passport-runtime gain (this audit):** Documenting that the initial ingest state is truth-honest closes a question that had been outstanding — there is no synthetic readiness leaking from the client. This is a positive finding; the runtime is more honest than the surface copy would suggest.

**Strongest replay-passport convergence gain (recommended next):** Add a `replayLineage` optional field to `PassportData` carrying the event sequence digest + the SSE event IDs that produced each field. The wallet-activation-reality work in W3-PR200A establishes the pattern (real introspection over a shape). The same pattern applied to `assertPassportData` — verify that ambiguous values correspond to absent source checks — would close gap #2.

**Biggest remaining activation blocker:** Gap #1 (no `replayLineage` field). Without it, the passport's claim that readiness was "computed from real federal sources" is structurally unverifiable from the payload alone. Any future verifier wanting to prove provenance would need to call the SSE endpoint separately and reconcile.

**Passport runtime verdict:** `HONEST WHERE IT EXISTS, INCOMPLETE WHERE IT MATTERS MOST.` The initial-state and per-field ambiguity preservation are sound; the lineage-binding to the contract is not. Recommend a follow-up PR (`W3-PR210A: passport replay lineage embedding`) that adds the lineage field + a contract assertion that lineage IDs reconcile with the events stream.

## Passport Runtime Board

| Metric | Reading | Evidence |
|---|---|---|
| Real Ingest Fidelity % | ~75 | SSE pipeline is real; events are real federal source calls; initial state honest |
| Replay Lineage Integrity % | ~20 | Events exist on the wire but not embedded in the contract |
| Passport Hydration Stability % | ~70 | Proxy route fail-closes correctly; `assertPassportData` enforces shape |
| Readiness Truthfulness % | ~80 | No synthetic defaults; readiness only set by SSE payload |
| Passport Runtime Maturity % | ~60 | Honest, but lacks the lineage-binding that would make it verifiable |

Board scores move only on merge per BOARD-SCHEMA-3.

## Lockdown test coverage (this PR)

The accompanying lockdown test at `apps/web/__tests__/passport-runtime-truth.test.ts` pins:

- `createInitialIngestStreamState()` returns no synthetic readiness, no synthetic source statuses, `isUsable: false`.
- `PassportData.standing` enum literals include `UNCHECKED`/`UNKNOWN` — ambiguity is type-visible.
- `PassportData.authority.credentials[].stale` is required (no optional staleness).
- The proxy route file fail-closes on shape failure (asserts `invalid_upstream_payload` literal present).

These are regression pins, not behavioral changes. They protect the honest defaults documented above.

## Out of scope (recommended follow-ups)

- **W3-PR210A** — embed `replayLineage` on `PassportData`. Contract change + backend coordination required.
- **W3-PR211A** — extend `assertPassportData` to verify ambiguity-to-source correspondence. Pure web-side work.
- **W3-PR205A** (already queued) — cryptographic offline VP signing in wallet-sdk, which closes a related but separate gap.
