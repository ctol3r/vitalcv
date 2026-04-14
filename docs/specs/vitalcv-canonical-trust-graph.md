# VitalCV Canonical Trust Graph

## Purpose

Define one deterministic graph contract for VitalCV trust data.

This graph is for trust state, evidence lineage, and decision provenance only.
It is not the knowledge graph, content graph, or UI layout graph.

## Hard Rules

1. Deterministic mapping only. Every node and edge must be reproducible from canonical inputs.
2. No duplication. Do not create summary nodes or shortcut edges when a first-order record already exists.
3. No circular ambiguity. Persist directed edges only. Reverse traversal is a query concern, not a storage concern.
4. First-order lineage wins. Claims, receipts, artifacts, source records, and decisions must connect through their real upstream dependencies.
5. Fail closed. If an upstream dependency cannot be resolved, keep the node with an integrity flag instead of fabricating a relationship.

## Canonical Layers

The persisted trust graph is a DAG with a fixed layer order:

1. `authority`
   `clinician` | `organization` | `source`
2. `evidence`
   `source_record` | `artifact` | `receipt` | `claim`
3. `signal`
   `finding` | `storyline` | `prediction`
4. `decision`
   `decision_recommendation` | `decision_capsule` | `recognition` | `acceptance` | `start`

`depends_on` may only point from a later layer to an earlier layer, except `storyline -> finding`, `acceptance -> recognition`, and `start -> acceptance`.

## Canonical Node Schema

```ts
type TrustGraphNodeKind =
  | 'clinician'
  | 'organization'
  | 'source'
  | 'source_record'
  | 'artifact'
  | 'receipt'
  | 'claim'
  | 'finding'
  | 'storyline'
  | 'prediction'
  | 'decision_recommendation'
  | 'decision_capsule'
  | 'recognition'
  | 'acceptance'
  | 'start';

type TrustGraphLayer = 'authority' | 'evidence' | 'signal' | 'decision';

interface TrustGraphNode {
  id: string;
  canonicalKey: string;
  kind: TrustGraphNodeKind;
  layer: TrustGraphLayer;
  subtype: string | null;
  label: string;
  status: string | null;
  confidence: number | null;
  trustTier: string | null;
  observedAt: string | null;
  issuedAt: string | null;
  effectiveAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  sourceRef: {
    table: string;
    rowId: string | null;
    naturalKey: string;
  };
  sourceRefs: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
```

### Node identity rules

`id` and `canonicalKey` must be derived from stable business identity, not display labels and not synthetic UI grouping.

| Kind | Canonical identity |
| --- | --- |
| `clinician` | `npi:{npi}` |
| `organization` | `organization:{id}` when internal, else `external_org:{normalized-employer-key}` |
| `source` | `source:{sourceId}` |
| `source_record` | `source_record:{sourceId}:{subjectNpi}:{checksum}` |
| `artifact` | `artifact:{subjectNpi}:{source}:{artifactType}:{checksum}`; prefer `sourceRecordId` in the hash when present |
| `receipt` | `receipt:{hash(claimId,field,sourceArtifactId|verificationArtifactId,integrityHash|checksum|value,parserVersion)}` |
| `claim` | `claim:{claimId}` |
| `finding` | `finding:{findingId}` |
| `storyline` | `storyline:{storylineKey}` |
| `prediction` | `prediction:{predictionId}` |
| `decision_recommendation` | `decision_recommendation:{actionId}` |
| `decision_capsule` | `decision_capsule:{id}` |
| `recognition` | `recognition:{recognitionId}` |
| `acceptance` | `acceptance:{acceptanceId}` |
| `start` | `start:{startId}` |

### Node normalization rules

1. `subtype` carries the domain subtype:
   claim type, source id, artifact type, decision type, finding type, prediction type.
2. `status` is the native domain status, not a UI color.
3. `sourceRef.naturalKey` is mandatory even when a row id exists.
4. `sourceRefs` contains all contributing record ids when multiple rows collapse into one logical node.
5. `metadata` may enrich a node, but never replace a missing relationship.

## Canonical Edge Schema

```ts
type TrustGraphEdgeType =
  | 'about'
  | 'issued_by'
  | 'depends_on'
  | 'follows'
  | 'supersedes'
  | 'affiliated_with';

interface TrustGraphEdge {
  id: string;
  canonicalKey: string;
  type: TrustGraphEdgeType;
  sourceNodeId: string;
  targetNodeId: string;
  status: 'active' | 'superseded' | 'inactive';
  confidence: number | null;
  evidenceRef: string | null;
  explanation: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
```

### Edge semantics

| Type | Direction | Meaning |
| --- | --- | --- |
| `about` | record -> canonical subject | The node is about this modeled subject node |
| `issued_by` | record -> authority | The node was emitted by this organization or source |
| `depends_on` | downstream -> upstream | The source node cannot be validated or reconstructed without the target node |
| `follows` | later event -> prior event | Canonical path sequencing only |
| `supersedes` | newer node -> older node | Deterministic replacement lineage |
| `affiliated_with` | clinician -> organization | Durable membership or institutional affiliation only |

