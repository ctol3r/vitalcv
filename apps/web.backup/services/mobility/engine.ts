import { PrismaClient, NCQARuleCode, PSVResult, PassportBundle, NCQAComplianceRecord } from '@prisma/client';
import { validateMobilityPrerequisites, OrgMobilityRequirements, MobilityPrereqResult, MobilityRequirementStatus } from './validatePrereqs.js';

const prisma = new PrismaClient();

export interface MobilityEngineInput {
  clinicianId: string;
  sourceOrgId: string;
  targetOrgId: string;
}

export interface MobilityCategorySummary {
  status: MobilityRequirementStatus;
  detail: string;
  lastSatisfiedAt?: string;
  referenceIds?: string[];
  metadata?: Record<string, unknown>;
}

export interface MobilityEngineResult {
  clinicianId: string;
  sourceOrgId: string;
  targetOrgId: string;
  requirements: OrgMobilityRequirements;
  categories: {
    psv: MobilityCategorySummary;
    compliance: MobilityCategorySummary;
    privileges: MobilityCategorySummary;
    enrollment: MobilityCategorySummary;
    credentialPassport: MobilityCategorySummary;
  };
  missing: string[];
  expired: string[];
  automaticallySatisfied: string[];
  generatedAt: string;
}

export async function evaluateMobilityReadiness(
  input: MobilityEngineInput
): Promise<MobilityEngineResult> {
  const now = new Date();
  const requirements = await loadOrgMobilityRequirements(input.targetOrgId);

  const clinicianProfile = await prisma.clinicianProfile.findUnique({
    where: { id: input.clinicianId },
    include: { user: true },
  });

  if (!clinicianProfile) {
    throw new Error(`Clinician ${input.clinicianId} not found`);
  }

  const [latestPsv, complianceRecords, passportBundle, prereqResult] = await Promise.all([
    prisma.pSVResult.findFirst({
      where: { clinicianId: input.clinicianId },
      orderBy: { checkedAt: 'desc' },
    }),
    prisma.nCQAComplianceRecord.findMany({
      where: { clinicianId: input.clinicianId },
    }),
    prisma.passportBundle.findFirst({
      where: { clinicianId: input.clinicianId },
      orderBy: { createdAt: 'desc' },
    }),
    validateMobilityPrerequisites({
      clinicianId: input.clinicianId,
      clinicianDid: clinicianProfile.user?.did,
      sourceOrgId: input.sourceOrgId,
      requirements,
      now,
    }),
  ]);

  const psvSummary = summarizePsv(latestPsv, requirements, now);
  const complianceSummary = summarizeCompliance(complianceRecords, requirements, now);
  const privilegesSummary = summarizePrivileges(prereqResult);
  const enrollmentSummary = summarizeEnrollment(prereqResult);
  const passportSummary = summarizePassport(passportBundle, requirements, now);

  const missing: string[] = [];
  const expired: string[] = [];
  const automaticallySatisfied: string[] = [];

  const categories: Array<[keyof MobilityEngineResult['categories'], MobilityCategorySummary]> = [
    ['psv', psvSummary],
    ['compliance', complianceSummary],
    ['privileges', privilegesSummary],
    ['enrollment', enrollmentSummary],
    ['credentialPassport', passportSummary],
  ];

  for (const [key, summary] of categories) {
    if (summary.status === 'missing') {
      missing.push(String(key));
    } else if (summary.status === 'expired') {
      expired.push(String(key));
    } else {
      automaticallySatisfied.push(String(key));
    }
  }

  return {
    clinicianId: input.clinicianId,
    sourceOrgId: input.sourceOrgId,
    targetOrgId: input.targetOrgId,
    requirements,
    categories: {
      psv: psvSummary,
      compliance: complianceSummary,
      privileges: privilegesSummary,
      enrollment: enrollmentSummary,
      credentialPassport: passportSummary,
    },
    missing,
    expired,
    automaticallySatisfied,
    generatedAt: now.toISOString(),
  };
}

export async function loadOrgMobilityRequirements(orgId: string): Promise<OrgMobilityRequirements> {
  const partner = await prisma.partnerConfig.findUnique({
    where: { id: orgId },
  });

  if (!partner) {
    throw new Error(`Org ${orgId} not found`);
  }

  const metadata = (partner.metadata as Record<string, unknown> | null) ?? {};
  const rawContainer = metadata ? (metadata as any).mobilityRequirements : undefined;
  const raw = (rawContainer as Record<string, unknown> | undefined) ?? {};

  const asStringArray = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((entry) => typeof entry === 'string').map((entry) => entry.toUpperCase()) : [];

  const requiredRules = asStringArray(raw.requiredNcqaRules);
  const requiredPrivilegeCodes = asStringArray(raw.requiredPrivilegeCodes);
  const requiredPayerIds = asStringArray(raw.requiredPayerIds);

  return {
    orgId,
    orgName: partner.partnerName,
    freshPsvDays: typeof raw.freshPsvDays === 'number' ? raw.freshPsvDays : 120,
    complianceRules: requiredRules.length > 0 ? requiredRules : Object.values(NCQARuleCode),
    requiredPrivilegeCodes,
    requiredPayerIds,
    requireCredentialPassport:
      typeof raw.requireCredentialPassport === 'boolean' ? raw.requireCredentialPassport : true,
    passportFreshnessDays:
      typeof raw.passportFreshnessDays === 'number' ? raw.passportFreshnessDays : 90,
    prerequisites: Array.isArray(raw.prerequisites) ? (raw.prerequisites as any[]) : [],
  };
}

