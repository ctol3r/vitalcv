# Replay Identity Contract

**Status**: STABLE — version `v1`
**Owners**: replay-identity surface (backend + web)
**First shipped**: PR #343 (canonical), PR #344 (survivability tests), PR #351 (operational tooling), PR #352 (operator-visible panel)
**Related docs**: [`replay-survivability-matrix.md`](../architecture/replay-survivability-matrix.md)

This contract defines what `lineageKey` and `runId` mean across VitalCV.
Every system that emits, consumes, or compares these identifiers — backend
services, the web bundle, signed receipts, CLI tooling, future external
verifier integrations — MUST honour the rules below.

The contract exists because the identifiers are **survivability-by-construction**:
two implementations on two machines that follow this spec produce
byte-identical output for the same inputs. Drifting from the spec breaks
that property silently; verifiers comparing identifiers across systems
would see false drift, and the audit chain's "no silent corruption"
invariant would no longer hold.

---

## 1. Identifiers at a glance

| Identifier | Stability scope | Inputs |
|---|---|---|
| `lineageKey` | identity of the **subject** — every snapshot for the same entity forever | `entityId` alone |
| `runId` | identity of a **snapshot** — stable per evidence set, changes when evidence changes | `entityId` + `lastCheckedAt` + sorted artifact checksums + channel |

Both identifiers are versioned via a prefix (`lin_v1_…`, `run_v1_…`). The
prefix is part of the contract — clients use it to determine which
algorithm version produced the identifier.

---

## 2. Wire format (v1)

```
lineageKey  := "lin_v1_" + 16 lowercase hex characters
runId       := "run_v1_" + 16 lowercase hex characters
```

Both identifiers are exactly **23 ASCII characters**:

- 7-character scheme prefix (`lin_v1_` or `run_v1_`)
- 16 lowercase hex characters (first 64 bits of a SHA-256 digest)

Two type guards are exported alongside the generators:

```ts
isV1LineageKey(value: string): boolean
isV1RunId(value: string): boolean
```

Both check prefix + length only. They do NOT verify that the digest is
well-formed against the actual algorithm — that verification is the
caller's job (re-derive from inputs and compare).

---

## 3. Algorithm specification

The algorithm is **SHA-256 of a canonicalized payload string**, with the
first 8 bytes (16 hex chars) used as the identifier suffix.

### 3.1 `lineageKey`

```
canonical(entityId) := lowercase(trim(entityId))
payload             := "entity|" + canonical(entityId)
digest              := SHA-256(payload)
lineageKey          := "lin_v1_" + hex(digest)[0:16]
```

`canonical()` MUST throw if `entityId` is empty after trimming.

### 3.2 `runId`

```
canonical(entityId)   := lowercase(trim(entityId))
canonical(channel)    := lowercase(trim(channel ?? ""))
canonical(checksums)  := sort(filter(map(trim, checksums), len > 0), localeCompare).join(",")
canonical(checkedAt)  := checkedAt ?? "never"

payload := "entity|" + canonical(entityId)
        + "|checkedAt|" + canonical(checkedAt)
        + "|channel|" + canonical(channel)
        + "|artifacts|" + canonical(checksums)

digest := SHA-256(payload)
runId  := "run_v1_" + hex(digest)[0:16]
```

The payload field ordering is **load-bearing**: `entity → checkedAt →
channel → artifacts`. Changing the order would change every existing
identifier. Implementations MUST emit fields in exactly this order.

### 3.3 Reference implementations

| Layer | Module | Hash primitive |
|---|---|---|
| Backend | `apps/api/backend/src/services/replay/replayIdentity.ts` | `node:crypto.createHash('sha256')` |
| Web (browser) | `apps/web/lib/replay/clientReplayIdentity.ts` | `crypto.subtle.digest('SHA-256', …)` |

Both implementations MUST produce byte-identical output for the same
inputs. Parity is asserted by:

