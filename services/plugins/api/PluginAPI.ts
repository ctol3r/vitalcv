import { PrismaClient } from '@prisma/client';
import { resolveClinicianContext } from '../../common/clinicianContext.js';
import {
	loadClinicianWithUser,
	buildClinicianTimeline,
	type TimelineBuildResult,
} from '../../timeline/getClinicianTimeline.js';
import { fusionEngine, type FusionEngineResult } from '../../qualityFusion/fusionEngine.js';
import { calculateCCI, type CCICalculationOptions, type CCICalculationResult } from '../../competency/calcCCI.js';
import { DemandForecastEngine, type ForecastRequest, type ForecastResponse } from '../../workforceForecast/demandEngine.js';
import { createLogger } from '@chai-vc/logging-core';
import { enforcePermissions } from '../permissions.js';
import { withLimits, type ExecutionLimits } from '../executionLimiter.js';
import { formatPluginError } from '../errorFormatter.js';

const log = createLogger({ service: 'plugins/api' });
const prisma = new PrismaClient();

// ------------------------------------------------------------
// Public Plugin API surface
// ------------------------------------------------------------
export interface PluginAPI {
	// Identity and profile
	fetchClinician(input: { clinicianId?: string; clinicianDid?: string; npi?: string }): Promise<{
		clinicianId: string;
		userId: string;
		npi?: string;
		specialty?: string;
		state?: string;
	} | null>;

	// Privileging snapshot
	fetchPrivileges(input: { clinicianId: string }): Promise<Array<{
		privilegeCode: string;
		grantedAt: string;
		expiresAt?: string;
		status?: string;
	}>>

	// Analytics
	runFusion(input: { clinicianId: string; lookbackDays?: number }): Promise<FusionEngineResult>;
	queryTimeline(input: { clinicianId: string; startDate?: Date; endDate?: Date }): Promise<TimelineBuildResult>;
	getRisk(input: { clinicianId: string }): Promise<{ score: number; factors: string[]; details?: Record<string, unknown> } | null>;
	getCCI(input: { features: Record<string, number>; options?: CCICalculationOptions }): Promise<CCICalculationResult>;
	runForecast(input: ForecastRequest): Promise<ForecastResponse>;
}

export interface CreatePluginAPIOptions {
	manifest: { name: string; capabilities: string[] };
	limits?: ExecutionLimits;
}

/**
 * Create a safe Plugin API bound to a plugin manifest and wrapped with:
 * - permissions enforcement
 * - execution limits
 * - safe error formatting
 */
export function createPluginAPI(options: CreatePluginAPIOptions): PluginAPI {
	const limits: ExecutionLimits = {
		timeoutMs: options.limits?.timeoutMs ?? 1500,
		maxHeapIncreaseBytes: options.limits?.maxHeapIncreaseBytes ?? 5 * 1024 * 1024, // +5MB soft cap
		label: `plugin:${options.manifest.name}`,
	};

	const forecastEngine = new DemandForecastEngine(prisma);

	return {
		async fetchClinician(input) {
			return withGuard('readTimeline', 'fetchClinician', limits, async () => {
				const ctx = await resolveClinicianContext(input);
				if (!ctx?.clinicianId) return null;
				const profile = await loadClinicianWithUser(ctx.clinicianId);
				if (!profile) return null;
				return {
					clinicianId: profile.id,
					userId: profile.userId,
					npi: profile.npi ?? undefined,
					specialty: profile.specialty ?? undefined,
					state: profile.state ?? undefined,
				};
			});
		},

		async fetchPrivileges(input) {
			return withGuard('readTimeline', 'fetchPrivileges', limits, async () => {
				// Fetch active granted privileges for clinician
				const granted = await prisma.privilegeGranted.findMany({
					where: { clinicianId: input.clinicianId },
					select: {
						id: true,
						grantedAt: true,
						expiresAt: true,
						status: true,
						privilegeCode: true,
					},
					orderBy: { grantedAt: 'desc' },
					take: 200,
				});
				return granted.map((g) => ({
					privilegeCode: g.privilegeCode ?? 'UNKNOWN',
					grantedAt: g.grantedAt.toISOString(),
					expiresAt: g.expiresAt?.toISOString(),
					status: g.status ?? undefined,
				}));
			});
		},

		async runFusion(input) {
			return withGuard('runAnalysis', 'runFusion', limits, async () => {
				return fusionEngine.run({ clinicianId: input.clinicianId, lookbackDays: input.lookbackDays });
			});
		},

		async queryTimeline(input) {
			return withGuard('readTimeline', 'queryTimeline', limits, async () => {
				const clinician = await loadClinicianWithUser(input.clinicianId);
				if (!clinician) {
					return { events: [], phaseGroups: [] };
				}
				return buildClinicianTimeline({
					clinician,
					startDate: input.startDate,
					endDate: input.endDate,
					sortDirection: 'desc',
				});
			});
		},

		async getRisk(input) {
			return withGuard('runAnalysis', 'getRisk', limits, async () => {
				const record = await prisma.credentialRisk.findUnique({
					where: { clinicianId: input.clinicianId },
					select: { score: true, factors: true, details: true },
				});
				if (!record) return null;
				return {
					score: record.score,
					factors: Array.isArray(record.factors) ? (record.factors as string[]) : [],
					details: (record.details ?? undefined) as Record<string, unknown> | undefined,
				};
			});
		},

		async getCCI(input) {
			return withGuard('runAnalysis', 'getCCI', limits, async () => {
				return calculateCCI(input.features as any, input.options);
			});
		},

		async runForecast(input) {
			return withGuard('provideForecasts', 'runForecast', limits, async () => {
				return forecastEngine.forecast(input);
			});
		},
	};

	function withGuard<T>(
		requiredCapability: string,
		method: string,
		execLimits: ExecutionLimits,
		fn: () => Promise<T>,
	): Promise<T> {
		// Permission check
		enforcePermissions(options.manifest, requiredCapability, { method });

		// Execution limits and error normalization
		return withLimits(execLimits, async () => {
			try {
				return await fn();
			} catch (e) {
				const formatted = formatPluginError(e);
				log.warn('Plugin API error', { method, error: formatted });
				throw new Error(formatted.message);
			}
		});
	}
}

export default createPluginAPI;


