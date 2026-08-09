import { createHmac, randomBytes, randomUUID } from 'node:crypto';

import { Prisma, PrismaClient } from '@prisma/client';

import prisma from '../../graphql/prisma_client';
import { decideEmployerActionRbac } from '../authz/employerActionRbac';
import {
  createConsentGrantInTransaction,
  type ConsentGrantTransaction,
} from '../consent/consentGrantService';
import {
  issueHandoffReceipt,
  issueHandoffReceiptInTransaction,
  type HandoffReceiptTransaction,
} from '../handoffs/handoffReceiptService';
import {
  buildFieldEntriesFromTrustState,
  buildSectionAbsencesFromTrustState,
  sealPacket,
  type PacketFieldEntry,
  type PacketSectionAbsence,
} from '../opportunities/applicationPacketService';
import {
  resolveDisclosureSections,
  type ApplicationDisclosureSection,
} from '../opportunities/applicationDisclosure';
import { computeClinicianTrustState } from '../trust/trustStateEngine';
import { sha256ForPayload } from '../../utils/deterministic';
import { HttpError } from '../../utils/httpError';

const APPLY_INTENT_TYPE = 'apply_intent_v1';
const APPLY_INTENT_ACTION = 'apply_with_vitalcv';
const DEFAULT_TTL_SECONDS = 30 * 60;
const MIN_TTL_SECONDS = 5 * 60;
const MAX_TTL_SECONDS = 60 * 60;
const IDEMPOTENT_RESULT_TTL_MS = 24 * 60 * 60 * 1000;
const CALLBACK_TIMEOUT_MS = 12_000;
const NPI_RE = /^\d{10}$/;

export type ApplyIntentStatus = 'ready' | 'used' | 'expired';

export interface ApplyIntentPayload {
  version: '1';
  action: typeof APPLY_INTENT_ACTION;
  opportunityId: string;
  opportunityVersion: string;
  organizationId: string;
  organizationName: string;
  opportunityTitle: string;
  opportunitySpecialty: string;
  opportunityState: string;
  purpose: string;
  requestedSections: ApplicationDisclosureSection[];
  requestedCredentialTypes: string[];
  callbackUrl: string | null;
  returnUrl: string;
  state: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
  createdByClerkUserId: string;
}

export interface ApplyIntentView {
  requestUri: string;
  status: ApplyIntentStatus;
  opportunity: {
    id: string;
    version: string;
    title: string;
    specialty: string;
    state: string;
  };
  organization: {
    id: string;
    name: string;
  };
  purpose: string;
  requestedSections: ApplicationDisclosureSection[];
  requestedCredentialTypes: string[];
  callbackConfigured: boolean;
  returnUrl: string;
  issuedAt: string;
  expiresAt: string;
}

export interface ApplyIntentPreview extends ApplyIntentView {
  clinician: {
    npi: string;
  };
  fields: PacketFieldEntry[];
  /**
   * Requested sections that would produce no field. The clinician sees the
   * empty sections before consenting, in the same terms the employer will read
   * them after — a preview that showed only populated sections would let the
   * clinician consent to a disclosure they have not actually seen.
   */
  sectionAbsences: PacketSectionAbsence[];
  limitations: string[];
}

export interface CreateApplyIntentInput {
  opportunityId: string;
  creatorClerkUserId: string;
  purpose?: string;
  requestedSections?: unknown;
  requestedCredentialTypes?: unknown;
  callbackUrl?: string | null;
  returnUrl?: string | null;
  state?: string;
  expiresInSeconds?: number;
}

export interface SubmitApplyIntentInput {
  requestUri: string;
  clinicianClerkUserId: string;
  selectedSections: unknown;
  coverNote?: string | null;
  authenticationMethod: string;
  authenticationRef?: string | null;
}

export interface ApplyIntentSubmissionResult {
  applicationId: string;
  opportunityId: string;
  handoffId: string;
  consentGrantId: string;
  packet: {
    id: string;
    version: number;
    hash: string;
    selectedSections: string[];
    fieldCount: number;
  };
  handoffReceipt: {
    id: string;
    attemptNumber: number;
    status: string;
    receiptHash: string;
    issuedAt: string;
  };
  employerReceiptUrl: string;
  returnUrl: string;
  limitations: string[];
}

