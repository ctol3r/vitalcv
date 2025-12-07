import { Router, type Request, type Response } from 'express';
import { PrismaClient, Prisma, type SpecialtyRequirement } from '@prisma/client';
import { calculateScheduleFit, type ShiftWindow } from '../../services/matching/schedule-fit';
import { applyFairnessGuardrail, type FairnessCandidateProfile } from '../../services/matching/fairness';
import { buildPredictiveScore, PREDICTIVE_WEIGHTS } from '../../services/matching/predictive';
import {
  clamp01,
  type ClinicianFeatureSource,
  type FeatureContext,
  type JobFeatureSource,
} from '../../services/matching/features';
import { evaluateCompatibility } from '../../services/matching/engine';
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
import { estimateHireLikelihood } from '../../services/matching/predict';
import { logFairnessDecisions, recordFairnessAudit } from '../../services/matching/fairness-log';

const prisma = new PrismaClient();
const router = Router();
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 40;
const DEFAULT_SHIFT: ShiftWindow = {
  start: '07:00',
  end: '19:00',
  days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
};

type JobRecord = Prisma.JobPostingGetPayload<{}>;
type ClinicianRecord = Prisma.ClinicianProfileGetPayload<{ include: { user: true } }>;
type ReadinessRecord = Prisma.ClinicianReadinessScoreGetPayload<{}>;
type MarketSignalRecord = Prisma.MarketSignalGetPayload<{}>;

