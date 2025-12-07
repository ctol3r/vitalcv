import { Router, type Request, type Response } from 'express';
import { Prisma, PrismaClient, type SpecialtyRequirement } from '@prisma/client';
import { evaluateCompatibility } from '../../services/matching/engine';
import { applyCompactWeight } from '../../services/matching/compact-weight';
import {
  clamp01,
  type ClinicianFeatureSource,
  type FeatureContext,
  type JobFeatureSource,
} from '../../services/matching/features';
import {
  calculateMarketEquilibrium,
  type MarketEquilibrium,
} from '../../services/matching/market';
import { evaluateMultiSignalMatch, type MultiSignalResult } from '../../services/matching/engine-v5';
import {
  buildSkillGapRecommendations,
  type SkillGapRecommendation,
} from '../../services/matching/skills-gap';
import { buildMatchExplanation, type MatchExplanation } from '../../services/matching/explain';
import { buildEhrSignal } from '../../services/matching/ehr';
import { buildPredictiveScore } from '../../services/matching/predictive';
import { estimateHireLikelihood } from '../../services/matching/predict';
import { buildMatchSuitabilityResource } from '../../services/matching/fhir';
import { getCompactEvidenceSummaries } from '../../../../../services/psv/evidenceBundle';
import type { PractitionerRoleResource } from '../../../../../services/fhir/types/r6';

const prisma = new PrismaClient();
const router = Router();
const MAX_CANDIDATE_JOBS = 40;

type JobRecord = Prisma.JobPostingGetPayload<{}>;
type MarketSignalRecord = Prisma.MarketSignalGetPayload<{}>;
type ReadinessRecord = Prisma.ClinicianReadinessScoreGetPayload<{}> | null;

