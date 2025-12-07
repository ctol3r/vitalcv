# Lifecycle Service

## Overview

The lifecycle service provides comprehensive lifecycle state management, temporal feature extraction, event series building, and projection storage for clinicians.

## Components

### 1. LifecycleState Model (`models/LifecycleState.ts`)

Stores snapshots for:
- **Privileges**: Active privilege codes, status, org, department
- **Credential Freshness**: License, board, DEA, PECOS expiry information
- **CCI (Competency Composite Index)**: Score, model type, contribution map
- **Risk**: Risk score, level, factors
- **Safety Signals**: Active signals, severity, resolution status
- **Enrollment Map**: Payer enrollments, PECOS status, CAQH ID
- **Compact Eligibility**: IMLC, PSYPACT, Counseling compact status
- **OPPE/FPPE**: Ongoing and focused professional practice evaluation data
- **Drift**: Drift event count, severity, recent events
- **Forecast Risk**: Projected risk scores across time horizons

**Usage:**
```typescript
import { createLifecycleState } from './models/LifecycleState.js';

const state = createLifecycleState({
  clinicianId: 'clinician-123',
  orgId: 'org-456',
  timestamp: new Date(),
  privileges: {
    privilegeCodes: ['PRIV-001'],
    status: 'ACTIVE',
  },
  cci: {
    cciScore: 85,
    computedAt: new Date(),
  },
});
```

### 2. TemporalFeatureExtractor (`extractors/temporalFeatures.ts`)

Extracts evolving features:
- **Credential Half-Life**: Days until 50% of credentials expire
- **Seasonality**: Monthly/quarterly performance patterns
- **Renewal Clustering**: Analysis of credential renewal timing
- **Risk Aging Curves**: Projected risk trends across time horizons

**Usage:**
```typescript
import { temporalFeatureExtractor } from './extractors/temporalFeatures.js';

const features = temporalFeatureExtractor.extractTemporalFeatures(states);
console.log(features.credentialHalfLife.overallHalfLife);
console.log(features.seasonality.peakMonth);
console.log(features.riskAgingCurve.projectedRisk['12mo']);
```

### 3. LifecycleEventSeries Builder (`extractors/eventSeries.ts`)

Turns all historical events into chronological series:
- Timeline events
- Drift events
- OPPE/FPPE events
- EHR sync events
- Privilege events
- Enrollment events
- Safety signal events
- Renewal events
- Credential update events

**Usage:**
```typescript
import { lifecycleEventSeriesBuilder } from './extractors/eventSeries.js';

const series = lifecycleEventSeriesBuilder.buildFromStates(states);
const driftEvents = lifecycleEventSeriesBuilder.filterByType(series, 'drift');
```

### 4. LifecycleProjectionConstants (`constants.ts`)

Defines projection windows:
- **3mo**: 3-month projection
- **6mo**: 6-month projection
- **12mo**: 12-month projection
- **24mo**: 24-month projection
- **36mo**: 36-month projection

**Usage:**
```typescript
import { getProjectionDate, getAllProjectionDates } from './constants.js';

const baseDate = new Date();
const projected3mo = getProjectionDate(baseDate, '3mo');
const allDates = getAllProjectionDates(baseDate);
```

### 5. LifecycleStorage (`storage.ts`)

Stores lifecycle projections per interval; retrievable by org, clinician, dept.

**Usage:**
```typescript
import { lifecycleStorage } from './storage.js';

// Store a projection
await lifecycleStorage.storeProjection(
  'clinician-123',
  '12mo',
  state,
  'org-456',
  'Emergency'
);

// Retrieve projections
const projections = await lifecycleStorage.getProjections({
  clinicianId: 'clinician-123',
  projectionWindow: '12mo',
});

// Get latest projection
const latest = await lifecycleStorage.getLatestProjection(
  'clinician-123',
  '12mo'
);

// Get all projections for a clinician
const allProjections = await lifecycleStorage.getClinicianProjections(
  'clinician-123'
);
```

## Database Schema

The service uses the `LifecycleProjection` Prisma model:

```prisma
model LifecycleProjection {
  id              String   @id @default(cuid())
  clinicianId     String
  orgId           String?
  department      String?
  projectionWindow String  // '3mo', '6mo', '12mo', '24mo', '36mo'
  state           Json     // LifecycleState snapshot
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([clinicianId])
  @@index([orgId])
  @@index([department])
  @@index([projectionWindow])
  @@index([clinicianId, projectionWindow])
  @@index([orgId, projectionWindow])
  @@index([createdAt])
}
```

## Migration

To create the database migration:

```bash
cd backend
npx prisma migrate dev --name add_lifecycle_projection
npx prisma generate
```

## Testing

Run tests with:

```bash
npm test -- services/lifecycle
```

## Exports

All components are exported from the main index:

```typescript
import {
  createLifecycleState,
  temporalFeatureExtractor,
  lifecycleEventSeriesBuilder,
  lifecycleStorage,
  getProjectionDate,
} from './services/lifecycle';
```

