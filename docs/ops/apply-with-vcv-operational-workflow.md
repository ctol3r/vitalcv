# Apply-with-VCV Operational Workflow

**Wave:** W2-PR46A
**Status:** scaffold landed (composer + tests + CI gate); production wiring is a later wave
**Owner:** trust-platform

## Why this exists

Apply-with-VCV started as a distribution wedge: a clinician generates a
24-hour signed bundle, an employer reads it. The wedge proved the surface but
left four operational gaps that block real hiring use:

1. **No portable manifest.** The signed bundle, the replay lineage
   (`AuditBundle`), and the verifier audit packet are three independent
   artifacts. Nothing fuses them with a single content-addressable hash.
2. **No replay-safe verifier protocol.** Verifier requests are direct API
   calls; retries can produce different request IDs, and responses don't
   anchor to a replay artifact.
3. **No ambiguity preservation contract.** A `ReceiptCandidate` carries a
   literal `decisionGrade: false`. Nothing in the wedge prevents a downstream
   consumer from coercing that to `true` during JSON serialization, copy
   templating, or display.
4. **No CI gate.** Banned phrases from the truth contract (see CLAUDE.md
   "Banned strings") can land in apply surfaces if a reviewer misses them.

## What the composer does

`apps/api/backend/src/services/apply/applyOperationalWorkflow.ts` is a
**pure transform module** (no fetches, no DB writes — same constraint as the
issuer-verification helpers under `apps/web/lib/issuer-verification/`).

It exposes:

| Function | Input | Output | Replay-safety property |
|----------|-------|--------|------------------------|
| `composeApplicationManifest` | bundle + replay lineage + audit packet + trajectory + verifier context + ambiguity markers | `ApplicationManifest` with deterministic `manifestHash` | Same input → same hash, regardless of `generatedAt` |
| `verifyApplicationManifest` | manifest + optional `now` | `{ valid, reason, recomputedHash }` | Pure recomputation; reasons: `OK`, `HASH_MISMATCH`, `EXPIRED`, `AMBIGUITY_VIOLATION`, `BANNED_COPY` |
| `issueVerifierRequest` | verifier context + scope + replay anchor + (optional) idempotency key | `VerifierRequest` with deterministic `requestId` | Same content → same requestId; scope is sorted before hashing |
| `simulateWorkflowChaos` | manifest + chaos kind | `ChaosVerdict` | Used by tests; never reports `silent_degradation_detected` on a healthy composer |
| `findBannedPhrase` | string | `string | null` | Defense-in-depth banned-string scan |

### Determinism contract

`manifestHash` = `SHA-256(canonicalJson(content))` where `content` excludes:

- `manifestId` (derived from the hash)
- `manifestHash` itself
- `generatedAt` / `expiresAt` (metadata)
- `signature` (caller-applied)

`canonicalJson` recursively sorts object keys; arrays preserve order
(semantic ordering is the caller's responsibility, e.g. trust trajectory
points should be sorted by `capturedAt` upstream).

### Ambiguity preservation contract

The composer **refuses** to emit a manifest if any `AmbiguityMarker` of kind
`receipt_candidate` or `psv_receipt_candidate` arrives with `decisionGrade !==
false`. Verification recomputes this check, so a manifest cannot be tampered
post-composition without being rejected.

This is enforced both at compose time (throws) and at verify time (returns
`AMBIGUITY_VIOLATION`). A JSON round-trip preserves the literal `false`.

### Replay-safe verifier requests

Every `VerifierRequest` carries:

- `requestId` derived deterministically from `verifierContext + sortedScope +
  replayAnchor + idempotencyKey`.
- `replayAnchor: { kind: 'CAPSULE' | 'BUNDLE' | 'MANIFEST', id, hash }` — the
  responder MUST echo this anchor in its response so downstream consumers can
  re-verify.
- `replaySafety.idempotencyContract: 'CONTENT_BOUND'` — within
  `idempotencyWindowSeconds` (default 24h, matching bundle TTL), retries with
  the same content yield the same response.

If a verifier omits `idempotencyKey`, the composer derives one from
`(verifierOrgId, sortedScope, replayAnchorId, replayAnchorHash)`. This means
even uncoordinated retries are idempotent.

## Audit events

Three new event-type families added in
`apps/api/backend/src/types/auditEventTypes.ts`:

```ts
export type ApplyWorkflowEventType =
  | 'APPLY_MANIFEST_COMPOSED'
  | 'APPLY_MANIFEST_EXPORTED'
  | 'APPLY_MANIFEST_VERIFIED'
  | 'APPLY_MANIFEST_REJECTED'
  | 'CREDENTIAL_SHARED'
  | 'CREDENTIAL_SHARE_REVOKED'
  | 'VERIFIER_REQUEST_ISSUED'
  | 'VERIFIER_REQUEST_ACCEPTED'
  | 'VERIFIER_REQUEST_DECLINED';
```

Wiring these to actual `appendAuditEvent` calls is intentionally out of
scope for this wave — the composer is a pure transform; persistence is the
caller's responsibility (and persistence is gated by TRUST-PERSIST-1).

## CI gate

`.github/workflows/apply-with-vcv-gate.yml` runs on PRs that touch any apply
surface. Two jobs:

1. **`banned-strings`** — `node scripts/apply-with-vcv-banned-strings.mjs`
   walks the apply surface tree and fails if any banned phrase appears in a
   non-allowlisted file. The script itself, the composer source, and the
   composer test file are allowlisted because they store split-join'd
   banned phrases as canonical constants.
2. **`workflow-tests`** — runs the 38-case Jest suite covering determinism,
   ambiguity, banned-copy, replay-safety, and chaos.

## Workflow chaos coverage

The chaos simulator exercises seven perturbations and asserts that the
workflow either invalidates loudly or holds clean — never silently degrades:

| Chaos kind | Expected verdict |
|------------|------------------|
| `tamper_bundle_signature` | `manifest_invalidated` |
| `tamper_replay_hash` | `manifest_invalidated` |
| `tamper_ambiguity_grade` | `manifest_invalidated` |
| `tamper_presentation_copy` | `manifest_invalidated` |
| `expire_anchor` | `manifest_invalidated` |
| `duplicate_request_with_drift` | `verifier_request_diverged` |
| `drop_audit_packet` | `manifest_held_clean` (hash differs) |

## What's deferred

- **Persistence wiring.** A `prisma.applicationManifest` table + write path
  is gated on TRUST-PERSIST-1.
- **Cross-tenant authorized-share verdict.** `tenantIsolation.ts` does not
  yet model `CROSS_TENANT_AUTHORIZED_SHARE` / `DELEGATION_APPROVED` — the
  composer represents these as `verifierContext` metadata only.
- **DID / OIDC federation.** External verifiers cannot cryptographically
  anchor the lineage; that is a Knowledge Trust Graph extension.
- **End-to-end "export → re-import → apply" round-trip test** with a real
  peer org. The chaos simulator covers the same surfaces but in-process.

## Truth contract notes

This wave does **not** change any of the issuer-verification literals
(`decisionGrade: false`, `proofTier: 'receipt_candidate'`, etc.). It also
does not introduce any new banned strings or weaken any existing copy
guards. The composer is purely additive over the wedge.
