import { PrismaClient } from '@prisma/client';
import { createCausalNode, type CausalNode, type CausalNodeType } from './models/CausalNode.js';
import { createCausalEdge, type CausalEdge } from './models/CausalEdge.js';
import { findApplicableRules } from './propagationRules.js';
import { computeConfidenceScore } from './confidence.js';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

export interface EventSource {
  id: string;
  type: string;
  clinicianId: string;
  orgId?: string;
  timestamp: Date;
  severity?: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL';
  metadata?: Record<string, unknown>;
}

export interface GraphBuildResult {
  nodes: CausalNode[];
  edges: CausalEdge[];
  nodeCount: number;
  edgeCount: number;
}

/**
 * CausalGraphBuilder builds a directed acyclic graph (DAG) from events tracked in:
 * - Drift engine (DriftEvent)
 * - Fusion engine (QualitySignal)
 * - Safety engine (PrivilegeSafetySignal)
 * - Enrollment engine (PayerEnrollment, PECOSEnrollment)
 * - Privilege engine (PrivilegeGranted, PrivilegeSafetyState)
 * - OPPE/FPPE engine (FPPERecord, OPPESchedule)
 * - Forecast engine (SafetyFeatureVector, RiskScore)
 */
export class CausalGraphBuilder {
  /**
   * Build a causal graph for a specific clinician
   */
  async buildGraphForClinician(
    clinicianId: string,
    orgId?: string,
    timeWindow?: { start: Date; end: Date }
  ): Promise<GraphBuildResult> {
    const nodes: CausalNode[] = [];
    const edges: CausalEdge[] = [];

    // Collect events from all engines
    const events = await this.collectEvents(clinicianId, orgId, timeWindow);

    // Convert events to causal nodes
    const nodeMap = new Map<string, CausalNode>();
    for (const event of events) {
      const node = this.eventToNode(event);
      nodes.push(node);
      nodeMap.set(node.id, node);
    }

    // Build edges based on propagation rules
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const source = nodes[i];
        const target = nodes[j];

        // Check if there's a rule connecting these nodes
        const rules = findApplicableRules(source, target);
        if (rules.length > 0) {
          // Use the first applicable rule (could be enhanced to merge multiple rules)
          const rule = rules[0];
          const confidence = await computeConfidenceScore(source, target, rule);

          const edge = createCausalEdge({
            id: randomUUID(),
            sourceNodeId: source.id,
            targetNodeId: target.id,
            edgeType: rule.edgeType,
            confidenceScore: confidence,
            rationale: rule.description,
            metadata: {
              ruleBaseConfidence: rule.baseConfidence,
            },
          });

          edges.push(edge);
        }
      }
    }

    return {
      nodes,
      edges,
      nodeCount: nodes.length,
      edgeCount: edges.length,
    };
  }

  /**
   * Collect events from all tracking engines
   */
  private async collectEvents(
    clinicianId: string,
    orgId?: string,
    timeWindow?: { start: Date; end: Date }
  ): Promise<EventSource[]> {
    const events: EventSource[] = [];
    const where = {
      clinicianId,
      ...(orgId ? { orgId } : {}),
      ...(timeWindow
        ? {
            detectedAt: {
              gte: timeWindow.start,
              lte: timeWindow.end,
            },
          }
        : {}),
    };

    // Collect from Drift engine
    try {
      const driftEvents = await prisma.driftEvent.findMany({
        where: {
          ...where,
          resolvedAt: null, // Only unresolved events
        },
      });
      for (const event of driftEvents) {
        events.push({
          id: event.id,
          type: 'DriftEvent',
          clinicianId: event.clinicianId,
          orgId: event.orgId || undefined,
          timestamp: event.detectedAt,
          severity: this.mapDriftSeverity(event.severity),
          metadata: {
            category: event.category,
            source: event.source,
            ...(event.metadata as Record<string, unknown>),
          },
        });
      }
    } catch (error) {
      // DriftEvent model may not exist yet, skip
      console.warn('DriftEvent model not available:', error);
    }

    // Collect from Safety engine (PrivilegeSafetySignal)
    try {
      const safetySignals = await prisma.privilegeSafetySignal.findMany({
        where: {
          clinicianId,
          ...(orgId ? { orgId } : {}),
          ...(timeWindow
            ? {
                detectedAt: {
                  gte: timeWindow.start,
                  lte: timeWindow.end,
                },
              }
            : {}),
          resolvedAt: null,
        },
      });
      for (const signal of safetySignals) {
        events.push({
          id: signal.id,
          type: 'PrivilegeSafetySignal',
          clinicianId: signal.clinicianId,
          orgId: signal.orgId || undefined,
          timestamp: signal.detectedAt,
          severity: signal.severity,
          metadata: {
            signalType: signal.signalType,
            privilegeCodes: signal.privilegeCodes,
            source: signal.source,
            ...(signal.details as Record<string, unknown>),
          },
        });
      }
    } catch (error) {
      // PrivilegeSafetySignal model may not exist yet, skip
      console.warn('PrivilegeSafetySignal model not available:', error);
    }

    // Collect from Quality Fusion engine (QualitySignal)
    // Note: Assuming QualitySignal is stored in a similar way
    // You may need to adjust based on your actual schema
    try {
      const qualitySignals = await prisma.qualitySignal?.findMany?.({
        where: {
          clinicianId,
          ...(timeWindow
            ? {
                timestamp: {
                  gte: timeWindow.start,
                  lte: timeWindow.end,
                },
              }
            : {}),
        },
      });
      if (qualitySignals) {
        for (const signal of qualitySignals) {
          events.push({
            id: signal.id,
            type: 'QualitySignal',
            clinicianId: signal.clinicianId,
            timestamp: signal.timestamp,
            severity: signal.severity,
            metadata: {
              signalType: signal.signalType,
              ...(signal.details as Record<string, unknown>),
            },
          });
        }
      }
    } catch (error) {
      // QualitySignal model may not exist yet, skip
      console.warn('QualitySignal model not available:', error);
    }

    // Collect from Enrollment engine (PayerEnrollment conflicts)
    try {
      const enrollmentConflicts = await prisma.payerEnrollment.findMany({
        where: {
          clinicianDid: clinicianId,
          ...(orgId ? { orgId } : {}),
          status: {
            in: ['DENIED', 'TERMINATED'],
          },
          ...(timeWindow
            ? {
                createdAt: {
                  gte: timeWindow.start,
                  lte: timeWindow.end,
                },
              }
            : {}),
        },
      });
      for (const enrollment of enrollmentConflicts) {
        events.push({
          id: enrollment.id,
          type: 'PayerEnrollment',
          clinicianId: enrollment.clinicianDid,
          orgId: enrollment.orgId,
          timestamp: enrollment.createdAt,
          severity: enrollment.status === 'DENIED' ? 'HIGH' : 'MED',
          metadata: {
            status: enrollment.status,
            payerId: enrollment.payerId,
          },
        });
      }
    } catch (error) {
      // PayerEnrollment model may not exist yet, skip
      console.warn('PayerEnrollment model not available:', error);
    }

    // Collect from Forecast engine (SafetyFeatureVector, RiskScore)
    try {
      const riskScores = await prisma.riskScore?.findMany?.({
        where: {
          deviceId: clinicianId, // Adjust based on your schema
          ...(timeWindow
            ? {
                createdAt: {
                  gte: timeWindow.start,
                  lte: timeWindow.end,
                },
              }
            : {}),
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 10, // Limit to recent risk scores
      });
      if (riskScores) {
        for (const risk of riskScores) {
          if (risk.score >= 70) {
            // Only include high-risk scores
            events.push({
              id: risk.id,
              type: 'RiskScore',
              clinicianId: risk.deviceId, // Adjust based on schema
              timestamp: risk.createdAt,
              severity: risk.score >= 90 ? 'CRITICAL' : risk.score >= 80 ? 'HIGH' : 'MED',
              metadata: {
                score: risk.score,
                reasonTags: risk.reasonTags,
              },
            });
          }
        }
      }
    } catch (error) {
      // RiskScore model may not exist or have different structure
      console.warn('RiskScore model not available:', error);
    }

    return events;
  }

  /**
   * Convert an event source to a causal node
   */
  private eventToNode(event: EventSource): CausalNode {
    let nodeType: CausalNodeType = 'DRIFT_EVENT';

    // Map event types to node types
    switch (event.type) {
      case 'DriftEvent':
        nodeType = 'DRIFT_EVENT';
        break;
      case 'QualitySignal':
        nodeType = 'QUALITY_SIGNAL';
        break;
      case 'PrivilegeSafetySignal':
        nodeType = 'SAFETY_SIGNAL';
        break;
      case 'PayerEnrollment':
        nodeType = 'ENROLLMENT_CONFLICT';
        break;
      case 'RiskScore':
        nodeType = 'RISK_SPIKE';
        break;
      default:
        nodeType = 'DRIFT_EVENT';
    }

    return createCausalNode({
      id: randomUUID(),
      nodeType,
      sourceEventId: event.id,
      sourceEventType: event.type,
      clinicianId: event.clinicianId,
      orgId: event.orgId,
      timestamp: event.timestamp,
      severity: event.severity,
      summary: this.generateSummary(event),
      metadata: event.metadata,
    });
  }

  /**
   * Generate a summary for an event
   */
  private generateSummary(event: EventSource): string {
    const type = event.type;
    const severity = event.severity || 'MED';
    const category = event.metadata?.category as string | undefined;
    const signalType = event.metadata?.signalType as string | undefined;

    if (category) {
      return `${category} ${type} (${severity})`;
    }
    if (signalType) {
      return `${signalType} ${type} (${severity})`;
    }
    return `${type} (${severity})`;
  }

  /**
   * Map Prisma DriftSeverity to our severity enum
   */
  private mapDriftSeverity(
    severity: string | null | undefined
  ): 'LOW' | 'MED' | 'HIGH' | 'CRITICAL' | undefined {
    if (!severity) return undefined;
    const upper = severity.toUpperCase();
    if (upper === 'INFO' || upper === 'LOW') return 'LOW';
    if (upper === 'MEDIUM' || upper === 'MED') return 'MED';
    if (upper === 'HIGH') return 'HIGH';
    if (upper === 'CRITICAL') return 'CRITICAL';
    return 'MED';
  }
}

/**
 * Build a causal graph for a clinician
 */
export async function buildCausalGraph(
  clinicianId: string,
  orgId?: string,
  timeWindow?: { start: Date; end: Date }
): Promise<GraphBuildResult> {
  const builder = new CausalGraphBuilder();
  return builder.buildGraphForClinician(clinicianId, orgId, timeWindow);
}

