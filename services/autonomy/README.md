# Autonomy Service - Self-Healing System

This service implements autonomic/self-healing capabilities for the platform, including monitoring, drift detection, automatic recovery, and distributed state reconciliation.

## Components

### 1. AutonomicLoopController (`loops/controller.ts`)

Monitors modules, queues, and databases; triggers remediation tasks on anomaly detection with pluggable policies.

**Features:**
- Continuous monitoring of system resources
- Anomaly detection (high latency, queue overflow, database issues)
- Pluggable remediation policies
- Automatic remediation task execution

**Usage:**
```typescript
import { AutonomicLoopController } from './loops/controller.js';

const controller = new AutonomicLoopController({
  checkIntervalMs: 30000,
  queueThresholds: {
    maxPending: 1000,
    maxRunning: 100,
    maxDeadLetter: 50,
    maxAvgLatencyMs: 5000,
  },
});

controller.start();
```

### 2. StateDriftDetector (`drift/detector.ts`)

Compares expected vs actual module state; logs drift; escalates if persistent.

**Features:**
- Expected state registration
- Continuous state comparison
- Drift detection (status mismatch, task count, latency, error rate)
- Escalation actions based on persistence

**Usage:**
```typescript
import { StateDriftDetector } from './drift/detector.js';

const detector = new StateDriftDetector({
  checkIntervalMs: 60000,
  persistenceThreshold: 3,
});

detector.registerExpectedState({
  moduleId: 'module:SUPERVISOR_RUN',
  expectedStatus: 'running',
  expectedTaskCount: 5,
  expectedMaxLatencyMs: 1000,
  expectedErrorRate: 0.1,
});

detector.start();
```

### 3. SupervisorAutoRecoveryHandler (`../supervisor/autoRecovery.ts`)

When tasks repeatedly fail, Supervisor invokes remediation flows (restart module, clear cache, failover).

**Features:**
- Failure threshold monitoring
- Remediation flow execution (restart, clear cache, failover, scale up, investigate)
- Cooldown periods to prevent thrashing
- Priority-based flow selection

**Usage:**
```typescript
import { SupervisorAutoRecoveryHandler } from '../supervisor/autoRecovery.js';

const recoveryHandler = new SupervisorAutoRecoveryHandler({
  failureThreshold: 3,
  failureWindowMs: 300000,
});

recoveryHandler.start();
```

### 4. DistributedStateReconciler (`state/reconciler.ts`)

Across regions, reconciles queue offsets, supervisor context, module health; resolves conflicts via CRDT.

**Features:**
- Multi-region state reconciliation
- CRDT-based conflict resolution (last-write-wins, max-value, union)
- Queue offset reconciliation
- Supervisor context merging
- Module health aggregation

**Usage:**
```typescript
import { DistributedStateReconciler } from './state/reconciler.js';

const reconciler = new DistributedStateReconciler({
  regionId: 'us-east-1',
  reconciliationIntervalMs: 60000,
  peers: ['us-west-2', 'eu-west-1'],
  conflictResolution: {
    queueOffsets: 'max_value',
    supervisorContext: 'last_write_wins',
    moduleHealth: 'union',
  },
});

reconciler.start();
```

## Testing

Comprehensive test suite in `tests/autonomy/selfHealing.test.ts` that simulates:
- Module crashes
- Network splits
- Database corruption
- Queue overflow
- State drift
- Task failures

Run tests:
```bash
npm test -- tests/autonomy/selfHealing.test.ts
```

## Integration

To integrate these components into your application:

1. **Start monitoring:**
```typescript
import { AutonomicLoopController } from './services/autonomy/loops/controller.js';
import { StateDriftDetector } from './services/autonomy/drift/detector.js';
import { SupervisorAutoRecoveryHandler } from './services/supervisor/autoRecovery.js';
import { DistributedStateReconciler } from './services/autonomy/state/reconciler.js';

// Initialize and start all components
const controller = new AutonomicLoopController();
const detector = new StateDriftDetector();
const recoveryHandler = new SupervisorAutoRecoveryHandler();
const reconciler = new DistributedStateReconciler();

controller.start();
detector.start();
recoveryHandler.start();
reconciler.start();
```

2. **Register expected states:**
```typescript
detector.registerExpectedState({
  moduleId: 'module:SUPERVISOR_RUN',
  expectedStatus: 'running',
  expectedTaskCount: 10,
  expectedMaxLatencyMs: 2000,
  expectedErrorRate: 0.05,
});
```

3. **Add custom remediation policies:**
```typescript
controller.addPolicy({
  name: 'custom-policy',
  appliesTo: (anomaly, resource) => {
    return anomaly.type === 'custom_anomaly';
  },
  generateRemediationTasks: (anomaly, resource) => {
    return [{
      taskType: 'SUPERVISOR_RUN',
      priority: 10,
      payload: { action: 'custom_remediation' },
    }];
  },
});
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              AutonomicLoopController                      │
│  Monitors: Modules, Queues, Databases                     │
│  Triggers: Remediation Tasks                              │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              StateDriftDetector                          │
│  Compares: Expected vs Actual State                      │
│  Escalates: Persistent Drift                             │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│         SupervisorAutoRecoveryHandler                    │
│  Monitors: Task Failures                                 │
│  Executes: Remediation Flows                             │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│         DistributedStateReconciler                        │
│  Reconciles: Queue Offsets, Context, Health               │
│  Resolves: Conflicts via CRDT                            │
└─────────────────────────────────────────────────────────┘
```

## Configuration

All components support configuration via constructor options. See individual component files for detailed configuration options.

## Monitoring

All components use structured logging via `@chai-vc/logging-core`. Key events are logged with appropriate log levels:
- `info`: Normal operations
- `warn`: Anomalies detected
- `error`: Critical issues requiring attention

## Future Enhancements

- Metrics export for Prometheus
- Webhook notifications for critical anomalies
- Machine learning-based anomaly detection
- Advanced CRDT implementations (LWW-Register, G-Counter, etc.)
- Integration with Kubernetes for module restarts
- Distributed tracing support

