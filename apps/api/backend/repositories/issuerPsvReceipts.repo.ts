/**
 * ISSUER-10 — contract-aligned PSV receipt + issuer audit-event repository.
 *
 * This is the writer the ISSUER-9 defer memo said had to exist before backend
 * persistence could be turned on. It is deliberately NOT
 * `psvReceipts.repo.ts`: that repository stores the legacy PsvReceiptSnapshot
 * shape and drops limitations, source basis, responder attribution, scope and
 * freshness on the floor. Persisting there was never persistence under the
 * truth contract.
 *
 * Contract this repository upholds:
 *   - Every ISSUER-4 field round-trips VERBATIM. A dropped or rewritten field
 *     is a structural failure that throws, never a silent partial write.
 *   - The truth-tier literals are written by this module, never accepted from
 *     a caller: proofTier='psv_receipt', decisionGrade=true,
 *     globalCredentialTruth=false. The input type does not carry them.
 *   - A write returns a confirmation only after the row is read back and
 *     verified. "The insert did not throw" is not confirmation.
 *   - Idempotent by `idempotencyKey`: a retried write returns the SAME row
 *     with `alreadyPersisted: true` rather than a second row or a crash.
 *   - Timestamps are stored as supplied by the caller (`promotedAt`,
 *     `freshness.issuedAt`, `freshness.staleAfter`) — this module never
 *     substitutes its own clock for a source-observed time. See
 *     [[builtat_was_the_request_clock]]: `createdAt` is the row's write time
 *     and answers a different question from `promotedAt`.
 */

import prisma from '../src/graphql/prisma_client';

// ---------------------------------------------------------------------------
// Contract shapes (structural mirrors of apps/web/lib/issuer-verification/types.ts).
//
// Duplicated rather than imported: apps/web is a separate package and the
// backend must not depend on the Next.js app. The round-trip tests are what
// keep the two in step — if the web contract gains a field, the verbatim
// comparison here fails loudly rather than dropping it.
// ---------------------------------------------------------------------------

export interface PolicyReviewActorRecord {
  actorId: string;
  displayName: string;
  role: 'policy_reviewer' | 'credentialing_committee' | 'compliance_officer' | 'demo';
}

export interface SourceBasisRecord {
  sourceOrganizationName: string;
  isContractedAgent: boolean;
  agentName?: string;
  agentActsFor?: string;
  basisNote?: string;
}

export interface AttributedResponderRecord {
  name: string;
  role?: string;
  contact?: string;
  attributedAt: string;
  attributionMethod: 'self_attested' | 'directory_match' | 'partner_assertion' | 'unknown';
}

export interface PsvReceiptScopeRecord {
  claimType: string;
  covers: string;
  doesNotCover: string;
  sourceOrganizationName: string;
}

export interface PsvReceiptLimitationRecord {
  kind:
    | 'legally_only'
    | 'partial_confirmation'
    | 'contracted_agent'
    | 'access_required'
    | 'jurisdictional_scope'
    | 'other';
  description: string;
}

export interface FreshnessPolicyRecord {
  ttlDays: number;
  issuedAt: string;
  staleAfter: string;
}

/**
 * Write input. The truth-tier literals are ABSENT by design — a caller cannot
 * ask for a different tier because there is no field to ask with.
 */
export interface IssuerPsvReceiptWriteInput {
  psvReceiptId: string;
  psvCandidateId: string;
  receiptCandidateId: string;
  requestId: string;
  claimId: string;
  claimType: string;
  promotedAt: string;
  promotedBy: PolicyReviewActorRecord;
  sourceBasis: SourceBasisRecord;
  attributedResponder: AttributedResponderRecord;
  scope: PsvReceiptScopeRecord;
  limitations: PsvReceiptLimitationRecord[];
  freshness: FreshnessPolicyRecord;
  correlationId: string;
  recordedBy?: 'demo' | 'review_surface' | 'system';
  idempotencyKey?: string;
  notes?: string;
}

export interface IssuerPsvReceiptWriteConfirmation {
  confirmedAt: string;
  confirmedBy: string;
  writerMode: 'repository';
  persistedRowId: string;
  /** True when an existing row matched the idempotency key. */
  alreadyPersisted: boolean;
}

export class IssuerPsvReceiptContractError extends Error {
  readonly field: string;

