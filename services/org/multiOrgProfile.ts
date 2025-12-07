/**
 * B195A-MULTIORG-002: MultiOrgProfile view
 * Aggregates clinician signals across every organization they collaborate with.
 */

import {
  DriftEventStatus,
  OrgMembershipRole,
  OrgMembershipV2Status,
  PrismaClient,
} from '@prisma/client';
import {
  ClinicianWithUser,
  getTimelineSummary,
  loadClinicianWithUser,
  TimelineSummary,
} from '../timeline/getClinicianTimeline';

const prisma = new PrismaClient();

export interface MultiOrgProfileOrgSummary {
  orgId: string;
  orgName?: string | null;
  membership: {
    role: OrgMembershipRole;
    status: OrgMembershipV2Status;
    joinedAt?: string | null;
  };
  privileges: {
    requests: {
      total: number;
      pending: number;
      underReview: number;
      approved: number;
      denied: number;
      lastUpdatedAt?: string;
    };
    grants: {
      active: number;
      hold: number;
      suspended: number;
      revoked: number;
    };
  };
  compliance: {
    tjcStatus?: string;
    evaluatedAt?: string;
  };
  enrollment: {
    total: number;
    submitted: number;
    approved: number;
    terminated: number;
    nextRevalidationDue?: string;
  };
  risk: {
    driftOpen: number;
    lastDriftAt?: string;
  };
  quality: {
    fppeOpen: number;
    oppeOpen: number;
    nextOppeReview?: string;
  };
}

export interface MultiOrgProfileAggregateSummary {
  totalMemberships: number;
  activeMemberships: number;
  privileges: {
    totalRequests: number;
    activeGrants: number;
  };
  enrollment: {
    total: number;
    approved: number;
  };
  riskScore?: number;
}

export interface MultiOrgProfileView {
  clinician: {
    id: string;
    userId: string;
    name?: string | null;
    npi: string;
    specialty: string;
    state: string;
  };
  memberships: MultiOrgProfileOrgSummary[];
  aggregates: MultiOrgProfileAggregateSummary;
  timeline?: TimelineSummary | null;
}

export async function getMultiOrgProfile(
  clinicianId: string
): Promise<MultiOrgProfileView> {
  const clinician = await loadClinicianWithUser(clinicianId);

  if (!clinician) {
    throw new Error('Clinician not found');
  }

  const memberships = await prisma.orgMembershipV2.findMany({
    where: { clinicianId },
    include: {
      org: {
        select: {
          id: true,
          partnerId: true,
          partnerName: true,
        },
      },
    },
    orderBy: [{ createdAt: 'asc' }],
  });

  const orgIds = memberships.map((m) => m.orgId);
  const clinicianDid = clinician.user.did ?? null;

  const [
    privilegeRequests,
    privilegeGrants,
    complianceRecords,
    enrollmentStats,
    driftStats,
    qualityStats,
    credentialRisk,
    timeline,
  ] = await Promise.all([
    getPrivilegeRequestStats(clinicianDid, orgIds),
    getPrivilegeGrantStats(clinicianDid, orgIds),
    getComplianceRecords(clinicianId, orgIds),
    getEnrollmentStats(clinicianDid, orgIds),
    getDriftStats(clinicianId, orgIds),
    getQualityStats(clinicianId, orgIds),
    getCredentialRiskScore(clinicianId),
    buildTimelineSummary(clinician),
  ]);

  const summaries: MultiOrgProfileOrgSummary[] = memberships.map((membership) => {
    const privilege = privilegeRequests.get(membership.orgId) ?? defaultPrivilegeRequestStats();
    const grants = privilegeGrants.get(membership.orgId) ?? defaultGrantStats();
    const compliance = complianceRecords.get(membership.orgId);
    const enrollment = enrollmentStats.get(membership.orgId) ?? defaultEnrollmentStats();
    const drift = driftStats.get(membership.orgId) ?? defaultDriftStats();
    const quality = qualityStats.get(membership.orgId) ?? defaultQualityStats();

    return {
      orgId: membership.orgId,
      orgName: membership.org?.partnerName ?? membership.org?.partnerId,
      membership: {
        role: membership.role,
        status: membership.membershipStatus,
        joinedAt: toIso(membership.joinedAt),
      },
      privileges: {
        requests: privilege,
        grants,
      },
      compliance: compliance ?? {
        tjcStatus: undefined,
        evaluatedAt: undefined,
      },
      enrollment,
      risk: drift,
      quality,
    };
  });

  const aggregates = computeAggregates(summaries, credentialRisk?.score);

  return {
    clinician: {
      id: clinician.id,
      userId: clinician.userId,
      name: clinician.user?.name,
      npi: clinician.npi,
      specialty: clinician.specialty,
      state: clinician.state,
    },
    memberships: summaries,
    aggregates,
    timeline,
  };
}