router.get('/matching/predictive/:jobId', async (req: Request, res: Response) => {
  const jobId = req.params.jobId;
  if (!jobId) {
    return res.status(400).json({ error: 'job_id_required', message: 'Job identifier is required' });
  }

  const limit = normalizeLimit(req.query.limit);
  try {
    const job = await prisma.jobPosting.findUnique({ where: { id: jobId } });
    if (!job) {
      return res.status(404).json({
        error: 'job_not_found',
        message: `Job ${jobId} could not be located`,
      });
    }

    const jobRequirements = await loadJobRequirements(job.id);
    const jobFeatureSource = buildJobSource(job);
    const jobRegions = extractJobRegions(job);
    const jobMarketSignals = await loadJobMarketSignals(jobRegions, job.specialty ?? 'GENERAL');
    const market = calculateMarketEquilibrium(jobMarketSignals, {
      priorityRegion: jobRegions[0],
      prioritySpecialty: job.specialty ?? 'GENERAL',
    });
    const jobMetadata = (job.metadata as Record<string, unknown> | null) ?? null;
    const jobEhrRoles = extractEhrRoles(jobMetadata);
    const jobEhrVendor = extractEhrVendor(jobMetadata);

    const readiness = await prisma.clinicianReadinessScore.findMany({
      orderBy: { score: 'desc' },
      take: limit * 3,
    });

    const readinessMap = new Map(readiness.map((record) => [record.clinicianId, record]));

    if (!readiness.length) {
      return res.json({
        job: serializeJob(job),
        generatedAt: new Date().toISOString(),
        candidates: [],
        fairnessOverlay: buildEmptyOverlay(),
        autoVerifyRecommendation: [],
      });
    }

    const clinicianProfiles = await prisma.clinicianProfile.findMany({
      where: { id: { in: readiness.map((record) => record.clinicianId) } },
      include: { user: true },
    });
    const profileMap = new Map(clinicianProfiles.map((profile) => [profile.id, profile]));

    const jobShift = buildJobShift(job);
    const baseCandidates = readiness
      .map((record) => {
        const clinician = profileMap.get(record.clinicianId);
        if (!clinician) {
          return null;
        }
        return buildCandidate(job, jobShift, record, clinician);
      })
      .filter((candidate): candidate is NonNullable<ReturnType<typeof buildCandidate>> => Boolean(candidate));

    const fairnessProfiles: FairnessCandidateProfile[] = baseCandidates.map((candidate) => ({
      clinicianId: candidate.clinicianId,
      baseScore: candidate.readinessScore,
      specialty: candidate.specialty,
      gender: candidate.gender,
      locationRegion: candidate.state,
      readinessScore: candidate.readinessScore,
      historicalHireRate: candidate.historicalSuccessRate,
    }));

    const fairnessAdjustments = applyFairnessGuardrail(fairnessProfiles);
    const fairnessMap = new Map(fairnessAdjustments.map((entry) => [entry.clinicianId, entry]));
    await logFairnessDecisions({
      jobId: job.id,
      orgId: job.partnerId,
      featureWeights: PREDICTIVE_WEIGHTS,
      adjustments: fairnessAdjustments,
    });

    const predictiveRankings = baseCandidates
      .map((candidate) => {
        const fairness = fairnessMap.get(candidate.clinicianId);
        const predictive = buildPredictiveScore({
          readinessScore: candidate.readinessScore,
          scheduleFit: candidate.scheduleFit,
          fairnessScore: fairness?.fairnessScore ?? candidate.readinessScore,
          historicalSuccessRate: candidate.historicalSuccessRate,
          signalVolatility: candidate.signalVolatility,
        });

        const clinician = profileMap.get(candidate.clinicianId);
        const readinessRecord = readinessMap.get(candidate.clinicianId);
        if (!clinician || !readinessRecord) {
          return {
            ...candidate,
            fairness,
            prediction: predictive,
            market,
            multiSignal: null,
            skillGaps: [],
            explanation: null,
            hireLikelihood: {
              hireLikelihood: predictive.predictionScore,
              confidenceBand: { lower: predictive.rationale.confidenceBand.lower, upper: predictive.rationale.confidenceBand.upper },
              drivers: predictive.rationale.factors,
            },
          };
        }

        const featureContext = buildCandidateFeatureContext({
          clinician,
          readiness: readinessRecord,
          job,
          jobFeatureSource,
          requirements: jobRequirements,
        });

        const compatibility = evaluateCompatibility(featureContext);
        const ehrSignal = buildEhrSignal({
          requiredRoles: jobEhrRoles,
          clinicianRoles: extractClinicianEhrRoles(readinessRecord),
          vendor: jobEhrVendor,
        });

        const multiSignal = evaluateMultiSignalMatch({
          compatibility,
          readinessScore: candidate.readinessScore,
          trustWeight: deriveCandidateTrustWeight(readinessRecord, compatibility.featureVector),
          market,
          ehr: ehrSignal,
        });

        const skillGaps = buildSkillGapRecommendations({
          featureVector: compatibility.featureVector,
          context: featureContext,
          ehr: ehrSignal,
        });

        const explanation = buildMatchExplanation({
          roleTitle: job.title ?? job.specialty ?? job.id,
          market,
          multiSignal,
          gaps: skillGaps,
          fairnessAlerts: fairness?.biasAlerts,
        });

        const hireLikelihood = estimateHireLikelihood({
          multiSignalScore: multiSignal.finalScore,
          predictive,
          fairnessScore: fairness?.fairnessScore ?? candidate.readinessScore,
          marketPressure: market.equilibriumScore,
          readinessScore: candidate.readinessScore,
          trustWeight: multiSignal.metadata.trustWeight,
        });

        return {
          ...candidate,
          fairness,
          prediction: predictive,
          multiSignal,
          skillGaps,
          explanation,
          market,
          hireLikelihood,
        };
      })
      .sort((a, b) => b.prediction.predictionScore - a.prediction.predictionScore)
      .slice(0, limit);

    await Promise.all(
      predictiveRankings.map((candidate) =>
        recordFairnessAudit({
          prisma,
          clinicianId: candidate.clinicianId,
          jobId: job.id,
          fairnessScore: candidate.fairness?.fairnessScore ?? candidate.readinessScore,
          decisionScore: candidate.prediction.predictionScore,
          weights: candidate.prediction.rationale.contributions,
          alerts: candidate.fairness?.biasAlerts ?? [],
        }),
      ),
    );

    await Promise.all(
      predictiveRankings.map((candidate) =>
        persistContextualFeatures({
          clinicianId: candidate.clinicianId,
          jobId: job.id,
          scheduleFit: candidate.scheduleFit,
          travelRadius: candidate.travelRadius,
          preferences: {
            availability: candidate.availability,
            fairnessAlerts: candidate.fairness?.biasAlerts ?? [],
          },
        }),
      ),
    );

    const fairnessOverlay = summarizeFairnessOverlay(fairnessProfiles, fairnessAdjustments);
    const autoVerify = predictiveRankings.slice(0, 5).map((candidate) => ({
      clinicianId: candidate.clinicianId,
      predictedHireLikelihood: candidate.prediction.predictionScore,
      readinessScore: candidate.readinessScore,
    }));

    return res.json({
      job: serializeJob(job, jobShift),
      market,
      generatedAt: new Date().toISOString(),
      totalConsidered: baseCandidates.length,
      candidates: predictiveRankings.map(serializeCandidate),
      fairnessOverlay,
      autoVerifyRecommendation: autoVerify,
    });
  } catch (error) {
    console.error('[Matching] predictive ranking failed', error);
    return res.status(500).json({
      error: 'predictive_matching_failed',
      message: error instanceof Error ? error.message : 'Unable to compute predictive ranking',
    });
  }
});

