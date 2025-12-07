import { z } from 'zod';

// Define schemas for each PluginAPI method
export const fetchClinicianSchema = z
	.object({
		clinicianId: z.string().min(1).optional(),
		clinicianDid: z.string().min(1).optional(),
		npi: z.string().min(1).optional(),
	})
	.refine((v) => !!(v.clinicianId || v.clinicianDid || v.npi), {
		message: 'one of clinicianId, clinicianDid, or npi must be provided',
	});

export const fetchPrivilegesSchema = z.object({
	clinicianId: z.string().min(1),
});

export const runFusionSchema = z.object({
	clinicianId: z.string().min(1),
	lookbackDays: z.number().int().positive().max(365).optional(),
});

export const queryTimelineSchema = z.object({
	clinicianId: z.string().min(1),
	startDate: z.preprocess(
		(v) => (typeof v === 'string' ? new Date(v) : v),
		z.date().optional(),
	),
	endDate: z.preprocess(
		(v) => (typeof v === 'string' ? new Date(v) : v),
		z.date().optional(),
	),
});

export const getRiskSchema = z.object({
	clinicianId: z.string().min(1),
});

export const getCCISchema = z.object({
	features: z.record(z.number()),
	options: z
		.object({
			handleMissingData: z.enum(['skip', 'default', 'impute']).optional(),
			modelConfig: z.any().optional(),
			defaultValues: z.record(z.number()).optional(),
		})
		.optional(),
});

export const runForecastSchema = z.object({
	orgId: z.string().optional(),
	department: z.string().optional(),
	specialty: z.string().optional(),
	role: z.string().optional(),
	startDate: z.preprocess(
		(v) => (typeof v === 'string' ? new Date(v) : v),
		z.date().optional(),
	),
	horizonDays: z.array(z.number().int().positive()).optional(),
	modelType: z.enum(['ml', 'moving_average', 'arima']).optional(),
	modelConfig: z.any().optional(),
});

export type FetchClinicianInput = z.infer<typeof fetchClinicianSchema>;
export type FetchPrivilegesInput = z.infer<typeof fetchPrivilegesSchema>;
export type RunFusionInput = z.infer<typeof runFusionSchema>;
export type QueryTimelineInput = z.infer<typeof queryTimelineSchema>;
export type GetRiskInput = z.infer<typeof getRiskSchema>;
export type GetCCIInput = z.infer<typeof getCCISchema>;
export type RunForecastInput = z.infer<typeof runForecastSchema>;

export class PluginRequestValidationError extends Error {
	constructor(public readonly method: string, public readonly issues: z.ZodIssue[]) {
		super(`Invalid request for ${method}`);
		this.name = 'PluginRequestValidationError';
	}
}

export function validatePluginRequest<T>(method: string, schema: z.ZodSchema<T>, payload: unknown): T {
	const parsed = schema.safeParse(payload);
	if (!parsed.success) {
		throw new PluginRequestValidationError(method, parsed.error.issues);
	}
	return parsed.data;
}


