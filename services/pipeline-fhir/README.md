# FHIR Data Pipeline (Spezi-style) for PSV

FHIR data pipeline following Spezi-style architecture: ingest → normalize → audit → export.

## Task: B119B-FHIRPIPE-012

### Acceptance Criteria
- ✅ ingest→normalize→audit→export complete
- ✅ Hashes on-chain

## Pipeline Stages

### 1. Ingest
- Accepts FHIR resources from source systems
- Validates resource structure
- Generates SHA-256 hash of ingested data
- Anchors hash on-chain

### 2. Normalize
- Normalizes FHIR resources to internal format
- Handles Practitioner, PractitionerRole, Organization resources
- Generates hash of normalized data
- Anchors hash on-chain

### 3. Audit
- Adds audit metadata to resources
- Tracks verification timestamps
- Generates hash of audited data
- Anchors hash on-chain

### 4. Export
- Exports audited resources as FHIR Bundle
- Generates hash of exported data
- Anchors hash on-chain
- Computes Merkle root of all stage hashes
- Anchors Merkle root on-chain

## Usage

```typescript
import { getFhirPipelineProcessor } from './index';

const processor = getFhirPipelineProcessor();

// Sample FHIR resources
const resources = [
  {
    resourceType: 'Practitioner',
    id: 'practitioner-1',
    name: [{ given: ['John'], family: 'Doe' }],
    identifier: [{ system: 'http://hl7.org/fhir/sid/us-npi', value: '1234567890' }],
  },
  {
    resourceType: 'PractitionerRole',
    id: 'role-1',
    practitioner: { reference: 'Practitioner/practitioner-1' },
    code: [{ coding: [{ system: 'http://snomed.info/sct', code: 'doctor' }] }],
  },
];

// Process pipeline
const result = await processor.processPipeline(
  'provider-1',
  'fhir-server',
  resources,
  '1234567890'
);

console.log('Pipeline ID:', result.pipelineId);
console.log('Merkle Root:', result.merkleRoot);
console.log('Transaction Hash:', result.txHash);
```

## On-Chain Anchoring

Each pipeline stage hash is anchored on-chain via Polkadot service:
- Ingest hash
- Normalize hash
- Audit hash
- Export hash
- Merkle root (computed from all stage hashes)

## Configuration

Set environment variables:
- `SUBSTRATE_WS`: WebSocket endpoint for Polkadot connection (optional, falls back to mock)