function normalizeLimit(rawLimit: unknown): number {
  const parsed = Number.parseInt(String(rawLimit ?? DEFAULT_LIMIT), 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_LIMIT;
  }
  return Math.max(5, Math.min(parsed, MAX_LIMIT));
}

function buildJobShift(job: JobRecord): ShiftWindow {
  const metadata = (job.metadata as Record<string, unknown> | null) ?? {};
  const shift = metadata?.shift as Partial<ShiftWindow> | undefined;
  const timezone =
    typeof metadata?.timezone === 'string' ? metadata.timezone : (job as any).timezone;

  return {
    start: typeof shift?.start === 'string' ? shift.start : DEFAULT_SHIFT.start,
    end: typeof shift?.end === 'string' ? shift.end : DEFAULT_SHIFT.end,
    days: Array.isArray(shift?.days) && shift.days.length ? shift.days : DEFAULT_SHIFT.days,
    timezone: typeof timezone === 'string' ? timezone : 'UTC',
    consecutiveNights:
      typeof shift?.consecutiveNights === 'number' ? shift?.consecutiveNights : undefined,
  };
}

function buildCandidate(
  job: JobRecord,
  jobShift: ShiftWindow,
  readiness: Prisma.ClinicianReadinessScoreGetPayload<{}>,
  clinician: Prisma.ClinicianProfileGetPayload<{ include: { user: true } }>,
) {
  const factors = (readiness.factors as Record<string, unknown>) ?? {};
  const factorBag = factors as Record<string, any>;
  const availability = extractAvailability(factors) ?? [buildDefaultAvailability(clinician)];
  const travelRadius = Number((clinician as any).travelRadiusMiles ?? factorBag?.travelRadius ?? 75);
  const travelDistance = deriveDistance(job, clinician, travelRadius);

  const scheduleFit = calculateScheduleFit({
    clinician: {
      availability,
      travelRadiusMiles: travelRadius,
      consecutiveNightShifts: Number(factorBag?.consecutiveNightShifts ?? 0),
      timezone: (clinician as any).timezone ?? undefined,
      commuteMode: (factors?.commuteMode as string | undefined)?.toLowerCase() as any,
      maxCommuteMinutes: Number(factorBag?.maxCommuteMinutes ?? undefined),
    },
    job: {
      shift: jobShift,
      shiftType: jobShift.consecutiveNights && jobShift.consecutiveNights > 0 ? 'night' : 'day',
      expectedConsecutiveNights: jobShift.consecutiveNights,
      onsiteRequirement: job.modality !== 'remote',
      location: extractLocation(job),
    },
    travel: {
      distanceMiles: travelDistance,
    },
  });

  const readinessScore = clamp01(readiness.score);
  const historicalSuccessRate = clamp01(
    Number((factorBag?.historicalHireRate ?? factorBag?.historicalSuccess ?? 0.55) as number),
  );
  const signalVolatility = clamp01(
    Number((factorBag?.volatility ?? factorBag?.variance ?? 0.08) as number),
  );

  return {
    clinicianId: clinician.id,
    name: clinician.user?.name ?? clinician.id,
    specialty: clinician.specialty ?? 'General',
    gender: ((clinician as any).gender as string | undefined) ?? 'unspecified',
    state: clinician.state ?? 'UNKNOWN',
    readinessScore,
    scheduleFit: scheduleFit.scheduleFit,
    commuteMinutes: scheduleFit.commuteMinutes,
    shiftOverlap: scheduleFit.shiftOverlap,
    fatigueRisk: scheduleFit.fatigueRisk,
    shiftNotes: scheduleFit.shiftNotes,
    availability,
    travelRadius,
    historicalSuccessRate,
    signalVolatility,
    distanceMiles: travelDistance,
    scheduleInsights: {
      shift: jobShift,
      location: extractLocation(job),
    },
  };
}