  constructor(field: string, detail: string) {
    super(`IssuerPsvReceipt contract violation on "${field}": ${detail}`);
    this.name = 'IssuerPsvReceiptContractError';
    this.field = field;
  }
}

const REQUIRED_TOP_LEVEL: Array<keyof IssuerPsvReceiptWriteInput> = [
  'psvReceiptId',
  'psvCandidateId',
  'receiptCandidateId',
  'requestId',
  'claimId',
  'claimType',
  'promotedAt',
  'promotedBy',
  'sourceBasis',
  'attributedResponder',
  'scope',
  'limitations',
  'freshness',
  'correlationId',
];

/**
 * Structural validation. Every check here maps to a blocker the ISSUER-9 memo
 * recorded — this is the code that makes those blockers un-reoccurrable.
 */
export function assertWritableIssuerPsvReceipt(input: IssuerPsvReceiptWriteInput): void {
  for (const field of REQUIRED_TOP_LEVEL) {
    if (input[field] === undefined || input[field] === null) {
      throw new IssuerPsvReceiptContractError(String(field), 'required field is missing');
    }
  }

  // A caller must not be able to smuggle a truth-tier field through a JS
  // callsite that TypeScript did not check.
  for (const forbidden of ['proofTier', 'decisionGrade', 'globalCredentialTruth']) {
    if (Object.prototype.hasOwnProperty.call(input, forbidden)) {
      throw new IssuerPsvReceiptContractError(
        forbidden,
        'truth-tier fields are written by the repository, never supplied by a caller',
      );
    }
  }

  if (!Array.isArray(input.limitations)) {
    throw new IssuerPsvReceiptContractError('limitations', 'must be an array (may be empty)');
  }

  // The contracted-agent distinction is the whole reason sourceBasis is an
  // object rather than a string. An agent with no named principal collapses it.
  if (input.sourceBasis.isContractedAgent) {
    if (!input.sourceBasis.agentName || !input.sourceBasis.agentActsFor) {
      throw new IssuerPsvReceiptContractError(
        'sourceBasis',
        'a contracted-agent basis requires both agentName and agentActsFor',
      );
    }
  }

  if (!input.attributedResponder.attributionMethod) {
    throw new IssuerPsvReceiptContractError(
      'attributedResponder.attributionMethod',
      'attribution quality is load-bearing; a responder name alone is not attribution',
    );
  }

  if (!input.scope.covers || !input.scope.doesNotCover) {
    throw new IssuerPsvReceiptContractError(
      'scope',
      'both covers and doesNotCover are required — an unbounded receipt is not scoped evidence',
    );
  }

  if (
    typeof input.freshness.ttlDays !== 'number' ||
    !input.freshness.issuedAt ||
    !input.freshness.staleAfter
  ) {
    throw new IssuerPsvReceiptContractError(
      'freshness',
      'ttlDays, issuedAt and staleAfter are all required',
    );
  }
}

/**
 * Canonical form for the JSONB round-trip assertions.
 *
 * Postgres `jsonb` does not preserve object key order — it stores keys sorted
 * by length then bytewise — so a naive JSON.stringify comparison reports a
 * mismatch on every write even when nothing changed. Object keys are sorted
 * here so the comparison tests CONTENT.
 *
 * ARRAY order is deliberately left alone: `limitations` is an ordered list and
 * a reordering is a real change, not a formatting difference.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return entries.map(([k, v]) => [k, canonicalize(v)]);
  }
  return value;
}

/** Deep structural equality, insensitive to JSONB key reordering. */
function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonicalize(a)) === JSON.stringify(canonicalize(b));
}

/**
 * Read the row back and prove every contract field survived the write. This is
 * what makes the returned confirmation mean something: a write that silently
 * dropped `limitations` fails HERE rather than being reported as persisted.
 */
