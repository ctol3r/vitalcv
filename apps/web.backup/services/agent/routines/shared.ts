import {
  PrismaClient,
  type ClinicianProfile,
  type PayerEnrollmentV2,
  type Payer,
  type CaqhProfile,
  type Credential,
  type StateLicenseVerification,
  type PECOSProvider,
  type CompactConsent,
  CredentialTimelineEventType,
  TimelineEventSeverity,
  type RevalidationTask,
} from '@prisma/client';
import { logCredentialTimelineEvent } from '../../timeline/logCredentialTimelineEvent';
import { getServiceLogger } from '../../logging/serviceLogger';
import type {
  AgentRoutineContext,
  RoutineCheckResult,
  RoutineCheckStatus,
} from './types';

const prisma = new PrismaClient();
const log = getServiceLogger('agent/routines/shared');

type ProfileWithRelations = ClinicianProfile & {
  user: {
    id: string;
    did: string | null;
    didLinks: { did: string }[];
  };
  caqhProfiles: CaqhProfile[];
  payerEnrollmentsV2: (PayerEnrollmentV2 & { payer: Payer })[];
};

export interface ProviderDemographics {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  dateOfBirth?: string;
  taxonomyCodes?: string[];
}

export interface ResolvedClinicianContext {
  clinicianId: string;
  clinicianDid?: string;
  npi: string;
  state: string;
  specialty: string;
  userId: string;
  profile: ProfileWithRelations;
  caqhProfile?: CaqhProfile | null;
  payerEnrollments: (PayerEnrollmentV2 & { payer: Payer })[];
  compactConsents: Set<string>;
  demographics?: ProviderDemographics;
}

export function getPrismaClient(): PrismaClient {
  return prisma;
}

export function checkStatusToSeverity(status: RoutineCheckStatus): TimelineEventSeverity {
  switch (status) {
    case 'fail':
      return TimelineEventSeverity.CRITICAL;
    case 'warning':
      return TimelineEventSeverity.WARNING;
    case 'pass':
      return TimelineEventSeverity.INFO;
    default:
      return TimelineEventSeverity.NOTICE;
  }
}

export function buildCheck(params: {
  id: string;
  title: string;
  status: RoutineCheckStatus;
  summary?: string;
  details?: string[];
  evidence?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  timelineEvent?: CredentialTimelineEventType;
  timelineSeverity?: TimelineEventSeverity;
}): RoutineCheckResult {
  return {
    id: params.id,
    title: params.title,
    status: params.status,
    summary: params.summary,
    details: params.details,
    evidence: params.evidence,
    metadata: params.metadata,
    timelineEvent: params.timelineEvent,
    timelineSeverity:
      params.timelineSeverity ?? checkStatusToSeverity(params.status),
  };
}

async function fetchProfileById(id: string): Promise<ProfileWithRelations | null> {
  return prisma.clinicianProfile.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          did: true,
          didLinks: { select: { did: true } },
        },
      },
      caqhProfiles: {
        orderBy: { updatedAt: 'desc' },
        take: 1,
      },
      payerEnrollmentsV2: {
        include: { payer: true },
        orderBy: { updatedAt: 'desc' },
      },
    },
  }) as Promise<ProfileWithRelations | null>;
}

async function fetchProfileByNpi(npi: string): Promise<ProfileWithRelations | null> {
  return prisma.clinicianProfile.findFirst({
    where: { npi },
    include: {
      user: {
        select: {
          id: true,
          did: true,
          didLinks: { select: { did: true } },
        },
      },
      caqhProfiles: {
        orderBy: { updatedAt: 'desc' },
        take: 1,
      },
      payerEnrollmentsV2: {
        include: { payer: true },
        orderBy: { updatedAt: 'desc' },
      },
    },
  }) as Promise<ProfileWithRelations | null>;
}

async function fetchProfileByDid(did: string): Promise<ProfileWithRelations | null> {
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ did }, { didLinks: { some: { did } } }],
    },
    select: {
      clinicianProfile: {
        include: {
          user: {
            select: {
              id: true,
              did: true,
              didLinks: { select: { did: true } },
            },
          },
          caqhProfiles: {
            orderBy: { updatedAt: 'desc' },
            take: 1,
          },
          payerEnrollmentsV2: {
            include: { payer: true },
            orderBy: { updatedAt: 'desc' },
          },
        },
      },
    },
  });

  return (user?.clinicianProfile as ProfileWithRelations | undefined) ?? null;
}

