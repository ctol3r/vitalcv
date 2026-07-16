/**
 * Application packet read boundary.
 *
 * A submitted ApplicationPacket is historical evidence. This service is the
 * only read path that authorizes access and re-verifies the sealed bytes before
 * exposing it. It deliberately does not resolve current trust state.
 */

import {
  MembershipRole,
  UserRole,
  UserStatus,
} from '@prisma/client';

import prisma from '../../graphql/prisma_client';
import { sha256ForPayload } from '../../utils/deterministic';
import { HttpError } from '../../utils/httpError';
import {
  type ApplicationPacketContent,
  type PacketEvidenceState,
  type PacketFieldEntry,
  type SealedApplicationPacket,
  verifySealedPacket,
} from './applicationPacketService';

export type ApplicationPacketAccessPerspective = 'clinician' | 'employer' | 'admin';
export type SubmittedPacketField = PacketFieldEntry;
export type ApplicationPacketLifecycle = 'active' | 'superseded' | 'revoked';

export interface ApplicationPacketReadResponse {
  applicationId: string;
  opportunityId: string;
  accessPerspective: ApplicationPacketAccessPerspective;
  mode: 'sealed' | 'legacy';
  submittedPacket: {
    packetVersion: number;
    packetHash: string;
    // Invalid packets fail closed before a response is constructed.
    integrity: 'valid' | 'invalid';
    purpose: string;
    recipient: string;
    consentAt: string;
    consentReceiptId: string;
    selectedSections: string[];
    fields: SubmittedPacketField[];
    methodologyVersion: string;
    lifecycle: ApplicationPacketLifecycle;
  } | null;
  legacyNotice: string | null;
}

export interface ReadApplicationPacketInput {
  applicationId: string;
  clerkUserId: string;
  /** Undefined selects the version attached to the application at submission. */
  packetVersion?: number;
}

