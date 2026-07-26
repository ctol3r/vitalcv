# W228-C4 — Domain Model Map

**Date:** 2026-06-21 · All types in `packages/domain-evidence/src`. Pure, serializable, no classes.

---

## 1. Evidence layer (`types.ts`)

```
EvidenceObject {
  evidenceId, subjectKey, evidenceClass, label, value,
  status, source, trustTier, decisionGrade,         // decisionGrade ⇔ status==='checked'
  observedAt, checkedAt, expiresAt, freshnessWindowHours,
  integrityHash, provenance, lifecycle, supersedes, supersededBy
}
EvidenceClass  (15)  identity | licensure | board_cert | registration | exclusion |
                     enrollment | privilege | peer_review | recognition | acceptance |
                     start | employment | research | publication | training
EvidenceStatus (9)   = CanonicalSourceCoverageState (trust-state) — only 'checked' is decision-grade
EvidenceLifecycle    active | superseded | revoked | expired
EvidenceSource       { sourceId, sourceLabel, laneType, governance }
EvidenceProvenance   { artifactIds[], receiptIds[], sourceUrl, checksum, parserVersion }
EvidenceRelationship { from, to, type, confidence, observedAt }   type(10): issued_by | verified_by |
                     derived_from | proven_by | supersedes | affiliated_with | trained_at |
                     works_at | accepted_by | attested_by
EvidenceCollection   { subjectKey, generatedFor, objects[], relationships[], byClass, coverageSummary }
```

## 2. Graph layer (`projectors/graph.ts`)

```
GraphNode {
  id, type, label, trustScore, evidenceSource, status,
  evidenceClass, decisionGrade, checkedAt, expiresAt, lifecycle
}
GraphNodeType (3)            subject | evidence | source
GraphRelationship            { id, from, to, type, evidenceId }
GraphRelationshipType (16)   HAS_IDENTITY | HOLDS_LICENSE | HOLDS_CERTIFICATION | HOLDS_REGISTRATION |
                             SCREENED_FOR_EXCLUSION | ENROLLED_IN | PRIVILEGED_AT | REVIEWED_BY |
                             RECOGNIZED_BY | ACCEPTED_BY | STARTED_AT | EMPLOYED_BY | AUTHORED |
                             TRAINED_AT | VERIFIED_BY | CERTIFIED_BY
GraphProjection              { subjectKey, nodes[], relationships[], stats }
statusTrustScore(status)     checked→1, stale→0.4, pending→0.2, reviewRequired→0.1, else→0  (monotonic)
```

## 3. Trust layer (`trust/propagate.ts`)

```
TrustDimension (7)   identity | authority | professional | research | leadership | institutional | mobility
DimensionTrust       { dimension, score|null, contributingCount, decisionGradeCount, supporting[], weakening[], origins[] }
TrustHistory         { entries[], reinforcementCount, decayCount, netDelta, trend }
TrustHistoryEntry    { occurredAt, type(reinforcement|decay), dimension, evidenceId, detail, scoreDelta }
TrustProjection      { subjectKey, overall{score|null, decisionGradeEvidence, totalEvidence}, dimensions[], history }
```

## 4. Timeline layer (`timeline/timeline.ts`)

```
CareerEventType (13)  identity_verification | licensure | certification | screening | enrollment |
                      recognition | acceptance | employment_start | employment | training |
                      privileging | peer_review | research
CareerEvent          { eventId, occurredAt, type, label, detail, evidenceId, evidenceSource,
                       trustImpact, trustDimension, mobilityImpact, recognitionImpact }
MobilityImpact        expands | reduces | none
RecognitionImpact     recognition | acceptance | start | none
ReputationStanding    established | emerging | provisional | unknown   (threshold over decision-grade evidence)
ReputationSummary     { overallTrust|null, decisionGradeEvidence, totalEvidence, reinforcementCount,
                        decayCount, trend, standing }
TimelineProjection    { subjectKey, events[], trustHistory, recognition[], reputation, firstAt, lastAt }
```

## 5. Invariant relationships (the load-bearing identities)

- `EvidenceObject.decisionGrade === (status === 'checked')` — enforced in `buildEvidenceCollection` (throws otherwise).
- `GraphNode.trustScore = statusTrustScore(status)` — monotonic, gated states = 0.
- `DimensionTrust.score = mean(contributing trustScores)` — bounded by max contributing (no inflation).
- `CareerEvent.trustImpact ∈ [−1, 1]` — checked→+score, decayed→−(1−score), else 0.
- `ReputationStanding === 'unknown'` ⇐ `decisionGradeEvidence === 0`.
- `EvidenceStatus ≡ CanonicalSourceCoverageState` — cannot drift (imported, not redeclared).
