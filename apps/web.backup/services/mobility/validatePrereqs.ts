import { PrismaClient, PayerEnrollmentV2Status } from '@prisma/client';

const prisma = new PrismaClient();

export type MobilityRequirementStatus = 'missing' | 'expired' | 'automaticallySatisfied';

export interface MobilityPrerequisiteDefinition {
  type: 'license' | 'boardCertification' | 'payerEnrollment' | 'custom';
  description?: string;
  states?: string[];
  payerIds?: string[];
  boards?: string[];
  key?: string;
  value?: string | number | boolean | string[];
}

export interface OrgMobilityRequirements {
  orgId: string;
  orgName: string;
  freshPsvDays: number;
  complianceRules: string[];
  requiredPrivilegeCodes: string[];
  requiredPayerIds: string[];
  requireCredentialPassport: boolean;
  passportFreshnessDays: number;
  prerequisites?: MobilityPrerequisiteDefinition[];
}

export interface MobilityPrereqInput {
  clinicianId: string;
  clinicianDid?: string | null;
  sourceOrgId: string;
  requirements: OrgMobilityRequirements;
  now?: Date;
}

export interface SourcePrivilegeSnapshot {
  privilegeGrantedId: string;
  privilegeSetId: string;
  privilegeSetV2Id?: string | null;
  privilegeCodes: string[];
  expiresAt: Date | null;
  status: string;
  isTemporary: boolean;
  temporaryEndDate?: Date | null;
}

export interface MobilityPrereqResult {
  ok: boolean;
  missingPrivilegeCodes: string[];
  expiredPrivilegeCodes: string[];
  missingPayerEnrollments: string[];
  expiredPayerEnrollments: string[];
  satisfiedPrivilegeCodes: string[];
  sourcePrivileges: SourcePrivilegeSnapshot[];
  enrollmentStatuses: Record<string, PayerEnrollmentV2Status>;
  actionItems: string[];
}

interface PrivilegeCodeBucket {
  codes: string[];
  expiresAt: Date | null;
  isTemporary: boolean;
  temporaryEndDate?: Date | null;
  status: string;
}

interface PrivilegeBucket extends PrivilegeCodeBucket {
  privilegeGrantedId: string;
  privilegeSetId: string;
  privilegeSetV2Id?: string | null;
}

export async function validateMobilityPrerequisites(
  input: MobilityPrereqInput
): Promise<MobilityPrereqResult> {
  const now = input.now ?? new Date();
  const clinicianProfile =
    input.clinicianDid && input.clinicianDid.startsWith('did:')
      ? await prisma.clinicianProfile.findFirst({
          where: {
            user: { did: input.clinicianDid },
          },
          include: { user: true },
        })
      : await prisma.clinicianProfile.findUnique({
          where: { id: input.clinicianId },
          include: { user: true },
        });

  if (!clinicianProfile) {
    throw new Error(`Clinician ${input.clinicianId} not found`);
  }

  const clinicianDid = input.clinicianDid ?? clinicianProfile.user?.did ?? null;
  const privilegeBuckets: PrivilegeBucket[] = clinicianDid
    ? await loadPrivilegeCodeBuckets(clinicianDid, input.sourceOrgId)
    : [];

  const privilegeSnapshots: SourcePrivilegeSnapshot[] = privilegeBuckets.map((bucket) => ({
    privilegeGrantedId: bucket.privilegeGrantedId,
    privilegeSetId: bucket.privilegeSetId,
    privilegeSetV2Id: bucket.privilegeSetV2Id,
    privilegeCodes: bucket.codes,
    expiresAt: bucket.expiresAt,
    status: bucket.status,
    isTemporary: bucket.isTemporary,
    temporaryEndDate: bucket.temporaryEndDate,
  }));

  const allPrivilegeCodes = new Map<string, PrivilegeCodeBucket>();
  for (const bucket of privilegeBuckets) {
    for (const code of bucket.codes) {
      allPrivilegeCodes.set(code, bucket);
    }
  }

  const normalizedRequiredCodes = Array.from(
    new Set(
      (input.requirements.requiredPrivilegeCodes ?? [])
        .map((code) => code?.toUpperCase())
        .filter(Boolean) as string[]
    )
  );

  const missingPrivilegeCodes: string[] = [];
  const expiredPrivilegeCodes: string[] = [];
  const satisfiedPrivilegeCodes: string[] = [];

  if (normalizedRequiredCodes.length === 0) {
    if (allPrivilegeCodes.size === 0) {
      missingPrivilegeCodes.push('ANY');
    } else {
      satisfiedPrivilegeCodes.push(...Array.from(allPrivilegeCodes.keys()));
    }
  } else {
    for (const code of normalizedRequiredCodes) {
      const bucket = allPrivilegeCodes.get(code);
      if (!bucket) {
        missingPrivilegeCodes.push(code);
        continue;
      }

      if (isPrivilegeExpired(bucket, now)) {
        expiredPrivilegeCodes.push(code);
      } else {
        satisfiedPrivilegeCodes.push(code);
      }
    }
  }

  const enrollmentResult = await evaluateEnrollmentCoverage(
    input.clinicianId,
    input.requirements.requiredPayerIds ?? [],
    now
  );

  const actionItems: string[] = [];

  if (missingPrivilegeCodes.length > 0) {
    actionItems.push(`Grant privileges for: ${missingPrivilegeCodes.join(', ')}`);
  }
  if (expiredPrivilegeCodes.length > 0) {
    actionItems.push(`Renew privileges for: ${expiredPrivilegeCodes.join(', ')}`);
  }
  if (enrollmentResult.missing.length > 0) {
    actionItems.push(`Initiate payer enrollment for: ${enrollmentResult.missing.join(', ')}`);
  }
  if (enrollmentResult.expired.length > 0) {
    actionItems.push(`Refresh payer enrollment for: ${enrollmentResult.expired.join(', ')}`);
  }

  return {
    ok:
      missingPrivilegeCodes.length === 0 &&
      expiredPrivilegeCodes.length === 0 &&
      enrollmentResult.missing.length === 0 &&
      enrollmentResult.expired.length === 0,
    missingPrivilegeCodes,
    expiredPrivilegeCodes,
    missingPayerEnrollments: enrollmentResult.missing,
    expiredPayerEnrollments: enrollmentResult.expired,
    satisfiedPrivilegeCodes,
    sourcePrivileges: privilegeSnapshots,
    enrollmentStatuses: enrollmentResult.statusByPayer,
    actionItems,
  };
}

