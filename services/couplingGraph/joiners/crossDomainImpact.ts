/**
 * B210B-COUP-009: CrossDomainImpactJoiner
 *
 * Joins causalGraph + predictiveSafety + workforceForecast + competency + enrollment
 * → unified system impact model.
 */

import type {
  UnifiedSystemImpact,
  SystemPerformance,
  RippleScoreMap,
  DepartmentImpact,
  SensitivityResult,
} from '../types.js';
import { propagateImpact, propagateMultipleImpacts } from '../propagationEngine.js';
import { simulateScenario } from '../simulator/rippleSimulator.js';
import { analyzeSensitivity } from '../analytics/sensitivity.js';
import { getCouplingGraphStore } from '../models/couplingGraphStore.js';
import { createLogger } from '@chai-vc/logging-core';

// Import domain services
import type { CausalEventType } from '../../causalGraph/types.js';
import { detectRootCauses } from '../../causalGraph/rootCauseDetector.js';
import type { SafetyFeatureVector } from '../../predictiveSafety/models/SafetyFeatureVector.js';
import type { ForecastResponse } from '../../workforceForecast/index.js';
import type { CompetencyFeatureVector } from '../../competency/models/CompetencyFeatureVector.js';

const logger = createLogger({ service: 'cross-domain-impact-joiner' });

export interface CrossDomainData {
  causalEvents?: CausalEventType[];
  safetySignals?: SafetyFeatureVector[];
  workforceForecast?: ForecastResponse | { predictedGaps?: Array<{ severity?: number; departmentId?: string; specialty?: string; reason?: string }> };
  competencyData?: CompetencyFeatureVector[];
  enrollmentData?: Array<{
    providerId: string;
    payerId: string;
    status: 'ACTIVE' | 'PENDING' | 'EXPIRED' | 'SUSPENDED';
    enrolledAt?: Date;
    expiresAt?: Date;
  }>;
}

/**
 * Join data from multiple domains into unified system impact model
 */
export async function joinCrossDomainImpact(
  data: CrossDomainData
): Promise<UnifiedSystemImpact> {
  logger.info('Joining cross-domain impact data', {
    hasCausalEvents: !!data.causalEvents?.length,
    hasSafetySignals: !!data.safetySignals?.length,
    hasWorkforceForecast: !!data.workforceForecast,
    hasCompetencyData: !!data.competencyData?.length,
    hasEnrollmentData: !!data.enrollmentData?.length,
  });

  const store = getCouplingGraphStore();
  await store.initialize();

  // Step 1: Convert domain data to source events
  const sourceEvents = await convertDomainDataToSourceEvents(data);

  // Step 2: Propagate impact through coupling graph
  const rippleScores = await propagateMultipleImpacts(sourceEvents, {
    maxDepth: 5,
    minImpactThreshold: 0.01,
  });

  // Step 3: Compute current system performance
  const systemPerformance = await computeSystemPerformance(data, rippleScores);

  // Step 4: Compute department impacts
  const departmentImpacts = await computeDepartmentImpacts(rippleScores, data);

  // Step 5: Analyze sensitivity
  const sensitivityResults = await analyzeSensitivity(systemPerformance, {
    perturbationSize: 0.01,
  });

  // Step 6: Generate predictions
  const predictions = await generatePredictions(systemPerformance, data, rippleScores);

  const unifiedImpact: UnifiedSystemImpact = {
    timestamp: new Date(),
    systemPerformance,
    rippleScores,
    departmentImpacts,
    sensitivityResults,
    predictions,
  };

  logger.info('Cross-domain impact join completed', {
    rippleNodes: rippleScores.size,
    departmentsAffected: departmentImpacts.length,
    fragileAreas: sensitivityResults.filter((r) => r.fragilityScore > 0.5).length,
  });

  return unifiedImpact;
}

/**
 * Convert domain data to source events for propagation
 */
