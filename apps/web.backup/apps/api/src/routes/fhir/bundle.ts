import { Router, type Request, type Response } from 'express';
import { PrismaClient, Prisma, type SpecialtyRequirement } from '@prisma/client';
import { mapPractitioner } from '../../services/fhir/mappers/practitioner';
import { mapPractitionerRole } from '../../services/fhir/mappers/role';
import { mapVerificationResult } from '../../services/fhir/mappers/verification';
import { logFhirActivity } from '../../services/fhir/activity-log';
import { evaluateCompatibility } from '../../services/matching/engine';
import { evaluateMultiSignalMatch } from '../../services/matching/engine-v5';
import { calculateMarketEquilibrium } from '../../services/matching/market';
import { buildSkillGapRecommendations } from '../../services/matching/skills-gap';
import { buildMatchExplanation } from '../../services/matching/explain';
import { buildEhrSignal } from '../../services/matching/ehr';
import {
  clamp01,
  type ClinicianFeatureSource,
  type FeatureContext,
  type JobFeatureSource,
} from '../../services/matching/features';
import { getCompactEvidenceSummaries } from '../../../../../services/psv/evidenceBundle';

const prisma = new PrismaClient();
const router = Router();

router.get('/fhir/bundle/:clinicianId', async (req: Request, res: Response) => {
  try {
    const clinician = await prisma.clinicianProfile.findUnique({
      where: { id: req.params.clinicianId },
      include: { user: true },
    });

    if (!clinician) {
      return res.status(404).json({
        error: 'clinician_not_found',
        message: `Clinician ${req.params.clinicianId} not found`,
      });
    }

    const [licenses, boardCerts, jobPostings, readiness, compactSummaries] = await Promise.all([
      prisma.stateLicenseVerification.findMany({
        where: { clinicianId: clinician.id },
      }),
      prisma.credential.findMany({
        where: { userId: clinician.userId, type: { contains: 'board', mode: 'insensitive' } },
      }),
      prisma.jobPosting.findMany({
        where: {
          specialty: clinician.specialty,
          status: 'active',
        },
        take: 5,
      }),
      prisma.clinicianReadinessScore.findUnique({
        where: { clinicianId: clinician.id },
      }),
      getCompactEvidenceSummaries(clinician.user?.did ?? ''),
    ]);

    const practitioner = mapPractitioner({
      id: clinician.id,
      npi: clinician.npi,
      name: buildName(clinician.user?.name ?? ''),
      telecom: {
        email: clinician.user?.email ?? undefined,
        phone: clinician.user?.phone ?? undefined,
      },
      addresses: [
        {
          line1: clinician.addressLine1 ?? undefined,
          line2: clinician.addressLine2 ?? undefined,
          city: clinician.city ?? undefined,
          state: clinician.state ?? undefined,
          postalCode: clinician.postalCode ?? undefined,
          country: 'USA',
        },
      ],
      specialties: [
        {
          code: clinician.specialty ?? '207Q00000X',
          display: clinician.specialty ?? 'Specialist',
        },
      ],
      qualifications: boardCerts.map((credential) => ({
        code: credential.type ?? credential.id,
        display: credential.name ?? credential.type ?? credential.id,
        issuer: credential.issuer ?? undefined,
      })),
    });

    const clinicianFeatureSource = buildClinicianSource({
      clinician,
      licenses,
      boardCredentials: boardCerts,
      readiness,
      compactSummaries,
    });

    const requirements = await loadRequirements(jobPostings.map((job) => job.id));
    const marketSignals = await loadMarketSignals(jobPostings);

    const roles = jobPostings.map((job) => {
      const fhirMetadata = (job.fhirMetadata as Record<string, unknown> | null) ?? {};
      const metadata = (job.metadata as Record<string, unknown> | null) ?? {};
      const telehealthUrl =
        typeof fhirMetadata?.telehealthUrl === 'string'
          ? (fhirMetadata.telehealthUrl as string)
          : typeof metadata?.telehealthUrl === 'string'
            ? (metadata.telehealthUrl as string)
            : 'https://telehealth.example.org';

      return mapPractitionerRole({
        id: `role-${job.id}`,
        practitionerId: clinician.id,
        organization: {
          id: job.partnerId,
          name: job.partnerName ?? job.partnerId,
        },
        specialty: {
          code: job.specialty ?? clinician.specialty ?? '207Q00000X',
          display: job.title ?? job.specialty ?? clinician.specialty ?? 'Role',
        },
        active: job.status !== 'closed',
        compactEligible: (job.requiredStates?.length ?? 0) > 1,
        locations: job.requiredStates?.map((state) => ({ state })),
        telecom: job.telehealth
          ? [
              {
                system: 'url',
                value: telehealthUrl,
              },
            ]
          : undefined,
        matchSuitability: buildSuitabilityPayload({
          clinician: clinicianFeatureSource,
          job,
          requirements: requirements.get(job.id) ?? [],
          readiness,
          metadata,
          marketSignals,
        }),
      });
    });

    const verifications = licenses.map((license) =>
      mapVerificationResult({
        id: `verification-${license.id}`,
        status: license.status ?? 'in-process',
        targetId: `Practitioner/${clinician.id}`,
        targetDisplay: clinician.user?.name ?? clinician.npi,
        method: 'state-license-verification',
        source: {
          who: license.source ? `Organization/${license.source}` : undefined,
          display: license.source ?? 'State board',
          type: license.source ? 'state-board' : 'internal',
          validationStatus: license.verifiedAt ? 'successful' : 'pending',
          validationDate: license.verifiedAt?.toISOString() ?? undefined,
        },
        attester: {
          who: license.reviewerDid ?? undefined,
          organizationId: clinician.orgId ?? undefined,
          timestamp: license.verifiedAt?.toISOString() ?? license.updatedAt.toISOString(),
        },
      }),
    );

    const bundle = {
      resourceType: 'Bundle',
      type: 'collection' as const,
      entry: [
        {
          fullUrl: `Practitioner/${practitioner.id}`,
          resource: practitioner,
        },
        ...roles.map((role) => ({
          fullUrl: `PractitionerRole/${role.id}`,
          resource: role,
        })),
        ...verifications.map((verification) => ({
          fullUrl: `VerificationResult/${verification.id}`,
          resource: verification,
        })),
      ],
    };

    await logFhirActivity({
      kind: 'bundle-fetch',
      severity: 'info',
      context: {
        clinicianId: clinician.id,
        entries: bundle.entry.length,
      },
    });

    return res.json(bundle);
  } catch (error) {
    console.error('[fhir] bundle generation failed', error);
    return res.status(500).json({
      error: 'fhir_bundle_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

function buildName(fullName: string | null) {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { first: 'Unknown', last: 'Practitioner' };
  }
  if (parts.length === 1) {
    return { first: parts[0], last: parts[0] };
  }
  return {
    first: parts[0],
    last: parts[parts.length - 1],
    middle: parts.slice(1, -1),
  };
}

async function loadRequirements(jobIds: string[]): Promise<Map<string, SpecialtyRequirement[]>> {
  if (!jobIds.length) {
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

async function loadMarketSignals(jobPostings: Prisma.JobPostingGetPayload<{}>[]) {
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

function buildSuitabilityPayload(params: {
  clinician: ClinicianFeatureSource;
  job: Prisma.JobPostingGetPayload<{}>;
  requirements: SpecialtyRequirement[];
  readiness: Prisma.ClinicianReadinessScoreGetPayload<{}> | null;
  metadata: Record<string, unknown> | null;
  marketSignals: Prisma.MarketSignalGetPayload<{}>[];
}) {
  const jobFeatureSource = buildJobSource(params.job);
  const context: FeatureContext = {
    clinician: params.clinician,
    job: jobFeatureSource,
    requirements: params.requirements,
  };
  const compatibility = evaluateCompatibility(context);
  const jobRegions = extractJobRegions(params.job);
  const signalSlice = selectMarketSignals(jobRegions, params.job, params.marketSignals, params.clinician);
  const market = calculateMarketEquilibrium(signalSlice, {
    priorityRegion: jobRegions[0],
    prioritySpecialty: params.job.specialty ?? params.clinician.primarySpecialty,
  });
  const ehrSignal = buildEhrSignal({
    requiredRoles: extractEhrRoles(params.metadata),
    clinicianRoles: extractClinicianEhrRoles(params.readiness),
    vendor: extractEhrVendor(params.metadata),
  });
  const multiSignal = evaluateMultiSignalMatch({
    compatibility,
    readinessScore: params.readiness?.score ?? compatibility.featureVector.recency,
    trustWeight: deriveTrustWeight(params.readiness, compatibility.featureVector),
    market,
    ehr: ehrSignal,
  });
  const skillGaps = buildSkillGapRecommendations({
    featureVector: compatibility.featureVector,
    context,
    ehr: ehrSignal,
  });
  const explanation = buildMatchExplanation({
    roleTitle: params.job.title ?? params.job.specialty ?? params.job.id,
    market,
    multiSignal,
    gaps: skillGaps,
  });
  return {
    score: multiSignal.finalScore,
    method: 'multi-signal-v5',
    generatedAt: new Date().toISOString(),
    rationale: explanation.highlights.slice(0, 3).map((highlight) => highlight.detail),
  };
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

function buildSanctionsSignal(readiness: Prisma.ClinicianReadinessScoreGetPayload<{}> | null) {
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

function extractJobRegions(job: Prisma.JobPostingGetPayload<{}>): string[] {
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

function selectMarketSignals(
  regions: string[],
  job: Prisma.JobPostingGetPayload<{}>,
  signals: Prisma.MarketSignalGetPayload<{}>[],
  clinician: ClinicianFeatureSource,
) {
  const normalizedRegions = new Set(regions.map((region) => region.toUpperCase()));
  const jobSpecialty = (job.specialty ?? clinician.primarySpecialty ?? 'GENERAL').toLowerCase();
  const matches = signals.filter(
    (signal) =>
      normalizedRegions.has(signal.region.toUpperCase()) &&
      signal.specialty.toLowerCase() === jobSpecialty,
  );
  if (matches.length) {
    return matches;
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

function deriveTrustWeight(
  readiness: Prisma.ClinicianReadinessScoreGetPayload<{}> | null,
  vector: ReturnType<typeof evaluateCompatibility>['featureVector'],
): number {
  const base = readiness?.score ?? vector.recency ?? 0.65;
  const sanctions = vector.sanctionsRisk ?? 0.8;
  const board = vector.boardStatus ?? 0.5;
  const volatility = clamp01(
    Number((readiness?.factors as { volatility?: number })?.volatility ?? 0.08),
  );
  return clamp01(base * 0.55 + sanctions * 0.25 + board * 0.2 - volatility * 0.1);
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}
export default router;

