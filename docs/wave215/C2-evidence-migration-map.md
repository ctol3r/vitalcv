# W215-C2 — Evidence Migration Map

**Wave:** 215 · **Depends on:** [C1](./C1-implementation-analysis.md)
**Date:** 2026-06-20

Maps today's objects to the future evidence model. Verdict per row: **REUSE** (wrap, no schema change), **NORMALIZE** (adapter into EvidenceObject), **CREATE** (genuinely new).

---

## 1. The common evidence spine (already implicit)

Every evidence-like object in the repo shares this shape — the future `EvidenceObject` simply names it:

```
subjectKey  + evidenceClass + value + source + observedAt + checkedAt
            + freshnessWindow + integrityHash + trustTier + status
            + supersession(prev/next) + provenance(artifactIds, receiptIds)
```

`ClaimRecord` already carries all of these fields. **`EvidenceObject` is `ClaimRecord` + a discriminated `evidenceClass` and a normalized status — not a new store.**

## 2. Object → Evidence mapping

| Today | Future | Verdict | Basis |
|---|---|---|---|
| `VcvCredential` (license/board/DEA/NPI/OIG) | `EvidenceObject{class: licensure\|board_cert\|identity\|registration\|exclusion}` | **NORMALIZE** | Has domain, status, verificationLevel, claimValue, artifactIds, jurisdiction. One adapter. |
| `ClaimRecord` (Prisma) | `EvidenceObject` (canonical persisted form) | **REUSE** | Already the spine. EvidenceObject is a typed view over it. |
| `VerificationArtifact` | `EvidenceSource` + raw evidence backing an EvidenceObject | **NORMALIZE** | source, checksum, lifecycleState, supersededBy, generation → maps to EvidenceSource + lifecycle. |
| `VerificationReceiptRecord` / `PsvReceipt` | `EvidenceProof` (the cryptographic backing of an EvidenceObject) | **REUSE** | receiptId, rawHash, checksum, integrityHash, expiresAt — proof layer. |
| `SourceCheckResult` / `Claim` (adapters) | runtime producer of `EvidenceObject`s | **REUSE** | claim-engine already emits atomic, sourced claims. |
| `CanonicalSourceCoverage` (trust-state) | `EvidenceStatus` + freshness + provenance on an EvidenceObject | **REUSE** | state vocabulary (checked/stale/gated/…) becomes `EvidenceStatus`. |
| `CanonicalTruth` (identity/safety/authority/eligibility) | `EvidenceClass` grouping / dimension rollup | **REUSE** | dimensions already classify evidence. |
| `RecognitionEvent` / `EmployerAcceptance` / `StartAttestation` | `EvidenceObject{class: recognition\|acceptance\|start}` (employment evidence) | **NORMALIZE (read-only)** | Already signed + hash-anchored. Expose as evidence; do NOT relax `VerifiedCanonicalPath` branding. |
| `AuthorityCredential`, `OPPECaseRecord`, `FPPERecord` | `EvidenceObject{class: privilege\|peer_review}` | **NORMALIZE** | Privileging evidence classes. |
| `ResearchActivityScore`, `OrcidProfile`, `PubMedArticle`, `ClinicalTrialRecord` | `EvidenceObject{class: research\|publication}` | **NORMALIZE** | Already structured; thin adapters. |
| `EvidenceBundleManifest` | `EvidenceCollection` (typed bundle) | **NORMALIZE** | Already a collection of checks. |
| `PassportData` | `EvidenceCollection` (the canonical collection view) | **NORMALIZE** | Passport = the per-entity collection. `career-packet.ts` already projects it. |
| `CareerPacketModel` (W205) | `EvidenceCollection` recruiter projection | **REUSE** | Keep as the recruiter read-view. |

## 3. EvidenceRelationship mapping

| Today | Future relationship | Verdict |
|---|---|---|
| `VcvEntityRelationship` (LICENSED_BY, WORKS_FOR, EMPLOYED_BY) | `EvidenceRelationship` (entity↔entity) | **REUSE** |
| `GraphEdge.type` (issued_by, verified_by, accepted_by, attested_by, trained_at, sourced_from, derived_from) | `EvidenceRelationship` (evidence↔source / evidence↔entity) | **REUSE** |
| `ClaimRecord.supersededByClaimId` / `VerificationArtifact.supersededByArtifactId` | `EvidenceRelationship{type: supersedes}` | **REUSE** |
| `Claim.sourceCheckId`, `VerificationReceiptRecord.claimRecordId` | `EvidenceRelationship{type: proven_by / derived_from}` | **REUSE** |

## 4. What must actually be CREATED (small)

1. **`EvidenceClass` enum** — the unifying discriminator (identity, licensure, board_cert, registration, exclusion, enrollment, recognition, acceptance, start, privilege, peer_review, research, publication, employment). New, but pure type.
2. **`EvidenceStatus` enum** — a thin re-projection of `CanonicalSourceCoverageState` + lifecycle (active/superseded/revoked/expired). New, but derives from existing vocabularies.
3. **Normalizer adapters** — pure functions `fromVcvCredential()`, `fromClaimRecord()`, `fromRecognitionEvent()`, `fromVerificationArtifact()`. New code, no new storage.
4. **`EvidenceCollection` assembler** — `buildEvidenceCollection(entityKey)` composing normalizers (parallels `buildCareerPacket`).
5. **Thin read APIs** (C6) — aggregation endpoints only.

**Nothing in this list requires a new persistence model in W220.** Storage already exists (`ClaimRecord`, `VerificationArtifact`, receipts, `VcvCredential`, recognition tables). The migration is a *typed facade + adapters*, shippable without a data migration.

## 5. Backwards-compatibility guarantees

- `PassportData`, `career-packet.ts`, `/packet/[entityId]`, `/api/passport/*`, `/api/employer-review/*` **unchanged**. EvidenceObject is additive and read-only in W220.
- No relaxation of `VerifiedCanonicalPath`, audit immutability, or partial-stays-partial.
- EvidenceObject adapters are pure (no fetches/writes), mirroring `lib/issuer-verification/*`.

## 6. Sequencing hint for W220

1. Define `EvidenceObject` / `EvidenceClass` / `EvidenceStatus` / `EvidenceRelationship` / `EvidenceSource` types in `packages/domain-evidence` (C3) — types only.
2. Write the four normalizer adapters + unit tests proving every adapter preserves source state honestly (no upgrade).
3. `buildEvidenceCollection(entityKey)` over existing services.
4. `GET /evidence/:entityId` read API returning the collection.

**Deliverable status:** complete. Proceed to C3.
