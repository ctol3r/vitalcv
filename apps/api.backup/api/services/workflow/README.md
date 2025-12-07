# Workflow Service

Comprehensive workflow orchestration system for the Chai VC Platform.

## Overview

The Workflow Service provides a complete workflow engine with support for:
- **Triggers**: Event-based, cron-scheduled, and webhook triggers
- **Actions**: External API calls, notifications, and data transformations
- **Retry Policies**: Fixed interval, exponential backoff, and max attempts
- **Security**: Role-based access control (RBAC)
- **Analytics**: Execution metrics and performance tracking
- **DSL**: User-friendly domain-specific language for workflow definitions

## Architecture

```
services/workflow/
├── models/
│   └── types.ts              # Type definitions and schemas
├── triggers/
│   ├── eventTriggerService.ts    # Event-based triggers
│   ├── cronTriggerService.ts     # Scheduled triggers
│   └── webhookTriggerService.ts  # Webhook triggers
├── actions/
│   ├── externalAPIAction.ts      # External API calls
│   ├── notificationAction.ts      # Notifications (email/SMS/in-app)
│   └── dataTransformAction.ts    # Data transformations
├── engine/
│   └── retryPolicyHandler.ts      # Retry logic
├── security/
│   └── rbacEnforcer.ts           # RBAC enforcement
├── analytics/
│   └── workflowAnalyticsService.ts # Metrics and analytics
├── dsl/
│   └── dslParser.ts              # DSL parser
└── index.ts                      # Main exports
```

## Dependencies

The following npm packages are required:

```json
{
  "dependencies": {
    "axios": "^1.6.0",
    "cron-parser": "^4.9.0",
    "handlebars": "^4.7.8"
  },
  "devDependencies": {
    "@types/cron-parser": "^3.0.0"
  }
}
```

## Usage

### Basic Workflow Definition

```typescript
import {
  WorkflowDefinition,
  TriggerType,
  ActionType,
} from '@chai-vc/workflow';

const workflow: WorkflowDefinition = {
  id: 'credential-issued-workflow',
  name: 'Credential Issued Workflow',
  description: 'Handles notifications when a credential is issued',
  trigger: {
    type: TriggerType.EVENT,
    eventType: 'CREDENTIAL_ISSUED',
    filters: {
      'credentialType': 'medical_license',
    },
  },
  steps: [
    {
      id: 'send-notification',
      name: 'Send Notification',
      action: {
        type: ActionType.NOTIFICATION,
        channel: 'email',
        template: 'credential-issued-email',
        recipients: ['{{userId}}'],
        personalization: {
          credentialType: '{{triggerData.credentialType}}',
        },
      },
    },
  ],
  enabled: true,
};
```

### Event Trigger Service

```typescript
import { EventTriggerService } from '@chai-vc/workflow';
import { bus } from '@/agents/bus';

const eventTriggerService = new EventTriggerService(bus);

// Register workflow
eventTriggerService.registerWorkflow(workflow, workflow.trigger);

// Set workflow executor
eventTriggerService.setWorkflowExecutor(async (context) => {
  // Execute workflow steps
  for (const step of workflow.steps) {
    // Execute step...
  }
});
```

### Cron Trigger Service

```typescript
import { CronTriggerService } from '@chai-vc/workflow';

const cronTriggerService = new CronTriggerService();

// Register workflow with cron trigger
await cronTriggerService.registerWorkflow(workflow, {
  type: TriggerType.CRON,
  expression: '0 9 * * *', // Daily at 9 AM
  timezone: 'America/New_York',
});

// Start the service
await cronTriggerService.start();
```

### Webhook Trigger Service

```typescript
import { WebhookTriggerService } from '@chai-vc/workflow';
import express from 'express';

const app = express();
const webhookTriggerService = new WebhookTriggerService();

// Register workflow
webhookTriggerService.registerWorkflow(workflow, {
  type: TriggerType.WEBHOOK,
  path: '/webhooks/credential-issued',
  method: 'POST',
  secret: process.env.WEBHOOK_SECRET,
});

// Add middleware
app.post('/webhooks/*', webhookTriggerService.getMiddleware());
```

### RBAC Enforcement