interface StoredIdempotentResult {
  actorClerkUserId: string;
  result: ApplyIntentSubmissionResult;
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function requireText(value: string | undefined | null, field: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new HttpError(400, `${field} is required.`);
  return normalized;
}

function normalizeTtl(value: number | undefined): number {
  if (value === undefined) return DEFAULT_TTL_SECONDS;
  if (!Number.isInteger(value) || value < MIN_TTL_SECONDS || value > MAX_TTL_SECONDS) {
    throw new HttpError(400, `expiresInSeconds must be between ${MIN_TTL_SECONDS} and ${MAX_TTL_SECONDS}.`);
  }
  return value;
}

function normalizeCredentialTypes(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new HttpError(400, 'requestedCredentialTypes must be a list of strings.');
  }
  const normalized = [...new Set(value.map((entry) => entry.trim()).filter(Boolean))];
  if (normalized.length > 32 || normalized.some((entry) => entry.length > 100)) {
    throw new HttpError(400, 'requestedCredentialTypes exceeds the supported limit.');
  }
  return normalized.sort();
}

function allowedOrigins(): Set<string> {
  const configured = (process.env.APPLY_INTENT_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      try {
        return new URL(value).origin;
      } catch {
        return '';
      }
    })
    .filter(Boolean);
  const origins = new Set<string>(['https://vitalcv.com', ...configured]);
  if (process.env.NODE_ENV !== 'production') {
    origins.add('http://localhost:3000');
    origins.add('http://127.0.0.1:3000');
  }
  return origins;
}

function normalizeAllowedUrl(
  raw: string | null | undefined,
  field: string,
  fallback: string | null,
): string | null {
  const value = raw?.trim() || fallback;
  if (!value) return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new HttpError(400, `${field} must be an absolute URL.`);
  }
  if (!['https:', 'http:'].includes(parsed.protocol) || !allowedOrigins().has(parsed.origin)) {
    throw new HttpError(400, `${field} origin is not allowlisted.`);
  }
  parsed.username = '';
  parsed.password = '';
  parsed.hash = '';
  return parsed.toString();
}

function parsePayload(value: unknown): ApplyIntentPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(409, 'Apply Intent is malformed.');
  }
  const payload = value as Record<string, unknown>;
  const requestedSections = resolveDisclosureSections(payload.requestedSections);
  const requestedCredentialTypes = normalizeCredentialTypes(payload.requestedCredentialTypes);
  if (
    payload.version !== '1'
    || payload.action !== APPLY_INTENT_ACTION
    || typeof payload.opportunityId !== 'string'
    || typeof payload.opportunityVersion !== 'string'
    || typeof payload.organizationId !== 'string'
    || typeof payload.organizationName !== 'string'
    || typeof payload.opportunityTitle !== 'string'
    || typeof payload.opportunitySpecialty !== 'string'
    || typeof payload.opportunityState !== 'string'
    || typeof payload.purpose !== 'string'
    || (payload.callbackUrl !== null && typeof payload.callbackUrl !== 'string')
    || typeof payload.returnUrl !== 'string'
    || typeof payload.state !== 'string'
    || typeof payload.nonce !== 'string'
    || typeof payload.issuedAt !== 'string'
    || typeof payload.expiresAt !== 'string'
    || typeof payload.createdByClerkUserId !== 'string'
  ) {
    throw new HttpError(409, 'Apply Intent is malformed.');
  }
  return {
    version: '1',
    action: APPLY_INTENT_ACTION,
    opportunityId: payload.opportunityId,
    opportunityVersion: payload.opportunityVersion,
    organizationId: payload.organizationId,
    organizationName: payload.organizationName,
    opportunityTitle: payload.opportunityTitle,
    opportunitySpecialty: payload.opportunitySpecialty,
    opportunityState: payload.opportunityState,
    purpose: payload.purpose,
    requestedSections,
    requestedCredentialTypes,
    callbackUrl: payload.callbackUrl as string | null,
    returnUrl: payload.returnUrl,
    state: payload.state,
    nonce: payload.nonce,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
    createdByClerkUserId: payload.createdByClerkUserId,
  };
}

function statusOf(row: { used: boolean; expiresAt: Date }, now = new Date()): ApplyIntentStatus {
  if (row.used) return 'used';
  if (row.expiresAt.getTime() <= now.getTime()) return 'expired';
  return 'ready';
}