async function convertDomainDataToSourceEvents(
  data: CrossDomainData
): Promise<Array<import('../types.js').SourceEvent>> {
  const sourceEvents: Array<import('../types.js').SourceEvent> = [];

  // Convert causal events
  if (data.causalEvents) {
    for (const eventType of data.causalEvents) {
      // Find nodes affected by this causal event
      const affectedNodes = await findNodesForCausalEvent(eventType);
      for (const nodeId of affectedNodes) {
        sourceEvents.push({
          nodeId,
          eventType: `CAUSAL_${eventType}`,
          initialImpact: 0.7, // Default impact for causal events
          metadata: { causalEventType: eventType },
        });
      }
    }
  }

  // Convert safety signals
  if (data.safetySignals) {
    for (const signal of data.safetySignals) {
      // Map safety signal to nodes (e.g., privilege nodes)
      const affectedNodes = await findNodesForSafetySignal(signal);
      for (const nodeId of affectedNodes) {
        const impact = computeSafetyImpact(signal);
        sourceEvents.push({
          nodeId,
          eventType: 'SAFETY_SIGNAL',
          initialImpact: impact,
          metadata: { safetySignal: signal },
        });
      }
    }
  }

  // Convert workforce forecast gaps
  if (data.workforceForecast) {
    const gaps = (data.workforceForecast as any).predictedGaps || [];
    for (const gap of gaps) {
      // Map gap to department/credential nodes
      const affectedNodes = await findNodesForWorkforceGap(gap);
      for (const nodeId of affectedNodes) {
        sourceEvents.push({
          nodeId,
          eventType: 'WORKFORCE_GAP',
          initialImpact: Math.min(1.0, gap.severity || 0.5),
          metadata: { gap },
        });
      }
    }
  }

  // Convert competency issues
  if (data.competencyData) {
    for (const competency of data.competencyData) {
      // Map low competency to nodes
      if (competency.overallScore && competency.overallScore < 0.7) {
        const affectedNodes = await findNodesForCompetency(competency);
        for (const nodeId of affectedNodes) {
          sourceEvents.push({
            nodeId,
            eventType: 'COMPETENCY_ISSUE',
            initialImpact: 1.0 - (competency.overallScore || 0.5),
            metadata: { competency },
          });
        }
      }
    }
  }

  // Convert enrollment issues
  if (data.enrollmentData) {
    for (const enrollment of data.enrollmentData) {
      if (enrollment.status === 'EXPIRED' || enrollment.status === 'SUSPENDED') {
        const affectedNodes = await findNodesForEnrollment(enrollment);
        for (const nodeId of affectedNodes) {
          sourceEvents.push({
            nodeId,
            eventType: 'ENROLLMENT_ISSUE',
            initialImpact: enrollment.status === 'EXPIRED' ? 0.8 : 0.6,
            metadata: { enrollment },
          });
        }
      }
    }
  }

  return sourceEvents;
}

/**
 * Find nodes affected by a causal event
 */
async function findNodesForCausalEvent(eventType: CausalEventType): Promise<string[]> {
  const store = getCouplingGraphStore();
  const nodes = store.getAllNodes();

  // Map causal event types to node types/names
  const eventToNodeMapping: Partial<Record<CausalEventType, string[]>> = {
    LICENSE_DRIFT: ['license', 'credential'],
    ENROLLMENT_CONFLICT: ['enrollment', 'payer'],
    RISK_SPIKE: ['privilege', 'safety'],
    SAFETY_HOLD: ['privilege', 'safety'],
  };

  const keywords = eventToNodeMapping[eventType] || [];
  const matchingNodes = nodes.filter((n) =>
    keywords.some((kw) => n.type.includes(kw) || n.name.toLowerCase().includes(kw))
  );

  return matchingNodes.map((n) => n.id);
}

/**
 * Find nodes affected by a safety signal
 */
async function findNodesForSafetySignal(signal: SafetyFeatureVector): Promise<string[]> {
  const store = getCouplingGraphStore();
  const nodes = store.getAllNodes();

  // Map safety signals to privilege nodes
  return nodes
    .filter((n) => n.type === 'privilege')
    .map((n) => n.id);
}

/**
 * Compute impact from safety signal
 */
function computeSafetyImpact(signal: SafetyFeatureVector): number {
  // Use risk score or similar metric from safety signal
  return (signal as any).riskScore || 0.5;
}

