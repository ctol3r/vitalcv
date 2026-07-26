# W215-C3 — `packages/domain-evidence` Architecture

**Wave:** 215 · **Depends on:** [C1](./C1-implementation-analysis.md), [C2](./C2-evidence-migration-map.md)
**Date:** 2026-06-20
**Status:** implementation-ready architecture. **NO IMPLEMENTATION YET.**

---

## 0. Package intent

`packages/domain-evidence` is a **typed facade + pure normalizers** over evidence that already exists across `packages/domain-common`, `packages/source-adapters`, `packages/trust-state`, `packages/audit`, and the Prisma store. It introduces *no new persistence*. It follows the repo's existing package conventions: `isolatedModules: true`, barrel re-exports with the `type` keyword, ships from `dist/` (turbo-prebuilt like `@vitalcv/trust-state`).

**Hard rule:** every function here is a **pure transform** — no fetches, no DB writes, no audit-event writes (same discipline as `lib/issuer-verification/*`). It normalizes; it never verifies.

## 1. Proposed structures

### `EvidenceObject`
```ts
interface EvidenceObject {
  evidenceId: string;            // stable id (reuse claimId / receiptId / credential id)
  subjectKey: string;            // VcvEntity.canonicalId or NPI — the addressing key
  evidenceClass: EvidenceClass;
  label: string;                 // human label ("California RN License")
  value: EvidenceValue;          // normalized scalar/record from the source claim
  status: EvidenceStatus;        // derived, never upgraded
  source: EvidenceSource;
  trustTier: string | null;      // reuse existing trustTier vocabulary
  decisionGrade: boolean;        // === status maps to 'checked'; never widened
  observedAt: string | null;     // when the source authority last updated
  checkedAt: string | null;      // when VitalCV checked
  expiresAt: string | null;      // freshness boundary
  freshnessWindowHours: number | null;
  integrityHash: string | null;  // checksum / rawHash / integrityHash
  provenance: EvidenceProvenance; // artifactIds[], receiptIds[], sourceUrl, parserVersion
  lifecycle: EvidenceLifecycle;   // active | superseded | revoked | expired
  supersedes: string | null;      // prior evidenceId
  supersededBy: string | null;    // newer evidenceId
}
```

### `EvidenceClass` (discriminated union — the unifier from C2 §4)
```ts
type EvidenceClass =
  | 'identity' | 'licensure' | 'board_cert' | 'registration' | 'exclusion'
  | 'enrollment' | 'privilege' | 'peer_review'
  | 'recognition' | 'acceptance' | 'start' | 'employment'
  | 'research' | 'publication' | 'training';
```

### `EvidenceStatus` (re-projection of existing vocabularies — no new states invented)
```ts
// 1:1 with CanonicalSourceCoverageState; decision-grade === 'checked' only.
type EvidenceStatus =
  | 'checked' | 'stale' | 'pending' | 'gated' | 'unavailable'
  | 'accessRequired' | 'reviewRequired' | 'notDecisionGrade' | 'previewOnly';
```

### `EvidenceSource`
```ts
interface EvidenceSource {
  sourceId: string;              // 'NPPES_API', 'OIG_LEIE', 'STATE_BOARD', 'ORCID', …
  sourceLabel: string;
  laneType: string | null;       // reuse source-adapters LaneType
  governance: string | null;     // reuse sourceGovernance (open | gated | human_lookup_only)
}
```

### `EvidenceRelationship`
```ts
type EvidenceRelationshipType =
  | 'issued_by' | 'verified_by' | 'derived_from' | 'proven_by'
  | 'supersedes' | 'affiliated_with' | 'trained_at' | 'works_at'
  | 'accepted_by' | 'attested_by';   // subset of existing GraphEdge EdgeType

interface EvidenceRelationship {
  from: string;                  // evidenceId or subjectKey
  to: string;                    // evidenceId, sourceId, or entity key
  type: EvidenceRelationshipType;
  confidence: number | null;
  observedAt: string | null;
}
```

### `EvidenceCollection`
```ts
interface EvidenceCollection {
  subjectKey: string;
  generatedFor: { displayName: string; npi: string | null };
  objects: EvidenceObject[];
  relationships: EvidenceRelationship[];
  byClass: Record<EvidenceClass, EvidenceObject[]>;  // convenience rollup
  coverageSummary: Record<EvidenceStatus, string[]>; // reuse summarizeCanonicalSourceCoverage
}
```

## 2. Proposed module layout

```
packages/domain-evidence/
  src/
    types.ts                 // the structures above (types only)
    normalize/
      fromVcvCredential.ts   // VcvCredential        → EvidenceObject
      fromClaimRecord.ts     // ClaimRecord          → EvidenceObject
      fromVerificationArtifact.ts
      fromReceipt.ts         // VerificationReceiptRecord/PsvReceipt → provenance
      fromRecognitionPath.ts // Recognition/Acceptance/Start → EvidenceObject (read-only)
      status.ts              // CanonicalSourceCoverageState → EvidenceStatus (identity map)
    collection.ts            // buildEvidenceCollection(inputs) — pure assembler
    index.ts                 // barrel (export type { … })
  package.json               // name @vitalcv/domain-evidence, build → dist/
  tsconfig.json              // isolatedModules: true
```

## 3. Dependencies (consume, never fork)

- `@vitalcv/trust-state` — `CanonicalSourceCoverageState`, `summarizeCanonicalSourceCoverage`, `createCanonicalSourceCoverage`, freshness/provenance helpers. **`EvidenceStatus` is literally the coverage state vocabulary.**
- `@vitalcv/domain-common` — `RecognitionEvent`/`EmployerAcceptance`/`StartAttestation`, `AuthorityCredential`, PSV contracts.
- `@vitalcv/source-adapters` — `Claim`, `SourceCheckResult`, `LaneType`.
- `@vitalcv/audit` — types only (timeline lives in C4, not here).

`domain-evidence` does **not** import Prisma or any app — adapters take already-fetched records as input (purity). The *fetching* lives in app/service code that calls these normalizers (parallels how `career-packet.ts` takes a hydrated `PassportData`).

## 4. Invariants enforced inside the package (unit-tested)

1. **No status upgrade.** `status.ts` is an identity map; a `gated` input can never become `checked`. Tested against a gated fixture.
2. **decisionGrade ⇔ checked.** `decisionGrade === (status === 'checked')`, never widened (mirrors the issuer truth contract).
3. **No bare `Verified` label.** `label`/status renders use honest vocabulary; serialized output passes the banned-label assertion.
4. **Recognition normalizers are read-only.** They never construct a `VerifiedCanonicalPath`; they project an already-verified path into evidence view.
5. **Pure.** No I/O; deterministic given inputs (no `Date.now()` inside derivations — timestamps come from the records).

## 5. Why a facade, not a new model (decision record)

A new `Evidence` table would duplicate `ClaimRecord`/`VerificationArtifact` and create a dual-write integrity problem against append-only, hash-anchored stores. The facade:
- ships in W220 with **zero data migration**,
- keeps a single source of truth for persisted evidence,
- lets `EvidenceObject` evolve as a *view* while storage stays stable,
- is reversible (delete the package; nothing downstream breaks because it's additive).

If a future wave needs a materialized evidence index for query performance, that is a separate, gated decision (parallels `evaluateBackendPersistenceReadiness`'s `defer_until_contract_aligned` default) — **not** part of W220.

**Deliverable status:** complete (architecture only). Proceed to C4.
