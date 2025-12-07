/**
 * CausalOrchestrator Job
 *
 * Runs daily + on safety/risk/drift events:
 * - Updates causal graph with new events
 * - Computes new causal explanations
 * - Updates timeline with causal insights
 */

import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { createLogger } from '@chai-vc/logging-core';
import type { CausalEventType, CausalNode } from '../../services/causalGraph/types.js';
import { getCausalGraphStore } from '../../services/causalGraph/models/causalGraphStore.js';
import { detectRootCauses } from '../../services/causalGraph/rootCauseDetector.js';
import { explainPathsToTarget } from '../../services/causalGraph/pathExplainer.js';
import { logCredentialTimelineEvent } from '../../services/timeline/logCredentialTimelineEvent.js';
import {
  CredentialTimelineEventType,
  TimelineEventSeverity,
} from '@prisma/client';

const prisma = new PrismaClient();
const logger = createLogger({ service: 'causal-orchestrator' });

export interface CausalOrchestratorOptions {
  runOnStartup?: boolean;
  cronSchedule?: string; // Default: '0 2 * * *' (2 AM daily)
  processEventTypes?: CausalEventType[]; // Which event types to process
}

/**
 * Run the causal orchestrator
 */
export async function runCausalOrchestrator(
  options: CausalOrchestratorOptions = {}
): Promise<void> {
  const {
    processEventTypes = [
      'SAFETY_HOLD' as CausalEventType,
      'RISK_SPIKE' as CausalEventType,
      'LICENSE_DRIFT' as CausalEventType,
      'ENROLLMENT_CONFLICT' as CausalEventType,
    ],
  } = options;

  logger.info('Starting causal orchestrator run', {
    eventTypes: processEventTypes,
  });

  const store = getCausalGraphStore();
  await store.initialize();

  // Step 1: Update causal graph with recent events
  const updatedNodes = await updateCausalGraphFromEvents(processEventTypes);
  logger.info('Updated causal graph', { nodeCount: updatedNodes.length });

  // Step 2: Compute causal explanations for target events
  const explanations: Array<{
    targetEvent: CausalEventType;
    rootCauses: number;
    paths: number;
  }> = [];

  for (const eventType of processEventTypes) {
    try {
      const rootCauseResult = await detectRootCauses(eventType, {
        maxDepth: 5,
        minConfidence: 0.3,
        maxPathsPerRoot: 10,
      });

      const pathExplanations = await explainPathsToTarget(eventType, {
        maxPaths: 5,
        minConfidence: 0.3,
      });

      explanations.push({
        targetEvent: eventType,
        rootCauses: rootCauseResult.rootCauses.length,
        paths: pathExplanations.length,
      });

      // Step 3: Update timeline with causal insights
      await updateTimelineWithCausalInsights(eventType, rootCauseResult.rootCauses, pathExplanations);
    } catch (error) {
      logger.error('Error processing event type', {
        eventType,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info('Causal orchestrator run completed', {
    updatedNodes: updatedNodes.length,
    explanations: explanations.length,
  });
}

/**
 * Update causal graph from recent events in the database
 */
async function updateCausalGraphFromEvents(
  eventTypes: CausalEventType[]
): Promise<CausalNode[]> {
  const store = getCausalGraphStore();
  const newNodes: CausalNode[] = [];
  const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Map event types to database queries
  // This is a simplified example - in production, you'd query actual event tables
  for (const eventType of eventTypes) {
    try {
      // Query for recent events of this type
      // Example: Query timeline events, safety signals, drift events, etc.
      const events = await queryEventsByType(eventType, last24Hours);

      for (const event of events) {
        const node: CausalNode = {
          id: `node-${event.id || Date.now()}-${Math.random()}`,
          eventType,
          entityId: event.entityId,
          entityType: event.entityType,
          timestamp: event.timestamp || new Date(),
          severity: mapSeverity(event.severity),
          metadata: event.metadata,
          resolved: event.resolved || false,
          resolvedAt: event.resolvedAt,
        };

        store.addNode(node);
        newNodes.push(node);
      }
    } catch (error) {
      logger.warn('Error querying events', {
        eventType,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return newNodes;
}

/**
 * Query events by type from the database
 * This is a placeholder - implement based on your actual event storage
 */
async function queryEventsByType(
  eventType: CausalEventType,
  since: Date
): Promise<Array<{
  id?: string;
  entityId?: string;
  entityType?: string;
  timestamp?: Date;
  severity?: string;
  metadata?: Record<string, unknown>;
  resolved?: boolean;
  resolvedAt?: Date;
}>> {
  // Placeholder implementation
  // In production, you would query:
  // - Timeline events
  // - Safety signals
  // - Drift events
  // - Risk events
  // etc.

  // Example: Query timeline events
  try {
    const timelineEvents = await prisma.credentialTimelineEvent.findMany({
      where: {
        eventType: mapEventTypeToTimelineType(eventType),
        createdAt: {
          gte: since,
        },
      },
      take: 100,
    });

    return timelineEvents.map((event) => ({
      id: event.id,
      entityId: event.clinicianId || undefined,
      entityType: 'clinician',
      timestamp: event.createdAt,
      severity: event.severity,
      metadata: event.metadata as Record<string, unknown> | undefined,
    }));
  } catch (error) {
    logger.warn('Error querying timeline events', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Map causal event type to timeline event type
 */
function mapEventTypeToTimelineType(
  eventType: CausalEventType
): CredentialTimelineEventType {
  // This is a simplified mapping - adjust based on your actual event types
  const mapping: Partial<Record<CausalEventType, CredentialTimelineEventType>> = {
    SAFETY_HOLD: CredentialTimelineEventType.SAFETY_HOLD,
    RISK_SPIKE: CredentialTimelineEventType.RISK_ALERT,
    LICENSE_DRIFT: CredentialTimelineEventType.DRIFT_DETECTED,
    ENROLLMENT_CONFLICT: CredentialTimelineEventType.ENROLLMENT_ISSUE,
  };

  return (
    mapping[eventType] ||
    CredentialTimelineEventType.SUPERVISOR_TRIGGER
  );
}

/**
 * Map severity string to CausalNode severity
 */
function mapSeverity(severity?: string | null): 'LOW' | 'MED' | 'HIGH' | 'CRITICAL' {
  if (!severity) return 'MED';

  const upper = severity.toUpperCase();
  if (upper === 'CRITICAL') return 'CRITICAL';
  if (upper === 'HIGH') return 'HIGH';
  if (upper === 'LOW') return 'LOW';
  return 'MED';
}

/**
 * Update timeline with causal insights
 */
async function updateTimelineWithCausalInsights(
  targetEvent: CausalEventType,
  rootCauses: Array<{
    eventType: CausalEventType;
    nodeId: string;
    confidence: number;
    paths: Array<{
      nodes: CausalNode[];
      edges: Array<{
        sourceEventType: CausalEventType;
        targetEventType: CausalEventType;
        confidence: number;
      }>;
      totalConfidence: number;
    }>;
  }>,
  pathExplanations: Array<{
    explanation: string;
    humanReadableSteps: string[];
    confidence: number;
  }>
): Promise<void> {
  if (rootCauses.length === 0) return;

  // Find the top root cause
  const topRootCause = rootCauses[0];

  // Get entities from the paths
  const entities = new Set<string>();
  for (const rootCause of rootCauses) {
    for (const path of rootCause.paths) {
      for (const node of path.nodes) {
        if (node.entityId) {
          entities.add(node.entityId);
        }
      }
    }
  }

  // Log timeline event for each affected entity
  for (const entityId of entities) {
    try {
      await logCredentialTimelineEvent({
        clinicianId: entityId,
        eventType: CredentialTimelineEventType.SUPERVISOR_TRIGGER,
        severity: TimelineEventSeverity.WARNING,
        metadata: {
          causalAnalysis: {
            targetEvent,
            topRootCause: {
              eventType: topRootCause.eventType,
              confidence: topRootCause.confidence,
            },
            totalRootCauses: rootCauses.length,
            pathCount: pathExplanations.length,
            topPathExplanation: pathExplanations[0]?.explanation,
            topPathSteps: pathExplanations[0]?.humanReadableSteps,
          },
        },
      });
    } catch (error) {
      logger.warn('Error logging timeline event', {
        entityId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/**
 * Start the causal orchestrator cron job
 */
export function startCausalOrchestratorCron(
  options: CausalOrchestratorOptions = {}
): void {
  const cronSchedule = options.cronSchedule || '0 2 * * *'; // 2 AM daily
  logger.info(`Starting causal orchestrator cron with schedule: ${cronSchedule}`);

  if (options.runOnStartup) {
    // Run immediately on startup
    runCausalOrchestrator(options).catch((error) => {
      logger.error('Error in startup causal orchestrator run', { error });
    });
  }

  cron.schedule(cronSchedule, async () => {
    try {
      await runCausalOrchestrator(options);
    } catch (error) {
      logger.error('Error in causal orchestrator cron run', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

/**
 * Trigger causal orchestrator on specific events
 */
export async function triggerCausalOrchestratorOnEvent(
  eventType: CausalEventType,
  entityId?: string
): Promise<void> {
  logger.info('Triggering causal orchestrator on event', { eventType, entityId });

  await runCausalOrchestrator({
    processEventTypes: [eventType],
  });
}

export default {
  runCausalOrchestrator,
  startCausalOrchestratorCron,
  triggerCausalOrchestratorOnEvent,
};

if (require.main === module) {
  logger.info('🚀 [CausalOrchestrator] Running in standalone mode...');
  startCausalOrchestratorCron({ runOnStartup: true });
  process.on('SIGINT', () => {
    logger.info('\n🛑 [CausalOrchestrator] Shutting down...');
    process.exit(0);
  });
}