```typescript
import { WorkflowRBACEnforcer, WorkflowPermission } from '@chai-vc/workflow';

const rbacEnforcer = new WorkflowRBACEnforcer();

const user = {
  userId: 'user-123',
  roles: ['workflow_editor'],
  orgId: 'org-456',
};

// Check permissions
if (rbacEnforcer.canExecute(user, workflow)) {
  // Execute workflow
} else {
  throw new Error('Insufficient permissions');
}
```

### Analytics

```typescript
import { WorkflowAnalyticsService } from '@chai-vc/workflow';

const analyticsService = new WorkflowAnalyticsService();

// Record execution
await analyticsService.recordExecution(executionResult, TriggerType.EVENT);

// Get metrics
const metrics = await analyticsService.getWorkflowMetrics('workflow-id', {
  start: new Date('2024-01-01'),
  end: new Date('2024-12-31'),
});

console.log(`Success rate: ${metrics.successRate * 100}%`);
console.log(`Average duration: ${metrics.averageDuration}ms`);
```

### DSL Parser

```typescript
import { WorkflowDSLParser } from '@chai-vc/workflow';

const parser = new WorkflowDSLParser();

const dsl = `
workflow credential_issued "Credential Issued Workflow" {
  description: "Handles notifications when a credential is issued"
  trigger: event CREDENTIAL_ISSUED filters: { credentialType: "medical_license" }
  steps: [
    step send_notification "Send Notification" {
      action: notify email "credential-issued-email" to ["{{userId}}"]
      retry: exponential maxAttempts: 3 interval: 1000
    }
  ]
}
`;

const workflow = parser.parse(dsl);
```

## Database Schema

The workflow service requires the following database tables:

```sql
-- Workflow executions
CREATE TABLE IF NOT EXISTS "WorkflowExecution" (
  execution_id VARCHAR(255) PRIMARY KEY,
  workflow_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,
  trigger_type VARCHAR(50) NOT NULL,
  duration_ms INTEGER,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  error_message TEXT,
  step_results JSONB,
  INDEX idx_workflow_id (workflow_id),
  INDEX idx_started_at (started_at)
);

-- Cron schedules
CREATE TABLE IF NOT EXISTS "WorkflowSchedule" (
  workflow_id VARCHAR(255) PRIMARY KEY,
  trigger_type VARCHAR(50) NOT NULL,
  cron_expression VARCHAR(255),
  timezone VARCHAR(100),
  next_run TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Webhook requests (optional, for audit)
CREATE TABLE IF NOT EXISTS "WebhookRequest" (
  id SERIAL PRIMARY KEY,
  workflow_id VARCHAR(255) NOT NULL,
  path VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  ip VARCHAR(45),
  headers JSONB,
  body JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_workflow_id (workflow_id),
  INDEX idx_created_at (created_at)
);
```

## Testing

Each service includes comprehensive tests. Run tests with:

```bash
npm test -- services/workflow
```

## Integration

### With Event Bus

The workflow service integrates with the existing event bus system:

```typescript
import { emitEvent } from '@/agents/bus';
import { EventTriggerService } from '@chai-vc/workflow';

// Emit events that trigger workflows
emitEvent({
  type: 'CREDENTIAL_ISSUED',
  credentialType: 'medical_license',
  userId: 'user-123',
});
```

### With Notification Service

The workflow service uses the existing notification service:

```typescript
import { createNotification } from '@chai-vc/notifications';

// Used internally by NotificationAction
```

## Security Considerations

1. **Webhook Signatures**: Always use secrets for webhook triggers
2. **RBAC**: Enforce permissions before workflow execution
3. **Input Validation**: Validate all workflow definitions and DSL input
4. **Rate Limiting**: Webhook triggers include built-in rate limiting
5. **Error Handling**: Failed workflows are logged and tracked

## Performance

- **Concurrent Execution**: Workflows execute asynchronously
- **Retry Policies**: Configurable retry logic prevents resource exhaustion
- **Analytics**: Metrics are aggregated efficiently
- **Database**: Indexed queries for fast analytics retrieval

## Future Enhancements

- [ ] Visual workflow builder UI
- [ ] Workflow versioning and rollback
- [ ] Workflow templates library
- [ ] Advanced condition expressions
- [ ] Workflow dependencies and chaining
- [ ] Real-time execution monitoring dashboard

