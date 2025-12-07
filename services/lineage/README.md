# Data Lineage System

Implementation of data lineage tracking system for tracking data transformations and provenance across the platform.

## Components

### B228A-LIN-001: DataLineage Model

**Location**: `services/lineage/models/DataLineage.ts`

Tracks data lineage with the following fields:
- `id`: Unique identifier
- `sourceSystem`: System/service where data originated (e.g., 'credentials', 'reputation', 'finance')
- `sourceRecordId`: ID of the source record
- `targetRecordId`: ID of the target/resulting record
- `operationType`: CREATE, UPDATE, or DELETE
- `timestamp`: When the operation occurred
- `operatorId`: User ID or system identifier who performed the operation
- `transformationId`: References TransformationRegistry
- `metadata`: Additional context (requestId, chainId, network, etc.)

**Database**: Prisma model `DataLineage` with comprehensive indexes for efficient querying.

**Tests**: `services/lineage/__tests__/DataLineage.test.ts`

### B228A-LIN-002: LineageCollector

**Location**: `services/lineage/collector.ts`

Middleware for intercepting CRUD operations across services:
- Automatically extracts context from HTTP requests
- Supports asynchronous logging via queue
- Batches writes for performance
- Can be configured per route/service

**Usage**:
```typescript
import { lineageCollectorMiddleware } from './services/lineage/collector';

// Apply to routes
app.post('/api/credentials', lineageCollectorMiddleware(), handler);
app.put('/api/reputation/:id', lineageCollectorMiddleware({ sourceSystem: 'reputation' }), handler);
```

**Manual Recording**:
```typescript
import { recordLineageSync, recordLineageAsync } from './services/lineage/collector';

// Synchronous (for critical operations)
await recordLineageSync({
  sourceSystem: 'credentials',
  sourceRecordId: 'cred_123',
  targetRecordId: 'cred_456',
  operationType: OperationType.CREATE,
  operatorId: 'user_789',
});

// Asynchronous (for non-critical operations)
recordLineageAsync({
  sourceSystem: 'reputation',
  sourceRecordId: 'rep_123',
  targetRecordId: 'rep_456',
  operationType: OperationType.UPDATE,
});
```

### B228A-LIN-003: DataProvenanceService

**Location**: `services/lineage/provenanceService.ts`

Provides APIs to query lineage:
- Forward lineage: What was created/updated from a record
- Backward lineage: What created/updated a record
- Full lineage: Both forward and backward
- Federated queries: Across multiple chains/networks
- Provenance graphs: Graph structure with nodes and edges

**Usage**:
```typescript
import { provenanceService } from './services/lineage/provenanceService';

// Get forward lineage
const forwardGraph = await provenanceService.getForwardLineage('record_123', {
  maxDepth: 5,
  chainId: 'polkadot',
});

// Get backward lineage
const backwardGraph = await provenanceService.getBackwardLineage('record_123');

// Get full lineage
const fullGraph = await provenanceService.getFullLineage('record_123', {
  maxDepth: 10,
  includeMetadata: true,
});

// Federated query across chains
const federatedGraph = await provenanceService.federatedQuery('record_123', [
  'polkadot',
  'kusama',
]);
```

### B228A-LIN-004: TransformationRegistry

**Location**: `services/lineage/transformationRegistry.ts`

Catalogs all data transformations:
- Assigns stable transformationIds (hash-based)
- Stores version, description, risk classification
- Tracks AI models and functions used

**Usage**:
```typescript
import { transformationRegistry } from './services/lineage/transformationRegistry';

// Register a transformation
const transformation = await transformationRegistry.registerTransformation({
  name: 'AI Link Inference',
  description: 'Infers relationships between entities using AI',
  version: '1.2.0',
  riskClassification: RiskClassification.MEDIUM,
  metadata: {
    model: 'gpt-4',
    function: 'inferLinks',
  },
});

// Get transformation
const trans = await transformationRegistry.getTransformation(transformation.transformationId);

// Query transformations
const highRisk = await transformationRegistry.getTransformationsByRisk(
  RiskClassification.HIGH
);
```

### B228A-LIN-005: LineageAggregationJob

**Location**: `jobs/lineage/aggregationJob.ts`

Nightly job that aggregates lineage data:
- Records processed per day
- Sources used
- Transformations invoked
- Operators active
- Top sources and transformations

**Usage**:
```typescript
import { runLineageAggregation, scheduleLineageAggregation } from './jobs/lineage/aggregationJob';

// Run aggregation for a specific date
const stats = await runLineageAggregation(new Date('2025-11-16'));

// Schedule nightly aggregation (runs at 2 AM UTC)
scheduleLineageAggregation();

// Run aggregation for a date range (backfilling)
const statsArray = await runLineageAggregationRange(
  new Date('2025-11-01'),
  new Date('2025-11-16')
);
```

## Database Schema

### Migration

**Location**: `backend/prisma/migrations/20251116_add_data_lineage_models/migration.sql`

Creates:
- `OperationType` enum (CREATE, UPDATE, DELETE)
- `RiskClassification` enum (LOW, MEDIUM, HIGH, CRITICAL)
- `TransformationRegistry` table
- `DataLineage` table
- Comprehensive indexes for efficient querying

### Prisma Models

**Location**: `backend/prisma/schema.prisma`

```prisma
model DataLineage {
  id               String        @id @default(cuid())
  sourceSystem     String
  sourceRecordId   String
  targetRecordId  String
  operationType    OperationType
  timestamp        DateTime      @default(now())
  operatorId       String?
  transformationId String?
  transformation   TransformationRegistry? @relation(...)
  metadata         Json?
  // ... indexes
}

model TransformationRegistry {
  transformationId String        @id @default(cuid())
  name             String
  description      String?       @db.Text
  version          String        @default("1.0.0")
  riskClassification RiskClassification @default(MEDIUM)
  metadata         Json?
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt
  lineageEntries   DataLineage[]
  // ... indexes
}
```

## Integration

### Express Middleware

Add to your Express routes:

```typescript
import { lineageCollectorMiddleware } from './services/lineage/collector';

// Apply to specific routes
router.post('/api/credentials', lineageCollectorMiddleware(), createCredential);
router.put('/api/reputation/:id', lineageCollectorMiddleware({ sourceSystem: 'reputation' }), updateReputation);
router.delete('/api/finance/:id', lineageCollectorMiddleware({ sourceSystem: 'finance' }), deleteFinanceRecord);
```

### Service Integration

Record lineage in your services:

```typescript
import { recordLineageSync } from './services/lineage/collector';
import { OperationType } from '@prisma/client';

// After creating a record
const newRecord = await createRecord(data);
await recordLineageSync({
  sourceSystem: 'credentials',
  sourceRecordId: data.sourceId,
  targetRecordId: newRecord.id,
  operationType: OperationType.CREATE,
  operatorId: userId,
  transformationId: transformationId,
});
```

## Testing

Run tests:

```bash
npm test -- services/lineage/__tests__/DataLineage.test.ts
```

## Future Enhancements

- [ ] GraphQL API for lineage queries
- [ ] Real-time lineage visualization
- [ ] Lineage retention policies
- [ ] Lineage export for compliance
- [ ] Integration with audit logging
- [ ] Performance optimizations for large-scale queries