function defaultPrivilegeRequestStats() {
  return {
    total: 0,
    pending: 0,
    underReview: 0,
    approved: 0,
    denied: 0,
    lastUpdatedAt: undefined as string | undefined,
  };
}

function defaultGrantStats() {
  return {
    active: 0,
    hold: 0,
    suspended: 0,
    revoked: 0,
  };
}

function defaultEnrollmentStats() {
  return {
    total: 0,
    submitted: 0,
    approved: 0,
    terminated: 0,
    nextRevalidationDue: undefined as string | undefined,
  };
}

function defaultDriftStats() {
  return {
    driftOpen: 0,
    lastDriftAt: undefined as string | undefined,
  };
}

function defaultQualityStats() {
  return {
    fppeOpen: 0,
    oppeOpen: 0,
    nextOppeReview: undefined as string | undefined,
  };
}

async function getPrivilegeRequestStats(
  clinicianDid: string | null,
  orgIds: string[]
) {
  const map = new Map<string, ReturnType<typeof defaultPrivilegeRequestStats>>();
  if (!clinicianDid || orgIds.length === 0) {
    return map;
  }

  const requests = await prisma.privilegeRequest.findMany({
    where: {
      clinicianDid,
      orgId: { in: orgIds },
    },
    select: {
      orgId: true,
      status: true,
      updatedAt: true,
    },
  });

  for (const request of requests) {
    const entry = map.get(request.orgId) ?? defaultPrivilegeRequestStats();
    entry.total += 1;
    const status = request.status.toUpperCase();
    if (status === 'PENDING') {
      entry.pending += 1;
    } else if (status === 'UNDER_REVIEW') {
      entry.underReview += 1;
    } else if (status === 'APPROVED') {
      entry.approved += 1;
    } else if (status === 'DENIED') {
      entry.denied += 1;
    }
    if (!entry.lastUpdatedAt || request.updatedAt > new Date(entry.lastUpdatedAt)) {
      entry.lastUpdatedAt = request.updatedAt.toISOString();
    }
    map.set(request.orgId, entry);
  }

  return map;
}

async function getPrivilegeGrantStats(
  clinicianDid: string | null,
  orgIds: string[]
) {
  const map = new Map<string, ReturnType<typeof defaultGrantStats>>();
  if (!clinicianDid || orgIds.length === 0) {
    return map;
  }

  const grants = await prisma.privilegeGranted.findMany({
    where: {
      clinicianDid,
      orgId: { in: orgIds },
    },
    select: {
      orgId: true,
      status: true,
    },
  });

  for (const grant of grants) {
    const entry = map.get(grant.orgId) ?? defaultGrantStats();
    const status = (grant.status ?? '').toUpperCase();
    if (status === 'ACTIVE') {
      entry.active += 1;
    } else if (status === 'HOLD') {
      entry.hold += 1;
    } else if (status === 'SUSPENDED') {
      entry.suspended += 1;
    } else if (status === 'REVOKED') {
      entry.revoked += 1;
    }
    map.set(grant.orgId, entry);
  }

  return map;
}

async function getComplianceRecords(clinicianId: string, orgIds: string[]) {
  const map = new Map<
    string,
    {
      tjcStatus?: string;
      evaluatedAt?: string;
    }
  >();

  if (orgIds.length === 0) {
    return map;
  }

  const records = await prisma.tJCComplianceRecord.findMany({
    where: {
      clinicianId,
      orgId: { in: orgIds },
    },
    orderBy: [{ orgId: 'asc' }, { evaluationDate: 'desc' }],
  });

  for (const record of records) {
    if (record.orgId && !map.has(record.orgId)) {
      map.set(record.orgId, {
        tjcStatus: record.overallStatus,
        evaluatedAt: toIso(record.evaluationDate),
      });
    }
  }

  return map;
}

async function getEnrollmentStats(clinicianDid: string | null, orgIds: string[]) {
  const map = new Map<string, ReturnType<typeof defaultEnrollmentStats>>();
  if (!clinicianDid || orgIds.length === 0) {
    return map;
  }

  const enrollments = await prisma.payerEnrollment.findMany({
    where: {
      clinicianDid,
      orgId: { in: orgIds },
    },
    select: {
      orgId: true,
      status: true,
      revalidationDueAt: true,
    },
  });

  for (const enrollment of enrollments) {
    if (!enrollment.orgId) {
      continue;
    }
    const entry = map.get(enrollment.orgId) ?? defaultEnrollmentStats();
    entry.total += 1;
    const status = enrollment.status?.toUpperCase();
    if (status === 'SUBMITTED') {
      entry.submitted += 1;
    } else if (status === 'APPROVED') {
      entry.approved += 1;
    } else if (status === 'TERMINATED') {
      entry.terminated += 1;
    }
    const nextDue = toIso(enrollment.revalidationDueAt);
    if (nextDue) {
      if (!entry.nextRevalidationDue || nextDue < entry.nextRevalidationDue) {
        entry.nextRevalidationDue = nextDue;
      }
    }
    map.set(enrollment.orgId, entry);
  }

  return map;
}