function toView(requestUri: string, row: { used: boolean; expiresAt: Date }, payload: ApplyIntentPayload): ApplyIntentView {
  return {
    requestUri,
    status: statusOf(row),
    opportunity: {
      id: payload.opportunityId,
      version: payload.opportunityVersion,
      title: payload.opportunityTitle,
      specialty: payload.opportunitySpecialty,
      state: payload.opportunityState,
    },
    organization: {
      id: payload.organizationId,
      name: payload.organizationName,
    },
    purpose: payload.purpose,
    requestedSections: [...payload.requestedSections],
    requestedCredentialTypes: [...payload.requestedCredentialTypes],
    callbackConfigured: Boolean(payload.callbackUrl),
    returnUrl: payload.returnUrl,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
  };
}

function notFound(): HttpError {
  return new HttpError(404, 'Apply Intent not found.');
}

function idempotencyKey(requestUri: string, actor: string): string {
  return `apply-intent:${requestUri}:${actor}`;
}

function parseStoredResult(value: unknown, actor: string): ApplyIntentSubmissionResult | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const stored = value as Partial<StoredIdempotentResult>;
  if (stored.actorClerkUserId !== actor || !stored.result) return null;
  return stored.result;
}

function selectedWithinRequested(
  selected: readonly ApplicationDisclosureSection[],
  requested: readonly ApplicationDisclosureSection[],
): boolean {
  const allowed = new Set(requested);
  return selected.every((section) => allowed.has(section));
}

function limitationsForFields(
  requestedSections: readonly ApplicationDisclosureSection[],
  fields: readonly PacketFieldEntry[],
): string[] {
  const limitations: string[] = [];
  const fieldSections = new Set(fields.map((field) => field.sectionId));
  for (const section of requestedSections) {
    if (!fieldSections.has(section)) limitations.push(`No current ${section} evidence was available for this packet.`);
  }
  if (fields.some((field) => field.evidenceState === 'access_required')) {
    limitations.push('Some requested evidence requires source access or employer review.');
  }
  if (fields.some((field) => field.evidenceState === 'unavailable')) {
    limitations.push('Some requested evidence was unavailable at submission time.');
  }
  return [...new Set(limitations)];
}

async function loadIntentRow(requestUri: string, client: PrismaClient = prisma) {
  const row = await client.parRequest.findUnique({ where: { requestUri } });
  if (!row || row.requestType !== APPLY_INTENT_TYPE) throw notFound();
  return { row, payload: parsePayload(row.requestJson) };
}

export async function createApplyIntent(
  input: CreateApplyIntentInput,
  client: PrismaClient = prisma,
): Promise<ApplyIntentView> {
  const creatorClerkUserId = requireText(input.creatorClerkUserId, 'creatorClerkUserId');
  const actor = await client.user.findUnique({ where: { clerkUserId: creatorClerkUserId } });
  const decision = decideEmployerActionRbac(actor);
  if (!decision.allowed || !actor?.organizationId) {
    throw new HttpError(404, 'Opportunity not found.');
  }

  const opportunity = await client.opportunity.findUnique({
    where: { id: requireText(input.opportunityId, 'opportunityId') },
    include: { organization: { select: { id: true, name: true } } },
  });
  if (!opportunity || opportunity.organizationId !== actor.organizationId || opportunity.status !== 'ACTIVE') {
    throw new HttpError(404, 'Opportunity not found.');
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + normalizeTtl(input.expiresInSeconds) * 1000);
  const requestedSections = resolveDisclosureSections(input.requestedSections);
  const requestedCredentialTypes = normalizeCredentialTypes(input.requestedCredentialTypes);
  const callbackUrl = normalizeAllowedUrl(input.callbackUrl, 'callbackUrl', null);
  const returnUrl = normalizeAllowedUrl(
    input.returnUrl,
    'returnUrl',
    `https://vitalcv.com/employer/opportunities/${opportunity.id}`,
  ) as string;
  const requestUri = `vai_${randomBytes(24).toString('base64url')}`;
  const payload: ApplyIntentPayload = {
    version: '1',
    action: APPLY_INTENT_ACTION,
    opportunityId: opportunity.id,
    opportunityVersion: opportunity.updatedAt.toISOString(),
    organizationId: opportunity.organizationId,
    organizationName: opportunity.organization.name,
    opportunityTitle: opportunity.title,
    opportunitySpecialty: opportunity.specialty,
    opportunityState: opportunity.state,
    purpose: input.purpose?.trim() || 'employment application',
    requestedSections,
    requestedCredentialTypes,
    callbackUrl,
    returnUrl,
    state: input.state?.trim() || randomBytes(18).toString('base64url'),
    nonce: randomBytes(24).toString('base64url'),
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    createdByClerkUserId: creatorClerkUserId,
  };
  const payloadHash = sha256ForPayload(payload);

  await client.$transaction(async (tx) => {
    await tx.auditEvent.create({
      data: {
        type: 'apply_intent_created',
        hash: payloadHash,
        referenceId: requestUri,
        clinicianId: creatorClerkUserId,
        organizationId: opportunity.organizationId,
        metadata: asJson({
          entity_type: 'apply_intent',
          request_uri: requestUri,
          opportunity_id: opportunity.id,
          opportunity_version: payload.opportunityVersion,
          requested_sections: requestedSections,
          requested_credential_types: requestedCredentialTypes,
          callback_configured: Boolean(callbackUrl),
          expires_at: payload.expiresAt,
        }),
      },
    });
    await tx.parRequest.create({
      data: {
        requestUri,
        requestType: APPLY_INTENT_TYPE,
        requestJson: asJson(payload),
        clientId: opportunity.organizationId,
        redirectUri: callbackUrl,
        scope: requestedSections.join(' '),
        expiresAt,
      },
    });
  });

  return toView(requestUri, { used: false, expiresAt }, payload);
}