/**
 * Find nodes affected by workforce gap
 */
async function findNodesForWorkforceGap(gap: any): Promise<string[]> {
  const store = getCouplingGraphStore();
  const nodes = store.getAllNodes();

  // Map gap to department nodes
  const departmentId = gap.departmentId || gap.specialty;
  return nodes
    .filter((n) => n.departmentId === departmentId || n.type === 'department')
    .map((n) => n.id);
}

/**
 * Find nodes affected by competency issue
 */
async function findNodesForCompetency(competency: CompetencyFeatureVector): Promise<string[]> {
  const store = getCouplingGraphStore();
  const nodes = store.getAllNodes();

  // Map competency to credential/privilege nodes
  return nodes
    .filter((n) => n.type === 'credential' || n.type === 'privilege')
    .map((n) => n.id);
}

/**
 * Find nodes affected by enrollment issue
 */
async function findNodesForEnrollment(enrollment: CrossDomainData['enrollmentData']![0]): Promise<string[]> {
  const store = getCouplingGraphStore();
  const nodes = store.getAllNodes();

  // Map enrollment to payer/enrollment nodes
  return nodes
    .filter((n) => n.type === 'enrollment' || n.type === 'payer')
    .map((n) => n.id);
}

/**
 * Compute system performance from domain data and ripple scores
 */
async function computeSystemPerformance(
  data: CrossDomainData,
  rippleScores: RippleScoreMap
): Promise<SystemPerformance> {
  // Aggregate ripple scores
  const totalRipple = Array.from(rippleScores.values()).reduce((sum, r) => sum + r.score, 0);
  const avgRipple = rippleScores.size > 0 ? totalRipple / rippleScores.size : 0;
  const impactFactor = 1.0 - Math.min(1.0, avgRipple * 0.3);

  // Compute metrics from domain data
  const credentialReadiness = computeCredentialReadiness(data);
  const enrollmentStability = computeEnrollmentStability(data);
  const workforceCapacity = computeWorkforceCapacity(data);
  const safetyIndex = computeSafetyIndex(data);

  // Aggregate into overall score
  const overallScore = (
    credentialReadiness * 0.25 +
    enrollmentStability * 0.25 +
    workforceCapacity * 0.25 +
    safetyIndex * 0.25
  ) * impactFactor;

  // Department scores (simplified - would need actual department data)
  const departmentScores = new Map<string, number>();

  return {
    overallScore: Math.max(0, Math.min(1, overallScore)),
    departmentScores,
    credentialReadiness: Math.max(0, Math.min(1, credentialReadiness * impactFactor)),
    enrollmentStability: Math.max(0, Math.min(1, enrollmentStability * impactFactor)),
    workforceCapacity: Math.max(0, Math.min(1, workforceCapacity * impactFactor)),
    safetyIndex: Math.max(0, Math.min(1, safetyIndex * impactFactor)),
  };
}

/**
 * Compute credential readiness from domain data
 */
