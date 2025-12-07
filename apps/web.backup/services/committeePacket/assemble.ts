import { PrismaClient, PayerEnrollmentV2Status } from '@prisma/client';
import { loadClinicianWithUser, buildClinicianTimeline } from '../timeline/getClinicianTimeline';
import { detectPayerDiscrepancies, type DiscrepancyFinding } from '../payer/detectPayerDiscrepancies';
import {
  CommitteePacketDocument,
  CommitteePacketDocumentSchema,
  CommitteePacketStatus,
  IdentitySection,
  LicenseEntry,
  CredentialEntry,
  PayerEnrollmentEntry,
  PrivilegeRequestEntry,
  PrivilegeGrantEntry,
  QualityEntry,
  RiskSummary,
  CommitteePacketTimeline,
} from './models/CommitteePacket';
import { getPecosSummaryForClinician, getCredentialRiskSummary } from '../psv/evidenceBundle';
import { PayerEnrollmentV2Record } from '../payer/models/PayerEnrollmentV2';
import { saveCommitteePacketSnapshot } from './saveSnapshot';

const prisma = new PrismaClient();

export interface AssembleCommitteePacketOptions {
  clinicianId: string;
  includeTimeline?: boolean;
  prismaClient?: PrismaClient;
}

export interface GenerateCommitteePacketOptions extends AssembleCommitteePacketOptions {
  statusOverride?: CommitteePacketStatus;
}