async function getDriftStats(clinicianId: string, orgIds: string[]) {
  const map = new Map<string, ReturnType<typeof defaultDriftStats>>();
  if (orgIds.length === 0) {
    return map;
  }

  const events = await prisma.driftEvent.findMany({
    where: {
      clinicianId,
      orgId: { in: orgIds },
    },
    orderBy: { triggeredAt: 'desc' },
  });

  for (const event of events) {
    if (!event.orgId) {
      continue;
    }
    const entry = map.get(event.orgId) ?? defaultDriftStats();
    if (
      event.status === DriftEventStatus.OPEN ||
      event.status === DriftEventStatus.ACKNOWLEDGED
    ) {
      entry.driftOpen += 1;
    }
    if (!entry.lastDriftAt) {
      entry.lastDriftAt = toIso(event.triggeredAt);
    }
    map.set(event.orgId, entry);
  }

  return map;
}

async function getQualityStats(clinicianId: string, orgIds: string[]) {
  const map = new Map<string, ReturnType<typeof defaultQualityStats>>();
  if (orgIds.length === 0) {
    return map;
  }

  const [fppeCases, oppeCases, oppeSchedules] = await Promise.all([
    prisma.fPPECase.findMany({
      where: { clinicianId, orgId: { in: orgIds } },
      select: { orgId: true, status: true },
    }),
    prisma.oPPECase.findMany({
      where: { clinicianId, orgId: { in: orgIds } },
      select: { orgId: true, status: true },
    }),
    prisma.oPPEScheduleV2.findMany({
      where: { clinicianId, orgId: { in: orgIds } },
      select: { orgId: true, nextDueAt: true },
    }),
  ]);

  for (const caseRecord of fppeCases) {
    if (!caseRecord.orgId) {
      continue;
    }
    const entry = map.get(caseRecord.orgId) ?? defaultQualityStats();
    const status = caseRecord.status;
    if (status === 'OPEN' || status === 'IN_REVIEW') {
      entry.fppeOpen += 1;
    }
    map.set(caseRecord.orgId, entry);
  }

  for (const caseRecord of oppeCases) {
    if (!caseRecord.orgId) {
      continue;
    }
    const entry = map.get(caseRecord.orgId) ?? defaultQualityStats();
    if (caseRecord.status === 'OPEN' || caseRecord.status === 'REVIEWING') {
      entry.oppeOpen += 1;
    }
    map.set(caseRecord.orgId, entry);
  }

  for (const schedule of oppeSchedules) {
    if (!schedule.orgId) {
      continue;
    }
    const entry = map.get(schedule.orgId) ?? defaultQualityStats();
    const due = toIso(schedule.nextDueAt);
    if (due) {
      entry.nextOppeReview = due;
    }
    map.set(schedule.orgId, entry);
  }

  return map;
}

async function getCredentialRiskScore(clinicianId: string) {
  return prisma.credentialRisk.findUnique({
    where: { clinicianId },
  });
}

async function buildTimelineSummary(clinician: ClinicianWithUser) {
  try {
    return await getTimelineSummary(clinician);
  } catch {
    return null;
  }
}

function computeAggregates(
  summaries: MultiOrgProfileOrgSummary[],
  riskScore?: number
): MultiOrgProfileAggregateSummary {
  const aggregate = summaries.reduce(
    (acc, summary) => {
      acc.totalMemberships += 1;
      if (summary.membership.status === OrgMembershipV2Status.ACTIVE) {
        acc.activeMemberships += 1;
      }
      acc.privileges.totalRequests += summary.privileges.requests.total;
      acc.privileges.activeGrants += summary.privileges.grants.active;
      acc.enrollment.total += summary.enrollment.total;
      acc.enrollment.approved += summary.enrollment.approved;
      return acc;
    },
    {
      totalMemberships: 0,
      activeMemberships: 0,
      privileges: {
        totalRequests: 0,
        activeGrants: 0,
      },
      enrollment: {
        total: 0,
        approved: 0,
      },
    }
  );

  return {
    ...aggregate,
    riskScore,
  };
}

function toIso(value?: Date | null) {
  if (!value) {
    return undefined;
  }
  return value.toISOString();
}

