import { z } from 'zod';

const DateInput = z.preprocess((value) => {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return undefined;
}, z.date());

export const WorkforceDemandUrgency = {
  FLEXIBLE: 'FLEXIBLE',
  ROUTINE: 'ROUTINE',
  PRIORITY: 'PRIORITY',
  CRITICAL: 'CRITICAL',
} as const;

export type WorkforceDemandUrgency = (typeof WorkforceDemandUrgency)[keyof typeof WorkforceDemandUrgency];

export const WorkforceDemandLocationSchema = z
  .object({
    campusId: z.string().min(1).optional(),
    facilityId: z.string().min(1).optional(),
    departmentName: z.string().optional(),
    unit: z.string().optional(),
    city: z.string().optional(),
    state: z
      .string()
      .length(2)
      .transform((value) => value.toUpperCase())
      .optional(),
    zip: z.string().optional(),
    coordinates: z
      .object({
        lat: z.number(),
        lng: z.number(),
      })
      .optional(),
  })
  .strict();

export type WorkforceDemandLocation = z.infer<typeof WorkforceDemandLocationSchema>;

export const WorkforceShiftTimeSchema = z
  .object({
    start: DateInput,
    end: DateInput,
    timezone: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.end.getTime() <= value.start.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['end'],
        message: 'Shift end must be after shift start',
      });
    }
  });

export interface WorkforceShiftTime extends z.infer<typeof WorkforceShiftTimeSchema> {}

export const WorkforceDemandSchema = z
  .object({
    id: z.string().min(1).optional(),
    orgId: z.string().min(1),
    deptId: z.string().min(1),
    role: z.string().min(1),
    privilegeCodes: z.array(z.string()).default([]),
    requiredCompacts: z.array(z.string()).default([]),
    requiredEnrollments: z.array(z.string()).default([]),
    requiredEhrCompetencies: z.array(z.string()).default([]),
    shiftTime: WorkforceShiftTimeSchema,
    location: WorkforceDemandLocationSchema,
    urgency: z.enum(Object.values(WorkforceDemandUrgency) as [string, ...string[]]).default(WorkforceDemandUrgency.ROUTINE),
    requiredHeadcount: z.number().int().positive().default(1),
    fulfilledHeadcount: z.number().int().nonnegative().default(0),
    metadata: z.record(z.any()).optional(),
  })
  .strict();

export type WorkforceDemand = z.infer<typeof WorkforceDemandSchema>;
export type WorkforceDemandInput = z.input<typeof WorkforceDemandSchema>;

export function normalizeWorkforceDemand(input: WorkforceDemandInput): WorkforceDemand {
  const parsed = WorkforceDemandSchema.parse(input);
  return parsed;
}

export interface CoverageGap {
  capacity: number;
  filled: number;
  deficit: number;
  coverageRatio: number;
  status: 'FILLED' | 'AT_RISK' | 'CRITICAL';
}

export function calculateCoverageGap(demand: WorkforceDemand, fulfillmentOverride?: number): CoverageGap {
  const filled = fulfillmentOverride ?? demand.fulfilledHeadcount;
  const deficit = Math.max(demand.requiredHeadcount - filled, 0);
  const capacity = demand.requiredHeadcount;
  const coverageRatio = capacity === 0 ? 1 : Math.min(filled / capacity, 1);

  let status: CoverageGap['status'] = 'FILLED';
  if (deficit > 0) {
    status = coverageRatio < 0.5 ? 'CRITICAL' : 'AT_RISK';
  }

  return {
    capacity,
    filled,
    deficit,
    coverageRatio,
    status,
  };
}

export function mergePrivilegeCodes(...lists: Array<string[] | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  lists.forEach((list) => {
    list?.forEach((code) => {
      const normalized = code.trim();
      if (!normalized || seen.has(normalized)) {
        return;
      }
      seen.add(normalized);
      result.push(normalized);
    });
  });

  return result;
}


