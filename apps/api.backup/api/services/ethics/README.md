# Ethics Services

Implementation of ethics and compliance services for autonomous action monitoring and oversight.

## Services

### 1. BiasDetectionEngine (`biasDetector.ts`)

**B222B-ETH-006**

Monitors autonomous decisions for potential bias (geographical, demographic, institutional, temporal).

**Features:**
- Detects bias across multiple dimensions (geographical, demographic, institutional, temporal)
- Configurable thresholds for bias detection
- Integrates with ResearchKernel for statistical analysis
- Provides evidence and recommendations for detected bias
- Logs bias detections to audit trail

**Usage:**
```typescript
import { createBiasDetectionEngine } from '@domain/ethics/biasDetector';

const engine = createBiasDetectionEngine({
  thresholds: {
    geographical: 0.15,
    demographic: 0.20,
    institutional: 0.15,
    temporal: 0.10,
  },
});

const result = await engine.analyzeDecision({
  decisionId: 'decision_123',
  decisionType: 'privilege_grant',
  region: 'us-east',
  demographics: { specialty: 'cardiology' },
  outcome: 'approved',
  timestamp: new Date(),
});
```

### 2. RegulatoryComplianceChecker (`complianceChecker.ts`)

**B222B-ETH-007**

Validates autonomous actions for compliance with CMS/State licensing rules, HIPAA, TEFCA, and privilege compacts.

**Features:**
- Checks compliance across multiple regulatory frameworks:
  - CMS (Medicare/Medicaid)
  - State licensing requirements
  - HIPAA (PHI protection, audit logging, BAAs)
  - TEFCA (health information exchange)
  - Privilege compacts (cross-border practice)
- Logs compliance violations and exceptions
- Provides remediation recommendations

**Usage:**
```typescript
import { createRegulatoryComplianceChecker } from '@domain/autonomy/compliance/complianceChecker';

const checker = createRegulatoryComplianceChecker({
  strictMode: false,
  enabledFrameworks: [
    RegulatoryFramework.CMS,
    RegulatoryFramework.STATE_LICENSING,
    RegulatoryFramework.HIPAA,
  ],
});

const result = await checker.checkCompliance({
  actionId: 'action_123',
  actionType: 'privilege_grant',
  orgId: 'org_123',
  stateCode: 'CA',
  involvesPHI: true,
  timestamp: new Date(),
});
```

### 3. AutonomyKillSwitch (`killSwitch.ts`)

**B222B-ETH-008**

Emergency stop mechanism to immediately halt all autonomous actions across regions.

**Features:**
- Immediate halt of autonomous actions
- Region-specific or global activation
- Quorum-based re-enablement (requires multiple approvals)
- Role-based quorum requirements
- Event-driven architecture for integration

**Usage:**
```typescript
import { createAutonomyKillSwitch } from '@domain/autonomy/control/killSwitch';

const killSwitch = createAutonomyKillSwitch({
  quorumSize: 3,
  requiredRoles: ['admin', 'compliance_officer', 'ethics_board'],
});

// Activate emergency stop
const activation = await killSwitch.activateEmergencyStop(
  'user_123',
  'Suspected bias pattern detected',
  'us-east' // optional region
);

// Request quorum approval to re-enable
await killSwitch.requestReEnableApproval(
  activation.id,
  'admin_user',
  'admin'
);
```

### 4. EthicsAuditTrail (`auditTrail.ts`)

**B222B-ETH-009**

Immutable log of autonomous actions, bias checks, and compliance outcomes with cryptographic proofs.

**Features:**
- Immutable audit trail with cryptographic hashing
- Digital signatures for entry integrity
- Merkle tree proofs (optional)
- Access control for oversight bodies
- Chain integrity via previous hash linking

**Usage:**
```typescript
import { createEthicsAuditTrail } from '@domain/ethics/auditTrail';

const auditTrail = createEthicsAuditTrail({
  enableMerkleProofs: true,
  enableBlockchainAnchoring: false,
});

// Log autonomous action
await auditTrail.logAutonomousAction('action_123', {
  actionType: 'privilege_grant',
  orgId: 'org_123',
  outcome: { approved: true },
});

// Query entries
const entries = await auditTrail.queryEntries({
  types: [AuditTrailEntryType.AUTONOMOUS_ACTION],
  orgId: 'org_123',
  startTime: new Date('2024-01-01'),
});
```

### 5. OversightNotificationService (`oversightNotification.ts`)

**B222B-ETH-010**

Notifies stakeholders (clinicians, orgs, boards) of autonomous actions and ethics/compliance flags.

**Features:**
- Multi-channel notifications (in-app, email, SMS)
- Stakeholder-specific notification preferences
- Urgency-based filtering
- Includes links to explanation graphs
- Supports multiple notification types

**Usage:**
```typescript
import { createOversightNotificationService } from '@domain/ethics/oversightNotification';

const notificationService = createOversightNotificationService({
  explanationGraphBaseUrl: 'https://app.example.com/explain',
  enableEmail: true,
});

// Notify of bias detection
await notificationService.notifyBiasDetected({
  decisionId: 'decision_123',
  orgId: 'org_123',
  biasType: 'demographic',
  severity: 0.8,
  description: 'Demographic bias detected',
  explanationGraphLink: 'https://app.example.com/explain/graph_123',
});

// Notify of compliance violation
await notificationService.notifyComplianceViolation({
  actionId: 'action_123',
  failedFramework: 'HIPAA',
  violations: [{
    framework: 'HIPAA',
    rule: 'HIPAA_PHI_AUTHORIZATION',
    severity: 'critical',
  }],
});
```

## Integration

These services are designed to work together:

1. **Autonomous actions** are checked for **bias** and **compliance**
2. **Violations** are logged to the **audit trail**
3. **Stakeholders** are **notified** of issues
4. **Kill switch** can halt all actions if needed
5. **Oversight bodies** can query the **audit trail** for review

## Configuration

All services support configuration via constructor parameters. Default configurations are provided but can be overridden based on organizational needs.

## Dependencies

- `@chai-vc/logging-core` - Logging
- `@prisma/client` - Database access
- `crypto` - Cryptographic operations
- `events` - Event emitter for kill switch

## Future Enhancements

- Database schema for persistent storage
- ResearchKernel integration for bias metrics
- Blockchain anchoring for audit trail
- Email/SMS service integration for notifications
- Real-time dashboard for oversight bodies

