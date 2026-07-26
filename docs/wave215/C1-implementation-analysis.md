# W215-C1 — Implementation Analysis (Repository Discovery)

**Wave:** 215 (Career Evidence Foundation) · **Role:** Claude Code
**Date:** 2026-06-20
**Scope:** how today's Passport evolves into the Career Evidence Network — *implementation strategy only, no doctrine, no redesign.*

---

## 0. Thesis

**The Career Evidence Network is ~70% already in the repository — as primitives, not as a named layer.** Evidence objects, professional-memory timelines, a graph engine, and entity/relationship persistence all exist today under different names. The W220–270 job is **unification, naming, and a thin read-API facade** over these primitives — *not* building a new platform. This is the single most important input to the roadmap: it converts "build the Career Evidence Network" into "expose and unify what already verifies clinicians."

The recruiter value shipped in W205 (`/packet/[entityId]`, `deriveRecruiterRollup`) must be preserved as the stable read-surface while the substrate is unified underneath.

---

## 1. Existing evidence-like structures (already in repo)

| Concept | Where | Notes |
|---|---|---|
| **Atomic claim** | `packages/source-adapters/src/claim-engine.ts` → `Claim`; persisted as `ClaimRecord` (Prisma) | claimId, claimType, value, source, observedAt, confidence, trustTier, validFrom/validUntil, supersededBy. This is already an evidence object. |
| **Source check result** | `packages/source-adapters/src/types.ts` → `SourceCheckResult` | sourceId, laneType, status, claims[], limitations[], matchBasis, rawHash, parserVersion. |
| **Cryptographic receipt** | `ProofManifest.receipts` (`SourceReceipt`); persisted as `VerificationReceiptRecord` + `PsvReceipt` (Prisma) | receiptId, rawHash, checksum, integrityHash, rawArtifactRef (S3/IPFS), trustTier, expiresAt. |
| **Multi-source artifact** | Prisma `VerificationArtifact` | source, status, checksum, verifiedAt, expiresAt, lifecycleState, revokedAt, supersededByArtifactId, generation — full lifecycle + supersession already modeled. |
| **Canonical truth** | `packages/trust-state` → `CanonicalTruth` / `CanonicalTruthSet` | identity/safety/authority/eligibility dimensions, decisionGrade, coverage. |
| **Source coverage** | `packages/trust-state` → `CanonicalSourceCoverage` | state, freshness window, provenance (artifactIds, receiptIds, checksum, parserVersion). |
| **Credential** | Prisma `VcvCredential` | domain (NPI_IDENTITY, STATE_LICENSE, BOARD_CERT, DEA, OIG_EXCLUSION), status, verificationLevel, claimValue, artifactIds, jurisdiction. |
| **Recognition path** | `packages/domain-common/employmentContracts.ts` + Prisma `Recognition`/`Acceptance`/`Start` | the canonical Recognition→Acceptance→Start chain, signed, hash-anchored, type-branded `VerifiedCanonicalPath`. |
| **Evidence bundle** | `packages/domain-common` → `EvidenceBundleManifest`, `EvidenceBundleResult` | already a "collection of checks" object. |
| **Career packet (UI)** | `apps/web/lib/packet/career-packet.ts` (W205) | `CareerPacketModel` is an *evidence-collection view* over a passport. |

**Finding:** there is no single `EvidenceObject` type, but there are at least **six** structurally-equivalent evidence representations (`Claim`, `ClaimRecord`, `VerificationArtifact`, `VerificationReceiptRecord`, `PsvReceipt`, `VcvCredential`). They share a common spine: *subject + type + value + source + observedAt + freshness + integrity hash + supersession*.

## 2. Existing professional-memory / timeline structures

| Concept | Where | Ordering key |
|---|---|---|
| **Immutable audit log** | `packages/audit/AuditEvent.ts` (27 event types incl. RECOGNITION/ACCEPTANCE/START/PSV_RECEIPT/TRUST_STATE_*) | `occurred_at` (RFC3339), deep-frozen |
| **Audit timeline + packet** | `packages/audit/AuditScrapbook.ts` → `AuditTimelineEntry`, `AuditPacket` (NCQA-tagged, SHA256 of timeline) | chronological, immutable |
| **Append-only ingest log** | Prisma `IngestEvent` (unique `(ingestRunId, sequence)`) | `sequence` — guaranteed ordering |
| **Change events** | Prisma `EntityChangeEvent` (new/updated/deleted/revoked, previous/current value) | `observedAt` |
| **Watchtower event store** | `core/watchtower/eventStore.ts` → `WatchtowerEvent`, `WatchtowerClaimDelta`, replay-safe hashing | `occurredAt` / `detectedAt` |
| **Trust history** | `core/investigation/investigationEngine.ts` → `TrustTimelinePoint[]` (score, delta, trigger, band) | `recordedAt` |
| **Storyline timeline** | `core/storylines/storylineTimeline.ts` → `StorylineTimeline` (origin/update/quiet/escalated events, decay, dedupe by content-hash eventKey) | `occurredAt` |
| **Trust-state preview** | `packages/trust-state/TrustStateResolver.ts` → `TrustTimelinePreviewEntry`, `audit_timeline.buildTimeline()` | `occurred_at` |

