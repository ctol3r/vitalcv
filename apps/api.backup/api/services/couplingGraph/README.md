# Coupling Graph Service

## Overview

The Coupling Graph Service provides system-wide impact analysis by modeling relationships and dependencies between system components (departments, credentials, privileges, enrollments, etc.). It propagates impact through the graph to identify ripple effects and system fragility.

## Components

### 1. PropagationEngine (`propagationEngine.ts`)

**B210B-COUP-006**: Propagates impact from source events through the coupling graph via impact weights, outputting a ripple score map.

**Usage:**
```typescript
import { propagateImpact } from './propagationEngine.js';

const rippleScores = await propagateImpact({
  nodeId: 'privilege-anesthesia-001',
  eventType: 'PRIVILEGE_HOLD',
  initialImpact: 0.8,
}, {
  maxDepth: 5,
  minImpactThreshold: 0.01,
  decayFactor: 0.8,
});
```

**Features:**
- BFS-based propagation with configurable depth
- Impact decay per hop
- Cycle detection (optional)
- Multiple source event support

### 2. RippleScenarioSimulator (`simulator/rippleSimulator.ts`)

**B210B-COUP-007**: Simulates critical scenarios (DEA mass expiry, compact ineligibility, payer network failure, FPPE surge) and outputs department-by-department impact.

**Usage:**
```typescript
import { simulateScenario } from './simulator/rippleSimulator.js';

const impacts = await simulateScenario({
  type: 'DEA_MASS_EXPIRY',
  affectedNodeIds: ['node-1', 'node-2'],
  severity: 0.8,
}, {
  maxDepth: 5,
  includeRecoveryTime: true,
});
```

**Supported Scenarios:**
- `DEA_MASS_EXPIRY`: Mass DEA license expiration
- `COMPACT_INELIGIBILITY`: Multi-state compact eligibility loss
- `PAYER_NETWORK_FAILURE`: Payer network enrollment failure
- `FPPE_SURGE`: Focused Professional Practice Evaluation surge

### 3. SystemSensitivityAnalyzer (`analytics/sensitivity.ts`)

**B210B-COUP-008**: Computes ∂(system_performance)/∂(credential_variable) for each node to identify fragile areas.

**Usage:**
```typescript
import { analyzeSensitivity } from './analytics/sensitivity.js';

const results = await analyzeSensitivity(basePerformance, {
  perturbationSize: 0.01,
  minSensitivityThreshold: 0.001,
});

// Get top fragile areas
const topFragile = results
  .filter(r => r.fragilityScore > 0.7)
  .sort((a, b) => b.fragilityScore - a.fragilityScore);
```

**Output:**
- Sensitivity score per node
- Fragility score (0-1)
- Affected departments
- Recommendations for mitigation

### 4. CrossDomainImpactJoiner (`joiners/crossDomainImpact.ts`)

**B210B-COUP-009**: Joins data from multiple domains (causalGraph, predictiveSafety, workforceForecast, competency, enrollment) into a unified system impact model.

**Usage:**
```typescript
import { joinCrossDomainImpact } from './joiners/crossDomainImpact.js';

const unifiedImpact = await joinCrossDomainImpact({
  causalEvents: ['RISK_SPIKE', 'SAFETY_HOLD'],
  safetySignals: [...],
  workforceForecast: {...},
  competencyData: [...],
  enrollmentData: [...],
});
```

**Output:**
- Unified system performance metrics
- Ripple scores across all domains
- Department impacts
- Sensitivity analysis results
- Future predictions (next week, next month)

### 5. CouplingOrchestrator Job (`jobs/couplingGraph/couplingOrchestrator.ts`)

**B210B-COUP-010**: Runs weekly + on critical events to update system-wide impact predictions and Timeline.

**Usage:**
```typescript
import { startCouplingOrchestratorCron } from '../../jobs/couplingGraph/couplingOrchestrator.js';

// Start weekly cron job (default: 3 AM every Sunday)
startCouplingOrchestratorCron({
  runOnStartup: true,
  cronSchedule: '0 3 * * 0',
});

// Or trigger on critical events
import { triggerCouplingOrchestratorOnEvent } from '../../jobs/couplingGraph/couplingOrchestrator.js';
await triggerCouplingOrchestratorOnEvent('SAFETY_HOLD', 'clinician-123');
```

## Data Models

### CouplingNode
Represents a system component (department, credential, privilege, etc.)

### CouplingEdge
Represents an impact relationship with:
- `impactWeight`: 0.0-1.0, how much impact propagates
- `relationshipType`: DEPENDS_ON, AFFECTS, REQUIRES, ENABLES, BLOCKS
- `delay`: Optional propagation delay

### RippleScore
Cumulative impact score for a node after propagation:
- `score`: 0.0-1.0
- `propagationDepth`: How many hops from source
- `paths`: All propagation paths

## Graph Store

The `CouplingGraphStore` loads nodes and edges from the database:
- Privilege nodes from `PrivilegeNode` table
- Dependency edges from `PrivilegeDependency` table
- Extensible to other node/edge types

## Integration Points

- **CausalGraph**: Uses causal events to trigger propagation
- **PredictiveSafety**: Incorporates safety signals into impact
- **WorkforceForecast**: Uses forecast gaps for capacity analysis
- **Competency**: Maps competency issues to credential nodes
- **Enrollment**: Tracks enrollment status changes
- **Timeline**: Logs impact predictions and fragile areas

## Example Workflow

1. **Event Occurs**: Privilege hold in anesthesia department
2. **Propagation**: Impact propagates through coupling graph
3. **Ripple Analysis**: Identify all affected departments
4. **Sensitivity Check**: Determine if this is a fragile area
5. **Scenario Simulation**: Simulate recovery scenarios
6. **Timeline Update**: Log predictions and recommendations

## Configuration

Default propagation options:
- `maxDepth`: 5 hops
- `minImpactThreshold`: 0.01
- `decayFactor`: 0.8 (20% decay per hop)
- `includeCycles`: false

## Future Enhancements

- Graph persistence to database
- Real-time event streaming
- Machine learning for impact weight tuning
- Visualization API for frontend
- Historical impact trend analysis