function summarizePsv(
  psv: PSVResult | null,
  requirements: OrgMobilityRequirements,
  now: Date
): MobilityCategorySummary {
  if (!psv) {
    return {
      status: 'missing',
      detail: 'No PSV run found for clinician',
    };
  }

  const freshUntil = psv.freshUntil ?? new Date(psv.checkedAt);
  const validWindow = new Date(psv.checkedAt);
  validWindow.setDate(validWindow.getDate() + requirements.freshPsvDays);
  const stillFresh = psv.isFresh && freshUntil.getTime() >= now.getTime() && validWindow >= now;

  return {
    status: stillFresh ? 'automaticallySatisfied' : 'expired',
    detail: stillFresh
      ? `PSV passed ${psv.checkedAt.toISOString()}`
      : `PSV stale since ${freshUntil.toISOString()}`,
    lastSatisfiedAt: stillFresh ? psv.checkedAt.toISOString() : undefined,
    referenceIds: [psv.id],
    metadata: {
      summary: psv.metadata ?? {},
    },
  };
}

function summarizeCompliance(
  records: NCQAComplianceRecord[],
  requirements: OrgMobilityRequirements,
  now: Date
): MobilityCategorySummary {
  if (requirements.complianceRules.length === 0) {
    return {
      status: 'automaticallySatisfied',
      detail: 'Org does not require NCQA compliance tracking',
    };
  }

  const recordByRule = new Map(records.map((record) => [record.ruleCode, record]));
  const missing: string[] = [];
  const expired: string[] = [];

  for (const rule of requirements.complianceRules) {
    const entry = recordByRule.get(rule as NCQARuleCode);
    if (!entry) {
      missing.push(rule);
      continue;
    }

    const nextDueAt = entry.nextDueAt ?? entry.updatedAt;
    if (!nextDueAt || nextDueAt.getTime() <= now.getTime() || entry.status === 'FAIL' || entry.status === 'WARN') {
      expired.push(rule);
    }
  }

  let status: MobilityRequirementStatus = 'automaticallySatisfied';
  if (missing.length > 0) {
    status = 'missing';
  } else if (expired.length > 0) {
    status = 'expired';
  }

  return {
    status,
    detail:
      status === 'automaticallySatisfied'
        ? 'All required NCQA controls satisfied'
        : buildComplianceDetail(missing, expired),
    metadata: {
      missingRules: missing,
      expiredRules: expired,
    },
  };
}

function buildComplianceDetail(missing: string[], expired: string[]): string {
  const messages: string[] = [];
  if (missing.length > 0) {
    messages.push(`Missing rules: ${missing.join(', ')}`);
  }
  if (expired.length > 0) {
    messages.push(`Expired/out-of-window: ${expired.join(', ')}`);
  }
  return messages.join(' | ') || 'No compliance posture available';
}

function summarizePrivileges(prereqResult: MobilityPrereqResult): MobilityCategorySummary {
  if (prereqResult.missingPrivilegeCodes.length > 0) {
    return {
      status: 'missing',
      detail: `Missing privilege coverage for ${prereqResult.missingPrivilegeCodes.join(', ')}`,
      referenceIds: prereqResult.sourcePrivileges.map((priv) => priv.privilegeGrantedId),
    };
  }

  if (prereqResult.expiredPrivilegeCodes.length > 0) {
    return {
      status: 'expired',
      detail: `Expired privilege coverage for ${prereqResult.expiredPrivilegeCodes.join(', ')}`,
      referenceIds: prereqResult.sourcePrivileges.map((priv) => priv.privilegeGrantedId),
    };
  }

  return {
    status: 'automaticallySatisfied',
    detail: prereqResult.satisfiedPrivilegeCodes.length
      ? `Auto-satisfied for ${prereqResult.satisfiedPrivilegeCodes.join(', ')}`
      : 'Existing privileges satisfy Org B requirements',
    referenceIds: prereqResult.sourcePrivileges.map((priv) => priv.privilegeGrantedId),
  };
}

function summarizeEnrollment(prereqResult: MobilityPrereqResult): MobilityCategorySummary {
  if (prereqResult.missingPayerEnrollments.length > 0) {
    return {
      status: 'missing',
      detail: `Missing enrollments: ${prereqResult.missingPayerEnrollments.join(', ')}`,
      metadata: { enrollmentStatuses: prereqResult.enrollmentStatuses },
    };
  }

  if (prereqResult.expiredPayerEnrollments.length > 0) {
    return {
      status: 'expired',
      detail: `Revalidation due for: ${prereqResult.expiredPayerEnrollments.join(', ')}`,
      metadata: { enrollmentStatuses: prereqResult.enrollmentStatuses },
    };
  }

  return {
    status: 'automaticallySatisfied',
    detail: 'Payer enrollment requirements satisfied',
    metadata: { enrollmentStatuses: prereqResult.enrollmentStatuses },
  };
}

function summarizePassport(
  bundle: PassportBundle | null,
  requirements: OrgMobilityRequirements,
  now: Date
): MobilityCategorySummary {
  if (!requirements.requireCredentialPassport) {
    return {
      status: 'automaticallySatisfied',
      detail: 'Org does not require credential passport',
    };
  }

  if (!bundle) {
    return {
      status: 'missing',
      detail: 'No credential passport issued',
    };
  }

  const ageMs = now.getTime() - bundle.createdAt.getTime();
  const freshMs = requirements.passportFreshnessDays * 24 * 60 * 60 * 1000;
  const stillFresh = ageMs <= freshMs;

  return {
    status: stillFresh ? 'automaticallySatisfied' : 'expired',
    detail: stillFresh
      ? `Passport issued ${bundle.createdAt.toISOString()}`
      : `Passport older than ${requirements.passportFreshnessDays} days`,
    lastSatisfiedAt: bundle.createdAt.toISOString(),
    referenceIds: [bundle.id],
  };
}

