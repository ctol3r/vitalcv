/**
 * Causal Graph Types
 *
 * Defines types for causal relationships between events in the credentialing system.
 */

/**
 * Causal event types that can appear in the causal graph
 */
export enum CausalEventType {
  // License-related events
  LICENSE_DRIFT = 'LICENSE_DRIFT',
  LICENSE_EXPIRED = 'LICENSE_EXPIRED',
  LICENSE_RENEWED = 'LICENSE_RENEWED',

  // Trust-related events
  DECREASED_PECOS_TRUST = 'DECREASED_PECOS_TRUST',
  INCREASED_PECOS_TRUST = 'INCREASED_PECOS_TRUST',
  TRUST_DEGRADATION = 'TRUST_DEGRADATION',

  // Enrollment-related events
  ENROLLMENT_CONFLICT = 'ENROLLMENT_CONFLICT',
  ENROLLMENT_DENIED = 'ENROLLMENT_DENIED',
  ENROLLMENT_APPROVED = 'ENROLLMENT_APPROVED',

  // Risk-related events
  RISK_SPIKE = 'RISK_SPIKE',
  RISK_DECREASE = 'RISK_DECREASE',
  RISK_NORMALIZED = 'RISK_NORMALIZED',

  // Safety-related events
  SAFETY_HOLD = 'SAFETY_HOLD',
  SAFETY_RELEASE = 'SAFETY_RELEASE',
  SAFETY_ALERT = 'SAFETY_ALERT',

  // Quality-related events
  OPPE_LOW = 'OPPE_LOW',
  OPPE_IMPROVED = 'OPPE_IMPROVED',
  FPPE_FAILURE = 'FPPE_FAILURE',
  QUALITY_DECLINE = 'QUALITY_DECLINE',

  // Compliance-related events
  COMPLIANCE_VIOLATION = 'COMPLIANCE_VIOLATION',
  COMPLIANCE_RESTORED = 'COMPLIANCE_RESTORED',

  // Payer-related events
  PAYER_DENIAL = 'PAYER_DENIAL',
  PAYER_APPROVAL = 'PAYER_APPROVAL',
}

/**
 * Causal relationship between two events
 */
export interface CausalEdge {
  id: string;
  sourceEventType: CausalEventType;
  targetEventType: CausalEventType;
  confidence: number; // 0.0 to 1.0
  strength: number; // 0.0 to 1.0, how strong the causal relationship is
  delay: number; // Expected delay in milliseconds between cause and effect
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Node in the causal graph representing an event occurrence
 */
export interface CausalNode {
  id: string;
  eventType: CausalEventType;
  entityId?: string; // Optional: clinician ID, org ID, etc.
  entityType?: string; // Optional: 'clinician', 'org', 'privilege', etc.
  timestamp: Date;
  severity: 'LOW' | 'MED' | 'HIGH' | 'CRITICAL';
  metadata?: Record<string, unknown>;
  resolved?: boolean;
  resolvedAt?: Date;
}

/**
 * Causal path from root cause to target event
 */
export interface CausalPath {
  nodes: CausalNode[];
  edges: CausalEdge[];
  totalConfidence: number; // Product of edge confidences
  pathLength: number;
  estimatedDelay: number; // Sum of edge delays
}

/**
 * Root cause with confidence score
 */
export interface RootCause {
  eventType: CausalEventType;
  nodeId: string;
  confidence: number; // 0.0 to 1.0
  paths: CausalPath[]; // All paths from this root cause to target
  totalImpact: number; // Sum of path confidences
  metadata?: Record<string, unknown>;
}

/**
 * What-if simulation result
 */
export interface WhatIfResult {
  scenario: string; // Description of the scenario
  intervention: {
    eventType: CausalEventType;
    action: 'REMOVE' | 'ADD' | 'MODIFY';
    value?: unknown;
  };
  predictedChanges: {
    eventType: CausalEventType;
    change: 'INCREASE' | 'DECREASE' | 'NORMALIZE' | 'TRIGGER' | 'PREVENT';
    confidence: number;
    estimatedDelay: number;
  }[];
  overallRiskChange: 'INCREASE' | 'DECREASE' | 'NEUTRAL';
  riskScoreDelta: number;
}

/**
 * Causal graph structure
 */
export interface CausalGraph {
  nodes: Map<string, CausalNode>;
  edges: Map<string, CausalEdge>;
  adjacencyList: Map<string, string[]>; // eventType -> array of target event types
  reverseAdjacencyList: Map<string, string[]>; // eventType -> array of source event types
}

