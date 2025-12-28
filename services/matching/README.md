# Matching Service

AI-driven matching service for ranking clinicians against job postings using embeddings and feature-weighted scoring.

## Overview

The matching service combines:
- **Vector embeddings** (OpenAI/Vertex AI) for semantic similarity
- **Feature-weighted scoring** (specialty, location, experience, rating, burnout risk)
- **Explainability** (reason codes for each match)
- **Fairness metrics** (disparity detection by region, specialty, etc.)
- **Fuzzy specialty matching** (adjacent specialties via distance map)

## Components

### Models

- **MatchingConfig** (`models/MatchingConfig.ts`): Stores feature weights for matching algorithm
- **Embeddings** (`models/Embeddings.ts`): Schema for storing vector embeddings

### Services

- **embeddings.ts**: Embedding provider integration (OpenAI/Vertex/stub)
- **score.ts**: Similarity scoring (cosine + feature-weighted)
- **explanations.ts**: Explainability service (reason codes)
- **matchaConfig.ts**: MATCHA boot config (specialty distance map)
- **specialtyDistance.ts**: Specialty adjacency map + utilities
- **fhirAgentHarness.ts**: FHIR-AgentBench harness for evaluation
- **fairnessMetrics.ts**: Fairness metrics computation

### API

- **rankCandidates.ts**: `POST /matching/rank` endpoint for ranking candidates

## Usage

### Ranking Candidates

```typescript
POST /matching/rank
{
  "jobId": "job-123",
  "limit": 20,
  "forceRefresh": false
}
```

Response:
```json
{
  "jobId": "job-123",
  "jobTitle": "Family Medicine Physician",
  "totalCandidates": 50,
  "rankedCandidates": [
    {
      "rank": 1,
      "clinicianId": "did:example:123",
      "clinicianName": "Dr. Jane Doe",
      "score": 0.9234,
      "explanation": [
        {
          "tag": "specialty_match",
          "message": "Exact specialty match",
          "confidence": 1.0
        },
        {
          "tag": "geographically_close",
          "message": "Geographically close to job location",
          "confidence": 0.95
        }
      ]
    }
  ],
  "weights": {
    "specialtyMatch": 0.35,
    "locationProximity": 0.25,
    "experienceYears": 0.20,
    "rating": 0.15,
    "burnoutRisk": 0.05
  }
}
```

## Configuration

### Environment Variables

- `EMBEDDING_PROVIDER`: `stub` (default), `openai`, or `vertex`
- `OPENAI_API_KEY`: Required if using OpenAI provider
- `GOOGLE_CLOUD_PROJECT_ID`: Required if using Vertex AI provider

### Feature Weights

Default weights (sum to 1.0):
- `specialtyMatch`: 0.35
- `locationProximity`: 0.25
- `experienceYears`: 0.20
- `rating`: 0.15
- `burnoutRisk`: 0.05

Customize via `MatchingConfig` model in database.

### Specialty Distance Map

MATCHA loads a specialty distance map at boot to support adjacent specialty matching.
Distances are normalized to 0–1 and applied as a fuzzy score multiplier.

Example (default map):

```ts
Internal Medicine -> Primary Care = 0.9
Family Medicine -> Primary Care = 0.9
Emergency Medicine -> Urgent Care = 0.75
```

## Database Schema

### MatchingConfig

```prisma
model MatchingConfig {
  id          String   @id @default(cuid())
  orgId       String? // null for global/default config
  name        String
  description String?  @db.Text
  weights     Json // FeatureWeights
  isActive    Boolean  @default(true)
  isDefault   Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### Embedding

```prisma
model Embedding {
  id         String   @id @default(cuid())
  entityId   String // Clinician DID or Job ID
  entityType String // 'Clinician' or 'Job'
  vector     Json // Array of numbers
  metadata   Json // {model, dimension, provider, version}
  updatedAt  DateTime @updatedAt
  createdAt  DateTime @default(now())
}
```

## Migration

Run migration to create tables:

```bash
cd backend
npx prisma migrate dev --name add_matching_system
npx prisma generate
```

## Testing

Run unit tests:

```bash
npm test -- services/matching/__tests__
```

## Embedding Providers

### Stub Provider (Default)

Deterministic fake embeddings for testing. No API key required.

### OpenAI Provider

Requires `OPENAI_API_KEY` environment variable.

Models supported:
- `text-embedding-3-small` (default)
- `text-embedding-ada-002`

### Vertex AI Provider

Requires `GOOGLE_CLOUD_PROJECT_ID` environment variable.

**Note**: Vertex AI provider is not yet fully implemented.

## Scoring Algorithm

Composite score combines:

1. **Embedding similarity** (50%): Cosine similarity between clinician and job embeddings
2. **Feature-weighted score** (50%): Weighted sum of:
   - Specialty match
   - Location proximity
   - Experience years
   - Rating
   - Burnout risk (inverted)

Final score: `0.5 * embeddingScore + 0.5 * featureScore`

## Explainability

Each match includes explanation tags:
- `specialty_match`: Exact specialty match
- `specialty_adjacent_match`: Adjacent specialty match (distance-weighted)
- `specialty_category_match`: Same specialty category
- `geographically_close`: Close to job location
- `experienced`: High experience
- `high_rating`: High quality rating
- `low_burnout_risk`: Low burnout risk
- `strong_embedding_match`: Strong semantic match

## Fairness Metrics

Compute fairness metrics for top-k selections:

```typescript
import { generateFairnessReport } from './fairnessMetrics';

const report = await generateFairnessReport(
  jobId,
  topKCandidates,
  topK,
  baselineDistribution,
  threshold
);
```

Metrics computed by:
- Region
- Specialty
- Gender proxy (if available)
- Experience tier

## FHIR AgentBench

Run benchmark scenarios:

```typescript
import { runBenchmark } from './fhirAgentHarness';

const scenarios = [
  {
    id: 'icu-physician',
    name: 'Match ICU Physician',
    jobRequirements: { specialty: '207RC0000X' },
    expectedCandidates: ['clinician-1', 'clinician-2'],
    topK: 10,
  },
];

const results = await runBenchmark(scenarios);
console.log(generateReport(results));
```