export async function assembleCommitteePacket(
  options: AssembleCommitteePacketOptions
): Promise<CommitteePacketDocument> {
  const { clinicianId, includeTimeline = true } = options;
  const client = options.prismaClient ?? prisma;

  const clinician = await client.clinicianProfile.findUnique({
    where: { id: clinicianId },
    include: {
      user: true,
      caqhProfiles: true,
    },
  });

  if (!clinician) {
    throw new Error(`Clinician ${clinicianId} not found`);
  }

  const [npiClaim] = await client.npiClaim.findMany({
    where: { userId: clinician.userId },
  });

  const [licenses, boardCreds, deaCreds, payerEnrollments, privilegeRequests, privilegeGrants, fppeOppe] =
    await Promise.all([
      client.stateLicenseVerification.findMany({ where: { clinicianId }, orderBy: { updatedAt: 'desc' } }),
      client.credential.findMany({
        where: { userId: clinician.userId, type: { contains: 'board', mode: 'insensitive' } },
        orderBy: { issuedAt: 'desc' },
      }),
      client.credential.findMany({
        where: { userId: clinician.userId, type: { contains: 'dea', mode: 'insensitive' } },
        orderBy: { issuedAt: 'desc' },
      }),
      client.payerEnrollmentV2.findMany({
        where: { clinicianId },
        include: { payer: true },
        orderBy: { updatedAt: 'desc' },
      }),
      client.privilegeRequest.findMany({
        where: { clinicianDid: clinician.user?.did ?? undefined },
        include: { privilegeSet: true },
        orderBy: { createdAt: 'desc' },
      }),
      client.privilegeGranted.findMany({
        where: { clinicianDid: clinician.user?.did ?? undefined },
        include: { renewals: true },
        orderBy: { grantedAt: 'desc' },
      }),
      client.fppeOppe.findMany({
        where: { clinicianDid: clinician.user?.did ?? undefined },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

  const pecosSummary = await getPecosSummaryForClinician(clinicianId);
  const riskSummary = await getCredentialRiskSummary(clinicianId);

  const timelineClinician = includeTimeline ? await loadClinicianWithUser(clinicianId) : null;
  const timeline = timelineClinician
    ? await buildClinicianTimeline({ clinician: timelineClinician, sortDirection: 'desc' })
    : { events: [], phaseGroups: [] };

  const identitySection: IdentitySection = {
    npi: clinician.npi,
    fullName: clinician.user?.name,
    specialty: clinician.specialty,
    state: clinician.state,
    did: clinician.user?.did,
    caqhId: clinician.caqhProfiles?.[0]?.caqhId ?? null,
    level: npiClaim?.level,
    tags: (npiClaim?.tags as Record<string, unknown> | null) ?? undefined,
  };

  const licenseSection: LicenseEntry[] = licenses.map((license) => ({
    state: license.state,
    licenseNumber: license.licenseNumber,
    status: license.status,
    issueDate: license.issueDate?.toISOString() ?? null,
    expiryDate: license.expiryDate?.toISOString() ?? null,
    disciplinaryFlag: license.disciplinaryFlag,
  }));

  const boardSection: CredentialEntry[] = boardCreds.map((credential) => ({
    id: credential.id,
    type: credential.type,
    status: credential.status ?? 'UNKNOWN',
    issuedAt: credential.issuedAt?.toISOString() ?? credential.createdAt.toISOString(),
    expiresAt: credential.expiresAt?.toISOString() ?? null,
    issuer: credential.issuer,
    metadata: {
      name: credential.name,
    },
  }));

  const deaSection: CredentialEntry[] = deaCreds.map((credential) => ({
    id: credential.id,
    type: credential.type,
    status: credential.status ?? 'UNKNOWN',
    issuedAt: credential.issuedAt?.toISOString() ?? credential.createdAt.toISOString(),
    expiresAt: credential.expiresAt?.toISOString() ?? null,
    issuer: credential.issuer,
    metadata: {
      name: credential.name,
    },
  }));

  const payerEnrollmentSection: PayerEnrollmentEntry[] = payerEnrollments.map((enrollment) => ({
    id: enrollment.id,
    payerName: enrollment.payer?.name ?? enrollment.payerId,
    payerId: enrollment.payer?.payerId ?? enrollment.payerId,
    status: enrollment.status,
    panelType: enrollment.panelType,
    effectiveDate: enrollment.effectiveDate?.toISOString() ?? null,
    states: enrollment.payer?.states ?? [],
    specialty: enrollment.payer?.specialty ?? [],
    metadata: enrollment.metadata as Record<string, unknown> | null,
    updatedAt: enrollment.updatedAt.toISOString(),
  }));

  const privilegeRequestsSection: PrivilegeRequestEntry[] = privilegeRequests.map((request) => ({
    id: request.id,
    status: request.status,
    privilegeSetName: request.privilegeSet?.name,
    reviewerDid: request.reviewerDid,
    createdAt: request.createdAt.toISOString(),
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
  }));

  const privilegeGrantsSection: PrivilegeGrantEntry[] = privilegeGrants.map((grant) => ({
    id: grant.id,
    privilegeSetId: grant.privilegeSetId,
    status: grant.status,
    grantedAt: grant.grantedAt.toISOString(),
    expiresAt: grant.expiresAt.toISOString(),
    renewalDue: grant.renewalDue?.toISOString() ?? null,
  }));

  const qualitySection: QualityEntry[] = fppeOppe.map((record) => ({
    type: record.fppeStatus === 'NOT_STARTED' ? 'OPPE' : 'FPPE',
    status: record.fppeStatus === 'NOT_STARTED' ? record.oppeStatus ?? 'NOT_STARTED' : record.fppeStatus,
    notes: record.notes,
    dueAt: record.oppeNextReviewDue?.toISOString() ?? record.fppeEndDate?.toISOString() ?? null,
    updatedAt: record.updatedAt.toISOString(),
  }));

  const riskSection: RiskSummary | null = riskSummary
    ? {
        score: riskSummary.score,
        factors: riskSummary.factors,
        updatedAt: riskSummary.updatedAt,
      }
    : null;

  const caqhSnapshot = clinician.caqhProfiles?.[0];
  const discrepancyFindings: DiscrepancyFinding[] = payerEnrollments.flatMap((enrollment) => {
    const enrollmentRecord: PayerEnrollmentV2Record = {
      id: enrollment.id,
      clinicianId: enrollment.clinicianId,
      payerId: enrollment.payerId,
      status: enrollment.status as PayerEnrollmentV2Status,
      effectiveDate: enrollment.effectiveDate,
      panelType: enrollment.panelType as any,
      notes: enrollment.notes,
      metadata: enrollment.metadata as Record<string, unknown> | null,
      lastStatusChange: enrollment.lastStatusChange,
      createdAt: enrollment.createdAt,
      updatedAt: enrollment.updatedAt,
    };

    return detectPayerDiscrepancies({
      clinicianId,
      clinicianSpecialty: clinician.specialty,
      targetState: enrollment.payer?.states?.[0],
      caqh: caqhSnapshot
        ? {
            hasProfile: true,
            missingSections: Array.isArray((caqhSnapshot.fields as any)?.missingSections)
              ? ((caqhSnapshot.fields as any)?.missingSections as string[])
              : [],
          }
        : { hasProfile: false },
      payer: {
        id: enrollment.payer?.id ?? enrollment.payerId,
        name: enrollment.payer?.name ?? enrollment.payerId,
        requiresCaqh: enrollment.payer?.requiresCaqh ?? true,
        specialty: enrollment.payer?.specialty ?? [],
        states: enrollment.payer?.states ?? [],
      },
      enrollment: enrollmentRecord,
    });
  });

  const timelineSection: CommitteePacketTimeline = {
    events: timeline.events.map((event) => ({
      id: event.id,
      phase: event.phase,
      title: event.title,
      timestamp: event.timestamp.toISOString(),
      status: event.status,
      metadata: event.metadata as Record<string, unknown> | undefined,
    })),
    phaseGroups: timeline.phaseGroups.map((group) => ({
      phase: group.phase,
      events: group.events.map((event) => ({
        id: event.id,
        timestamp: event.timestamp.toISOString(),
      })),
    })),
  };

  const document: CommitteePacketDocument = {
    clinicianId,
    generatedAt: new Date().toISOString(),
    sections: {
      identity: identitySection,
      licensure: licenseSection,
      boardCertifications: boardSection,
      dea: deaSection,
      pecos: pecosSummary,
      medicaid: payerEnrollmentSection.find((entry) => entry.payerId.includes('MEDICAID')) ?? null,
      payerEnrollments: payerEnrollmentSection,
      privileges: {
        requests: privilegeRequestsSection,
        active: privilegeGrantsSection,
      },
      quality: qualitySection,
      risk: riskSection,
      discrepancies: discrepancyFindings,
      timeline: timelineSection,
    },
  };

  CommitteePacketDocumentSchema.parse(document);
  return document;
}

export async function generateCommitteePacketSnapshot(
  options: GenerateCommitteePacketOptions
) {
  const document = await assembleCommitteePacket(options);
  return saveCommitteePacketSnapshot({
    clinicianId: options.clinicianId,
    document,
    status: options.statusOverride ?? CommitteePacketStatus.GENERATED,
  });
}
import { PrismaClient, PayerEnrollmentV2Status } from '@prisma/client';
import { loadClinicianWithUser, buildClinicianTimeline } from '../timeline/getClinicianTimeline';
import { detectPayerDiscrepancies, type DiscrepancyFinding } from '../payer/detectPayerDiscrepancies';
import {
  CommitteePacketDocument,
  CommitteePacketDocumentSchema,
  CommitteePacketStatus,
  IdentitySection,
  LicenseEntry,
  CredentialEntry,
  PayerEnrollmentEntry,
  PrivilegeRequestEntry,
  PrivilegeGrantEntry,
  QualityEntry,
  RiskSummary,
  CommitteePacketTimeline,
} from './models/CommitteePacket';
import { getPecosSummaryForClinician, getCredentialRiskSummary } from '../psv/evidenceBundle';
import { PayerEnrollmentV2Record } from '../payer/models/PayerEnrollmentV2';
import { CommitteePacketStatus as PrismaStatus } from '@prisma/client';
import { saveCommitteePacketSnapshot } from './saveSnapshot';

const prisma = new PrismaClient();

export interface AssembleCommitteePacketOptions {
  clinicianId: string;
  includeTimeline?: boolean;
  prismaClient?: PrismaClient;
}

export interface GenerateCommitteePacketOptions extends AssembleCommitteePacketOptions {
  statusOverride?: CommitteePacketStatus;
}

export async function assembleCommitteePacket(
  options: AssembleCommitteePacketOptions
): Promise<CommitteePacketDocument> {
  const { clinicianId, includeTimeline = true } = options;
  const client = options.prismaClient ?? prisma;

  const clinician = await client.clinicianProfile.findUnique({
    where: { id: clinicianId },
    include: {
      user: true,
      caqhProfiles: true,
    },
  });

  if (!clinician) {
    throw new Error(`Clinician ${clinicianId} not found`);
  }

  const [npiClaim] = await client.npiClaim.findMany({
    where: { userId: clinician.userId },
  });

  const [licenses, boardCreds, deaCreds, payerEnrollments, privilegeRequests, privilegeGrants, fppeOppe] =
    await Promise.all([
      client.stateLicenseVerification.findMany({ where: { clinicianId }, orderBy: { updatedAt: 'desc' } }),
      client.credential.findMany({
        where: { userId: clinician.userId, type: { contains: 'board', mode: 'insensitive' } },
        orderBy: { issuedAt: 'desc' },
      }),
      client.credential.findMany({
        where: { userId: clinician.userId, type: { contains: 'dea', mode: 'insensitive' } },
        orderBy: { issuedAt: 'desc' },
      }),
      client.payerEnrollmentV2.findMany({
        where: { clinicianId },
        include: { payer: true },
        orderBy: { updatedAt: 'desc' },
      }),
      client.privilegeRequest.findMany({
        where: { clinicianDid: clinician.user?.did ?? undefined },
        include: { privilegeSet: true },
        orderBy: { createdAt: 'desc' },
      }),
      client.privilegeGranted.findMany({
        where: { clinicianDid: clinician.user?.did ?? undefined },
        include: { renewals: true },
        orderBy: { grantedAt: 'desc' },
      }),
      client.fppeOppe.findMany({
        where: { clinicianDid: clinician.user?.did ?? undefined },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

  const pecosSummary = await getPecosSummaryForClinician(clinicianId);
  const riskSummary = await getCredentialRiskSummary(clinicianId);

  const timelineClinician = includeTimeline ? await loadClinicianWithUser(clinicianId) : null;
  const timeline = timelineClinician
    ? await buildClinicianTimeline({ clinician: timelineClinician, sortDirection: 'desc' })
    : { events: [], phaseGroups: [] };

  const identitySection: IdentitySection = {
    npi: clinician.npi,
    fullName: clinician.user?.name,
    specialty: clinician.specialty,
    state: clinician.state,
    did: clinician.user?.did,
    caqhId: clinician.caqhProfiles?.[0]?.caqhId ?? null,
    level: npiClaim?.level,
    tags: (npiClaim?.tags as Record<string, unknown> | null) ?? undefined,
  };

  const licenseSection: LicenseEntry[] = licenses.map((license) => ({
    state: license.state,
    licenseNumber: license.licenseNumber,
    status: license.status,
    issueDate: license.issueDate?.toISOString() ?? null,
    expiryDate: license.expiryDate?.toISOString() ?? null,
    disciplinaryFlag: license.disciplinaryFlag,
  }));

  const boardSection: CredentialEntry[] = boardCreds.map((credential) => ({
    id: credential.id,
    type: credential.type,
    status: credential.status ?? 'UNKNOWN',
    issuedAt: credential.issuedAt?.toISOString() ?? credential.createdAt.toISOString(),
    expiresAt: credential.expiresAt?.toISOString() ?? null,
    issuer: credential.issuer,
    metadata: {
      name: credential.name,
    },
  }));

  const deaSection: CredentialEntry[] = deaCreds.map((credential) => ({
    id: credential.id,
    type: credential.type,
    status: credential.status ?? 'UNKNOWN',
    issuedAt: credential.issuedAt?.toISOString() ?? credential.createdAt.toISOString(),
    expiresAt: credential.expiresAt?.toISOString() ?? null,
    issuer: credential.issuer,
    metadata: {
      name: credential.name,
    },
  }));

  const payerEnrollmentSection: PayerEnrollmentEntry[] = payerEnrollments.map((enrollment) => ({
    id: enrollment.id,
    payerName: enrollment.payer?.name ?? enrollment.payerId,
    payerId: enrollment.payer?.payerId ?? enrollment.payerId,
    status: enrollment.status,
    panelType: enrollment.panelType,
    effectiveDate: enrollment.effectiveDate?.toISOString() ?? null,
    states: enrollment.payer?.states ?? [],
    specialty: enrollment.payer?.specialty ?? [],
    metadata: enrollment.metadata as Record<string, unknown> | null,
    updatedAt: enrollment.updatedAt.toISOString(),
  }));

  const privilegeRequestsSection: PrivilegeRequestEntry[] = privilegeRequests.map((request) => ({
    id: request.id,
    status: request.status,
    privilegeSetName: request.privilegeSet?.name,
    reviewerDid: request.reviewerDid,
    createdAt: request.createdAt.toISOString(),
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
  }));

  const privilegeGrantsSection: PrivilegeGrantEntry[] = privilegeGrants.map((grant) => ({
    id: grant.id,
    privilegeSetId: grant.privilegeSetId,
    status: grant.status,
    grantedAt: grant.grantedAt.toISOString(),
    expiresAt: grant.expiresAt.toISOString(),
    renewalDue: grant.renewalDue?.toISOString() ?? null,
  }));

  const qualitySection: QualityEntry[] = fppeOppe.map((record) => ({
    type: record.fppeStatus === 'NOT_STARTED' ? 'OPPE' : 'FPPE',
    status: record.fppeStatus === 'NOT_STARTED' ? record.oppeStatus ?? 'NOT_STARTED' : record.fppeStatus,
    notes: record.notes,
    dueAt: record.oppeNextReviewDue?.toISOString() ?? record.fppeEndDate?.toISOString() ?? null,
    updatedAt: record.updatedAt.toISOString(),
  }));

  const riskSection: RiskSummary | null = riskSummary
    ? {
        score: riskSummary.score,
        factors: riskSummary.factors,
        updatedAt: riskSummary.updatedAt,
      }
    : null;

  const caqhSnapshot = clinician.caqhProfiles?.[0];
  const discrepancyFindings: DiscrepancyFinding[] = payerEnrollments.flatMap((enrollment) => {
    const enrollmentRecord: PayerEnrollmentV2Record = {
      id: enrollment.id,
      clinicianId: enrollment.clinicianId,
      payerId: enrollment.payerId,
      status: enrollment.status as PayerEnrollmentV2Status,
      effectiveDate: enrollment.effectiveDate,
      panelType: enrollment.panelType as any,
      notes: enrollment.notes,
      metadata: enrollment.metadata as Record<string, unknown> | null,
      lastStatusChange: enrollment.lastStatusChange,
      createdAt: enrollment.createdAt,
      updatedAt: enrollment.updatedAt,
    };

    return detectPayerDiscrepancies({
      clinicianId,
      clinicianSpecialty: clinician.specialty,
      targetState: enrollment.payer?.states?.[0],
      caqh: caqhSnapshot
        ? {
            hasProfile: true,
            missingSections: Array.isArray((caqhSnapshot.fields as any)?.missingSections)
              ? ((caqhSnapshot.fields as any)?.missingSections as string[])
              : [],
          }
        : { hasProfile: false },
      payer: {
        id: enrollment.payer?.id ?? enrollment.payerId,
        name: enrollment.payer?.name ?? enrollment.payerId,
        requiresCaqh: enrollment.payer?.requiresCaqh ?? true,
        specialty: enrollment.payer?.specialty ?? [],
        states: enrollment.payer?.states ?? [],
      },
      enrollment: enrollmentRecord,
    });
  });

  const timelineSection: CommitteePacketTimeline = {
    events: timeline.events.map((event) => ({
      id: event.id,
      phase: event.phase,
      title: event.title,
      timestamp: event.timestamp.toISOString(),
      status: event.status,
      metadata: event.metadata as Record<string, unknown> | undefined,
    })),
    phaseGroups: timeline.phaseGroups.map((group) => ({
      phase: group.phase,
      events: group.events.map((event) => ({
        id: event.id,
        timestamp: event.timestamp.toISOString(),
      })),
    })),
  };

  const document: CommitteePacketDocument = {
    clinicianId,
    generatedAt: new Date().toISOString(),
    sections: {
      identity: identitySection,
      licensure: licenseSection,
      boardCertifications: boardSection,
      dea: deaSection,
      pecos: pecosSummary,
      medicaid: payerEnrollmentSection.find((entry) => entry.payerId.includes('MEDICAID')) ?? null,
      payerEnrollments: payerEnrollmentSection,
      privileges: {
        requests: privilegeRequestsSection,
        active: privilegeGrantsSection,
      },
      quality: qualitySection,
      risk: riskSection,
      discrepancies: discrepancyFindings,
      timeline: timelineSection,
    },
  };

  CommitteePacketDocumentSchema.parse(document);
  return document;
}

export async function generateCommitteePacketSnapshot(
  options: GenerateCommitteePacketOptions
) {
  const document = await assembleCommitteePacket(options);
  return saveCommitteePacketSnapshot({
    clinicianId: options.clinicianId,
    document,
    status: options.statusOverride ?? CommitteePacketStatus.GENERATED,
  });
}