export async function readApplyIntent(
  requestUri: string,
  client: PrismaClient = prisma,
): Promise<ApplyIntentView> {
  const normalized = requireText(requestUri, 'requestUri');
  const { row, payload } = await loadIntentRow(normalized, client);
  return toView(normalized, row, payload);
}

export async function previewApplyIntent(
  requestUri: string,
  clinicianClerkUserId: string,
  client: PrismaClient = prisma,
): Promise<ApplyIntentPreview> {
  const { row, payload } = await loadIntentRow(requireText(requestUri, 'requestUri'), client);
  if (statusOf(row) !== 'ready') throw new HttpError(409, 'Apply Intent is no longer available.');
  const user = await client.user.findUnique({ where: { clerkUserId: clinicianClerkUserId } });
  const profile = user ? await client.personProfile.findUnique({ where: { userId: user.id } }) : null;
  const npi = profile?.npi?.trim();
  if (!npi || !NPI_RE.test(npi)) {
    throw new HttpError(409, 'Complete clinician onboarding before applying with VitalCV.');
  }
  const trustState = await computeClinicianTrustState(npi);
  const fields = buildFieldEntriesFromTrustState(trustState, payload.requestedSections);
  return {
    ...toView(requestUri, row, payload),
    clinician: { npi },
    fields,
    sectionAbsences: buildSectionAbsencesFromTrustState(trustState, payload.requestedSections, fields),
    limitations: limitationsForFields(payload.requestedSections, fields),
  };
}

function packetPersistenceData(input: {
  packetId: string;
  sealed: ReturnType<typeof sealPacket>;
}): Prisma.ApplicationPacketUncheckedCreateInput {
  const { packetId, sealed } = input;
  return {
    id: packetId,
    applicationId: sealed.applicationId,
    packetVersion: sealed.packetVersion,
    clerkUserId: sealed.clerkUserId,
    clinicianNpi: sealed.clinicianNpi,
    opportunityId: sealed.opportunityId,
    employerOrgId: sealed.employerOrgId,
    purpose: sealed.purpose,
    recipient: sealed.recipient,
    selectedSections: asJson(sealed.selectedSections),
    fields: asJson(sealed.fields),
    sectionAbsences: asJson(sealed.sectionAbsences ?? []),
    clinicianNote: sealed.clinicianNote,
    methodologyVersion: sealed.methodologyVersion,
    consentAt: new Date(sealed.consentAt),
    consentReceiptId: sealed.consentReceiptId,
    consentGrantId: sealed.consentGrantId ?? null,
    opportunityVersion: sealed.opportunityVersion ?? null,
    packetHash: sealed.packetHash,
  };
}