- `apps/api/backend/src/services/replay/__tests__/replayIdentity.test.ts` (PR #343, 24 cases — backend canonical)
- `apps/web/__tests__/replay-identity-parity.test.ts` (PR #352, 13 cases — web mirror)
- `apps/api/backend/src/services/replay/__tests__/replaySurvivability.test.ts` (PR #344, 20 cases — invariants)

Adding a third implementation (e.g. a Rust SDK or a mobile client) is
allowed only if the implementation passes the same parity test suite
against the v1 fixtures.

---

## 4. Normalization rules

| Input | Normalization | Effect on identifier |
|---|---|---|
| `entityId` whitespace (leading/trailing) | trimmed | none — same id |
| `entityId` case | lowercased | none — same id (e.g. `'ABC-DEF'` and `'abc-def'` collide intentionally) |
| `entityId` empty after trim | throw | identifier not produced |
| `channel` whitespace | trimmed | none |
| `channel` case | lowercased | none |
| `channel` `null` / `undefined` / `""` / whitespace-only | collapsed to `""` | all four inputs produce the same id |
| `lastCheckedAt` `null` | replaced with literal `"never"` | distinct from any real timestamp |
| `artifactChecksums` whitespace per element | trimmed | none |
| `artifactChecksums` empty/whitespace elements | dropped | element-count-only changes do not affect id |
| `artifactChecksums` ordering | sorted via `localeCompare` | order-invariant |
| `artifactChecksums` duplicates | **NOT** deduplicated by the generator | callers MUST dedupe upstream if dedupe is desired |

Whitespace and case normalization on `entityId` is intentional: it
prevents trivial cosmetic differences in the source (a manually-typed
NPI with leading space, an uppercased canonical id) from forking the
lineage of a single subject.

---

## 5. Canonicalization rules

The payload string emitted prior to hashing is the only invariant
between implementations. It MUST be canonicalized as follows:

| Concern | Rule |
|---|---|
| Field separator | exactly `|` (U+007C VERTICAL LINE) |
| Field label | the literal English-lowercase string from §3.2 |
| Encoding | UTF-8 (no BOM) |
| Line endings | none — payload is a single line |
| Trailing separator | none |
| Empty field marker for `channel` | empty substring (i.e. `|channel||`) |
| Sentinel for `null` `lastCheckedAt` | literal `"never"` |
| Artifact join separator | comma `,` (U+002C) |

The payload is **not** JSON. Using JSON would introduce ambiguity around
key ordering, whitespace, and number rendering. The flat
pipe-delimited form is unambiguous and language-agnostic.

---

## 6. Determinism guarantees

| Guarantee | Status |
|---|---|
| Same inputs → same output (within one process) | YES — pinned by `replayIdentity.test.ts` |
| Same inputs → same output across process restart | YES — pure function, no in-memory state |
| Same inputs → same output across deploys (same `v1`) | YES — scheme version embedded in prefix |
| Same inputs → same output across implementations (backend ↔ web) | YES — pinned by parity tests in PR #343 + PR #352 |
| Same inputs → same output across machines | YES — algorithm has no machine-local entropy (no random, no clock, no PID) |
| Same inputs → same output after node version upgrade | YES — `node:crypto` SHA-256 is stable; `crypto.subtle` SHA-256 is stable |

A regression in any of these is a contract violation. The mitigation is
always: **fix the regression, do NOT change the spec**.

---

## 7. Collision guarantees

| Collision class | Probability | Treatment |
|---|---|---|
| Two distinct subjects sharing the same `lineageKey` | ~2⁻⁶⁴ per pair (birthday paradox at ~4 billion subjects) | acceptable; the type guard catches malformed values, not legitimate collisions |
| Two distinct snapshots of the **same subject** sharing the same `runId` | possible only if all input fields are byte-identical (i.e. same evidence) | by-design — that IS the equality predicate |
| `lineageKey` of subject A == `runId` of subject B | impossible — prefixes differ (`lin_v1_` vs `run_v1_`) | trivial |
| v1 identifier colliding with a v2 identifier | impossible — prefixes differ (`*_v1_` vs `*_v2_`) | trivial |

The 64-bit truncation is a deliberate trade-off. The full 256-bit
digest would be cleaner but the truncated form is short enough to read
visually and copy/paste reliably. At 4 billion subjects, birthday
collision probability is ~50%; at audit-archive scales VitalCV expects
(low millions of subjects), the probability is negligible.

---

## 8. Degraded-state semantics

A "degraded" run is one where evidence collection failed partially or
entirely. The contract treats degraded runs as **first-class snapshots**:
they get a stable, deterministic `runId` derived from whatever inputs
WERE available, distinct from any complete-run id.

| Scenario | `lineageKey` | `runId` |
|---|---|---|
| `lastCheckedAt = null`, `artifactChecksums = []` | unchanged (subject is the same) | distinct deterministic id; recomputable; not a random fallback |
| `lastCheckedAt = null`, `artifactChecksums = [some]` | unchanged | distinct from same-artifacts-with-timestamp variant |
| `lastCheckedAt = ISO`, `artifactChecksums = []` | unchanged | distinct from same-timestamp-with-artifacts variant |
| `artifactChecksums = subset` (partial outage) | unchanged | distinct from full-set runId; subset can be reasoned about |

The verifier-facing consequence: **a verifier comparing two runIds for
the same lineageKey can tell a degraded snapshot apart from a complete
one** without out-of-band signaling, by recomputing the runId from the
inputs they have.

---

## 9. Survivability guarantees

Survivability is the property that the identifiers re-derive identically
after runtime turbulence (restart, deploy, partial persistence outage,
stale state recovery). The detailed contract lives in
[`replay-survivability-matrix.md`](../architecture/replay-survivability-matrix.md)
and is pinned by the 20-case simulation suite in
`apps/api/backend/src/services/replay/__tests__/replaySurvivability.test.ts`
(PR #344).

Summary table:

| Runtime event | `lineageKey` | `runId` |
|---|---|---|
| HTTP refresh | unchanged | unchanged |
| Backend process restart | unchanged | unchanged |
| Deploy (same `v1`) | unchanged | unchanged |
| Deploy (`v2` migration) | **changes** | **changes** |
| Partial persistence outage (subset of artifacts) | **unchanged** | **changes** |
| Degraded ingest (no artifacts) | unchanged | distinct deterministic id |
| Stale data recovered from cold storage | unchanged | unchanged from original write |
| Tampering with any input | varies | **always changes** |
| Artifact order changes in DB | unchanged | unchanged (normalized inside) |
| Cosmetic input drift (whitespace, case) | unchanged | unchanged |

---

## 10. Versioning strategy

### 10.1 When a version bump is REQUIRED

The scheme version (`v1`) MUST be bumped to `v2` (and so on) when ANY of
the following changes:

1. The set of input fields that contribute to the hash
2. The field ordering inside the payload string
3. The canonicalization rules (trim, case, sort, sentinel values)
4. The separator characters
5. The hash algorithm
6. The truncation length
7. The encoding (currently UTF-8)

Cosmetic changes that do NOT alter the bytes hashed (e.g. function
renames, comment edits, refactors that preserve output) do NOT require
a version bump.

### 10.2 What a version bump means operationally

- Every existing `lin_v1_…` and `run_v1_…` identifier remains valid
  forever. They are not retroactively migrated. Type guards still
  recognize them.
- New identifiers are emitted with the `v2` prefix.
- Both implementations (backend + web + any future SDK) MUST bump
  together. Skewed-version deploys would produce divergent ids for the
  same snapshot, breaking parity.
- Existing signed receipts continue to validate. The `kid` and JWKS
  remain unchanged — the version bump is about identifier derivation,
  not signing keys.
- A migration doc MUST accompany the version bump:
  `docs/contracts/replay-identity-v2-migration.md` (parallel to this
  doc), detailing what changed and how to compute parity against v1.

### 10.3 What CANNOT change without breaking the contract

- The semantic meaning of `lineageKey` (subject identity) — NEVER.
  If subject identity needs a different model, introduce a new
  identifier alongside `lineageKey`, do not redefine it.
- The semantic meaning of `runId` (snapshot identity) — NEVER.
- The 64-bit truncation reducing the visible identifier length — never
  shorter than 64 bits without compelling collision-resistance review.
  Longer is OK but breaks visual parity with existing identifiers.

### 10.4 Backward-compatibility commitments

A v1-issued identifier MUST remain recoverable forever. Concretely:

- The v1 algorithm code path remains in the codebase even after v2
  ships. New consumers may call only the latest version; existing
  archives are re-verifiable.
- Type guards for older versions remain exported.
- Test fixtures for v1 are not removed when v2 lands.

---

## 11. Test surface (where the contract is pinned)

| Test file | PR | Cases | What it pins |
|---|---|---|---|
| `apps/api/backend/src/services/replay/__tests__/replayIdentity.test.ts` | #343 | 24 | Backend canonical: shape, determinism, sensitivity, scheme-version guards |
| `apps/api/backend/src/services/replay/__tests__/replaySurvivability.test.ts` | #344 | 20 | Six runtime-turbulence scenarios + audit-chain integrity invariants |
| `apps/web/__tests__/passport-replay-identity.test.ts` | #343 | 8 | Web validator accepts the contract; rejects malformed values |
| `apps/web/__tests__/replay-identity-parity.test.ts` | #352 | 13 | Web mirror: shape contract + normalization invariance + determinism |
| `apps/web/__tests__/replay-scripts.test.ts` | #351 | 28 | CLI scripts honour the contract semantics |

Any change touching the algorithm MUST be accompanied by changes to
these tests. CI runs them all.

---

## 12. CLI verification

Three operational scripts under `scripts/replay/` (PR #351) verify the
contract against arbitrary evidence:

| Script | Purpose |
|---|---|
| `scripts/replay/verify-replay-integrity.ts` | Recomputes ids and asserts determinism + cosmetic invariance + sensitivity + optional expected-match |
| `scripts/replay/find-replay-gaps.ts` | Detects continuity gaps above `--max-gap-hours` threshold |
| `scripts/replay/reconcile-lineage.ts` | Compares two evidence candidates — same lineage? same snapshot? |

Operators run these against production-exported snapshot manifests as
part of integrity audits. The matching browser-side helpers
(`apps/web/lib/replay/integrityEvaluation.ts`, PR #352) render the same
findings inside the operator UI on `/passport/[id]`.

---

## 13. What this contract does NOT cover

The replay-identity contract scope is narrowly the `lineageKey` and
`runId` identifier algorithm. The following are out of scope:

- **Cryptographic signatures.** Signed receipts use ES256 over the
  passport payload — that's a separate contract owned by
  `apps/web/lib/crypto/receiptIssuer.ts` and the
  `.well-known/jwks.json` surface (PR #349).
- **DID issuance.** The issuer DID (`did:web:<origin>`) and its
  rotation strategy live in `.well-known/did.json` + the trust-register
  (PR #349). Receipts include both the runId (this contract) and the
  kid (signing contract); they are independent.
- **Storage.** This contract does not specify where ids are stored. They
  are recomputable from persisted inputs, so storage is an optimization,
  not a requirement.
- **Rendering.** UI conventions for displaying ids (truncation,
  monospace, copy-to-clipboard) are owned by the Lane B primitives
  (`<RunIdentity>`, `<ReplayIntegrityPanel>`, PR #341 + #352).

---

## 14. Future-engineer checklist

If you are about to touch any file in:

- `apps/api/backend/src/services/replay/`
- `apps/web/lib/replay/`
- `scripts/replay/`

Run this checklist:

- [ ] Is the change cosmetic (rename, refactor, comment)? → No version
      bump needed. Make sure every existing test still passes byte-for-byte.
- [ ] Is the change adding a new derived identifier or a new helper that
      consumes the existing ids? → Safe. Add tests pinning the new
      derivation; the existing identifiers are untouched.
- [ ] Is the change altering ANY of the items in §10.1 above? → **STOP**.
      You are bumping the scheme version. Read §10.2 carefully, write the
      v2 migration doc, ship parity tests against v1 fixtures, coordinate
      backend + web in one merge train.
- [ ] Is the change relaxing a guarantee in §6 or §7? → That is a
      contract amendment requiring an RFC, not a code change. The
      survivability test in #344 will fail and you should not make it pass
      by weakening the assertion.

---

## 15. References

| Document | Path | Purpose |
|---|---|---|
| Replay survivability matrix | `docs/architecture/replay-survivability-matrix.md` | Runtime-turbulence behavior |
| Production promotion protocol | `docs/ops/production-promotion-protocol.md` (PR #338) | 7-gate operator runbook; replay continuity gate is gate 5 |
| Knowledge trust graph | `docs/architecture/vitalcv-knowledge-trust-graph.md` | Broader trust ontology; replay identity is one node |

---

**Maintainer**: any change to this doc MUST be accompanied by a
corresponding change to the test surface in §11 and a commit message
that names the affected contract section.
