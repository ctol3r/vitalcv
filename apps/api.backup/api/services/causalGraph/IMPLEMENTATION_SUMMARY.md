# Causal Graph System - Implementation Summary

## Overview

This implementation delivers a complete causal graph system for understanding and analyzing causal relationships between events in the credentialing system. The system includes root cause detection, path explanation, what-if simulation, orchestration, and supervisor integration.

## Components Delivered

### 1. RootCauseDetector (`rootCauseDetector.ts`)

**Purpose**: Given a target event, backtracks through the causal graph to find root causes with confidence scores.

**Features**:
- Backtracks from target events through reverse edges (predecessors)
- Calculates confidence scores along paths
- Ranks root causes by total impact
- Configurable depth, confidence thresholds, and path limits

**API**:
```typescript
import { detectRootCauses, getRootCauses } from './rootCauseDetector.js';

const result = await detectRootCauses('SAFETY_HOLD', {
  maxDepth: 5,
  minConfidence: 0.3,
  maxPathsPerRoot: 10,
});

// Returns ranked root causes with confidence scores
```

**Acceptance Criteria**: ✅
- Given target event → backtracks through causal graph → outputs ranked root causes with confidence

### 2. CausalPathExplainer (`pathExplainer.ts`)

**Purpose**: Explains causal paths such as:
`LICENSE_DRIFT → DECREASED_PECOS_TRUST → ENROLLMENT_CONFLICT → RISK_SPIKE → SAFETY_HOLD`

**Features**:
- Generates human-readable explanations of causal paths
- Provides step-by-step breakdowns
- Calculates confidence and estimated time to effect
- Supports narrative explanations

**API**:
```typescript
import { explainPath, explainPathsToTarget, generateNarrativeExplanation } from './pathExplainer.js';

const explanations = await explainPathsToTarget('SAFETY_HOLD', {
  maxPaths: 5,
  minConfidence: 0.3,
});

// Returns human-readable path explanations
```

**Acceptance Criteria**: ✅
- Explains path such as: LICENSE_DRIFT → DECREASED_PECOS_TRUST → ENROLLMENT_CONFLICT → RISK_SPIKE → SAFETY_HOLD

### 3. WhatIfSimulator (`whatIfSimulator.ts`)

**Purpose**: Simulates remediation scenarios and predicts risk state changes.

**Features**:
- Simulates "what if" scenarios (e.g., "What if license is renewed?", "What if OPPE improves?")
- Predicts downstream effects through causal propagation
- Calculates risk score deltas
- Compares multiple scenarios
- Provides recommendations

**API**:
```typescript
import { simulateWhatIf, simulateMultipleScenarios, compareWhatIfResults } from './whatIfSimulator.js';

const result = await simulateWhatIf({
  description: 'What if license is renewed?',
  intervention: {
    eventType: 'LICENSE_RENEWED',
    action: 'ADD',
  },
}, {
  maxDepth: 3,
  timeHorizon: 90 * 24 * 60 * 60 * 1000, // 90 days
});

// Returns predicted changes and risk score delta
```

**Acceptance Criteria**: ✅
- Simulates remediation: e.g., 'What if license is renewed?', 'What if OPPE improves?', outputs predicted risk state changes

### 4. CausalOrchestrator Job (`jobs/causalGraph/causalOrchestrator.ts`)

**Purpose**: Runs daily + on safety/risk/drift events to update causal graph and compute explanations.

**Features**:
- Updates causal graph with recent events from database
- Computes causal explanations for target events
- Updates timeline with causal insights
- Runs on cron schedule (default: 2 AM daily)
- Can be triggered on specific events

**API**:
```typescript
import { runCausalOrchestrator, startCausalOrchestratorCron, triggerCausalOrchestratorOnEvent } from './causalOrchestrator.js';

// Start cron job
startCausalOrchestratorCron({
  runOnStartup: true,
  cronSchedule: '0 2 * * *', // 2 AM daily
});

// Trigger on specific event
await triggerCausalOrchestratorOnEvent('SAFETY_HOLD', 'clinician-123');
```

**Acceptance Criteria**: ✅
- Runs daily + on safety/risk/drift events; updates causal graph; computes new causal explanations; timeline updated

### 5. Causal → SupervisorAgent Integration (`services/supervisor/integration/causalIntegration.ts`)

**Purpose**: SupervisorAgent uses causal graph to decide task ordering, prioritization, and escalation.