**Finding:** "Professional Memory" is **already an event-sourced reality**, fragmented across `packages/audit`, `core/watchtower`, `core/storylines`, and Prisma append-only tables. A Career Timeline is a *projection/merge* over these, not a new store.

## 3. Existing graph structures

| Concept | Where |
|---|---|
| **Production graph schema** | `apps/web/components/graph-system/types.ts` → `GraphNode` (21 node types: clinician, organization, credential, license, receipt, source, claim, artifact, …), `GraphEdge` (35 `EdgeType`s incl. issued_by, verified_by, accepted_by, attested_by, trained_at, works_at, sourced_from, derived_from) |
| **Graph render components** | `components/graph/TrustGraphPrimary.tsx`, `components/graph/LiveTrustGraph.tsx` |
| **Backend graph API (live)** | `/api/graph/global|local|mobile`, `/api/graph/node/:id/neighbors`, `/api/graph/search`, `/api/graph/:npi`, `/api/graph/live/:npi`, `/api/graph/ai-links/suggest|apply` (22+ routes) |
| **Persisted edges** | Prisma `VcvEntityRelationship` (typed: LICENSED_BY, WORKS_FOR, EMPLOYED_BY; confidence, tier, validity dates) |
| **Doc-grade ontology** | `docs/architecture/vitalcv-knowledge-trust-graph.json` — 94 nodes / 96 edges / 82 rules (documentation-grade only, **not** wired into runtime types) |

**Finding:** the Career Evidence Graph **substrate already exists and serves traffic**. The gap is that its node/edge taxonomy (`graph-system/types.ts`) and the canonical ontology (`knowledge-trust-graph.json`) are not reconciled, and evidence objects are not yet first-class graph nodes everywhere.

## 4. Entity & API substrate

- **Entity:** Prisma `VcvEntity` (deterministic `canonicalId = sha256(entityType + primaryKey)`, npi, metadata), `VcvEntityRole`, `VcvEntityRelationship`, `VcvCredential`. Service: `entityResolutionService.ts`, `passportService.ts`.
- **Live APIs:** `/api/entity/:id`, `/api/entity/:id/relationships`, `/api/passport/:npi(/trust|/disclose)`, `/api/employer-review/:entityId/*`, `/api/graph/*`, `/api/storylines`, `/api/intelligence/mobility`, `/api/audit/bundle/:npi`.
- **Versioning:** 15+ `vitalcv.*.v1` schema strings; 53+ Prisma migrations. Established pattern for additive, versioned contracts.

## 5. Reusable primitives (build on, don't replace)

1. `packages/trust-state` factories — `createCanonicalSourceCoverage`, `createCanonicalTruth`, `deriveReadinessState`, freshness/provenance. **The normalization core for any EvidenceObject.**
2. `ClaimRecord` + `VerificationReceiptRecord` (Prisma) — the canonical persisted evidence + proof pair.
3. `packages/audit` + `core/watchtower` — the event spine for Professional Memory.
4. `graph-system/types.ts` + `/api/graph/*` — the graph engine.
5. `career-packet.ts` (W205) — the recruiter read-view to protect.
6. `VcvEntity` canonicalId — the stable subject key for evidence/timeline/graph addressing.

## 6. Architectural constraints (must hold across W220–270)

1. **Partial stays partial** (Trust Graph Rule 5) — no aggregation/graph/timeline layer may upgrade proof tier.
2. **Decision-grade = `checked` only**; gated/stale/notDecisionGrade never count positively (`assertNonGatedIfPositive`).
3. **Audit writes are server-only, transaction-coupled, append-only, immutable** (deep-frozen; `recordedBy: 'demo'` for demo surfaces).
4. **Issuer-verification helpers stay pure** — no fetches/writes; EvidenceObject normalizers follow the same rule.
5. **Recognition→Acceptance→Start is type-branded and immutable** — `VerifiedCanonicalPath` cannot be bypassed.
6. **Zero PHI on-chain / in exports.**
7. **Banned strings + no bare `Verified`** — every new public/API string crosses `pnpm check:claims` + `banned-verified-label.test.ts`.
8. **Recruiter value is the load-bearing surface** — `/packet/[entityId]` + `deriveRecruiterRollup` must not regress while the substrate unifies.

## 7. Migration opportunities (feeds C2–C7)

- **EvidenceObject as a read-facade** over `ClaimRecord`/`VerificationArtifact`/`VcvCredential`/receipts — a normalizer, not a new table (C2, C3).
- **Career Timeline as a projection** merging `AuditEvent` + `EntityChangeEvent` + `StorylineTimeline` + recognition events by subject + time (C4).
- **Career Evidence Graph as a typed view** reconciling `graph-system/types.ts` with the canonical ontology and promoting evidence objects to nodes (C5).
- **Thin read-only APIs** (`/evidence`, `/timeline`, `/recognition`, `/mobility`, `/graph`) that compose existing services — mostly aggregation endpoints (C6).

**Deliverable status:** complete. Proceed to C2 (Evidence Migration Map).