function computeCredentialReadiness(data: CrossDomainData): number {
  // Base score
  let score = 1.0;

  // Reduce for causal events
  if (data.causalEvents?.length) {
    score -= Math.min(0.5, data.causalEvents.length * 0.1);
  }

  // Reduce for competency issues
  if (data.competencyData && data.competencyData.length > 0) {
    // Check if CompetencyFeatureVector has overallScore or compute from features
    const lowCompetency = data.competencyData.filter((c) => {
      // CompetencyFeatureVector doesn't have overallScore, so we'll use a heuristic
      const features = (c as any).features || {};
      const avgFeature = Object.values(features).reduce((sum: number, val: any) => sum + (typeof val === 'number' ? val : 0), 0) / Object.keys(features).length;
      return avgFeature < 0.7;
    }).length;
    score -= Math.min(0.5, (lowCompetency / data.competencyData.length) * 0.3);
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Compute enrollment stability from domain data
 */
function computeEnrollmentStability(data: CrossDomainData): number {
  if (!data.enrollmentData || data.enrollmentData.length === 0) return 1.0;

  const active = data.enrollmentData.filter((e) => e.status === 'ACTIVE').length;
  return active / data.enrollmentData.length;
}

/**
 * Compute workforce capacity from domain data
 */
function computeWorkforceCapacity(data: CrossDomainData): number {
  if (!data.workforceForecast) return 1.0;

  // Use forecast to compute capacity
  const gaps = (data.workforceForecast as any).predictedGaps || [];
  if (gaps.length === 0) return 1.0;
  const gapSeverity = gaps.reduce((sum: number, g: any) => sum + (g.severity || 0), 0);
  return Math.max(0, 1.0 - gapSeverity / gaps.length);
}

/**
 * Compute safety index from domain data
 */
function computeSafetyIndex(data: CrossDomainData): number {
  let score = 1.0;

  // Reduce for safety signals
  if (data.safetySignals?.length) {
    score -= Math.min(0.5, data.safetySignals.length * 0.1);
  }

  // Reduce for causal safety events
  if (data.causalEvents?.includes('SAFETY_HOLD' as CausalEventType)) {
    score -= 0.3;
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Compute department impacts from ripple scores
 */
async function computeDepartmentImpacts(
  rippleScores: RippleScoreMap,
  data: CrossDomainData
): Promise<DepartmentImpact[]> {
  // Aggregate by department (similar to ripple simulator)
  const departmentMap = new Map<string, {
    departmentId: string;
    departmentName: string;
    nodes: string[];
    scores: number[];
  }>();

  const store = getCouplingGraphStore();
  for (const [nodeId, rippleScore] of rippleScores.entries()) {
    const node = store.getNode(nodeId);
    if (!node) continue;

    const deptId = node.departmentId || 'unknown';
    let deptData = departmentMap.get(deptId);
    if (!deptData) {
      deptData = {
        departmentId: deptId,
        departmentName: `Department ${deptId}`,
        nodes: [],
        scores: [],
      };
      departmentMap.set(deptId, deptData);
    }

    deptData.nodes.push(nodeId);
    deptData.scores.push(rippleScore.score);
  }

  return Array.from(departmentMap.values()).map((dept) => ({
    departmentId: dept.departmentId,
    departmentName: dept.departmentName,
    impactScore: dept.scores.length > 0
      ? dept.scores.reduce((a, b) => a + b, 0) / dept.scores.length
      : 0,
    affectedNodes: dept.nodes,
    criticalPath: [],
  }));
}

/**
 * Generate predictions for future system performance
 */
async function generatePredictions(
  currentPerformance: SystemPerformance,
  data: CrossDomainData,
  rippleScores: RippleScoreMap
): Promise<UnifiedSystemImpact['predictions']> {
  // Simple linear projection based on current trends
  const trendFactor = 0.95; // Slight decline if no intervention

  const nextWeek: SystemPerformance = {
    overallScore: currentPerformance.overallScore * trendFactor,
    departmentScores: new Map(
      Array.from(currentPerformance.departmentScores.entries()).map(([k, v]) => [
        k,
        v * trendFactor,
      ])
    ),
    credentialReadiness: currentPerformance.credentialReadiness * trendFactor,
    enrollmentStability: currentPerformance.enrollmentStability * trendFactor,
    workforceCapacity: currentPerformance.workforceCapacity * trendFactor,
    safetyIndex: currentPerformance.safetyIndex * trendFactor,
  };

  const nextMonth: SystemPerformance = {
    overallScore: currentPerformance.overallScore * Math.pow(trendFactor, 4),
    departmentScores: new Map(
      Array.from(currentPerformance.departmentScores.entries()).map(([k, v]) => [
        k,
        v * Math.pow(trendFactor, 4),
      ])
    ),
    credentialReadiness: currentPerformance.credentialReadiness * Math.pow(trendFactor, 4),
    enrollmentStability: currentPerformance.enrollmentStability * Math.pow(trendFactor, 4),
    workforceCapacity: currentPerformance.workforceCapacity * Math.pow(trendFactor, 4),
    safetyIndex: currentPerformance.safetyIndex * Math.pow(trendFactor, 4),
  };

  return { nextWeek, nextMonth };
}