async function loadPrivilegeCodeBuckets(clinicianDid: string, orgId: string): Promise<PrivilegeBucket[]> {
  const grants = await prisma.privilegeGranted.findMany({
    where: {
      clinicianDid,
      orgId,
      status: {
        in: ['ACTIVE', 'TEMPORARY'],
      },
    },
    include: {
      privilegeRequest: {
        include: {
          privilegeSet: true,
          privilegeSetV2: {
            include: {
              privileges: true,
            },
          },
        },
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
  });

  return grants.map((grant) => {
    const codes = new Set<string>();

    const v2Privileges = grant.privilegeRequest?.privilegeSetV2?.privileges ?? [];
    v2Privileges.forEach((entry) => {
      if (entry.privilegeCode) {
        codes.add(entry.privilegeCode.toUpperCase());
      }
    });

    const legacyProcedures = grant.privilegeRequest?.privilegeSet?.procedures;
    if (codes.size === 0 && Array.isArray(legacyProcedures)) {
      legacyProcedures
        .map((entry: any) => (typeof entry === 'string' ? entry : entry?.code ?? entry?.name))
        .filter(Boolean)
        .forEach((value) => codes.add(String(value).toUpperCase()));
    }

    if (codes.size === 0) {
      codes.add(`SET-${grant.privilegeSetId}`);
    }

    return {
      privilegeGrantedId: grant.id,
      privilegeSetId: grant.privilegeSetId,
      privilegeSetV2Id: grant.privilegeRequest?.privilegeSetV2Id,
      codes: Array.from(codes),
      expiresAt: grant.expiresAt,
      isTemporary: grant.isTemporary,
      temporaryEndDate: grant.temporaryEndDate,
      status: grant.status,
    };
  });
}

function isPrivilegeExpired(bucket: PrivilegeCodeBucket, now: Date): boolean {
  if (bucket.isTemporary && bucket.temporaryEndDate) {
    return bucket.temporaryEndDate.getTime() <= now.getTime();
  }
  if (bucket.expiresAt) {
    return bucket.expiresAt.getTime() <= now.getTime();
  }
  return false;
}

async function evaluateEnrollmentCoverage(
  clinicianId: string,
  requiredPayerIds: string[],
  now: Date
) {
  const enrollments = await prisma.payerEnrollmentV2.findMany({
    where: { clinicianId },
  });

  const statusByPayer = enrollments.reduce<Record<string, PayerEnrollmentV2Status>>((acc, record) => {
    acc[record.payerId] = record.status;
    return acc;
  }, {});

  if (requiredPayerIds.length === 0) {
    const activeEnrollment = enrollments.find((record) => record.status === 'ENROLLED');
    return {
      missing: activeEnrollment ? [] : ['ANY'],
      expired: activeEnrollment?.status === 'REVALIDATION_DUE' ? [activeEnrollment.payerId] : [],
      statusByPayer,
    };
  }

  const missing: string[] = [];
  const expired: string[] = [];

  for (const payerId of requiredPayerIds) {
    const record = enrollments.find((entry) => entry.payerId === payerId);
    if (!record) {
      missing.push(payerId);
      continue;
    }
    if (record.status === 'REVALIDATION_DUE') {
      expired.push(payerId);
      continue;
    }
    if (record.status !== 'ENROLLED') {
      missing.push(payerId);
    }
  }

  return {
    missing,
    expired,
    statusByPayer,
  };
}

