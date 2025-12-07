# Causal Graph Service

Builds directed acyclic graphs (DAGs) from events tracked across multiple engines to understand causal relationships between events.

## Components

### 1. CausalNode Model (`models/CausalNode.ts`)

Represents nodes in the causal graph with the following node types:
- `DRIFT_EVENT` - Events from the drift detection engine
- `QUALITY_SIGNAL` - Quality signals from the fusion engine
- `SAFETY_SIGNAL` - Safety signals from the safety engine
- `RISK_SPIKE` - Risk spikes detected
- `ENROLLMENT_CONFLICT` - Enrollment conflicts
- `PRIVILEGE_RESTRICTION` - Privilege restrictions
- `COMPLIANCE_FAIL` - Compliance failures
- `EHR_MISMATCH` - EHR mismatches
- `FORECAST_RISK` - Forecasted risks

### 2. CausalEdge Model (`models/CausalEdge.ts`)

Represents edges in the causal graph with the following edge types:
- `CAUSES` - Source event causes target event
- `AMPLIFIES` - Source event amplifies target event
- `CONTRADICTS` - Source event contradicts target event
- `MITIGATES` - Source event mitigates target event
- `REQUIRES` - Source event requires target event
- `PRECEDES` - Source event precedes target event

Each edge includes a `confidenceScore` (0-1) indicating the confidence in the relationship.

### 3. PropagationRulesEngine (`propagationRules.ts`)

Defines causal associations between different event types. Examples:
- `LICENSE_EXPIRY CAUSES PRIVILEGE_RESTRICTION`
- `OPPE_LOW AMPLIFIES RISK_SPIKE`
- `EHR_MISMATCH PRECEDES SAFETY_SIGNAL`

### 4. CausalGraphBuilder (`buildGraph.ts`)

Builds a DAG from events tracked in:
- Drift engine (DriftEvent)
- Fusion engine (QualitySignal)
- Safety engine (PrivilegeSafetySignal)
- Enrollment engine (PayerEnrollment, PECOSEnrollment)
- Privilege engine (PrivilegeGranted, PrivilegeSafetyState)
- OPPE/FPPE engine (FPPERecord, OPPESchedule)
- Forecast engine (SafetyFeatureVector, RiskScore)

### 5. CausalConfidenceScorer (`confidence.ts`)

Computes confidence scores for causal edges weighted by:
- **Recency** (20%): More recent events have higher confidence
- **Severity** (25%): Higher severity events have higher confidence
- **Historical patterns** (20%): Frequently observed relationships have higher confidence
- **Drift intensity** (15%): Stronger drift signals have higher confidence
- **Forecast agreement** (20%): Agreement with predictive models increases confidence

## Usage

```typescript
import { buildCausalGraph } from './services/causalGraph/buildGraph.js';

// Build graph for a clinician
const result = await buildCausalGraph(
  'clinician-123',
  'org-456',
  {
    start: new Date('2025-01-01'),
    end: new Date('2025-01-31'),
  }
);

console.log(`Built graph with ${result.nodeCount} nodes and ${result.edgeCount} edges`);
```

## Database Schema

The service uses Prisma models:
- `CausalNode` - Stores graph nodes
- `CausalEdge` - Stores graph edges

Run migrations to create these tables:
```bash
cd backend
npx prisma migrate dev --name add_causal_graph
npx prisma generate
```

## Tests

Tests are located in `__tests__/`:
- `CausalNode.test.ts` - Tests for node model
- `CausalEdge.test.ts` - Tests for edge model
- `propagationRules.test.ts` - Tests for propagation rules

Run tests:
```bash
npm test -- services/causalGraph
```