function extractAvailability(factors: Record<string, unknown>): ShiftWindow[] | null {
  const availability = factors?.availability;
  if (!availability || !Array.isArray((availability as any).windows)) {
    return null;
  }
  const windows = (availability as { windows: Array<Record<string, unknown>> }).windows;
  return windows
    .map((window) => ({
      start: typeof window.start === 'string' ? window.start : '08:00',
      end: typeof window.end === 'string' ? window.end : '18:00',
      days: Array.isArray(window.days) && window.days.length ? window.days : DEFAULT_SHIFT.days,
      timezone: typeof window.timezone === 'string' ? window.timezone : undefined,
      consecutiveNights:
        typeof window.consecutiveNights === 'number' ? window.consecutiveNights : undefined,
    }))
    .slice(0, 3);
}

function buildDefaultAvailability(
  clinician: Prisma.ClinicianProfileGetPayload<{ include: { user: true } }>,
): ShiftWindow {
  const timezone = (clinician as any).timezone ?? 'UTC';
  return {
    ...DEFAULT_SHIFT,
    timezone,
  };
}

function extractLocation(job: JobRecord) {
  const location = (job.location as Record<string, unknown> | null) ?? {};
  return {
    latitude: typeof location.latitude === 'number' ? location.latitude : undefined,
    longitude: typeof location.longitude === 'number' ? location.longitude : undefined,
    state: typeof location.state === 'string' ? location.state : job.requiredStates?.[0],
  };
}

function deriveDistance(
  job: JobRecord,
  clinician: Prisma.ClinicianProfileGetPayload<{ include: { user: true } }>,
  fallback: number,
): number {
  const location = extractLocation(job);
  const clinicianState = clinician.state ?? '';
  if (
    location.state &&
    clinicianState &&
    location.state.toUpperCase() === clinicianState.toUpperCase()
  ) {
    return Math.min(fallback, 35);
  }

  return fallback;
}

function summarizeFairnessOverlay(
  candidates: FairnessCandidateProfile[],
  adjustments: ReturnType<typeof applyFairnessGuardrail>,
) {
  const alerts = adjustments.reduce((sum, item) => sum + item.biasAlerts.length, 0);
  return {
    totalAlerts: alerts,
    representation: {
      specialty: summarizeDimension(candidates, (candidate) => candidate.specialty),
      gender: summarizeDimension(candidates, (candidate) =>
        (candidate.gender ?? 'unspecified').toLowerCase(),
      ),
      region: summarizeDimension(candidates, (candidate) =>
        (candidate.locationRegion ?? 'unknown').toUpperCase(),
      ),
    },
  };
}

