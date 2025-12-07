import { z } from 'zod';

export const CAUSAL_EDGE_TYPES = [
  'CAUSES',
  'AMPLIFIES',
  'CONTRADICTS',
  'MITIGATES',
  'REQUIRES',
  'PRECEDES',
] as const;

export const CausalEdgeTypeSchema = z.enum(CAUSAL_EDGE_TYPES);
export type CausalEdgeType = z.infer<typeof CausalEdgeTypeSchema>;

export const CausalEdgeSchema = z
  .object({
    id: z.string().min(1, 'id is required'),
    sourceNodeId: z.string().min(1, 'sourceNodeId is required'),
    targetNodeId: z.string().min(1, 'targetNodeId is required'),
    edgeType: CausalEdgeTypeSchema,
    confidenceScore: z
      .number()
      .min(0, 'confidenceScore must be >= 0')
      .max(1, 'confidenceScore must be <= 1'),
    rationale: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
    createdAt: z.coerce.date().default(() => new Date()),
  })
  .strict();

export type CreateCausalEdgeInput = z.input<typeof CausalEdgeSchema>;
export type CausalEdge = z.infer<typeof CausalEdgeSchema>;

export function createCausalEdge(input: CreateCausalEdgeInput): CausalEdge {
  return CausalEdgeSchema.parse(input);
}

export function isCausalEdge(edge: CausalEdge): boolean {
  return edge.edgeType === 'CAUSES';
}

export function isAmplificationEdge(edge: CausalEdge): boolean {
  return edge.edgeType === 'AMPLIFIES';
}

export function isMitigationEdge(edge: CausalEdge): boolean {
  return edge.edgeType === 'MITIGATES';
}

export function isContradictionEdge(edge: CausalEdge): boolean {
  return edge.edgeType === 'CONTRADICTS';
}

export function isRequirementEdge(edge: CausalEdge): boolean {
  return edge.edgeType === 'REQUIRES';
}

export function isPrecedenceEdge(edge: CausalEdge): boolean {
  return edge.edgeType === 'PRECEDES';
}

export function hasHighConfidence(edge: CausalEdge, threshold: number = 0.7): boolean {
  return edge.confidenceScore >= threshold;
}

export function hasLowConfidence(edge: CausalEdge, threshold: number = 0.3): boolean {
  return edge.confidenceScore <= threshold;
}