router.get('/matching/jobs/:clinicianId', async (req: Request, res: Response) => {
  const { clinicianId } = req.params;
  if (!clinicianId) {
    return res.status(400).json({
      error: 'clinician_id_required',
      message: 'Clinician identifier is required',
    });
  }

  const limitParam = Number.parseInt(String(req.query.limit ?? '5'), 10);
  const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(limitParam, 15)) : 5;

  try {
    const clinician = await prisma.clinicianProfile.findUnique({
      where: { id: clinicianId },
      include: {
        user: true,
      },
    });

    if (!clinician) {
      return res.status(404).json({
        error: 'clinician_not_found',
        message: `Unknown clinician ${clinicianId}`,
      });
    }

    const specialtyFilter = buildSpecialtyFilter(clinician.specialty);

    const [licenses, boardCredentials, readiness, jobPostings, compactSummaries] = await Promise.all([
      prisma.stateLicenseVerification.findMany({
        where: { clinicianId },
        orderBy: { issueDate: 'asc' },
      }),
      prisma.credential.findMany({
        where: {
          userId: clinician.userId,
          type: { contains: 'board', mode: 'insensitive' },
        },
        orderBy: { issuedAt: 'desc' },
        take: 10,
      }),
      prisma.clinicianReadinessScore.findUnique({
        where: { clinicianId },
      }),
      prisma.jobPosting.findMany({
        where: {
          status: 'active',
          ...(specialtyFilter.length ? { specialty: { in: specialtyFilter } } : {}),
        },
        orderBy: [{ createdAt: 'desc' as const }],
        take: MAX_CANDIDATE_JOBS,
      }),
      getCompactEvidenceSummaries(clinician.user?.did ?? ''),
    ]);

    if (jobPostings.length === 0) {
      return res.json({
        clinicianId,
        matches: [],
        compactSummary: summarizeCompact(compactSummaries),
        generatedAt: new Date().toISOString(),
      });
    }

    const [requirements, marketSignals] = await Promise.all([
      loadRequirements(jobPostings.map((job) => job.id)),
      loadMarketSignals(jobPostings),
    ]);

    const readinessFactors = (readiness?.factors as Record<string, unknown>) ?? {};
    const clinicianFeatureSource = buildClinicianSource({
      clinician,
      licenses,
      boardCredentials,
      readiness,
      compactSummaries,
    });

    const jobMatches = jobPostings
      .map((job) => {
        const jobFeatureSource = buildJobSource(job);
        const context: FeatureContext = {
          clinician: clinicianFeatureSource,
          job: jobFeatureSource,
          requirements: requirements.get(job.id) ?? [],
        };
        const compatibility = evaluateCompatibility(context);
        const jobMetadata = (job.metadata as Record<string, unknown> | null) ?? null;
        const adjustedScore = applyCompactWeight(compatibility.matchScore, {
          clinician: clinicianFeatureSource,
          job: {
            ...jobFeatureSource,
            requiredStates: job.requiredStates ?? [],
            telehealth: job.telehealth,
            travelRequired: jobMetadata?.travelRequired === true,
          },
        });

        const jobRegions = extractJobRegions(job, clinician.state);
        const matchingSignals = selectMarketSignals(job, jobRegions, marketSignals);
        const market = calculateMarketEquilibrium(matchingSignals, {
          priorityRegion: jobRegions[0],
          prioritySpecialty: job.specialty ?? clinician.specialty ?? 'GENERAL',
        });

        const ehrSignal = buildEhrSignal({
          requiredRoles: extractEhrRoles(jobMetadata),
          clinicianRoles: extractClinicianEhrRoles(readiness),
          vendor: extractEhrVendor(jobMetadata),
        });

        const multiSignal = evaluateMultiSignalMatch({
          compatibility,
          readinessScore: readiness?.score ?? compatibility.featureVector.recency,
          trustWeight: deriveTrustWeight(readiness, compatibility.featureVector),
          market,
          ehr: ehrSignal,
        });
        const skillGaps = buildSkillGapRecommendations({
          featureVector: compatibility.featureVector,
          context,
          ehr: ehrSignal,
        });
        const explanation = buildMatchExplanation({
          roleTitle: job.title ?? job.specialty ?? job.id,
          market,
          multiSignal,
          gaps: skillGaps,
        });
        const predictiveInput = buildPredictiveInput({
          readinessScore: readiness?.score ?? compatibility.featureVector.recency ?? 0.6,
          readinessFactors,
          job,
          clinician,
          featureVector: compatibility.featureVector,
        });
        const predictive = buildPredictiveScore(predictiveInput);
        const hireLikelihood = estimateHireLikelihood({
          multiSignalScore: multiSignal.finalScore,
          predictive,
          fairnessScore: predictiveInput.fairnessScore,
          marketPressure: deriveMarketPressureScore(market),
          readinessScore: predictiveInput.readinessScore,
          trustWeight: multiSignal.metadata.trustWeight,
        });
        const fhirSuitability = buildMatchSuitabilityResource({
          job,
          clinicianId: clinician.id,
          multiSignal,
          market,
          explanation,
          skillGaps,
        });

        return {
          job,
          compatibility,
          adjustedScore,
          market,
          multiSignal,
          skillGaps,
          explanation,
          predictive,
          hireLikelihood,
          fhirSuitability,
        };
      })
      .sort((a, b) => b.adjustedScore - a.adjustedScore)
      .slice(0, limit)
      .map(
        ({
          job,
          compatibility,
          adjustedScore,
          market,
          multiSignal,
          skillGaps,
          explanation,
          predictive,
          hireLikelihood,
          fhirSuitability,
        }) =>
          serializeMatch(job, compatibility, adjustedScore, {
            market,
            multiSignal,
            skillGaps,
            explanation,
            predictive,
            hireLikelihood,
            fhirSuitability,
          }),
      );

    return res.json({
      clinicianId,
      totalJobsConsidered: jobPostings.length,
      limit,
      matches: jobMatches,
      compactSummary: summarizeCompact(compactSummaries),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Matching] job recommendations failed', error);
    return res.status(500).json({
      error: 'matching_jobs_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

function buildSpecialtyFilter(primarySpecialty: string | null): string[] {
  if (!primarySpecialty) return [];
  return [primarySpecialty, primarySpecialty.split('-')[0] ?? primarySpecialty];
}

async function loadRequirements(jobIds: string[]): Promise<Map<string, SpecialtyRequirement[]>> {
  if (jobIds.length === 0) {
    return new Map();
  }
  const records = await prisma.specialtyRequirement.findMany({
    where: { jobId: { in: jobIds } },
  });
  const grouped = new Map<string, SpecialtyRequirement[]>();
  for (const record of records) {
    const existing = grouped.get(record.jobId) ?? [];
    existing.push(record);
    grouped.set(record.jobId, existing);
  }
  return grouped;
}

function buildClinicianSource({
  clinician,
  licenses,
  boardCredentials,
  readiness,
  compactSummaries,
}: {
  clinician: Prisma.ClinicianProfileGetPayload<{ include: { user: true } }>;
  licenses: Prisma.StateLicenseVerificationGetPayload<{}>[];
  boardCredentials: Prisma.CredentialGetPayload<{}>[];
  readiness: Prisma.ClinicianReadinessScoreGetPayload<{}> | null;
  compactSummaries: Awaited<ReturnType<typeof getCompactEvidenceSummaries>>;
}): ClinicianFeatureSource {
  const earliestLicense = licenses
    .map((license) => license.issueDate)
    .filter(Boolean)
    .map((date) => date!.getTime());
  const yearsExperience = earliestLicense.length
    ? calculateYearsSince(Math.min(...earliestLicense))
    : undefined;

  const sanctions = buildSanctionsSignal(readiness);
  const compactStates = compactSummaries.flatMap((summary) => summary.authorizedStates);

  return {
    id: clinician.id,
    primarySpecialty: clinician.specialty ?? 'UNKNOWN',
    secondarySpecialties: [],
    yearsExperience,
    boardCertifications: boardCredentials.map((credential) => ({
      specialty: credential.name ?? credential.type ?? 'GENERAL',
      status: credential.status ?? 'unknown',
      expiresAt: credential.expiresAt,
      verifiedAt: credential.updatedAt,
    })),
    compactEligibleStates: compactStates,
    sanctions,
    lastVerifiedAt: licenses[0]?.verifiedAt ?? readiness?.updatedAt ?? licenses[0]?.updatedAt,
  };
}

function buildJobSource(job: Prisma.JobPostingGetPayload<{}>): JobFeatureSource {
  return {
    id: job.id,
    orgId: job.partnerId,
    specialty: job.specialty ?? 'GENERAL',
    minYearsExperience: undefined,
    requiresBoardCertified: false,
    compactPreferred: job.telehealth === true || (job.requiredStates?.length ?? 0) > 1,
    updatedAt: job.updatedAt,
  };
}

function buildSanctionsSignal(
  readiness: Prisma.ClinicianReadinessScoreGetPayload<{}> | null,
) {
  const factors = (readiness?.factors as Record<string, unknown>) ?? {};
  const sanctionsMeta = (factors as { sanctions?: { hasActive?: boolean } }).sanctions;
  const probability = Number((factors as { sanctionsProbability?: number }).sanctionsProbability ?? 0);
  if (!sanctionsMeta?.hasActive) {
    return [];
  }
  return [
    {
      type: 'readiness',
      severity: probability >= 0.6 ? 'high' : probability >= 0.3 ? 'medium' : 'low',
      active: true,
    },
  ] as ClinicianFeatureSource['sanctions'];
}

function calculateYearsSince(timestamp: number): number {
  const diffMs = Date.now() - timestamp;
  const years = diffMs / (1000 * 60 * 60 * 24 * 365);
  return Math.max(0, Number(years.toFixed(1)));
}

function serializeMatch(
  job: Prisma.JobPostingGetPayload<{}>,
  compatibility: ReturnType<typeof evaluateCompatibility>,
  adjustedScore: number,
  extras: {
    market: MarketEquilibrium;
    multiSignal: MultiSignalResult;
    skillGaps: SkillGapRecommendation[];
    explanation: MatchExplanation;
    predictive: ReturnType<typeof buildPredictiveScore>;
    hireLikelihood: ReturnType<typeof estimateHireLikelihood>;
    fhirSuitability: PractitionerRoleResource;
  },
) {
  return {
    jobId: job.id,
    title: job.title,
    organization: job.partnerId,
    specialty: job.specialty,
    location: job.location ?? null,
    modality: job.modality,
    status: job.status,
    matchScore: Number((adjustedScore * 100).toFixed(1)),
    rawScore: compatibility.matchScore,
    adjustedScore,
    rationale: compatibility.rationale,
    compactRecommendation: compatibility.rationale.compact,
    featureVector: compatibility.featureVector,
    market: extras.market,
    multiSignal: extras.multiSignal,
    skillGaps: extras.skillGaps,
    explanation: extras.explanation,
    prediction: extras.predictive,
    hireLikelihood: extras.hireLikelihood,
    fhirSuitability: extras.fhirSuitability,
  };
}

async function loadMarketSignals(jobPostings: JobRecord[]): Promise<MarketSignalRecord[]> {
  if (!jobPostings.length) {
    return [];
  }
  const regions = dedupe(jobPostings.flatMap((job) => extractJobRegions(job)));
  const specialties = dedupe(
    jobPostings
      .map((job) => job.specialty)
      .filter((value): value is string => Boolean(value)),
  );
  if (!regions.length || !specialties.length) {
    return [];
  }
  return prisma.marketSignal.findMany({
    where: {
      region: { in: regions },
      specialty: { in: specialties },
    },
  });
}

function extractJobRegions(job: JobRecord, fallbackState?: string | null): string[] {
  const regions = new Set<string>();
  (job.requiredStates ?? []).forEach((state) => {
    if (state) regions.add(state.toUpperCase());
  });
  const location = (job.location as Record<string, unknown> | null) ?? null;
  const metadata = (job.metadata as Record<string, unknown> | null) ?? null;
  if (typeof location?.state === 'string') {
    regions.add(location.state.toUpperCase());
  }
  if (typeof metadata?.region === 'string') {
    regions.add(metadata.region.toUpperCase());
  }
  if (fallbackState) {
    regions.add(fallbackState.toUpperCase());
  }
  if (!regions.size) {
    regions.add('NATIONAL');
  }
  return Array.from(regions);
}

function selectMarketSignals(
  job: JobRecord,
  regions: string[],
  signals: MarketSignalRecord[],
): MarketSignalRecord[] {
  const normalizedRegions = new Set(regions.map((region) => region.toUpperCase()));
  const jobSpecialty = (job.specialty ?? 'GENERAL').toLowerCase();
  const candidates = signals.filter(
    (signal) =>
      normalizedRegions.has(signal.region.toUpperCase()) &&
      signal.specialty.toLowerCase() === jobSpecialty,
  );
  if (candidates.length) {
    return candidates;
  }
  return signals.filter((signal) => signal.specialty.toLowerCase() === jobSpecialty);
}

function extractEhrRoles(metadata: Record<string, unknown> | null): string[] {
  const privileges = metadata?.ehrPrivileges as unknown;
  if (Array.isArray(privileges)) {
    return privileges.filter((role): role is string => typeof role === 'string');
  }
  if (privileges && Array.isArray((privileges as { required?: string[] }).required)) {
    return (privileges as { required?: string[] }).required!.filter(
      (role): role is string => typeof role === 'string',
    );
  }
  return [];
}

function extractClinicianEhrRoles(
  readiness: Prisma.ClinicianReadinessScoreGetPayload<{}> | null,
): string[] {
  const factors = (readiness?.factors as Record<string, unknown>) ?? {};
  const privileges = factors?.ehrPrivileges as unknown;
  if (Array.isArray(privileges)) {
    return privileges.filter((role): role is string => typeof role === 'string');
  }
  if (privileges && Array.isArray((privileges as { granted?: string[] }).granted)) {
    return (privileges as { granted?: string[] }).granted!.filter(
      (role): role is string => typeof role === 'string',
    );
  }
  return [];
}

function extractEhrVendor(metadata: Record<string, unknown> | null): string | undefined {
  const vendor = metadata?.ehrVendor ?? metadata?.ehrSystem;
  if (typeof vendor === 'string') {
    return vendor;
  }
  if (vendor && typeof (vendor as { name?: string }).name === 'string') {
    return (vendor as { name?: string }).name;
  }
  return undefined;
}

function deriveTrustWeight(
  readiness: ReadinessRecord,
  vector: ReturnType<typeof evaluateCompatibility>['featureVector'],
): number {
  const readinessScore = readiness?.score ?? vector.recency ?? 0.6;
  const sanctions = vector.sanctionsRisk ?? 0.8;
  const board = vector.boardStatus ?? 0.5;
  const volatility = Number((readiness?.factors as { volatility?: number })?.volatility ?? 0.1);
  const volatilityPenalty = clamp01(volatility);
  return clamp01(readinessScore * 0.55 + sanctions * 0.25 + board * 0.15 - volatilityPenalty * 0.1);
}

function buildPredictiveInput({
  readinessScore,
  readinessFactors,
  job,
  clinician,
  featureVector,
}: {
  readinessScore: number;
  readinessFactors: Record<string, unknown>;
  job: JobRecord;
  clinician: Prisma.ClinicianProfileGetPayload<{ include: { user: true } }>;
  featureVector: ReturnType<typeof evaluateCompatibility>['featureVector'];
}) {
  const fairnessScore = clamp01(
    Number(
      (readinessFactors?.fairnessScore as number | undefined) ??
        (readinessFactors?.equityBoost as number | undefined) ??
        readinessScore,
    ),
  );
  const historicalSuccess = clamp01(
    Number(
      (readinessFactors?.historicalHireRate as number | undefined) ??
        (readinessFactors?.historicalSuccess as number | undefined) ??
        0.6,
    ),
  );
  const signalVolatility = clamp01(
    Number((readinessFactors?.volatility as number | undefined) ?? 0.09),
  );
  const scheduleFit = deriveScheduleFitEstimate({
    job,
    clinician,
    readinessFactors,
    featureVector,
  });
  return {
    readinessScore: clamp01(readinessScore),
    scheduleFit,
    fairnessScore,
    historicalSuccessRate: historicalSuccess,
    signalVolatility,
  };
}

function deriveScheduleFitEstimate({
  job,
  clinician,
  readinessFactors,
  featureVector,
}: {
  job: JobRecord;
  clinician: Prisma.ClinicianProfileGetPayload<{ include: { user: true } }>;
  readinessFactors: Record<string, unknown>;
  featureVector: ReturnType<typeof evaluateCompatibility>['featureVector'];
}): number {
  let base = job.telehealth ? 0.85 : 0.65;
  const clinicianState = clinician.state?.toUpperCase();
  const requiresTravel = Boolean((job.metadata as Record<string, unknown> | null)?.travelRequired);
  if ((job.requiredStates ?? []).some((state) => state?.toUpperCase() === clinicianState)) {
    base += 0.07;
  }
  if (requiresTravel) {
    base -= 0.08;
  }
  const fatiguePenalty = clamp01(
    Number((readinessFactors?.fatigueRisk as number | undefined) ?? 0.15) * 0.2,
  );
  const preferenceBoost = clamp01(
    Number((readinessFactors?.schedulePreference as number | undefined) ?? 0.75) * 0.1,
  );
  const recencySignal = clamp01(featureVector.recency ?? 0.65) * 0.05;
  return clamp01(base + preferenceBoost + recencySignal - fatiguePenalty);
}

function deriveMarketPressureScore(market: MarketEquilibrium): number {
  const ratioScore = clamp01(market.marketRatio / 2);
  if (market.pressure === 'tight') {
    return Math.max(ratioScore, 0.85);
  }
  if (market.pressure === 'surplus') {
    return Math.min(ratioScore, 0.45);
  }
  return Math.max(0.6, ratioScore);
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

function summarizeCompact(compactSummaries: Awaited<ReturnType<typeof getCompactEvidenceSummaries>>) {
  const states = compactSummaries.flatMap((summary) => summary.authorizedStates);
  return {
    totalStates: states.length,
    representativeStates: Array.from(new Set(states)).slice(0, 10),
    compacts: compactSummaries.map((summary) => ({
      compactType: summary.compactType,
      authorizedStates: summary.authorizedStates,
      representativeState: summary.representativeState,
    })),
  };
}

export default router;