function summarizeDimension(
  candidates: FairnessCandidateProfile[],
  selector: (candidate: FairnessCandidateProfile) => string,
) {
  const total = candidates.length || 1;
  const buckets = new Map<string, number>();
  candidates.forEach((candidate) => {
    const bucket = selector(candidate) || 'unknown';
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  });
  return Array.from(buckets.entries()).map(([bucket, count]) => ({
    group: bucket,
    share: Number(((count / total) * 100).toFixed(1)),
  }));
}

function buildEmptyOverlay() {
  return {
    totalAlerts: 0,
    representation: {
      specialty: [],
      gender: [],
      region: [],
    },
  };
}

async function loadJobRequirements(jobId: string): Promise<SpecialtyRequirement[]> {
  const requirements = await prisma.specialtyRequirement.findMany({
    where: { jobId },
  });
  return requirements;
}

function buildCandidateFeatureContext(params: {
  clinician: ClinicianRecord;
  readiness: ReadinessRecord;
  job: JobRecord;
  jobFeatureSource: JobFeatureSource;
  requirements: SpecialtyRequirement[];
}): FeatureContext {
  return {
    clinician: buildClinicianFeatureSource(params.clinician, params.readiness),
    job: params.jobFeatureSource,
    requirements: params.requirements,
  };
}

function buildClinicianFeatureSource(
  clinician: ClinicianRecord,
  readiness: ReadinessRecord,
): ClinicianFeatureSource {
  const factors = (readiness.factors as Record<string, unknown>) ?? {};
  return {
    id: clinician.id,
    primarySpecialty: clinician.specialty ?? 'GENERAL',
    secondarySpecialties: Array.isArray((factors.secondarySpecialties as string[]))
      ? (factors.secondarySpecialties as string[])
      : [],
    yearsExperience: deriveYearsExperience(clinician, readiness),
    boardCertifications: deriveBoardCertifications(clinician, readiness),
    compactEligibleStates: extractCompactStates(factors),
    sanctions: buildSanctionsSignal(readiness),
    lastVerifiedAt: readiness.updatedAt,
  };
}

function deriveYearsExperience(
  clinician: ClinicianRecord,
  readiness: ReadinessRecord,
): number | undefined {
  const factorValue = Number(
    ((readiness.factors as { yearsExperience?: number })?.yearsExperience) ?? NaN,
  );
  if (Number.isFinite(factorValue)) {
    return Number(factorValue.toFixed(1));
  }
  const profileYears = Number((clinician as any).yearsExperience ?? NaN);
  if (Number.isFinite(profileYears)) {
    return Number(profileYears.toFixed(1));
  }
  return undefined;
}

function deriveBoardCertifications(
  clinician: ClinicianRecord,
  readiness: ReadinessRecord,
): ClinicianFeatureSource['boardCertifications'] {
  const board = (readiness.factors as { board?: { specialty?: string; status?: string } }).board;
  if (!board) {
    return [];
  }
  return [
    {
      specialty: board.specialty ?? clinician.specialty ?? 'GENERAL',
      status: board.status ?? 'unknown',
    },
  ];
}

function extractCompactStates(factors: Record<string, unknown>): string[] {
  const compact = (factors.compact as { states?: string[] })?.states;
  if (!Array.isArray(compact)) {
    return [];
  }
  return compact.filter((state): state is string => typeof state === 'string');
}

