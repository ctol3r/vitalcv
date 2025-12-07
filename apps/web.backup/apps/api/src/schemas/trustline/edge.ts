import { z } from 'zod';

export const TrustlineEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  weight: z.number().min(0).max(1),
  type: z.enum(['employment', 'verification', 'compliance', 'safety', 'contract']),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type TrustlineEdge = z.infer<typeof TrustlineEdgeSchema>;

export const TrustlineGraphSchema = z.object({
  nodes: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      score: z.number().min(0).max(1),
      metadata: z.record(z.unknown()).optional(),
    })
  ),
  edges: z.array(TrustlineEdgeSchema),
});

export type TrustlineGraph = z.infer<typeof TrustlineGraphSchema>;








