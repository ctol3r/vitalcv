# Audit Anchoring Service for FHIR Pipeline Events

Audit anchoring service that anchors each FHIR pipeline stage hash on-chain and stores the Merkle root.

## Task: B119B-AUD-020

### Acceptance Criteria
- ✅ Each stage hash anchored
- ✅ Merkle root stored

## Features

### Stage Hash Anchoring
Each pipeline stage hash is individually anchored on-chain:
- Ingest stage hash
- Normalize stage hash
- Audit stage hash
- Export stage hash

### Merkle Root Computation
- Computes Merkle root from all stage hashes using binary Merkle tree
- Anchors Merkle root on-chain
- Stores Merkle root in audit results

### AuditScrapbook Integration
- Records each stage hash in AuditScrapbook
- Records Merkle root in AuditScrapbook
- Provides immutable audit trail

## Usage

```typescript
import { getFhirPipelineAuditService } from './fhir-pipeline-audit';

const auditService = getFhirPipelineAuditService();

// Stage hashes from FHIR pipeline
const stageHashes = [
  {
    stage: 'ingest',
    hash: 'abc123...',
    timestamp: Date.now(),
  },
  {
    stage: 'normalize',
    hash: 'def456...',
    timestamp: Date.now(),
  },
  {
    stage: 'audit',
    hash: 'ghi789...',
    timestamp: Date.now(),
  },
  {
    stage: 'export',
    hash: 'jkl012...',
    timestamp: Date.now(),
  },
];

// Anchor all stages and compute Merkle root
const result = await auditService.anchorPipelineStages('pipeline-123', stageHashes);

console.log('Merkle Root:', result.merkleRoot);
console.log('Transaction Hashes:', result.txHashes);
```

## Merkle Tree Construction

The Merkle root is computed using a binary Merkle tree:
1. Stage hashes are leaf nodes
2. Pairs of hashes are combined and hashed
3. Process continues until single root hash remains
4. Odd-numbered levels duplicate the last node

## Verification

Verify Merkle root matches stage hashes:

```typescript
const isValid = auditService.verifyMerkleRoot(stageHashes, expectedMerkleRoot);
```

## Integration with FHIR Pipeline

The audit service integrates with the FHIR pipeline processor:

```typescript
import { getFhirPipelineProcessor } from '../pipeline-fhir';
import { getFhirPipelineAuditService } from './fhir-pipeline-audit';

const processor = getFhirPipelineProcessor();
const auditService = getFhirPipelineAuditService();

// Process pipeline
const result = await processor.processPipeline(providerId, source, resources, npi);

// Extract stage hashes
const stageHashes = result.stages.map(s => ({
  stage: s.stage,
  hash: s.outputHash,
  timestamp: s.timestamp,
  metadata: s.metadata,
}));

// Anchor audit trail
const auditResult = await auditService.anchorPipelineStages(result.pipelineId, stageHashes);
```