const LEGACY_NOTICE = 'Legacy application — no immutable disclosure packet was captured at submission.';
const PACKET_NOT_FOUND_MESSAGE = 'Application packet not found.';
const REVIEW_MEMBERSHIP_ROLES = new Set<MembershipRole>([
  MembershipRole.ADMIN,
  MembershipRole.VERIFIER,
  MembershipRole.RECRUITER,
  MembershipRole.CREDENTIALING_SPECIALIST,
]);
const PACKET_EVIDENCE_STATES = new Set<PacketEvidenceState>([
  'source_backed',
  'checked',
  'self_attested',
  'needs_review',
  'access_required',
  'unavailable',
  'employer_decided',
]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ApplicationForPacketRead = {
  id: string;
  clerkUserId: string;
  opportunityId: string;
  sealedPacketVersion: number | null;
  opportunity: { organizationId: string };
};

type StoredApplicationPacket = {
  applicationId: string;
  packetVersion: number;
  clerkUserId: string;
  clinicianNpi: string;
  opportunityId: string;
  employerOrgId: string;
  purpose: string;
  recipient: string;
  selectedSections: unknown;
  fields: unknown;
  clinicianNote: string | null;
  methodologyVersion: string;
  consentAt: Date;
  consentReceiptId: string;
  packetHash: string;
  supersededByPacketId: string | null;
  revokedAt: Date | null;
  revokedReason: string | null;
};

function notFound(): HttpError {
  // The same response is used for absent and unauthorized resources so callers
  // cannot enumerate applications or retained packet versions.
  return new HttpError(404, PACKET_NOT_FOUND_MESSAGE);
}

function integrityFailure(): HttpError {
  return new HttpError(
    409,
    'Application packet integrity verification failed.',
    'APPLICATION_PACKET_INTEGRITY_FAILED',
  );
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Invalid stored packet ${field}.`);
  }
  return value;
}

function requireNullableString(value: unknown, field: string): string | null {
  if (value === null) {
    return null;
  }
  return requireString(value, field);
}

function parseSelectedSections(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((section) => typeof section !== 'string')) {
    throw new Error('Invalid stored packet selectedSections.');
  }
  return [...value];
}

function parsePacketFields(value: unknown): PacketFieldEntry[] {
  if (!Array.isArray(value)) {
    throw new Error('Invalid stored packet fields.');
  }

  return value.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`Invalid stored packet field at index ${index}.`);
    }
    const record = entry as Record<string, unknown>;
    const evidenceState = requireString(record.evidenceState, `fields[${index}].evidenceState`);
    if (!PACKET_EVIDENCE_STATES.has(evidenceState as PacketEvidenceState)) {
      throw new Error(`Invalid stored packet evidence state at index ${index}.`);
    }

    return {
      sectionId: requireString(record.sectionId, `fields[${index}].sectionId`),
      fieldId: requireString(record.fieldId, `fields[${index}].fieldId`),
      label: requireString(record.label, `fields[${index}].label`),
      value: requireNullableString(record.value, `fields[${index}].value`),
      evidenceState: evidenceState as PacketEvidenceState,
      sourceId: requireString(record.sourceId, `fields[${index}].sourceId`),
      sourceObservedAt: requireNullableString(record.sourceObservedAt, `fields[${index}].sourceObservedAt`),
      freshUntil: requireNullableString(record.freshUntil, `fields[${index}].freshUntil`),
      artifactId: requireNullableString(record.artifactId, `fields[${index}].artifactId`),
      receiptId: requireNullableString(record.receiptId, `fields[${index}].receiptId`),
    };
  });
}

function reconstructSealedPacket(row: StoredApplicationPacket): SealedApplicationPacket {
  const content: ApplicationPacketContent = {
    applicationId: row.applicationId,
    packetVersion: row.packetVersion,
    clerkUserId: row.clerkUserId,
    clinicianNpi: row.clinicianNpi,
    opportunityId: row.opportunityId,
    employerOrgId: row.employerOrgId,
    purpose: row.purpose,
    recipient: row.recipient,
    selectedSections: parseSelectedSections(row.selectedSections),
    fields: parsePacketFields(row.fields),
    clinicianNote: row.clinicianNote,
    methodologyVersion: row.methodologyVersion,
    consentAt: row.consentAt.toISOString(),
    consentReceiptId: row.consentReceiptId,
  };

  return { ...content, packetHash: row.packetHash };
}

function lifecycleOf(packet: StoredApplicationPacket): ApplicationPacketLifecycle {
  if (packet.revokedAt) {
    return 'revoked';
  }
  if (packet.supersededByPacketId) {
    return 'superseded';
  }
  return 'active';
}

async function recordPacketAudit(input: {
  type: 'application_packet_accessed' | 'application_packet_integrity_failed';
  application: ApplicationForPacketRead;
  packetVersion: number | null;
  actorClerkUserId: string;
  perspective: ApplicationPacketAccessPerspective | 'unknown';
}): Promise<void> {
  const metadata = {
    entity_type: 'application_packet',
    application_id: input.application.id,
    opportunity_id: input.application.opportunityId,
    packet_version: input.packetVersion,
    actor_perspective: input.perspective,
  };

  await prisma.auditEvent.create({
    data: {
      type: input.type,
      hash: sha256ForPayload({ type: input.type, actor: input.actorClerkUserId, ...metadata }),
      referenceId: input.application.id,
      clinicianId: input.actorClerkUserId,
      organizationId: input.application.opportunity.organizationId,
      metadata,
    },
  });
}

async function resolveAccessPerspective(
  application: ApplicationForPacketRead,
  clerkUserId: string,
): Promise<ApplicationPacketAccessPerspective> {
  if (application.clerkUserId === clerkUserId) {
    return 'clinician';
  }

  const actor = await prisma.user.findUnique({
    where: { clerkUserId },
    select: { id: true, role: true, status: true },
  });
  if (!actor) {
    throw notFound();
  }

  // This is the explicit, server-side platform administrator mechanism. No
  // request role, organization, or membership header participates in it.
  if (actor.role === UserRole.ADMIN && actor.status === UserStatus.ACTIVE) {
    return 'admin';
  }

  if (actor.status !== UserStatus.ACTIVE) {
    throw notFound();
  }

  const [personProfile, organizationProfile] = await Promise.all([
    prisma.personProfile.findUnique({
      where: { userId: actor.id },
      select: { id: true },
    }),
    prisma.organizationProfile.findUnique({
      where: { organizationId: application.opportunity.organizationId },
      select: { id: true },
    }),
  ]);
  if (!personProfile || !organizationProfile) {
    throw notFound();
  }

  const membership = await prisma.workspaceMembership.findUnique({
    where: {
      personProfileId_organizationProfileId: {
        personProfileId: personProfile.id,
        organizationProfileId: organizationProfile.id,
      },
    },
    select: { active: true, role: true },
  });

  if (!membership?.active || !REVIEW_MEMBERSHIP_ROLES.has(membership.role)) {
    throw notFound();
  }

  return 'employer';
}

/**
 * Reads the exact immutable packet attached to an application, or an explicitly
 * requested retained version. The query never substitutes a newer packet or
 * current Wallet evidence for the submitted record.
 */
export async function readApplicationPacket(
  input: ReadApplicationPacketInput,
): Promise<ApplicationPacketReadResponse> {
  const application = await prisma.application.findUnique({
    where: { id: input.applicationId },
    select: {
      id: true,
      clerkUserId: true,
      opportunityId: true,
      sealedPacketVersion: true,
      opportunity: { select: { organizationId: true } },
    },
  }) as ApplicationForPacketRead | null;

  if (!application) {
    throw notFound();
  }

  const accessPerspective = await resolveAccessPerspective(application, input.clerkUserId);
  if (application.sealedPacketVersion === null && input.packetVersion === undefined) {
    await recordPacketAudit({
      type: 'application_packet_accessed',
      application,
      packetVersion: null,
      actorClerkUserId: input.clerkUserId,
      perspective: accessPerspective,
    });
    return {
      applicationId: application.id,
      opportunityId: application.opportunityId,
      accessPerspective,
      mode: 'legacy',
      submittedPacket: null,
      legacyNotice: LEGACY_NOTICE,
    };
  }

  const packetVersion = input.packetVersion ?? application.sealedPacketVersion;
  if (packetVersion === null) {
    throw notFound();
  }

  const storedPacket = await prisma.applicationPacket.findFirst({
    where: { applicationId: application.id, packetVersion },
  }) as StoredApplicationPacket | null;
  if (!storedPacket) {
    throw notFound();
  }

  let packet: SealedApplicationPacket;
  try {
    packet = reconstructSealedPacket(storedPacket);
    const applicationBindingValid = (
      packet.applicationId === application.id
      && packet.opportunityId === application.opportunityId
      && packet.employerOrgId === application.opportunity.organizationId
    );
    if (!applicationBindingValid || !verifySealedPacket(packet)) {
      throw new Error('Stored packet failed integrity verification.');
    }
  } catch {
    await recordPacketAudit({
      type: 'application_packet_integrity_failed',
      application,
      packetVersion,
      actorClerkUserId: input.clerkUserId,
      perspective: accessPerspective,
    });
    throw integrityFailure();
  }

  await recordPacketAudit({
    type: 'application_packet_accessed',
    application,
    packetVersion,
    actorClerkUserId: input.clerkUserId,
    perspective: accessPerspective,
  });

  return {
    applicationId: application.id,
    opportunityId: application.opportunityId,
    accessPerspective,
    mode: 'sealed',
    submittedPacket: {
      packetVersion: packet.packetVersion,
      packetHash: packet.packetHash,
      integrity: 'valid',
      purpose: packet.purpose,
      recipient: packet.recipient,
      consentAt: packet.consentAt,
      consentReceiptId: packet.consentReceiptId,
      selectedSections: packet.selectedSections,
      fields: packet.fields,
      methodologyVersion: packet.methodologyVersion,
      lifecycle: lifecycleOf(storedPacket),
    },
    legacyNotice: null,
  };
}

/** Strict route parser shared by API callers and route tests. */
export function parseRequestedPacketVersion(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value)) {
    throw new HttpError(400, 'version must be a positive integer.');
  }

  const version = Number(value);
  if (!Number.isSafeInteger(version)) {
    throw new HttpError(400, 'version must be a positive integer.');
  }
  return version;
}

export function parseApplicationPacketApplicationId(value: unknown): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new HttpError(400, 'applicationId must be a UUID.');
  }
  return value;
}

export const applicationPacketLegacyNotice = LEGACY_NOTICE;
