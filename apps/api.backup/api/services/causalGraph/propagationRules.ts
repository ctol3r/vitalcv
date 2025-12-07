import type { CausalNodeType, CausalNode } from './models/CausalNode.js';
import type { CausalEdgeType } from './models/CausalEdge.js';

/**
 * PropagationRulesEngine defines causal associations between different event types.
 *
 * Examples:
 * - LICENSE_EXPIRY CAUSES PRIVILEGE_RESTRICTION
 * - OPPE_LOW AMPLIFIES RISK_SPIKE
 * - EHR_MISMATCH PRECEDES SAFETY_SIGNAL
 */

export interface PropagationRule {
  sourceNodeType: CausalNodeType;
  targetNodeType: CausalNodeType;
  edgeType: CausalEdgeType;
  condition?: (source: CausalNode, target: CausalNode) => boolean;
  baseConfidence?: number; // Base confidence score (0-1) before confidence scorer adjustments
  description?: string;
}

/**
 * Default propagation rules defining causal relationships
 */
export const PROPAGATION_RULES: PropagationRule[] = [
  // License/Board expiry causes privilege restrictions
  {
    sourceNodeType: 'DRIFT_EVENT',
    targetNodeType: 'PRIVILEGE_RESTRICTION',
    edgeType: 'CAUSES',
    condition: (source, target) => {
      const sourceCategory = source.metadata?.category as string | undefined;
      return sourceCategory === 'licensure' || sourceCategory === 'board';
    },
    baseConfidence: 0.9,
    description: 'License or board certification expiry causes privilege restrictions',
  },

  // OPPE low scores amplify risk spikes
  {
    sourceNodeType: 'QUALITY_SIGNAL',
    targetNodeType: 'RISK_SPIKE',
    edgeType: 'AMPLIFIES',
    condition: (source, target) => {
      const signalType = source.metadata?.signalType as string | undefined;
      return signalType === 'OPPE_LOW';
    },
    baseConfidence: 0.75,
    description: 'OPPE low scores amplify risk spikes',
  },

  // EHR mismatches precede safety signals
  {
    sourceNodeType: 'EHR_MISMATCH',
    targetNodeType: 'SAFETY_SIGNAL',
    edgeType: 'PRECEDES',
    condition: (source, target) => {
      // EHR mismatch should occur before safety signal
      return source.timestamp < target.timestamp;
    },
    baseConfidence: 0.7,
    description: 'EHR mismatches typically precede safety signals',
  },

  // FPPE failures cause privilege restrictions
  {
    sourceNodeType: 'QUALITY_SIGNAL',
    targetNodeType: 'PRIVILEGE_RESTRICTION',
    edgeType: 'CAUSES',
    condition: (source, target) => {
      const signalType = source.metadata?.signalType as string | undefined;
      return signalType === 'FPPE_FAILURE';
    },
    baseConfidence: 0.85,
    description: 'FPPE failures cause privilege restrictions',
  },

  // Compliance failures cause enrollment conflicts
  {
    sourceNodeType: 'COMPLIANCE_FAIL',
    targetNodeType: 'ENROLLMENT_CONFLICT',
    edgeType: 'CAUSES',
    baseConfidence: 0.8,
    description: 'Compliance failures cause enrollment conflicts',
  },

  // DEA expiry causes privilege restrictions
  {
    sourceNodeType: 'DRIFT_EVENT',
    targetNodeType: 'PRIVILEGE_RESTRICTION',
    edgeType: 'CAUSES',
    condition: (source, target) => {
      const sourceCategory = source.metadata?.category as string | undefined;
      return sourceCategory === 'dea';
    },
    baseConfidence: 0.95,
    description: 'DEA registration expiry causes privilege restrictions',
  },

  // PECOS conflicts cause enrollment conflicts
  {
    sourceNodeType: 'DRIFT_EVENT',
    targetNodeType: 'ENROLLMENT_CONFLICT',
    edgeType: 'CAUSES',
    condition: (source, target) => {
      const sourceCategory = source.metadata?.category as string | undefined;
      return sourceCategory === 'pecos';
    },
    baseConfidence: 0.7,
    description: 'PECOS drift events cause enrollment conflicts',
  },

  // Safety signals amplify risk spikes
  {
    sourceNodeType: 'SAFETY_SIGNAL',
    targetNodeType: 'RISK_SPIKE',
    edgeType: 'AMPLIFIES',
    baseConfidence: 0.8,
    description: 'Safety signals amplify risk spikes',
  },

  // Forecast risks require attention (precedes other events)
  {
    sourceNodeType: 'FORECAST_RISK',
    targetNodeType: 'RISK_SPIKE',
    edgeType: 'PRECEDES',
    baseConfidence: 0.65,
    description: 'Forecast risks typically precede actual risk spikes',
  },

  // Quality signals contradict safety signals (when they indicate good performance)
  {
    sourceNodeType: 'QUALITY_SIGNAL',
    targetNodeType: 'SAFETY_SIGNAL',
    edgeType: 'CONTRADICTS',
    condition: (source, target) => {
      const signalType = source.metadata?.signalType as string | undefined;
      // High volume or positive quality metrics contradict safety concerns
      return signalType === 'LOW_VOLUME' || signalType === 'EXCESSIVE_VARIANCE';
    },
    baseConfidence: 0.6,
    description: 'Positive quality signals may contradict safety concerns',
  },

  // Privilege restrictions mitigate risk (by removing dangerous privileges)
  {
    sourceNodeType: 'PRIVILEGE_RESTRICTION',
    targetNodeType: 'RISK_SPIKE',
    edgeType: 'MITIGATES',
    baseConfidence: 0.7,
    description: 'Privilege restrictions mitigate risk spikes',
  },
];

/**
 * Find applicable propagation rules for a source and target node
 */
export function findApplicableRules(
  source: CausalNode,
  target: CausalNode
): PropagationRule[] {
  return PROPAGATION_RULES.filter((rule) => {
    // Check node types match
    if (rule.sourceNodeType !== source.nodeType || rule.targetNodeType !== target.nodeType) {
      return false;
    }

    // Check condition if provided
    if (rule.condition) {
      return rule.condition(source, target);
    }

    return true;
  });
}

/**
 * Get all rules for a given source node type
 */
export function getRulesForSourceType(sourceType: CausalNodeType): PropagationRule[] {
  return PROPAGATION_RULES.filter((rule) => rule.sourceNodeType === sourceType);
}

/**
 * Get all rules for a given target node type
 */
export function getRulesForTargetType(targetType: CausalNodeType): PropagationRule[] {
  return PROPAGATION_RULES.filter((rule) => rule.targetNodeType === targetType);
}

/**
 * Get all rules for a given edge type
 */
export function getRulesForEdgeType(edgeType: CausalEdgeType): PropagationRule[] {
  return PROPAGATION_RULES.filter((rule) => rule.edgeType === edgeType);
}

