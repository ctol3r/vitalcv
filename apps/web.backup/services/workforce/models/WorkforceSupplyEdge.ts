import type { WorkforceSupplyMetadata, WorkforceSupplyNodeType } from './WorkforceSupplyNode.js';

export const WORKFORCE_SUPPLY_RELATION_TYPES = [
  'CAN_PRACTICE_IN',
  'CAN_PERFORM',
  'ELIGIBLE_VIA_COMPACT',
  'COVERED_BY_PAYER',
  'APPROVED_AT_ORG',
  'EHR_ROLE_GRANTED',
] as const;

export type WorkforceSupplyRelationType = (typeof WORKFORCE_SUPPLY_RELATION_TYPES)[number];

export interface WorkforceSupplyEdge {
  sourceNodeId: string;
  targetNodeId: string;
  relationType: WorkforceSupplyRelationType;
  weight: number;
  metadata: WorkforceSupplyMetadata;
}

export interface WorkforceSupplyEdgeInit {
  sourceNodeId: string;
  targetNodeId: string;
  relationType: WorkforceSupplyRelationType;
  weight?: number;
  metadata?: WorkforceSupplyMetadata | null;
}

export interface WorkforceEdgeContext {
  sourceType: WorkforceSupplyNodeType;
  targetType: WorkforceSupplyNodeType;
}

export function isWorkforceSupplyRelationType(
  value: unknown,
): value is WorkforceSupplyRelationType {
  return (
    typeof value === 'string' &&
    WORKFORCE_SUPPLY_RELATION_TYPES.includes(value as WorkforceSupplyRelationType)
  );
}

export function createWorkforceSupplyEdge(init: WorkforceSupplyEdgeInit): WorkforceSupplyEdge {
  if (!init.sourceNodeId?.trim() || !init.targetNodeId?.trim()) {
    throw new Error('WorkforceSupplyEdge requires both sourceNodeId and targetNodeId');
  }

  if (!isWorkforceSupplyRelationType(init.relationType)) {
    throw new Error(
      `WorkforceSupplyEdge.relationType "${init.relationType}" is invalid. Expected one of: ${WORKFORCE_SUPPLY_RELATION_TYPES.join(
        ', ',
      )}`,
    );
  }

  const weight = init.weight ?? 1;
  if (!(weight > 0)) {
    throw new Error('WorkforceSupplyEdge weight must be positive');
  }

  return {
    sourceNodeId: init.sourceNodeId.trim(),
    targetNodeId: init.targetNodeId.trim(),
    relationType: init.relationType,
    weight,
    metadata: init.metadata ? { ...init.metadata } : {},
  };
}