function assertRoundTrip(
  input: IssuerPsvReceiptWriteInput,
  row: {
    psvReceiptId: string;
    psvCandidateId: string;
    receiptCandidateId: string;
    requestId: string;
    claimId: string;
    claimType: string;
    promotedAt: Date;
    promotedBy: unknown;
    sourceBasis: unknown;
    attributedResponder: unknown;
    scope: unknown;
    limitations: unknown;
    freshness: unknown;
    proofTier: string;
    decisionGrade: boolean;
    globalCredentialTruth: boolean;
    correlationId: string;
  },
): void {
  const scalarChecks: Array<[string, unknown, unknown]> = [
    ['psvReceiptId', row.psvReceiptId, input.psvReceiptId],
    ['psvCandidateId', row.psvCandidateId, input.psvCandidateId],
    ['receiptCandidateId', row.receiptCandidateId, input.receiptCandidateId],
    ['requestId', row.requestId, input.requestId],
    ['claimId', row.claimId, input.claimId],
    ['claimType', row.claimType, input.claimType],
    ['correlationId', row.correlationId, input.correlationId],
  ];
  for (const [field, stored, supplied] of scalarChecks) {
    if (stored !== supplied) {
      throw new IssuerPsvReceiptContractError(
        field,
        `round-trip mismatch: stored ${JSON.stringify(stored)}, supplied ${JSON.stringify(supplied)}`,
      );
    }
  }

  if (row.promotedAt.toISOString() !== new Date(input.promotedAt).toISOString()) {
    throw new IssuerPsvReceiptContractError(
      'promotedAt',
      `round-trip mismatch: stored ${row.promotedAt.toISOString()}, supplied ${input.promotedAt}`,
    );
  }

  const jsonChecks: Array<[string, unknown, unknown]> = [
    ['promotedBy', row.promotedBy, input.promotedBy],
    ['sourceBasis', row.sourceBasis, input.sourceBasis],
    ['attributedResponder', row.attributedResponder, input.attributedResponder],
    ['scope', row.scope, input.scope],
    ['limitations', row.limitations, input.limitations],
    ['freshness', row.freshness, input.freshness],
  ];
  for (const [field, stored, supplied] of jsonChecks) {
    if (!sameJson(stored, supplied)) {
      throw new IssuerPsvReceiptContractError(
        field,
        `round-trip mismatch: stored ${JSON.stringify(stored)}, supplied ${JSON.stringify(supplied)}`,
      );
    }
  }

  // Defense-in-depth against a schema default being changed out from under us.
  if (row.proofTier !== 'psv_receipt') {
    throw new IssuerPsvReceiptContractError('proofTier', `stored ${row.proofTier}, expected psv_receipt`);
  }
  if (row.decisionGrade !== true) {
    throw new IssuerPsvReceiptContractError('decisionGrade', 'stored value is not the literal true');
  }
  if (row.globalCredentialTruth !== false) {
    throw new IssuerPsvReceiptContractError(
      'globalCredentialTruth',
      'stored value is not the literal false — a receipt may never assert global credential truth',
    );
  }
}

/**
 * Persist a promoted PSV receipt and confirm it. Throws
 * `IssuerPsvReceiptContractError` on any contract failure; the caller must NOT
 * report persistence when this throws.
 */
export async function writeIssuerPsvReceipt(
  input: IssuerPsvReceiptWriteInput,
  options: { confirmedBy: string; nowIso: string },
): Promise<IssuerPsvReceiptWriteConfirmation> {
  assertWritableIssuerPsvReceipt(input);

  if (input.idempotencyKey) {
    const existing = await prisma.issuerPsvReceipt.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      assertRoundTrip(input, existing as never);
      return {
        confirmedAt: options.nowIso,
        confirmedBy: options.confirmedBy,
        writerMode: 'repository',
        persistedRowId: existing.id,
        alreadyPersisted: true,
      };
    }
  }

  const created = await prisma.issuerPsvReceipt.create({
    data: {
      psvReceiptId: input.psvReceiptId,
      psvCandidateId: input.psvCandidateId,
      receiptCandidateId: input.receiptCandidateId,
      requestId: input.requestId,
      claimId: input.claimId,
      claimType: input.claimType,
      promotedAt: new Date(input.promotedAt),
      promotedBy: input.promotedBy as never,
      sourceBasis: input.sourceBasis as never,
      attributedResponder: input.attributedResponder as never,
      scope: input.scope as never,
      limitations: input.limitations as never,
      freshness: input.freshness as never,
      // Written here, never accepted from the caller.
      proofTier: 'psv_receipt',
      decisionGrade: true,
      globalCredentialTruth: false,
      recordedBy: input.recordedBy ?? 'system',
      correlationId: input.correlationId,
      idempotencyKey: input.idempotencyKey ?? null,
      notes: input.notes ?? null,
    },
  });

  // Read back through a fresh query rather than trusting the create() return
  // value, so the confirmation reflects what the DATABASE holds.
  const persisted = await prisma.issuerPsvReceipt.findUnique({
    where: { id: created.id },
  });
  if (!persisted) {
    throw new IssuerPsvReceiptContractError(
      'psvReceiptId',
      'row was not readable immediately after write; refusing to confirm persistence',
    );
  }
  assertRoundTrip(input, persisted as never);

  return {
    confirmedAt: options.nowIso,
    confirmedBy: options.confirmedBy,
    writerMode: 'repository',
    persistedRowId: persisted.id,
    alreadyPersisted: false,
  };
}