async function fetchCompactConsents(clinicianId: string): Promise<Set<string>> {
  const rows: CompactConsent[] = await prisma.compactConsent.findMany({
    where: { clinicianId },
  });
  return new Set(rows.map(row => row.compactType?.toUpperCase() ?? '').filter(Boolean));
}

async function fetchProviderDemographics(
  clinicianId: string,
  npi: string,
): Promise<ProviderDemographics | undefined> {
  const normalized = await prisma.providerNormalized.findFirst({
    where: {
      OR: [{ clinicianId }, { npi }],
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (!normalized) {
    return undefined;
  }

  const metadata = normalized.nameMetadata as Record<string, unknown> | null;
  return {
    firstName: normalized.givenName ?? (metadata?.firstName as string | undefined),
    lastName: normalized.familyName ?? (metadata?.lastName as string | undefined),
    fullName: normalized.displayName,
    dateOfBirth: metadata?.dateOfBirth as string | undefined,
    taxonomyCodes: normalized.taxonomyCodes,
  };
}

export async function resolveClinicianContext(
  input: AgentRoutineContext,
): Promise<ResolvedClinicianContext> {
  let profile: ProfileWithRelations | null = null;

  if (input.clinicianId) {
    profile = await fetchProfileById(input.clinicianId);
  }

  if (!profile && input.npi) {
    profile = await fetchProfileByNpi(input.npi);
  }

  if (!profile && input.clinicianDid) {
    profile = await fetchProfileByDid(input.clinicianDid);
  }

  if (!profile) {
    throw new Error('Clinician profile could not be resolved for routine context');
  }

  const clinicianDid =
    input.clinicianDid ||
    profile.user.did ||
    profile.user.didLinks?.[0]?.did;

  const consents = await fetchCompactConsents(profile.id);
  const demographics = await fetchProviderDemographics(profile.id, profile.npi);

  return {
    clinicianId: profile.id,
    clinicianDid: clinicianDid ?? undefined,
    npi: profile.npi,
    state: profile.state,
    specialty: profile.specialty,
    userId: profile.userId,
    profile,
    caqhProfile: profile.caqhProfiles?.[0],
    payerEnrollments: profile.payerEnrollmentsV2,
    compactConsents: consents,
    demographics,
  };
}

export async function emitTimelineEvent(options: {
  clinicianId: string;
  eventType: CredentialTimelineEventType;
  severity?: TimelineEventSeverity;
  metadata?: Record<string, unknown>;
  dryRun?: boolean;
}): Promise<void> {
  if (options.dryRun) {
    log.info(`[timeline] (dry-run) ${options.eventType}`, {
      clinicianId: options.clinicianId,
      metadata: options.metadata,
    });
    return;
  }

  await logCredentialTimelineEvent({
    clinicianId: options.clinicianId,
    eventType: options.eventType,
    severity: options.severity ?? TimelineEventSeverity.INFO,
    metadata: options.metadata,
  });
}

export async function fetchClinicianCredentials(
  userId: string,
  types?: string[],
): Promise<Credential[]> {
  return prisma.credential.findMany({
    where: {
      userId,
      ...(types ? { type: { in: types } } : {}),
    },
    orderBy: { issuedAt: 'desc' },
  });
}

export async function fetchStateLicenses(
  clinicianId: string,
): Promise<StateLicenseVerification[]> {
  return prisma.stateLicenseVerification.findMany({
    where: { clinicianId },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function fetchPecosProviders(
  clinicianId: string,
): Promise<PECOSProvider[]> {
  return prisma.pECOSProvider.findMany({
    where: { clinicianId },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function upsertRevalidationTask(options: {
  clinicianId: string;
  type: RevalidationTask['type'];
  notes: string;
  dueDate: Date;
  metadata?: Record<string, unknown>;
  dryRun?: boolean;
}): Promise<RevalidationTask | null> {
  if (options.dryRun) {
    log.info('[revalidation] (dry-run) task planned', {
      clinicianId: options.clinicianId,
      type: options.type,
      notes: options.notes,
    });
    return null;
  }

  const existing = await prisma.revalidationTask.findFirst({
    where: {
      clinicianId: options.clinicianId,
      type: options.type,
      status: { in: ['OPEN', 'IN_PROGRESS'] },
      notes: options.notes,
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.revalidationTask.create({
    data: {
      clinicianId: options.clinicianId,
      type: options.type,
      status: 'OPEN',
      dueDate: options.dueDate,
      notes: options.notes,
      metadata: options.metadata,
    },
  });
}

import {
  PrismaClient,
  type ClinicianProfile,
  type PayerEnrollmentV2,
  type Payer,
  type CaqhProfile,
  type Credential,
  type StateLicenseVerification,
  type PECOSProvider,
  type CompactConsent,
  CredentialTimelineEventType,
  TimelineEventSeverity,
  type RevalidationTask,
} from '@prisma/client';
import { logCredentialTimelineEvent } from '../../timeline/logCredentialTimelineEvent';
import { getServiceLogger } from '../../logging/serviceLogger';
import type {
  AgentRoutineContext,
  RoutineCheckResult,
  RoutineCheckStatus,
} from './types';

const prisma = new PrismaClient();
const log = getServiceLogger('agent/routines/shared');

type ProfileWithRelations = ClinicianProfile & {
  user: {
    id: string;
    did: string | null;
    didLinks: { did: string }[];
  };
  caqhProfiles: CaqhProfile[];
  payerEnrollmentsV2: (PayerEnrollmentV2 & { payer: Payer })[];
};

export interface ProviderDemographics {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  dateOfBirth?: string;
  taxonomyCodes?: string[];
}

export interface ResolvedClinicianContext {
  clinicianId: string;
  clinicianDid?: string;
  npi: string;
  state: string;
  specialty: string;
  userId: string;
  profile: ProfileWithRelations;
  caqhProfile?: CaqhProfile | null;
  payerEnrollments: (PayerEnrollmentV2 & { payer: Payer })[];
  compactConsents: Set<string>;
  demographics?: ProviderDemographics;
}

export function getPrismaClient(): PrismaClient {
  return prisma;
}

export function checkStatusToSeverity(status: RoutineCheckStatus): TimelineEventSeverity {
  switch (status) {
    case 'fail':
      return TimelineEventSeverity.CRITICAL;
    case 'warning':
      return TimelineEventSeverity.WARNING;
    case 'pass':
      return TimelineEventSeverity.INFO;
    default:
      return TimelineEventSeverity.NOTICE;
  }
}

export function buildCheck(params: {
  id: string;
  title: string;
  status: RoutineCheckStatus;
  summary?: string;
  details?: string[];
  evidence?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  timelineEvent?: CredentialTimelineEventType;
  timelineSeverity?: TimelineEventSeverity;
}): RoutineCheckResult {
  return {
    id: params.id,
    title: params.title,
    status: params.status,
    summary: params.summary,
    details: params.details,
    evidence: params.evidence,
    metadata: params.metadata,
    timelineEvent: params.timelineEvent,
    timelineSeverity:
      params.timelineSeverity ?? checkStatusToSeverity(params.status),
  };
}

async function fetchProfileById(id: string): Promise<ProfileWithRelations | null> {
  return prisma.clinicianProfile.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          did: true,
          didLinks: { select: { did: true } },
        },
      },
      caqhProfiles: {
        orderBy: { updatedAt: 'desc' },
        take: 1,
      },
      payerEnrollmentsV2: {
        include: { payer: true },
        orderBy: { updatedAt: 'desc' },
      },
    },
  }) as Promise<ProfileWithRelations | null>;
}

async function fetchProfileByNpi(npi: string): Promise<ProfileWithRelations | null> {
  return prisma.clinicianProfile.findFirst({
    where: { npi },
    include: {
      user: {
        select: {
          id: true,
          did: true,
          didLinks: { select: { did: true } },
        },
      },
      caqhProfiles: {
        orderBy: { updatedAt: 'desc' },
        take: 1,
      },
      payerEnrollmentsV2: {
        include: { payer: true },
        orderBy: { updatedAt: 'desc' },
      },
    },
  }) as Promise<ProfileWithRelations | null>;
}

async function fetchProfileByDid(did: string): Promise<ProfileWithRelations | null> {
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ did }, { didLinks: { some: { did } } }],
    },
    select: {
      clinicianProfile: {
        include: {
          user: {
            select: {
              id: true,
              did: true,
              didLinks: { select: { did: true } },
            },
          },
          caqhProfiles: {
            orderBy: { updatedAt: 'desc' },
            take: 1,
          },
          payerEnrollmentsV2: {
            include: { payer: true },
            orderBy: { updatedAt: 'desc' },
          },
        },
      },
    },
  });

  return (user?.clinicianProfile as ProfileWithRelations | undefined) ?? null;
}

async function fetchCompactConsents(clinicianId: string): Promise<Set<string>> {
  const rows: CompactConsent[] = await prisma.compactConsent.findMany({
    where: { clinicianId },
  });
  return new Set(rows.map(row => row.compactType?.toUpperCase() ?? '').filter(Boolean));
}

async function fetchProviderDemographics(
  clinicianId: string,
  npi: string,
): Promise<ProviderDemographics | undefined> {
  const normalized = await prisma.providerNormalized.findFirst({
    where: {
      OR: [{ clinicianId }, { npi }],
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (!normalized) {
    return undefined;
  }

  const metadata = normalized.nameMetadata as Record<string, unknown> | null;
  return {
    firstName: normalized.givenName ?? (metadata?.firstName as string | undefined),
    lastName: normalized.familyName ?? (metadata?.lastName as string | undefined),
    fullName: normalized.displayName,
    dateOfBirth: metadata?.dateOfBirth as string | undefined,
    taxonomyCodes: normalized.taxonomyCodes,
  };
}

export async function resolveClinicianContext(
  input: AgentRoutineContext,
): Promise<ResolvedClinicianContext> {
  let profile: ProfileWithRelations | null = null;

  if (input.clinicianId) {
    profile = await fetchProfileById(input.clinicianId);
  }

  if (!profile && input.npi) {
    profile = await fetchProfileByNpi(input.npi);
  }

  if (!profile && input.clinicianDid) {
    profile = await fetchProfileByDid(input.clinicianDid);
  }

  if (!profile) {
    throw new Error('Clinician profile could not be resolved for routine context');
  }

  const clinicianDid =
    input.clinicianDid ||
    profile.user.did ||
    profile.user.didLinks?.[0]?.did;

  const consents = await fetchCompactConsents(profile.id);
  const demographics = await fetchProviderDemographics(profile.id, profile.npi);

  return {
    clinicianId: profile.id,
    clinicianDid: clinicianDid ?? undefined,
    npi: profile.npi,
    state: profile.state,
    specialty: profile.specialty,
    userId: profile.userId,
    profile,
    caqhProfile: profile.caqhProfiles?.[0],
    payerEnrollments: profile.payerEnrollmentsV2,
    compactConsents: consents,
    demographics,
  };
}

export async function emitTimelineEvent(options: {
  clinicianId: string;
  eventType: CredentialTimelineEventType;
  severity?: TimelineEventSeverity;
  metadata?: Record<string, unknown>;
  dryRun?: boolean;
}): Promise<void> {
  if (options.dryRun) {
    log.info(`[timeline] (dry-run) ${options.eventType}`, {
      clinicianId: options.clinicianId,
      metadata: options.metadata,
    });
    return;
  }

  await logCredentialTimelineEvent({
    clinicianId: options.clinicianId,
    eventType: options.eventType,
    severity: options.severity ?? TimelineEventSeverity.INFO,
    metadata: options.metadata,
  });
}

export async function fetchClinicianCredentials(
  userId: string,
  types?: string[],
): Promise<Credential[]> {
  return prisma.credential.findMany({
    where: {
      userId,
      ...(types ? { type: { in: types } } : {}),
    },
    orderBy: { issuedAt: 'desc' },
  });
}

export async function fetchStateLicenses(
  clinicianId: string,
): Promise<StateLicenseVerification[]> {
  return prisma.stateLicenseVerification.findMany({
    where: { clinicianId },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function fetchPecosProviders(
  clinicianId: string,
): Promise<PECOSProvider[]> {
  return prisma.pECOSProvider.findMany({
    where: { clinicianId },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function upsertRevalidationTask(options: {
  clinicianId: string;
  type: RevalidationTask['type'];
  notes: string;
  dueDate: Date;
  metadata?: Record<string, unknown>;
  dryRun?: boolean;
}): Promise<RevalidationTask | null> {
  if (options.dryRun) {
    log.info('[revalidation] (dry-run) task planned', {
      clinicianId: options.clinicianId,
      type: options.type,
      notes: options.notes,
    });
    return null;
  }

  const existing = await prisma.revalidationTask.findFirst({
    where: {
      clinicianId: options.clinicianId,
      type: options.type,
      status: { in: ['OPEN', 'IN_PROGRESS'] },
      notes: options.notes,
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.revalidationTask.create({
    data: {
      clinicianId: options.clinicianId,
      type: options.type,
      status: 'OPEN',
      dueDate: options.dueDate,
      notes: options.notes,
      metadata: options.metadata,
    },
  });
}