### Edge rules

1. Persist directed edges only.
2. Never persist reciprocal mirrors.
3. Never store summary shortcuts like `clinician -> source`, `clinician -> organization accepted_by`, or `claim_type summary -> clinician`.
4. `depends_on` must encode real lineage, not inferred relevance.
5. If both a direct and indirect path exist, keep only the first-order direct relationship from the source record.

## Canonical Mapping

### 1. Authority layer

#### `clinician`

Primary source:
- `PersonProfile.npi`
- fallback: `VerificationArtifact.npi`, `ClaimRecord.subjectNpi`, `DecisionCapsule.subjectNpi`

Rules:
- One clinician node per NPI.
- `PersonProfile` is enrichment, not identity authority.
- No separate DID node in the trust graph. DID remains metadata until there is a stable DID-first use case.

#### `organization`

Primary source:
- `Organization.id`
- fallback external organization references from `DecisionCapsule.metadata`, `Recognition.employerId`, `Acceptance.employerId`, `Start.employerId`

Rules:
- Internal organization id wins over normalized name.
- External organization nodes must use a stable normalized employer key.
- Do not create both `organization` and `institution` nodes for the same party.

#### `source`

Primary source:
- `SourceRecord.sourceId`
- `VerificationArtifact.source`
- `ClaimRecord.sourceId`

Rules:
- One source node per source id from the source catalog.
- Source nodes are authorities, not evidence.

### 2. Evidence layer

#### `source_record`

Source:
- `SourceRecord`

Node:
- one node per unique `(sourceId, subjectNpi, checksum)`

Edges:
- `source_record -> source` via `issued_by`
- `source_record -> clinician` via `about`

Notes:
- `SourceRecord` is the raw fetched observation boundary.
- This is the first durable evidence node.

#### `artifact`

Source:
- `VerificationArtifact`

Node:
- one logical node per deterministic artifact content identity
- do not key artifacts by row uuid alone

Edges:
- `artifact -> clinician` via `about`
- `artifact -> source_record` via `depends_on` when `sourceRecordId` exists
- fallback `artifact -> source` via `issued_by` when no source record exists
- `artifact -> older artifact` via `supersedes` when `supersedesArtifactId` resolves

Notes:
- `VerificationArtifact` is the parsed evidence package.
- It is not a claim and it is not a source.

#### `receipt`

Source:
- `VerificationReceiptRecord`

Node:
- one logical node per deterministic field-proof identity

Edges:
- `receipt -> clinician` via `about`
- `receipt -> artifact` via `depends_on` when `verificationArtifactId` or `sourceArtifactId` resolves
- `receipt -> source_record` via `depends_on` when no artifact resolves
- `receipt -> source` via `issued_by` only as last fallback
- `receipt -> older receipt` via `supersedes` only if deterministic replacement is available

Notes:
- Receipt nodes exist because field-level proof is first-order evidence.
- The current runtime does not project them; it should.

#### `claim`

Source:
- `ClaimRecord`

Node:
- one logical node per `claimId`
- latest non-superseded row drives current node attributes
- all contributing `ClaimRecord.id` values stay in `sourceRefs`

Edges:
- `claim -> clinician` via `about`
- `claim -> receipt` via `depends_on` when receipts exist for `claimId`
- fallback `claim -> artifact` via `depends_on` when no receipt exists
- fallback `claim -> source_record` via `depends_on` when no artifact exists
- `claim -> older claim` via `supersedes` when `supersedesClaimId` resolves

Notes:
- This removes the current duplication where claim nodes are keyed by `ClaimRecord.id`.
- `claimId` is already deterministic in the identity pipeline.

### 3. Signal layer

#### `finding`

Source:
- `InvestigatorFinding`

Edges:
- `finding -> clinician|organization` via `about` using `FindingEntityLink`
- `finding -> claim|artifact|source_record|decision_capsule` via `depends_on` using `FindingEvidenceLink.recordType` + `recordId`

Rules:
- Do not materialize a finding without its `findingId`.
- Unresolved evidence links stay in metadata with an integrity flag.

#### `storyline`

Source:
- deterministic `storylineKey` grouping from `buildDecisionStorylines(...)`

Edges:
- `storyline -> finding` via `depends_on`
- `storyline -> clinician|organization` via `about` using `targetEntity`

Rules:
- `storylineKey` is the identity.
- Do not create one node per render; create one node per key.

#### `prediction`

Source:
- `PredictionInsight`

Edges:
- `prediction -> clinician|organization` via `about`
- optional `prediction -> finding` via `depends_on` only when a stable supporting record id exists

Rules:
- `evidenceSignals` stay in metadata until they can resolve to first-order graph nodes.
- Do not invent metric nodes for `evidenceSignals`.

### 4. Decision layer

#### `decision_recommendation`

Source:
- `ActionRecommendation`
- `DecisionResult` is not graphed directly until persisted with `actionId`

