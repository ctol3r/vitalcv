# Predictive Safety Module

## Overview

This module provides predictive safety analysis for clinicians by:
1. Extracting feature vectors from various safety signals (OPPE, FPPE, drift, compliance, etc.)
2. Building historical datasets for machine learning
3. Generating labels based on actual timeline events
4. Supporting prediction windows for forecasting privilege risk

## Components

### B203A-ML-001: SafetyFeatureVector Model

**File**: `models/SafetyFeatureVector.ts`

Stores feature vectors with:
- `clinicianId`: Clinician identifier
- `timestamp`: When the vector was captured
- `features`: Normalized feature values (0-1 range):
  - `oppe_trend`: OPPE trend (-1 to 1, declining to improving)
  - `fppe_outcomes`: FPPE outcomes (0 to 1, poor to excellent)
  - `complication_rate`: Complication rate (0 to 1)
  - `drift_events`: Drift events count (normalized)
  - `license_freshness`: License expiry freshness (0 to 1)
  - `board_freshness`: Board certification freshness (0 to 1)
  - `dea_expiry`: DEA expiry status (0 to 1)
  - `pecos_status`: PECOS enrollment status (0 to 1)
  - `payer_denials`: Payer denial rate (0 to 1)
  - `ehr_mismatches`: EHR mismatch count (normalized)

**Database**: Prisma model `SafetyFeatureVector` in `backend/prisma/schema.prisma`

**Migration**: Run `npx prisma migrate dev --name add_safety_feature_vector`

### B203A-ML-002: FeatureExtractor Service

**File**: `extractors/featureExtractor.ts`

Aggregates signals from:
- OPPE (Ongoing Professional Practice Evaluation)
- FPPE (Focused Professional Practice Evaluation)
- Drift events
- Risk/compliance data
- Enrollment data
- EHR data

Outputs normalized feature vector for ML models.

**Tests**: `extractors/__tests__/featureExtractor.test.ts` (tests 3 clinicians as specified)

### B203A-ML-003: HistoricalSafetyDatasetBuilder

**File**: `dataset/buildDataset.ts`

Builds N×M matrix of features from last 12 months:
- Integrates EHR mismatch data
- Integrates enrollment decline data
- Integrates compact changes
- Ensures balanced dataset (optional)

Supports:
- Date range filtering
- Per-clinician vector limits
- Dataset balancing by label class
- Feature statistics calculation

### B203A-ML-004: LabelGenerator

**File**: `dataset/generateLabels.ts`

Labels historical data with safety states:
- `SAFE`: No risk indicators
- `AT_RISK`: Moderate risk signals
- `HIGH_RISK`: High risk signals
- `HOLD_TRIGGERED`: Privilege hold was triggered
- `SUSPENDED`: Privilege suspension occurred

Uses timeline events as ground truth with configurable look-ahead window.

### B203A-ML-005: PredictionWindowConstants

**File**: `constants.ts`

Defines prediction windows:
- 7 days
- 14 days
- 30 days
- 60 days

## Usage Example

```typescript
import { featureExtractor } from './extractors/featureExtractor.js';
import { datasetBuilder } from './dataset/buildDataset.js';
import { labelGenerator } from './dataset/generateLabels.js';

// Extract features for a clinician
const features = await featureExtractor.extractFeatures(
  { clinicianId: 'clinician-123' },
  {
    oppe: { trend: 0.5, lastReviewScore: 0.8 },
    fppe: { status: 'COMPLETED', outcomes: 0.9 },
    compliance: { licenseExpiryDays: 1000, pecosStatus: 'ENROLLED' },
    // ... other data sources
  }
);

// Build dataset from historical vectors
const dataset = datasetBuilder.buildDataset(featureVectors, {
  monthsBack: 12,
  includeLabels: true,
  balanceDataset: true,
});

// Generate labels from timeline events
const labeled = labelGenerator.generateLabels(
  featureVectors,
  timelineEvents,
  { lookAheadDays: 60 }
);
```

## Database Migration

To create the database table:

```bash
cd backend
npx prisma migrate dev --name add_safety_feature_vector
npx prisma generate
```

## Testing

Run tests:

```bash
npm test -- services/predictiveSafety
```