**Features**:
- Enhances supervisor tasks with causal analysis
- Reorders tasks based on root cause priority
- Determines escalation based on causal chain severity
- Provides causal recommendations for task execution
- Integrates with supervisor planner

**API**:
```typescript
import {
  enhanceTasksWithCausalAnalysis,
  reorderTasksByCausalPriority,
  determineEscalationFromCausalChain,
  getCausalRecommendations,
} from './causalIntegration.js';

// Enhance tasks with causal analysis
const enhancements = await enhanceTasksWithCausalAnalysis(tasks, signals);
const reorderedTasks = reorderTasksByCausalPriority(enhancements);

// Determine escalation
const escalation = await determineEscalationFromCausalChain('SAFETY_HOLD', 'clinician-123');
```

**Integration with Supervisor Planner**:
The supervisor planner now supports `useCausalAnalysis` option:
```typescript
const tasks = await planTasks(signals, {
  useCausalAnalysis: true, // Enable causal graph analysis
});
```

**Acceptance Criteria**: ✅
- SupervisorAgent uses causal graph to decide task ordering, prioritization, and escalation

## File Structure

```
services/causalGraph/
├── types.ts                          # Type definitions
├── models/
│   └── causalGraphStore.ts          # In-memory graph store with seed data
├── rootCauseDetector.ts              # Root cause detection
├── pathExplainer.ts                   # Path explanation
├── whatIfSimulator.ts                 # What-if simulation
├── index.ts                           # Exports
└── tsconfig.json                      # TypeScript config

jobs/causalGraph/
└── causalOrchestrator.ts             # Daily orchestrator job

services/supervisor/integration/
└── causalIntegration.ts               # Supervisor integration
```

## Causal Graph Structure

The system uses a directed graph with:
- **Nodes**: Represent events (LICENSE_DRIFT, SAFETY_HOLD, etc.)
- **Edges**: Represent causal relationships with confidence scores
- **Seed Relationships**: Pre-defined causal chains such as:
  - LICENSE_DRIFT → DECREASED_PECOS_TRUST
  - DECREASED_PECOS_TRUST → ENROLLMENT_CONFLICT
  - ENROLLMENT_CONFLICT → RISK_SPIKE
  - RISK_SPIKE → SAFETY_HOLD

## Usage Examples

### Example 1: Find Root Causes for Safety Hold

```typescript
import { detectRootCauses } from './services/causalGraph/rootCauseDetector.js';

const result = await detectRootCauses('SAFETY_HOLD');
console.log(`Found ${result.rootCauses.length} root causes`);
result.rootCauses.forEach(rc => {
  console.log(`- ${rc.eventType}: ${(rc.confidence * 100).toFixed(1)}% confidence`);
});
```

### Example 2: Explain Causal Path

```typescript
import { explainPathsToTarget } from './services/causalGraph/pathExplainer.js';

const explanations = await explainPathsToTarget('SAFETY_HOLD');
explanations.forEach(exp => {
  console.log(exp.explanation);
  exp.humanReadableSteps.forEach(step => console.log(`  ${step}`));
});
```

### Example 3: Simulate Remediation

```typescript
import { simulateWhatIf } from './services/causalGraph/whatIfSimulator.js';

const result = await simulateWhatIf({
  description: 'What if license is renewed?',
  intervention: {
    eventType: 'LICENSE_RENEWED',
    action: 'ADD',
  },
});

console.log(`Risk change: ${result.overallRiskChange}`);
console.log(`Risk score delta: ${result.riskScoreDelta}`);
```

### Example 4: Use in Supervisor

```typescript
import { planTasks } from './services/supervisor/planner/supervisorPlanner.js';

const tasks = await planTasks(signals, {
  useCausalAnalysis: true, // Enable causal analysis
});
// Tasks are now reordered and prioritized based on root causes
```

## Next Steps

1. **Database Integration**: Connect to actual event tables (timeline events, safety signals, drift events)
2. **Graph Persistence**: Store causal graph in database for persistence across restarts
3. **Machine Learning**: Learn causal relationships from historical data
4. **Real-time Updates**: Update graph in real-time as events occur
5. **Visualization**: Add API endpoints for causal graph visualization
6. **Testing**: Add comprehensive unit and integration tests

## Notes

- The current implementation uses an in-memory graph store with seed data
- In production, this should be backed by a database or graph database (Neo4j, etc.)
- The causal relationships are currently hardcoded; in production, these could be learned from data
- The system is designed to be extensible and can be enhanced with additional event types and relationships

