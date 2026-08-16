/**
 * Application packet read boundary.
 *
 * A submitted ApplicationPacket is historical evidence. This service is the
 * only read path that authorizes access and re-verifies the sealed bytes before
 * exposing it. The evidence-view wrapper below adds current trust state without
 * changing the immutable packet contract.
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
  buildFieldEntriesFromTrustState,
  buildSectionAbsencesFromTrustState,
  withheldFieldIdsOf,
  PACKET_ABSENCE_STATES,
  type DisclosureSelection,
  type ApplicationPacketContent,
  type PacketAbsenceState,
  type PacketEvidenceState,
  type PacketFieldEntry,
  type PacketSectionAbsence,
  type SealedApplicationPacket,
  verifySealedPacket,
} from './applicationPacketService';
import { computeClinicianTrustState } from '../trust/trustStateEngine';

export type ApplicationPacketAccessPerspective = 'clinician' | 'employer' | 'admin';
export type SubmittedPacketField = PacketFieldEntry;
export type SubmittedPacketAbsence = PacketSectionAbsence;
export type ApplicationPacketLifecycle = 'active' | 'superseded' | 'revoked';

export interface ApplicationPacketReadResponse {
  applicationId: string;
  opportunityId: string;
  accessPerspective: ApplicationPacketAccessPerspective;
  mode: 'sealed' | 'legacy';
  submittedPacket: {
    packetVersion: number;
    packetHash: string;
    /** Opportunity.updatedAt frozen inside the seal; null only for legacy packet versions. */
    opportunityVersion: string | null;
    clinicianNpi: string;
    // Invalid packets fail closed before a response is constructed.
    integrity: 'valid' | 'invalid';
    purpose: string;
    recipient: string;
    consentAt: string;
    consentReceiptId: string;
    consentGrantId: string | null;
    selectedSections: string[];
    /** Field ids the clinician withheld at consent time (field-level disclosure). */
    withheldFieldIds: string[];
    fields: SubmittedPacketField[];
    /**
     * Selected sections that produced NO field, read straight out of the seal.
     *
     * `null` means this packet was sealed before absences were recorded — the
     * reader is told the record is missing rather than being shown an empty
     * list, which would assert "every section contributed" about a packet that
     * never made that claim. An empty array IS that assertion.
     */
    sectionAbsences: SubmittedPacketAbsence[] | null;
    /**
     * Sections named in `selectedSections` that have neither a field nor an
     * absence — the unexplained silences. Always `[]` for a packet sealed after
     * the absence invariant; non-empty only for legacy packets, where it names
     * exactly the sections a reader must NOT read as checked-and-clean.
     */
    unexplainedSectionIds: string[];
    methodologyVersion: string;
    clinicianNote: string | null;
    lifecycle: ApplicationPacketLifecycle;
  } | null;
  legacyNotice: string | null;
}

export type ApplicationEvidenceChangeKind =
  | 'unchanged'
  | 'added_after_submission'
  | 'changed_after_submission'
  | 'resolved_after_submission'
  | 'became_stale'
  | 'became_unavailable'
  | 'removed_after_submission';

export interface ApplicationEvidenceChange {
  fieldId: string;
  label: string;
  kind: ApplicationEvidenceChangeKind;
  submitted: SubmittedPacketField | null;
  current: SubmittedPacketField | null;
}

export interface ApplicationEvidenceViewResponse extends ApplicationPacketReadResponse {
  currentEvidence: {
    status: 'available' | 'unavailable';
    observedAt: string | null;
    methodologyVersion: string | null;
    fields: SubmittedPacketField[];
    /**
     * Sections that produce nothing from CURRENT sources. Recomputed, like
     * `fields` beside it — and necessarily so, since this panel is the live
     * view. Without it the live panel would reintroduce the exact silence the
     * sealed packet now removes: a section listed as disclosed, no row shown,
     * and a reader free to infer it was checked and clean.
     */
    sectionAbsences: SubmittedPacketAbsence[];
    changesSinceSubmission: ApplicationEvidenceChange[];
    notice: string;
  };
}

export interface ReadApplicationPacketInput {
  applicationId: string;
  clerkUserId: string;
  /** Undefined selects the version attached to the application at submission. */
  packetVersion?: number;
}

const LEGACY_NOTICE = 'Legacy application — no immutable disclosure record was captured at submission.';

/**
 * Every notice this service puts in front of a reader, in one place.
 *
 * These render VERBATIM on the employer and clinician surfaces, which makes
 * them customer-facing copy bound by EC-9 — but `scripts/check-public-claims.ts`
 * only scans `apps/web/app`, `apps/web/components` and `apps/marketing`, so
 * backend-authored copy is invisible to it. That is how "Current Wallet
 * evidence" survived the wave that retired "wallet" from customer language.
 * Collecting them here gives `applicationCopyContract.test.ts` something to
 * assert against without standing up a database.
 */
