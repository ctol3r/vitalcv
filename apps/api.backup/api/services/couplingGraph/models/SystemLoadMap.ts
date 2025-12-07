import { z } from 'zod';

export const SystemLoadMapSchema = z
  .object({
    id: z.string().min(1, 'id is required'),
    nodeId: z.string().min(1, 'nodeId is required'),
    loadScore: z
      .number()
      .min(0, 'loadScore must be >= 0')
      .max(1, 'loadScore must be <= 1'),
    orgId: z.string().optional(),
    forecastSource: z.string().optional(), // Source of forecast data
    mobilityFactor: z.number().min(0).max(1).optional(), // Staff mobility factor
    enrollmentCoverage: z.number().min(0).max(1).optional(), // Enrollment coverage factor
    metadata: z.record(z.unknown()).optional(),
    computedAt: z.coerce.date().default(() => new Date()),
    createdAt: z.coerce.date().default(() => new Date()),
    updatedAt: z.coerce.date().default(() => new Date()),
  })
  .strict();

export type CreateSystemLoadMapInput = z.input<typeof SystemLoadMapSchema>;
export type SystemLoadMap = z.infer<typeof SystemLoadMapSchema>;

export function createSystemLoadMap(input: CreateSystemLoadMapInput): SystemLoadMap {
  return SystemLoadMapSchema.parse(input);
}

export function hasHighLoad(loadMap: SystemLoadMap, threshold: number = 0.8): boolean {
  return loadMap.loadScore >= threshold;
}

export function hasLowLoad(loadMap: SystemLoadMap, threshold: number = 0.3): boolean {
  return loadMap.loadScore <= threshold;
}

export function isOverloaded(loadMap: SystemLoadMap, threshold: number = 0.9): boolean {
  return loadMap.loadScore >= threshold;
}