async function deliverCallback(
  payload: ApplyIntentPayload,
  result: ApplyIntentSubmissionResult,
): Promise<void> {
  if (!payload.callbackUrl) return;
  const secret = process.env.APPLY_HANDOFF_WEBHOOK_SECRET?.trim();
  if (!secret) return;

  const callbackPayload = {
    version: '1',
    event: 'application.packet.handoff',
    application_id: result.applicationId,
    opportunity_id: result.opportunityId,
    handoff_id: result.handoffId,
    consent_grant_id: result.consentGrantId,
    packet: {
      id: result.packet.id,
      version: result.packet.version,
      hash: result.packet.hash,
    },
    employer_receipt_url: result.employerReceiptUrl,
    limitations: result.limitations,
  };
  const body = JSON.stringify(callbackPayload);
  const signature = createHmac('sha256', secret).update(body).digest('hex');
  let status: 'delivered' | 'failed' = 'failed';
  let deliveredAt: Date | null = null;
  let providerMessageId: string | null = null;
  let limitation: string | null = null;

  try {
    const response = await fetch(payload.callbackUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-vitalcv-event': 'application.packet.handoff',
        'x-vitalcv-signature': `sha256=${signature}`,
        'x-vitalcv-handoff-id': result.handoffId,
      },
      body,
      redirect: 'error',
      signal: AbortSignal.timeout(CALLBACK_TIMEOUT_MS),
    });
    providerMessageId = response.headers.get('x-request-id') ?? response.headers.get('x-correlation-id');
    if (response.ok) {
      status = 'delivered';
      deliveredAt = new Date();
    } else {
      limitation = `ATS callback returned HTTP ${response.status}; employer portal receipt remains available.`;
    }
  } catch {
    limitation = 'ATS callback could not be delivered; employer portal receipt remains available.';
  }

  await issueHandoffReceipt({
    handoffId: result.handoffId,
    attemptNumber: 2,
    applicationId: result.applicationId,
    consentGrantId: result.consentGrantId,
    packetId: result.packet.id,
    packetHash: result.packet.hash,
    payloadHash: sha256ForPayload(callbackPayload),
    recipientOrganizationId: payload.organizationId,
    recipient: payload.organizationName,
    purpose: payload.purpose,
    channel: 'webhook',
    transportProvider: 'ats_callback',
    providerMessageId,
    status,
    limitation,
    deliveredAt,
    clinicianId: null,
    metadata: { callback_origin: new URL(payload.callbackUrl).origin },
  });
}

