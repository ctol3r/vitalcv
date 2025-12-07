# Resilience Services

This directory contains services for improving system resilience, including chaos engineering, disaster recovery, deployment strategies, and failover management.

## Services

### 1. ChaosInjectionService (`chaosInjection.ts`)

**B229B-OBS-006**: Enables controlled fault injection (latency, timeout, dropped requests) at runtime.

**Features:**
- Runtime fault injection with configurable probability
- Support for latency, timeout, error, and drop faults
- Integration with Autonomy engine for coordinated experiments
- Toggleable via configuration

**Usage:**
```typescript
import { chaosInjectionService } from './chaosInjection';

// Apply fault injection to a request
await chaosInjectionService.applyFault('/api/users');

// Start a chaos experiment
const experimentId = await chaosInjectionService.startExperiment({
  name: 'API Latency Test',
  hypothesis: 'System can handle 500ms latency',
  blastRadius: ['api', 'database'],
  duration: 300, // 5 minutes
  faults: [{
    enabled: true,
    faultType: FaultType.LATENCY,
    target: '/api/users',
    probability: 0.5,
    latencyMs: 500,
  }],
});
```

### 2. DisasterRecoveryService (`disasterRecovery.ts`)

**B229B-OBS-007**: Manages backup and restore of critical databases and blockchain states.

**Features:**
- Full and incremental backups
- RTO/RPO threshold management
- Support for database, blockchain, and filesystem backups
- Automated restore operations

**Usage:**
```typescript
import { disasterRecoveryService } from './disasterRecovery';

// Create a full backup
const backupId = await disasterRecoveryService.createFullBackup(
  'database',
  'database',
  { metadata: { version: '1.0.0' } }
);

// Create an incremental backup
const incrementalBackupId = await disasterRecoveryService.createIncrementalBackup(
  'database',
  'database',
  backupId
);

// Restore from backup
const restoreId = await disasterRecoveryService.restore(backupId, 'production-db');
```

### 3. BlueGreenDeploymentPipeline (`deployment/blueGreenPipeline.ts`)

**B229B-OBS-008**: Implements blue/green deployment strategy using CI/CD.

**Features:**
- Automated health checks
- Gradual or instant traffic shifting
- Automatic rollback on failure
- Zero-downtime deployments

**Usage:**
```typescript
import { blueGreenPipeline } from './deployment/blueGreenPipeline';

// Deploy with health checks and gradual traffic shift
const deploymentId = await blueGreenPipeline.deploy('v1.2.0', {
  healthCheck: {
    endpoint: '/health',
    intervalMs: 5000,
    timeoutMs: 3000,
    maxAttempts: 3,
  },
  trafficShift: {
    strategy: 'gradual',
    steps: 5,
    stepIntervalMs: 10000,
  },
  rollbackOnFailure: true,
});

// Rollback if needed
await blueGreenPipeline.rollback(deploymentId);
```

### 4. ChaosExperimentRegistry (`chaosExperimentRegistry.ts`)

**B229B-OBS-009**: Keeps a catalog of past and scheduled chaos experiments.

**Features:**
- Experiment catalog with full metadata
- Hypothesis and blast radius tracking
- Outcome recording and analysis
- Integration with Lineage service for provenance

**Usage:**
```typescript
import { chaosExperimentRegistry } from './chaosExperimentRegistry';

// Register an experiment
const experimentId = await chaosExperimentRegistry.registerExperiment({
  name: 'Database Latency Test',
  hypothesis: 'System degrades gracefully under database latency',
  blastRadius: ['database', 'api'],
  duration: 600,
  startTime: new Date(Date.now() + 3600000), // Start in 1 hour
  faults: [/* ... */],
});

// Complete experiment with results
await chaosExperimentRegistry.completeExperiment(experimentId, {
  outcome: ExperimentOutcome.SUCCESS,
  metrics: {
    requestsAffected: 1000,
    errorsInduced: 5,
    latencyAdded: 500,
  },
  observations: ['System handled latency well'],
  lessonsLearned: ['Consider adding circuit breakers'],
});

// Query experiments
const experiments = chaosExperimentRegistry.queryExperiments({
  status: 'completed',
  outcome: ExperimentOutcome.SUCCESS,
});
```

### 5. FailoverManager (`failoverManager.ts`)

**B229B-OBS-010**: Automatically redirects traffic to healthy regions and replicas upon failure.

**Features:**
- Continuous health monitoring
- Automatic failover to healthy regions
- Traffic redirection
- Event emission to ObservabilityDashboard

**Usage:**
```typescript
import { FailoverManager, HealthStatus } from './failoverManager';

// Initialize failover manager
const failoverManager = new FailoverManager({
  enabled: true,
  autoFailover: true,
  healthCheck: {
    endpoint: '/health',
    intervalMs: 10000,
    timeoutMs: 5000,
    failureThreshold: 3,
    successThreshold: 2,
  },
  regions: [
    {
      id: 'us-east-1',
      url: 'https://api-us-east.example.com',
      priority: 1,
      enabled: true,
    },
    {
      id: 'us-west-2',
      url: 'https://api-us-west.example.com',
      priority: 2,
      enabled: true,
    },
  ],
});

// Listen for failover events
failoverManager.on('failover', (event) => {
  console.log('Failover event:', event);
});

// Get health status
const health = failoverManager.getRegionHealth('us-east-1');
console.log('Region health:', health?.status);
```

## Configuration

### Environment Variables

- `CHAOS_INJECTION_ENABLED`: Enable/disable chaos injection (default: false)
- `BACKUP_STORAGE_PATH`: Path for backup storage (default: ./backups)
- `BLUE_ENVIRONMENT_URL`: URL for blue environment
- `GREEN_ENVIRONMENT_URL`: URL for green environment

## Integration

### Autonomy Engine

ChaosInjectionService integrates with the Autonomy engine to coordinate experiments:

```typescript
import { AutonomicLoopController } from '../autonomy/loops/controller';
import { chaosInjectionService } from './chaosInjection';

const autonomyController = new AutonomicLoopController();
const chaosService = new ChaosInjectionService({
  enabled: true,
  autonomyController,
});
```

### Lineage Service

ChaosExperimentRegistry integrates with the Lineage service for provenance tracking:

```typescript
import { provenanceService } from '../lineage/provenanceService';
import { chaosExperimentRegistry } from './chaosExperimentRegistry';

// Get experiment lineage
const lineage = await chaosExperimentRegistry.getExperimentLineage(experimentId);
```

### Observability Dashboard

FailoverManager emits events to the ObservabilityDashboard:

```typescript
failoverManager.on('failover', async (event) => {
  // Emit to observability dashboard
  await observabilityDashboard.recordEvent(event);
});
```

## Testing

Each service can be tested independently:

```typescript
import { chaosInjectionService } from './chaosInjection';

// Disable chaos injection for testing
chaosInjectionService.setEnabled(false);

// Test without fault injection
await chaosInjectionService.applyFault('/api/test');
```

## Best Practices

1. **Chaos Experiments**: Always start with small blast radius and gradually increase
2. **Backups**: Schedule regular backups based on RPO requirements
3. **Deployments**: Use gradual traffic shifting for critical services
4. **Failover**: Monitor health checks and adjust thresholds based on service characteristics
5. **Observability**: Ensure all events are properly logged and monitored

