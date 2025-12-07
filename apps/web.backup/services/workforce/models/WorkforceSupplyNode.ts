export const WORKFORCE_SUPPLY_NODE_TYPES = [
  'CLINICIAN',
  'LICENSE',
  'PRIVILEGE',
  'ORG',
  'STATE',
  'COMPACT',
  'ENROLLMENT',
  'PAYER',
  'EHR_ROLE',
] as const;

export type WorkforceSupplyNodeType = (typeof WORKFORCE_SUPPLY_NODE_TYPES)[number];
export type WorkforceSupplyMetadata = Record<string, unknown>;

export interface WorkforceSupplyNode {
  nodeId: string;
  nodeType: WorkforceSupplyNodeType;
  metadata: WorkforceSupplyMetadata;
  createdAt: Date;
}

export interface WorkforceSupplyNodeInit {
  nodeId: string;
  nodeType: WorkforceSupplyNodeType;
  metadata?: WorkforceSupplyMetadata | null;
  createdAt?: Date;
}

export function isWorkforceSupplyNodeType(value: unknown): value is WorkforceSupplyNodeType {
  return typeof value === 'string' && WORKFORCE_SUPPLY_NODE_TYPES.includes(value as WorkforceSupplyNodeType);
}

export function normalizeSupplyMetadata(
  metadata?: WorkforceSupplyMetadata | null,
): WorkforceSupplyMetadata {
  if (!metadata) {
    return {};
  }

  if (Array.isArray(metadata)) {
    return { items: [...metadata] };
  }

  if (typeof metadata !== 'object') {
    return { value: metadata };
  }

  return { ...(metadata as Record<string, unknown>) };
}

export function mergeSupplyMetadata(
  base: WorkforceSupplyMetadata,
  updates?: WorkforceSupplyMetadata | null,
): WorkforceSupplyMetadata {
  if (!updates || Object.keys(updates).length === 0) {
    return base;
  }
  return {
    ...base,
    ...updates,
  };
}

export function createWorkforceSupplyNode(init: WorkforceSupplyNodeInit): WorkforceSupplyNode {
  if (!init.nodeId || typeof init.nodeId !== 'string' || init.nodeId.trim().length === 0) {
    throw new Error('WorkforceSupplyNode.nodeId is required');
  }

  if (!isWorkforceSupplyNodeType(init.nodeType)) {
    throw new Error(
      `WorkforceSupplyNode.nodeType "${init.nodeType}" is invalid. Expected one of: ${WORKFORCE_SUPPLY_NODE_TYPES.join(
        ', ',
      )}`,
    );
  }

  return {
    nodeId: init.nodeId.trim(),
    nodeType: init.nodeType,
    metadata: normalizeSupplyMetadata(init.metadata),
    createdAt: init.createdAt ?? new Date(),
  };
}