export const CURRENT_EVIDENCE_NOTICES = {
  noNpi: 'The current profile cannot be shown because this application has no clinician NPI attached.',
  legacy: 'This is the current profile — not the original submission.',
  sealed: 'The current profile is shown separately and does not alter the submitted record.',
  sourcesDown: 'Current profile sources are temporarily unavailable. The submitted record remains intact.',
} as const;
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

export type StoredApplicationPacket = {
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
  /** null for legacy packets sealed before absences were recorded. */
  sectionAbsences: unknown;
  clinicianNote: string | null;
  methodologyVersion: string;
  consentAt: Date;
  consentReceiptId: string;
  /** null for legacy packets sealed before first-class grants existed. */
  consentGrantId: string | null;
  /** null for legacy packets sealed before this column existed. */
  opportunityVersion: string | null;
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

/**
 * NULL (legacy packet, sealed before the column existed) becomes `undefined`
 * so `canonicalize` omits the key and the stored hash still verifies — the
 * same rule `opportunityVersion` follows. An empty array is NOT the same thing
 * and is preserved as an empty array: it is the packet asserting that every
 * selected section contributed evidence.
 */
function parseSectionAbsences(value: unknown): PacketSectionAbsence[] | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error('Invalid stored packet sectionAbsences.');
  }

  return value.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`Invalid stored packet absence at index ${index}.`);
    }
    const record = entry as Record<string, unknown>;
    const evidenceState = requireString(record.evidenceState, `sectionAbsences[${index}].evidenceState`);
    if (!(PACKET_ABSENCE_STATES as readonly string[]).includes(evidenceState)) {
      throw new Error(`Invalid stored packet absence state at index ${index}.`);
    }

    return {
      sectionId: requireString(record.sectionId, `sectionAbsences[${index}].sectionId`),
      evidenceState: evidenceState as PacketAbsenceState,
      reason: requireString(record.reason, `sectionAbsences[${index}].reason`),
    };
  });
}

/**
 * Selected sections a packet accounts for NEITHER with a field NOR with an
 * absence. `sealPacket` makes this impossible for new packets; legacy packets
 * predate that invariant, and their silences must be named rather than left for
 * the reader to interpret as a clean check.
 */
function unexplainedSectionIdsOf(packet: SealedApplicationPacket): string[] {
  const withFields = new Set(packet.fields.map((field) => field.sectionId));
  const absent = new Set((packet.sectionAbsences ?? []).map((absence) => absence.sectionId));
  return packet.selectedSections
    .filter((sectionId) => !withFields.has(sectionId) && !absent.has(sectionId))
    .sort();
}

export function reconstructSealedPacket(row: StoredApplicationPacket): SealedApplicationPacket {
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
    // Legacy NULL → undefined → key omitted → original hash still verifies.
    sectionAbsences: parseSectionAbsences(row.sectionAbsences),
    clinicianNote: row.clinicianNote,
    methodologyVersion: row.methodologyVersion,
    consentAt: row.consentAt.toISOString(),
    consentReceiptId: row.consentReceiptId,
    // A null grant column predates ConsentGrant and must be omitted from the
    // canonical bytes. New packets include the id and bind it into the seal.
    consentGrantId: row.consentGrantId ?? undefined,
    // CRITICAL for legacy replay: a null column (packet sealed before this
    // field existed) must become `undefined` so `canonicalize` OMITS the key
    // and re-hashes to the original seal. A `null` here would add a key the
    // legacy hash never covered and fail every legacy packet's verification.
    opportunityVersion: row.opportunityVersion ?? undefined,
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
 * the current profile for the submitted record.
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
      && packet.clerkUserId === application.clerkUserId
      && packet.opportunityId === application.opportunityId
      && packet.employerOrgId === application.opportunity.organizationId
      && packet.packetVersion === packetVersion
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
      opportunityVersion: packet.opportunityVersion ?? null,
      clinicianNpi: packet.clinicianNpi,
      integrity: 'valid',
      purpose: packet.purpose,
      recipient: packet.recipient,
      consentAt: packet.consentAt,
      consentReceiptId: packet.consentReceiptId,
      consentGrantId: packet.consentGrantId ?? null,
      selectedSections: packet.selectedSections,
      // Derived from the sealed fields, never a stored parallel list.
      withheldFieldIds: withheldFieldIdsOf(packet),
      fields: packet.fields,
      // Read out of the seal, NOT recomputed. Recomputing here would resolve
      // absences against today's sources, so the same immutable packet could
      // show one reader "licensure — nothing found" and another nothing at all.
      sectionAbsences: packet.sectionAbsences ?? null,
      unexplainedSectionIds: unexplainedSectionIdsOf(packet),
      methodologyVersion: packet.methodologyVersion,
      clinicianNote: packet.clinicianNote,
      lifecycle: lifecycleOf(storedPacket),
    },
    legacyNotice: null,
  };
}

