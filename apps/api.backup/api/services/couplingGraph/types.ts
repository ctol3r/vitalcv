/**
 * Coupling Graph Types
 *
 * Defines types for coupling relationships and impact propagation in the credentialing system.
 */

/**
 * Node in the coupling graph representing a system component
 */
export interface CouplingNode {
  id: string;
  type: 'department' | 'credential' | 'privilege' | 'enrollment' | 'payer' | 'compact' | 'provider';
  name: string;
  departmentId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Edge in the coupling graph representing impact relationships
 */
export interface CouplingEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  impactWeight: number; // 0.0 to 1.0, how much impact propagates
  relationshipType: 'DEPENDS_ON' | 'AFFECTS' | 'REQUIRES' | 'ENABLES' | 'BLOCKS';
  delay?: number; // Propagation delay in milliseconds
  metadata?: Record<string, unknown>;
}

/**
 * Coupling graph structure
 */
export interface CouplingGraph {
  nodes: Map<string, CouplingNode>;
  edges: Map<string, CouplingEdge>;
  adjacencyList: Map<string, string[]>; // nodeId -> array of edge IDs
  reverseAdjacencyList: Map<string, string[]>; // nodeId -> array of edge IDs (incoming)
}

/**
 * Ripple score for a node after propagation
 */
export interface RippleScore {
  nodeId: string;
  score: number; // 0.0 to 1.0, cumulative impact
  propagationDepth: number;
  paths: Array<{
    sourceNodeId: string;
    edgeIds: string[];
    totalWeight: number;
  }>;
}

/**
 * Ripple score map: nodeId -> RippleScore
 */
export type RippleScoreMap = Map<string, RippleScore>;

/**
 * Source event for propagation
 */
export interface SourceEvent {
  nodeId: string;
  eventType: string;
  initialImpact: number; // 0.0 to 1.0
  metadata?: Record<string, unknown>;
}

/**
 * Scenario event for simulation
 */
export interface ScenarioEvent {
  type: 'DEA_MASS_EXPIRY' | 'COMPACT_INELIGIBILITY' | 'PAYER_NETWORK_FAILURE' | 'FPPE_SURGE';
  affectedNodeIds: string[];
  severity: number; // 0.0 to 1.0
  metadata?: Record<string, unknown>;
}

/**
 * Department impact result
 */
export interface DepartmentImpact {
  departmentId: string;
  departmentName: string;
  impactScore: number; // 0.0 to 1.0
  affectedNodes: string[];
  criticalPath: Array<{
    nodeId: string;
    nodeName: string;
    impactWeight: number;
  }>;
  estimatedRecoveryTime?: number; // milliseconds
}

/**
 * Sensitivity analysis result for a node
 */
export interface SensitivityResult {
  nodeId: string;
  nodeName: string;
  variableName: string;
  sensitivity: number; // ∂(system_performance)/∂(credential_variable)
  fragilityScore: number; // 0.0 to 1.0, how fragile this area is
  affectedDepartments: string[];
  recommendations?: string[];
}

/**
 * System performance metric
 */
export interface SystemPerformance {
  overallScore: number; // 0.0 to 1.0
  departmentScores: Map<string, number>;
  credentialReadiness: number;
  enrollmentStability: number;
  workforceCapacity: number;
  safetyIndex: number;
}

/**
 * Unified system impact model
 */
export interface UnifiedSystemImpact {
  timestamp: Date;
  systemPerformance: SystemPerformance;
  rippleScores: RippleScoreMap;
  departmentImpacts: DepartmentImpact[];
  sensitivityResults: SensitivityResult[];
  predictions: {
    nextWeek: SystemPerformance;
    nextMonth: SystemPerformance;
  };
}