function buildJobSource(job: JobRecord): JobFeatureSource {
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

function buildSanctionsSignal(readiness: ReadinessRecord | null) {
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

function extractJobRegions(job: JobRecord): string[] {
  const regions = new Set<string>();
  (job.requiredStates ?? []).forEach((state) => state && regions.add(state.toUpperCase()));
  const location = (job.location as Record<string, unknown> | null) ?? null;
  const metadata = (job.metadata as Record<string, unknown> | null) ?? null;
  if (typeof location?.state === 'string') {
    regions.add(location.state.toUpperCase());
  }
  if (typeof metadata?.region === 'string') {
    regions.add(metadata.region.toUpperCase());
  }
  if (!regions.size) {
    regions.add('NATIONAL');
  }
  return Array.from(regions);
}

async function loadJobMarketSignals(
  regions: string[],
  specialty: string,
): Promise<MarketSignalRecord[]> {
  if (!regions.length || !specialty) {
    return [];
  }
  return prisma.marketSignal.findMany({
    where: {
      region: { in: regions },
      specialty: { in: [specialty] },
    },
  });
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

function extractClinicianEhrRoles(readiness: ReadinessRecord): string[] {
  const factors = (readiness.factors as Record<string, unknown>) ?? {};
  const privileges = factors.ehrPrivileges as unknown;
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

function deriveCandidateTrustWeight(
  readiness: ReadinessRecord,
  vector: ReturnType<typeof evaluateCompatibility>['featureVector'],
): number {
  const volatility = Number(
    ((readiness.factors as { volatility?: number })?.volatility ?? 0.1) as number,
  );
  return clamp01(
    readiness.score * 0.6 + (vector.sanctionsRisk ?? 0.8) * 0.25 + (vector.recency ?? 0.6) * 0.2 - volatility * 0.1,
  );
}

async function persistContextualFeatures(params: {
  clinicianId: string;
  jobId: string;
  scheduleFit: number;
  travelRadius: number;
  preferences: Record<string, unknown>;
}) {
  const contextualStore = (prisma as any).contextualMatchFeatures;
  if (!contextualStore?.upsert) {
    return;
  }
  try {
    await contextualStore.upsert({
      where: {
        clinicianId_jobId: {
          clinicianId: params.clinicianId,
          jobId: params.jobId,
        },
      },
      update: {
        scheduleFit: params.scheduleFit,
        travelRadius: Math.round(params.travelRadius),
        preferences: params.preferences,
      },
      create: {
        clinicianId: params.clinicianId,
        jobId: params.jobId,
        scheduleFit: params.scheduleFit,
        travelRadius: Math.round(params.travelRadius),
        preferences: params.preferences,
      },
    });
  } catch (error) {
    console.warn('[Matching] contextual feature persistence skipped', error);
  }
}

function serializeJob(job: JobRecord, jobShift: ShiftWindow = DEFAULT_SHIFT) {
  return {
    id: job.id,
    title: job.title,
    specialty: job.specialty ?? 'General',
    organization: job.partnerId,
    location: extractLocation(job),
    shift: jobShift,
    modality: job.modality,
    requiredStates: job.requiredStates ?? [],
  };
}

function serializeCandidate(candidate: ReturnType<typeof buildCandidate> & {
  fairness?: ReturnType<typeof applyFairnessGuardrail>[number];
  prediction: ReturnType<typeof buildPredictiveScore>;
  multiSignal: MultiSignalResult | null;
  skillGaps: SkillGapRecommendation[];
  explanation: MatchExplanation | null;
  market: MarketEquilibrium;
  hireLikelihood: ReturnType<typeof estimateHireLikelihood>;
}) {
  return {
    clinicianId: candidate.clinicianId,
    name: candidate.name,
    specialty: candidate.specialty,
    state: candidate.state,
    readinessScore: candidate.readinessScore,
    scheduleFit: candidate.scheduleFit,
    commuteMinutes: candidate.commuteMinutes,
    shiftOverlap: candidate.shiftOverlap,
    fatigueRisk: candidate.fatigueRisk,
    shiftNotes: candidate.shiftNotes,
    fairness: candidate.fairness,
    prediction: {
      score: candidate.prediction.predictionScore,
      rationale: candidate.prediction.rationale,
    },
    multiSignal: candidate.multiSignal,
    market: candidate.market,
    skillGaps: candidate.skillGaps,
    explanation: candidate.explanation,
    hireLikelihood: candidate.hireLikelihood,
  };
}

export default router;


