import { z } from 'zod';

export const COUPLING_NODE_TYPES = [
  'DEPARTMENT',
  'ROLE',
  'PRIVILEGE_SET',
  'ENROLLMENT_POOL',
  'EHR_DOMAIN',
  'STATE_REGION',
  'SERVICE_LINE',
] as const;

export const CouplingNodeTypeSchema = z.enum(COUPLING_NODE_TYPES);
export type CouplingNodeType = z.infer<typeof CouplingNodeTypeSchema>;

export const CouplingNodeSchema = z
  .object({
    id: z.string().min(1, 'id is required'),
    nodeType: CouplingNodeTypeSchema,
    name: z.string().min(1, 'name is required'),
    orgId: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
    createdAt: z.coerce.date().default(() => new Date()),
    updatedAt: z.coerce.date().default(() => new Date()),
  })
  .strict();

export type CreateCouplingNodeInput = z.input<typeof CouplingNodeSchema>;
export type CouplingNode = z.infer<typeof CouplingNodeSchema>;

export function createCouplingNode(input: CreateCouplingNodeInput): CouplingNode {
  return CouplingNodeSchema.parse(input);
}

export function isDepartmentNode(node: CouplingNode): boolean {
  return node.nodeType === 'DEPARTMENT';
}

export function isRoleNode(node: CouplingNode): boolean {
  return node.nodeType === 'ROLE';
}

export function isPrivilegeSetNode(node: CouplingNode): boolean {
  return node.nodeType === 'PRIVILEGE_SET';
}

export function isEnrollmentPoolNode(node: CouplingNode): boolean {
  return node.nodeType === 'ENROLLMENT_POOL';
}

export function isEhrDomainNode(node: CouplingNode): boolean {
  return node.nodeType === 'EHR_DOMAIN';
}

export function isStateRegionNode(node: CouplingNode): boolean {
  return node.nodeType === 'STATE_REGION';
}

export function isServiceLineNode(node: CouplingNode): boolean {
  return node.nodeType === 'SERVICE_LINE';
}

