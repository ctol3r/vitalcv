import { z } from 'zod';

export const CAUSAL_NODE_TYPES = [
  'DRIFT_EVENT',
  'QUALITY_SIGNAL',
  'SAFETY_SIGNAL',
  'RISK_SPIKE',
  'ENROLLMENT_CONFLICT',
  'PRIVILEGE_RESTRICTION',
  'COMPLIANCE_FAIL',
  'EHR_MISMATCH',
  'FORECAST_RISK',
] as const;

export const CausalNodeTypeSchema = z.enum(CAUSAL_NODE_TYPES);
export type CausalNodeType = z.infer<typeof CausalNodeTypeSchema>;

export const CausalNodeSchema = z
  .object({
    id: z.string().min(1, 'id is required'),
    nodeType: CausalNodeTypeSchema,
    sourceEventId: z.string().min(1, 'sourceEventId is required'), // ID from original event (DriftEvent, QualitySignal, etc.)
    sourceEventType: z.string().min(1, 'sourceEventType is required'), // Type of source event (e.g., 'DriftEvent', 'QualitySignal')
    clinicianId: z.string().min(1, 'clinicianId is required'),
    orgId: z.string().optional(),
    timestamp: z.coerce.date().default(() => new Date()),
    severity: z.enum(['LOW', 'MED', 'HIGH', 'CRITICAL']).optional(),
    summary: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .strict();

export type CreateCausalNodeInput = z.input<typeof CausalNodeSchema>;
export type CausalNode = z.infer<typeof CausalNodeSchema>;

export function createCausalNode(input: CreateCausalNodeInput): CausalNode {
  return CausalNodeSchema.parse(input);
}

export function isDriftEventNode(node: CausalNode): boolean {
  return node.nodeType === 'DRIFT_EVENT';
}

export function isQualitySignalNode(node: CausalNode): boolean {
  return node.nodeType === 'QUALITY_SIGNAL';
}

export function isSafetySignalNode(node: CausalNode): boolean {
  return node.nodeType === 'SAFETY_SIGNAL';
}

export function isRiskSpikeNode(node: CausalNode): boolean {
  return node.nodeType === 'RISK_SPIKE';
}

