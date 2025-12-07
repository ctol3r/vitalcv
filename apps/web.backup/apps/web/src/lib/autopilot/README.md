# Autopilot Engine

Production-grade client-side Autopilot engine for VitalCV that automatically manages credentials, compliance, and chain synchronization.

## Architecture

The Autopilot Engine consists of five core components:

1. **AutopilotEngine** - Main orchestrator that coordinates all tasks
2. **AutopilotScheduler** - Determines when autopilot should run
3. **AutopilotTaskRegistry** - Manages all available tasks
4. **AutopilotAIReasoner** - Ranks task importance using AI/ML logic
5. **AutopilotChainBridge** - Handles chain synchronization and anchor management

## Usage

### Basic Setup

```tsx
import { AutopilotProvider } from '@/contexts/AutopilotContext';
import { useAutopilot } from '@/contexts/AutopilotContext';
import { getDefaultTasks } from '@/lib/autopilot/tasks';

// Wrap your app or specific route with the provider
function App() {
  return (
    <AutopilotProvider>
      <YourComponent />
    </AutopilotProvider>
  );
}

// Use in components
function MyComponent() {
  const { status, run, registerTask, getMostImportantTask } = useAutopilot();

  useEffect(() => {
    // Register default tasks
    getDefaultTasks().forEach(task => registerTask(task));
  }, [registerTask]);

  return (
    <button onClick={() => run()}>
      Run Autopilot ({status})
    </button>
  );
}
```

### Creating Custom Tasks

```tsx
import type { AutopilotTask } from '@/lib/autopilot/types';
import { useAutopilot } from '@/contexts/AutopilotContext';

function MyComponent() {
  const { registerTask } = useAutopilot();

  useEffect(() => {
    const customTask: AutopilotTask = {
      id: 'my-custom-task',
      name: 'My Custom Task',
      priority: 85,
      description: 'Does something important',
      category: 'custom',
      execute: async () => {
        // Your task logic here
        console.log('Executing custom task...');
      },
    };

    registerTask(customTask);
  }, [registerTask]);
}
```

### Desktop One-Page View

The desktop one-page view is available at `/autopilot` and provides:

- **Left Panel**: Identity orb, trust score, telemedicine readiness, compliance
- **Center Panel**: Single actionable item ("Fix This One Thing" or "You're Ready")
- **Right Panel**: Credentials list, chain anchor statuses, compact coverage, privileges

## Backend Integration

The Autopilot Engine integrates with five backend microservices:

1. **autopilot-orchestrator** - Finds missing/stale credentials, generates tasks
2. **autopilot-sync** - Pulls from official sources (state boards, DEA, ABMS/AOA, etc.)
3. **autopilot-chain-service** - Re-anchors credentials, checks consensus
4. **autopilot-compliance** - Tracks compliance cycles, predicts trustScore
5. **autopilot-ai** - Summarizes actions, decides next steps

### API Functions

```tsx
import {
  fetchAutopilotTasks,
  syncCredentials,
  refreshChainAnchors,
  getComplianceStatus,
  getAIRecommendations,
} from '@/lib/autopilot/api';

// Fetch tasks from orchestrator
const tasks = await fetchAutopilotTasks(clinicianId);

// Sync credentials from official sources
const syncResult = await syncCredentials(clinicianId);

// Refresh chain anchors
const chainResult = await refreshChainAnchors(clinicianId);

// Get compliance status
const compliance = await getComplianceStatus(clinicianId);

// Get AI recommendations
const recommendations = await getAIRecommendations(clinicianId);
```

## Task Execution Flow

1. **Scheduler Check**: `AutopilotScheduler.shouldRun()` determines if autopilot should run
2. **Task Ranking**: `AutopilotAIReasoner.rankImportance()` sorts tasks by priority
3. **Task Execution**: Tasks execute in priority order
4. **Chain Sync**: `AutopilotChainBridge.refreshAnchorsIfNeeded()` runs after tasks complete
5. **Status Update**: Engine status updates to `Ready` or `AttentionNeeded`

## Status States

- **Idle**: Autopilot not running
- **Running**: Currently executing tasks
- **Ready**: All tasks completed successfully
- **AttentionNeeded**: Issues detected, user action required

## Configuration

```tsx
const config: AutopilotConfig = {
  enabled: true,
  trustCheckIntervalHours: 4,      // Run every 4 hours
  compactSyncIntervalHours: 24,     // Sync compacts daily
  quietModeEnabled: true,           // Don't show notifications
  batterySaverMode: false,         // Reduce background activity
};

<AutopilotProvider config={config}>
  {children}
</AutopilotProvider>
```

## Example Tasks

Default tasks included:

- `credential-sync` - Sync credentials from official sources
- `chain-anchor-refresh` - Refresh stale chain anchors
- `compliance-check` - Check compliance status
- `expiration-check` - Identify expiring credentials
- `dea-verification` - Verify DEA registration status

## Integration with Lumen System

The Autopilot Engine can integrate with the Lumen visual identity system:

```tsx
import { useLumen } from '@/lib/lumen/LumenContext';

function AutopilotWithLumen() {
  const { updateSnapshot } = useLumen();
  const { healthSummary } = useAutopilot();

  useEffect(() => {
    if (healthSummary) {
      updateSnapshot({
        trust: healthSummary.confidence / 100,
        compliance: 0.85,
        // ... other snapshot data
      });
    }
  }, [healthSummary, updateSnapshot]);
}
```

## Error Handling

Tasks that throw errors are automatically captured as `AutopilotIssue` objects:

```tsx
const { pendingIssues, clearIssues } = useAutopilot();

// Issues include:
// - task name
// - error object
// - timestamp
// - isCritical flag (for high-priority tasks)

// Clear all issues
clearIssues();
```

## Health Summary

Get a comprehensive health summary:

```tsx
const { healthSummary } = useAutopilot();

// healthSummary includes:
// - status: AutopilotStatus
// - lastRun: Date | null
// - pendingIssues: number
// - totalTasks: number
// - completedTasks: number
// - confidence: number (0-100)
```