// ---------------------------------------------------------------------------
// ISSUER-7 audit events
// ---------------------------------------------------------------------------

export interface IssuerAuditEventWriteInput {
  eventId: string;
  correlationId: string;
  requestId: string;
  subjectId?: string;
  actor: { actorId: string; displayName?: string; role: string };
  actorRole: string;
  eventType: string;
  occurredAt: string;
  source: string;
  /** May be the empty-string placeholder. NEVER fabricate a hash. */
  payloadHash: string;
  limitationNote?: string;
  relatedArtifactId?: string;
  recordedBy?: 'demo' | 'review_surface' | 'system';
}

export interface IssuerAuditEventWriteConfirmation {
  confirmedAt: string;
  writerMode: 'repository';
  persistedRowId: string;
  alreadyPersisted: boolean;
}

export async function writeIssuerAuditEvent(
  input: IssuerAuditEventWriteInput,
  options: { nowIso: string },
): Promise<IssuerAuditEventWriteConfirmation> {
  if (!input.eventId || !input.correlationId || !input.requestId) {
    throw new IssuerPsvReceiptContractError(
      'eventId',
      'eventId, correlationId and requestId are all required',
    );
  }
  if (input.payloadHash === undefined || input.payloadHash === null) {
    throw new IssuerPsvReceiptContractError(
      'payloadHash',
      'payloadHash must be supplied (the empty-string placeholder is valid; a fabricated hash is not)',
    );
  }
  if (input.actorRole !== input.actor.role) {
    throw new IssuerPsvReceiptContractError(
      'actorRole',
      `mirror mismatch: actorRole=${input.actorRole} but actor.role=${input.actor.role}`,
    );
  }

  const existing = await prisma.issuerAuditEvent.findUnique({
    where: { eventId: input.eventId },
  });
  if (existing) {
    return {
      confirmedAt: options.nowIso,
      writerMode: 'repository',
      persistedRowId: existing.id,
      alreadyPersisted: true,
    };
  }

  const created = await prisma.issuerAuditEvent.create({
    data: {
      eventId: input.eventId,
      correlationId: input.correlationId,
      requestId: input.requestId,
      subjectId: input.subjectId ?? null,
      actor: input.actor as never,
      actorRole: input.actorRole,
      eventType: input.eventType,
      occurredAt: new Date(input.occurredAt),
      source: input.source,
      payloadHash: input.payloadHash,
      limitationNote: input.limitationNote ?? null,
      relatedArtifactId: input.relatedArtifactId ?? null,
      recordedBy: input.recordedBy ?? 'system',
    },
  });

  const persisted = await prisma.issuerAuditEvent.findUnique({ where: { id: created.id } });
  if (!persisted) {
    throw new IssuerPsvReceiptContractError(
      'eventId',
      'audit row was not readable immediately after write; refusing to confirm persistence',
    );
  }
  if (persisted.payloadHash !== input.payloadHash) {
    throw new IssuerPsvReceiptContractError(
      'payloadHash',
      `round-trip mismatch: stored ${JSON.stringify(persisted.payloadHash)}, supplied ${JSON.stringify(input.payloadHash)}`,
    );
  }

  return {
    confirmedAt: options.nowIso,
    writerMode: 'repository',
    persistedRowId: persisted.id,
    alreadyPersisted: false,
  };
}

/** Read a persisted receipt by its contract id. Returns null when absent. */
export async function findIssuerPsvReceipt(psvReceiptId: string) {
  return prisma.issuerPsvReceipt.findUnique({ where: { psvReceiptId } });
}
