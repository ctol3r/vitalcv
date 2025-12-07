import { z } from 'zod';

export const COUPLING_EDGE_TYPES = [
  'DEPENDS_ON',
  'FEEDS_INTO',
  'BLOCKS',
  'AMPLIFIES',
  'CAUSES',
  'DEGRADES',
  'STRENGTHENS',
] as const;

export const CouplingEdgeTypeSchema = z.enum(COUPLING_EDGE_TYPES);
export type CouplingEdgeType = z.infer<typeof CouplingEdgeTypeSchema>;

export const CouplingEdgeSchema = z
  .object({
    id: z.string().min(1, 'id is required'),
    sourceNodeId: z.string().min(1, 'sourceNodeId is required'),
    targetNodeId: z.string().min(1, 'targetNodeId is required'),
    edgeType: CouplingEdgeTypeSchema,
    impactWeight: z
      .number()
      .min(0, 'impactWeight must be >= 0')
      .max(1, 'impactWeight must be <= 1'),
    delayFactor: z.number().min(0, 'delayFactor must be >= 0'),
    metadata: z.record(z.unknown()).optional(),
    createdAt: z.coerce.date().default(() => new Date()),
    updatedAt: z.coerce.date().default(() => new Date()),
  })
  .strict();

export type CreateCouplingEdgeInput = z.input<typeof CouplingEdgeSchema>;
export type CouplingEdge = z.infer<typeof CouplingEdgeSchema>;

export function createCouplingEdge(input: CreateCouplingEdgeInput): CouplingEdge {
  return CouplingEdgeSchema.parse(input);
}

export function isDependsOnEdge(edge: CouplingEdge): boolean {
  return edge.edgeType === 'DEPENDS_ON';
}

export function isFeedsIntoEdge(edge: CouplingEdge): boolean {
  return edge.edgeType === 'FEEDS_INTO';
}

export function isBlocksEdge(edge: CouplingEdge): boolean {
  return edge.edgeType === 'BLOCKS';
}

export function isAmplifiesEdge(edge: CouplingEdge): boolean {
  return edge.edgeType === 'AMPLIFIES';
}

export function isCausesEdge(edge: CouplingEdge): boolean {
  return edge.edgeType === 'CAUSES';
}

export function isDegradesEdge(edge: CouplingEdge): boolean {
  return edge.edgeType === 'DEGRADES';
}

export function isStrengthensEdge(edge: CouplingEdge): boolean {
  return edge.edgeType === 'STRENGTHENS';
}

export function hasHighImpact(edge: CouplingEdge, threshold: number = 0.7): boolean {
  return edge.impactWeight >= threshold;
}

export function hasLowImpact(edge: CouplingEdge, threshold: number = 0.3): boolean {
  return edge.impactWeight <= threshold;
}