const AFFIRMATIVE_STATES = new Set<PacketEvidenceState>(['source_backed', 'checked']);

function fieldIsStale(field: SubmittedPacketField, now: Date): boolean {
  if (!field.freshUntil) return false;
  const deadline = new Date(field.freshUntil);
  return !Number.isNaN(deadline.getTime()) && deadline.getTime() < now.getTime();
}

/** Pure submitted/current comparison shared by the clinician and employer views. */
export function compareApplicationEvidence(
  submittedFields: readonly SubmittedPacketField[],
  currentFields: readonly SubmittedPacketField[],
  now = new Date(),
): ApplicationEvidenceChange[] {
  const submitted = new Map(submittedFields.map((field) => [field.fieldId, field]));
  const current = new Map(currentFields.map((field) => [field.fieldId, field]));
  const ids = [...new Set([...submitted.keys(), ...current.keys()])].sort();

  return ids.map((fieldId) => {
    const before = submitted.get(fieldId) ?? null;
    const after = current.get(fieldId) ?? null;
    let kind: ApplicationEvidenceChangeKind;

    if (!before) kind = 'added_after_submission';
    else if (!after) kind = 'removed_after_submission';
    else if (!fieldIsStale(before, now) && fieldIsStale(after, now)) kind = 'became_stale';
    else if (after.evidenceState === 'unavailable' && before.evidenceState !== 'unavailable') kind = 'became_unavailable';
    else if (!AFFIRMATIVE_STATES.has(before.evidenceState) && AFFIRMATIVE_STATES.has(after.evidenceState)) kind = 'resolved_after_submission';
    else if (
      before.value !== after.value
      || before.evidenceState !== after.evidenceState
      || before.sourceObservedAt !== after.sourceObservedAt
      || before.freshUntil !== after.freshUntil
    ) kind = 'changed_after_submission';
    else kind = 'unchanged';

    return { fieldId, label: after?.label ?? before?.label ?? fieldId, kind, submitted: before, current: after };
  });
}

/**
 * Authorized application evidence read model. The immutable packet remains the
 * authority for what was submitted; current source resolution is additive and
 * fail-soft so a connector outage never hides historical evidence.
 */
export async function readApplicationEvidenceView(
  input: ReadApplicationPacketInput,
): Promise<ApplicationEvidenceViewResponse> {
  const packet = await readApplicationPacket(input);
  const application = await prisma.application.findUnique({
    where: { id: input.applicationId },
    select: { npi: true },
  });
  const clinicianNpi = packet.submittedPacket?.clinicianNpi ?? application?.npi ?? null;
  // The current-evidence panel recomputes from LIVE trust state, so it must
  // apply the same disclosure the clinician consented to. Passing only the
  // sections would recompute withheld fields with their real values and show
  // the employer exactly what the clinician declined to share — the packet
  // would be honest and the panel beside it would leak.
  const disclosure: DisclosureSelection = {
    sections: packet.submittedPacket?.selectedSections
      ?? ['identity', 'exclusions', 'licensure', 'enrollment'],
    withheldFieldIds: packet.submittedPacket?.withheldFieldIds ?? [],
  };

  if (!clinicianNpi) {
    return {
      ...packet,
      currentEvidence: {
        status: 'unavailable',
        observedAt: null,
        methodologyVersion: null,
        fields: [],
        sectionAbsences: [],
        changesSinceSubmission: [],
        notice: CURRENT_EVIDENCE_NOTICES.noNpi,
      },
    };
  }

  try {
    const trustState = await computeClinicianTrustState(clinicianNpi);
    const fields = buildFieldEntriesFromTrustState(trustState, disclosure);
    return {
      ...packet,
      currentEvidence: {
        status: 'available',
        observedAt: trustState.computed_at,
        methodologyVersion: trustState.methodology_version,
        fields,
        sectionAbsences: buildSectionAbsencesFromTrustState(trustState, disclosure, fields),
        changesSinceSubmission: compareApplicationEvidence(packet.submittedPacket?.fields ?? [], fields),
        notice: packet.mode === 'legacy'
          ? CURRENT_EVIDENCE_NOTICES.legacy
          : CURRENT_EVIDENCE_NOTICES.sealed,
      },
    };
  } catch {
    return {
      ...packet,
      currentEvidence: {
        status: 'unavailable',
        observedAt: null,
        methodologyVersion: null,
        fields: [],
        sectionAbsences: [],
        changesSinceSubmission: [],
        notice: CURRENT_EVIDENCE_NOTICES.sourcesDown,
      },
    };
  }
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