Edges:
- `decision_recommendation -> clinician|organization` via `about` when the target resolves to a modeled subject node
- `decision_recommendation -> finding` via `depends_on`
- `decision_recommendation -> storyline` via `depends_on`
- `decision_recommendation -> prediction` via `depends_on`

Rules:
- Persisted recommendation rows are the deterministic graph boundary.
- In-process engine output is transient and must not create graph nodes.
- Non-modeled targets such as specialty remain in node metadata until a canonical specialty node exists.

#### `decision_capsule`

Source:
- `DecisionCapsule`

Edges:
- `decision_capsule -> clinician` via `about`
- `decision_capsule -> organization` via `issued_by` when `organizationId` or normalized employer metadata resolves
- `decision_capsule -> artifact` via `depends_on` for each `credentialIds[]`

Rules:
- Do not also create direct `clinician -> organization` acceptance edges from capsules.
- The capsule is the decision record; it already encodes the relationship.

#### `recognition`

Source:
- `Recognition`

Edges:
- `recognition -> clinician` via `about`
- `recognition -> organization` via `issued_by`
- `recognition -> receipt|claim|artifact|decision_capsule` via `depends_on` when `verificationRef` resolves

#### `acceptance`

Source:
- `Acceptance`

Edges:
- `acceptance -> clinician` via `about`
- `acceptance -> organization` via `issued_by`
- `acceptance -> recognition` via `follows`
- `acceptance -> claim|artifact|decision_capsule` via `depends_on` when `psvReportId` resolves to a stable node

#### `start`

Source:
- `Start`

Edges:
- `start -> clinician` via `about`
- `start -> organization` via `issued_by`
- `start -> acceptance` via `follows`

Rules for canonical path:
- No direct `recognition -> start`.
- No direct `clinician -> organization accepted_by`.
- Sequence is expressed only through `follows`.

## What The Current Runtime Gets Wrong

The current trust graph runtime in [rebuildEngine.ts](/Users/christoler/vitalcv/apps/api/backend/src/services/graph-engine/rebuildEngine.ts) and [schema.ts](/Users/christoler/vitalcv/apps/api/backend/src/services/graph-engine/schema.ts):

1. mixes knowledge-graph concerns with trust-graph concerns
2. keys claim nodes by `ClaimRecord.id` instead of deterministic `claimId`
3. omits receipt nodes entirely
4. stores shortcut edges like `accepted_by`, `verifies`, and `sourced_from` that collapse real lineage
5. persists reciprocal mirror edges, which creates circular ambiguity
6. materializes external organizations as `institution` nodes while internal orgs are `organization` nodes
7. creates synthetic summary nodes and semantic links that are not first-order trust records

## Required Runtime Changes

1. Split trust graph projection from knowledge graph projection.
2. Replace claim-node identity with `claimId`.
3. Add `VerificationReceiptRecord` projection.
4. Stop persisting reciprocal mirrors for trust-mode edges.
5. Remove trust-mode shortcut edges:
   `accepted_by`, `verifies`, `sourced_from`, `related_to`, `semantic_similarity`.
6. Collapse `institution` into `organization`.
7. Materialize `ActionRecommendation` as `decision_recommendation`.
8. Treat unresolved upstream links as integrity flags, not inferred edges.

## Minimal Edge Matrix

| From | Allowed edges |
| --- | --- |
| `clinician` | `affiliated_with -> organization` |
| `organization` | none |
| `source` | none |
| `source_record` | `about -> clinician`, `issued_by -> source` |
| `artifact` | `about -> clinician`, `depends_on -> source_record`, `issued_by -> source`, `supersedes -> artifact` |
| `receipt` | `about -> clinician`, `depends_on -> artifact|source_record`, `issued_by -> source` |
| `claim` | `about -> clinician`, `depends_on -> receipt|artifact|source_record`, `supersedes -> claim` |
| `finding` | `about -> clinician|organization`, `depends_on -> claim|artifact|source_record|decision_capsule` |
| `storyline` | `about -> clinician|organization`, `depends_on -> finding` |
| `prediction` | `about -> clinician|organization`, `depends_on -> finding` |
| `decision_recommendation` | `about -> clinician|organization`, `depends_on -> finding|storyline|prediction` |
| `decision_capsule` | `about -> clinician`, `issued_by -> organization`, `depends_on -> artifact` |
| `recognition` | `about -> clinician`, `issued_by -> organization`, `depends_on -> receipt|claim|artifact|decision_capsule` |
| `acceptance` | `about -> clinician`, `issued_by -> organization`, `follows -> recognition`, `depends_on -> claim|artifact|decision_capsule` |
| `start` | `about -> clinician`, `issued_by -> organization`, `follows -> acceptance` |

## Non-Goals

Do not add:

- claim-type rollup nodes
- source summary nodes per clinician
- direct clinician-to-organization acceptance edges
- AI similarity edges inside the trust graph
- document, tag, attachment, or backlink nodes inside the trust graph

Those belong in separate projections, not the canonical trust graph.
