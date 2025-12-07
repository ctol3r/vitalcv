import { z } from 'zod';

export const WorkforceDemandNodeTypes = ['DEPARTMENT', 'SHIFT', 'ROLE', 'SERVICE', 'REQUIREMENT'] as const;

export const WorkforceDemandNodeTypeSchema = z.enum(WorkforceDemandNodeTypes);

export type WorkforceDemandNodeType = z.infer<typeof WorkforceDemandNodeTypeSchema>;

export interface WorkforceDemandNodeConstraints {
  privilegeCodes?: string[];
  compacts?: string[];
  enrollments?: string[];
  ehrCompetencies?: string[];
  minHeadcount?: number;
  maxHeadcount?: number;
}

const WorkforceDemandNodeConstraintsSchema = z
  .object({
    privilegeCodes: z.array(z.string()).optional(),
    compacts: z.array(z.string()).optional(),
    enrollments: z.array(z.string()).optional(),
    ehrCompetencies: z.array(z.string()).optional(),
    minHeadcount: z.number().int().nonnegative().optional(),
    maxHeadcount: z.number().int().positive().optional(),
  })
  .partial()
  .strict();

export const WorkforceDemandNodeSchema = z
  .object({
    id: z.string().min(1),
    orgId: z.string().min(1),
    nodeType: WorkforceDemandNodeTypeSchema,
    label: z.string().min(1),
    description: z.string().optional(),
    parentNodeId: z.string().min(1).optional().nullable(),
    capacity: z.number().int().nonnegative().optional(),
    headcountTarget: z.number().int().nonnegative().default(0),
    tags: z.array(z.string()).default([]),
    metadata: z.record(z.any()).default({}),
    constraints: WorkforceDemandNodeConstraintsSchema.optional(),
    priorityScore: z.number().min(0).max(1).optional(),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
  })
  .strict();

export type WorkforceDemandNode = z.infer<typeof WorkforceDemandNodeSchema>;
export type WorkforceDemandNodeInput = z.input<typeof WorkforceDemandNodeSchema>;

const HierarchyRules: Record<WorkforceDemandNodeType, WorkforceDemandNodeType[]> = {
  DEPARTMENT: [],
  SHIFT: ['DEPARTMENT'],
  ROLE: ['DEPARTMENT', 'SHIFT'],
  SERVICE: ['ROLE'],
  REQUIREMENT: ['ROLE', 'SERVICE'],
};

export function allowedParentTypes(nodeType: WorkforceDemandNodeType): WorkforceDemandNodeType[] {
  return HierarchyRules[nodeType] ?? [];
}

export function canAttachToParent(nodeType: WorkforceDemandNodeType, parentType?: WorkforceDemandNodeType | null): boolean {
  if (!parentType) {
    return allowedParentTypes(nodeType).length === 0;
  }
  return allowedParentTypes(nodeType).includes(parentType);
}

export function assertParentCompatibility(nodeType: WorkforceDemandNodeType, parentType?: WorkforceDemandNodeType | null): void {
  const allowed = allowedParentTypes(nodeType);

  if (!parentType) {
    if (allowed.length > 0) {
      throw new Error(`${nodeType} nodes must have a parent of type ${allowed.join(' or ')}`);
    }
    return;
  }

  if (!allowed.includes(parentType)) {
    throw new Error(`${nodeType} nodes cannot attach to parent type ${parentType}. Allowed: ${allowed.join(', ') || 'none'}`);
  }
}

export function isLeafNode(nodeType: WorkforceDemandNodeType): boolean {
  return !Object.values(HierarchyRules).some((parents) => parents.includes(nodeType));
}

export function createWorkforceDemandNode(
  input: WorkforceDemandNodeInput,
  options?: { parentType?: WorkforceDemandNodeType | null }
): WorkforceDemandNode {
  const parsed = WorkforceDemandNodeSchema.parse({
    tags: [],
    metadata: {},
    ...input,
  });

  if ('parentType' in (options ?? {}) || parsed.parentNodeId === null || parsed.parentNodeId === undefined) {
    assertParentCompatibility(parsed.nodeType, options?.parentType ?? null);
  }

  if (parsed.constraints?.minHeadcount && parsed.constraints?.maxHeadcount) {
    if (parsed.constraints.minHeadcount > parsed.constraints.maxHeadcount) {
      throw new Error('minHeadcount cannot exceed maxHeadcount');
    }
  }

  return parsed;
}

export function deriveNodeKey(node: Pick<WorkforceDemandNode, 'orgId' | 'nodeType' | 'label'>): string {
  return `${node.orgId}:${node.nodeType}:${node.label.toLowerCase().replace(/\s+/g, '_')}`;
}