export async function submitApplyIntent(
  input: SubmitApplyIntentInput,
  client: PrismaClient = prisma,
): Promise<ApplyIntentSubmissionResult> {
  const requestUri = requireText(input.requestUri, 'requestUri');
  const clinicianClerkUserId = requireText(input.clinicianClerkUserId, 'clinicianClerkUserId');
  const responseKey = idempotencyKey(requestUri, clinicianClerkUserId);
  const existingResponse = await client.idempotentResponse.findUnique({ where: { key: responseKey } });
  const replay = existingResponse ? parseStoredResult(existingResponse.payload, clinicianClerkUserId) : null;
  if (replay) return replay;

  const { row: intentRow, payload } = await loadIntentRow(requestUri, client);
  if (statusOf(intentRow) !== 'ready') throw new HttpError(409, 'Apply Intent is no longer available.');

  const user = await client.user.findUnique({ where: { clerkUserId: clinicianClerkUserId } });
  const profile = user ? await client.personProfile.findUnique({ where: { userId: user.id } }) : null;
  const npi = profile?.npi?.trim();
  if (!user || !npi || !NPI_RE.test(npi)) {
    throw new HttpError(409, 'Complete clinician onboarding before applying with VitalCV.');
  }

  const opportunity = await client.opportunity.findUnique({
    where: { id: payload.opportunityId },
    include: { organization: { select: { name: true } } },
  });
  if (
    !opportunity
    || opportunity.status !== 'ACTIVE'
    || opportunity.organizationId !== payload.organizationId
    || opportunity.updatedAt.toISOString() !== payload.opportunityVersion
  ) {
    throw new HttpError(409, 'The opportunity changed after this Apply Intent was issued. Request a new link.');
  }

  const selectedSections = resolveDisclosureSections(input.selectedSections);
  if (!selectedWithinRequested(selectedSections, payload.requestedSections)) {
    throw new HttpError(400, 'The disclosure selection exceeds the employer-requested scope.');
  }
  const authenticationMethod = requireText(input.authenticationMethod, 'authenticationMethod');
  const trustState = await computeClinicianTrustState(npi);
  const fields = buildFieldEntriesFromTrustState(trustState, selectedSections);
  if (fields.length === 0) {
    throw new HttpError(409, 'No evidence is available in the selected disclosure scope.');
  }
  // Selected sections that produced nothing. `limitations` below says the same
  // thing in prose, but it lives on the RESPONSE — outside the seal, gone the
  // moment the response is discarded. This is the sealed record.
  const sectionAbsences = buildSectionAbsencesFromTrustState(trustState, selectedSections, fields);
  const limitations = limitationsForFields(selectedSections, fields);
  const consentAt = new Date();

  const result = await client.$transaction(async (tx): Promise<ApplyIntentSubmissionResult> => {
    const replayRow = await tx.idempotentResponse.findUnique({ where: { key: responseKey } });
    const concurrentReplay = replayRow ? parseStoredResult(replayRow.payload, clinicianClerkUserId) : null;
    if (concurrentReplay) return concurrentReplay;

    const claim = await tx.parRequest.updateMany({
      where: {
        requestUri,
        requestType: APPLY_INTENT_TYPE,
        used: false,
        expiresAt: { gt: consentAt },
      },
      data: { used: true },
    });
    if (claim.count !== 1) throw new HttpError(409, 'Apply Intent is no longer available.');

    const current = await tx.application.findUnique({
      where: {
        opportunityId_clerkUserId: {
          opportunityId: payload.opportunityId,
          clerkUserId: clinicianClerkUserId,
        },
      },
    });
    if (current && (current.status === 'ACCEPTED' || current.status === 'DECLINED')) {
      throw new HttpError(409, 'This application already has a final employer decision.');
    }

    const applicationId = current?.id ?? randomUUID();
    const latestPacket = current
      ? await tx.applicationPacket.findFirst({
          where: { applicationId },
          orderBy: { packetVersion: 'desc' },
          select: { id: true, packetVersion: true },
        })
      : null;
    const packetVersion = (latestPacket?.packetVersion ?? 0) + 1;
    const packetId = randomUUID();
    const consentGrantId = randomUUID();
    const consentAuditEventId = randomUUID();
    const handoffId = randomUUID();

    const sealed = sealPacket({
      applicationId,
      packetVersion,
      clerkUserId: clinicianClerkUserId,
      clinicianNpi: npi,
      opportunityId: payload.opportunityId,
      employerOrgId: payload.organizationId,
      purpose: payload.purpose,
      recipient: payload.organizationName,
      selectedSections: [...selectedSections].sort(),
      fields,
      // Always set, including `[]` — see ApplicationPacketContent.sectionAbsences.
      sectionAbsences,
      clinicianNote: input.coverNote?.trim() || null,
      methodologyVersion: trustState.methodology_version,
      consentAt: consentAt.toISOString(),
      consentReceiptId: consentAuditEventId,
      consentGrantId,
      opportunityVersion: payload.opportunityVersion,
    });

    const consentGrant = await createConsentGrantInTransaction(
      tx as unknown as ConsentGrantTransaction,
      {
        grantId: consentGrantId,
        auditEventId: consentAuditEventId,
        clinicianUserId: clinicianClerkUserId,
        clinicianNpi: npi,
        organizationId: payload.organizationId,
        recipient: payload.organizationName,
        purpose: payload.purpose,
        action: APPLY_INTENT_ACTION,
        scope: {
          requestUri,
          opportunityId: payload.opportunityId,
          opportunityVersion: payload.opportunityVersion,
          sections: selectedSections,
          fieldIds: fields.map((field) => field.fieldId),
          requestedCredentialTypes: payload.requestedCredentialTypes,
        },
        packetId,
        packetHash: sealed.packetHash,
        applicationId,
        authenticationMethod,
        authenticationRef: input.authenticationRef ?? null,
        grantedAt: consentAt,
        metadata: { apply_intent_request_uri: requestUri },
      },
    );

    if (current) {
      await tx.application.update({
        where: { id: applicationId },
        data: {
          status: 'PENDING',
          npi,
          coverNote: input.coverNote?.trim() || current.coverNote,
        },
      });
    } else {
      await tx.application.create({
        data: {
          id: applicationId,
          opportunityId: payload.opportunityId,
          clerkUserId: clinicianClerkUserId,
          npi,
          coverNote: input.coverNote?.trim() || null,
          status: 'PENDING',
        },
      });
    }

    await tx.applicationPacket.create({ data: packetPersistenceData({ packetId, sealed }) });
    if (latestPacket) {
      await tx.applicationPacket.update({
        where: { id: latestPacket.id },
        data: { supersededByPacketId: packetId },
      });
    }
    await tx.application.update({
      where: { id: applicationId },
      data: { sealedPacketVersion: packetVersion },
    });

    await tx.auditEvent.create({
      data: {
        type: 'application_packet_sealed',
        hash: sealed.packetHash,
        referenceId: applicationId,
        clinicianId: clinicianClerkUserId,
        organizationId: payload.organizationId,
        metadata: asJson({
          entity_type: 'application_packet',
          packet_id: packetId,
          packet_version: packetVersion,
          packet_hash: sealed.packetHash,
          consent_grant_id: consentGrant.id,
          consent_receipt_id: consentAuditEventId,
          apply_intent_request_uri: requestUri,
          field_count: fields.length,
        }),
      },
    });

    const employerReceiptUrl = `https://vitalcv.com/employer/applications/${applicationId}`;
    const portalPayload = {
      version: '1',
      applicationId,
      opportunityId: payload.opportunityId,
      handoffId,
      consentGrantId,
      packetId,
      packetVersion,
      packetHash: sealed.packetHash,
      employerReceiptUrl,
      limitations,
    };
    const receipt = await issueHandoffReceiptInTransaction(
      tx as unknown as HandoffReceiptTransaction,
      {
        handoffId,
        attemptNumber: 1,
        applicationId,
        consentGrantId,
        packetId,
        packetHash: sealed.packetHash,
        payloadHash: sha256ForPayload(portalPayload),
        recipientOrganizationId: payload.organizationId,
        recipient: payload.organizationName,
        purpose: payload.purpose,
        channel: 'portal',
        transportProvider: 'vitalcv_employer_portal',
        status: 'logged_only',
        limitation: payload.callbackUrl
          ? 'Employer portal receipt created; ATS callback delivery is recorded as a separate immutable attempt.'
          : 'Employer portal receipt created; no ATS callback was configured.',
        issuedAt: consentAt,
        clinicianId: clinicianClerkUserId,
        metadata: { apply_intent_request_uri: requestUri },
      },
    );

    await tx.auditEvent.create({
      data: {
        type: 'application_submitted',
        hash: sealed.packetHash,
        referenceId: applicationId,
        clinicianId: clinicianClerkUserId,
        organizationId: payload.organizationId,
        metadata: asJson({
          entity_type: 'application',
          action: 'submitted_from_apply_intent',
          request_uri: requestUri,
          packet_id: packetId,
          packet_version: packetVersion,
          packet_hash: sealed.packetHash,
          consent_grant_id: consentGrantId,
          handoff_id: handoffId,
        }),
      },
    });

    const submissionResult: ApplyIntentSubmissionResult = {
      applicationId,
      opportunityId: payload.opportunityId,
      handoffId,
      consentGrantId,
      packet: {
        id: packetId,
        version: packetVersion,
        hash: sealed.packetHash,
        selectedSections: sealed.selectedSections,
        fieldCount: fields.length,
      },
      handoffReceipt: {
        id: receipt.id,
        attemptNumber: receipt.attemptNumber,
        status: receipt.status,
        receiptHash: receipt.receiptHash,
        issuedAt: receipt.issuedAt.toISOString(),
      },
      employerReceiptUrl,
      returnUrl: payload.returnUrl,
      limitations,
    };

    await tx.idempotentResponse.create({
      data: {
        key: responseKey,
        auditRef: consentGrant.auditEventId,
        payload: asJson({ actorClerkUserId: clinicianClerkUserId, result: submissionResult }),
        expiresAt: new Date(consentAt.getTime() + IDEMPOTENT_RESULT_TTL_MS),
      },
    });

    return submissionResult;
  });

  void deliverCallback(payload, result).catch(() => {
    // The callback attempt records its own failure receipt. A provider outage must
    // never turn an already-committed application into a false transaction failure.
  });
  return result;
}
