import type {
  DomainPsvReceipt,
  DomainPsvReceiptCandidateReference,
  DomainPsvReceiptContractGap,
  DomainPsvReceiptContractGapKind,
  DomainPsvReceiptFreshness,
  DomainPsvReceiptLimitation,
  DomainPsvReceiptResponderAttribution,
  DomainPsvReceiptScope,
  DomainPsvReceiptSourceBasis,
  DomainPsvReceiptStatus,
  DomainPsvReceiptWriterConfirmation,
  PsvReceiptSnapshot,
} from './psvReceipts';

/**
 * BACKEND-1 — Domain PSV Receipt mapper / validator.
 *
 * Truth contract:
 *   - This module is a pure transform — no fetches, no DB writes,
 *     no I/O of any kind. It does NOT enable persistence.
 *   - The mapper does NOT fabricate missing fields. If the upstream
 *     issuer PSVReceipt omits limitations / sourceBasis /
 *     responderAttribution / freshness / scope, the corresponding
 *     `DomainPsvReceiptContractGap` is emitted instead of a synthesized
 *     value.
 *   - A receipt may be marked `status: 'persisted'` ONLY when an
 *     explicit `DomainPsvReceiptWriterConfirmation` is present AND
 *     the writer mode is `'repository'` or `'external'`.
 *   - The legacy `PsvReceiptSnapshot` is NOT a full domain receipt.
 *     `mapLegacySnapshotToDomainReceipt` always emits a
 *     `legacy_snapshot_only` gap so the caller cannot mistake the
 *     legacy shape for the aligned issuer trust contract.
 *   - The mapper refuses to introduce a `globalCredentialTruth`
 *     field. If the upstream object has one, the mapper drops it
 *     and surfaces `forbidden_global_credential_truth_field`.
 */

/**
 * The shape we accept as input from the issuer trust contract
 * (apps/web/lib/issuer-verification/psvReceipt.ts). Defined here as
 * a structural alias so domain-core does not statically depend on
 * the apps/web package — keeping the module reusable from any
 * server context.
 */
export interface IssuerPsvReceiptShape {
  psvReceiptId?: string;
  psvCandidateId?: string;
  receiptCandidateId?: string;
  requestId?: string;
  claimId?: string;
  claimType?: string;
  scope?: {
    claimType?: string;
    covers?: string;
    doesNotCover?: string;
    sourceOrganizationName?: string;
  };
  limitations?: ReadonlyArray<{
    kind?:
      | 'legally_only'
      | 'partial_confirmation'
      | 'contracted_agent'
      | 'access_required'
      | 'jurisdictional_scope'
      | 'other';
    description?: string;
  }>;
  sourceBasis?: {
    sourceOrganizationName?: string;
    isContractedAgent?: boolean;
    agentName?: string;
    agentActsFor?: string;
    basisNote?: string;
  };
  attributedResponder?: {
    name?: string;
    role?: string;
    attributedAt?: string;
    attributionMethod?:
      | 'self_attested'
      | 'directory_match'
      | 'partner_assertion'
      | 'unknown';
  };
  freshness?: {
    ttlDays?: number;
    issuedAt?: string;
    staleAfter?: string;
  };
  /**
   * INTENTIONALLY NOT mapped. If present on the upstream object,
   * the mapper drops it AND emits a contract gap so the legacy
   * truth invariant cannot leak into the domain shape.
   */
  globalCredentialTruth?: unknown;
  proofTier?: unknown;
  decisionGrade?: unknown;
}

export interface MapIssuerToDomainOptions {
  /**
   * Optional writer confirmation. The mapper will set
   * `status: 'persisted'` only when this is present AND its
   * `writerMode` is `'repository'` or `'external'`.
   */
  writerConfirmation?: DomainPsvReceiptWriterConfirmation;
}

export interface MapIssuerToDomainResult {
  receipt: DomainPsvReceipt;
  gaps: ReadonlyArray<DomainPsvReceiptContractGap>;
  /** True iff `gaps` is empty. */
  contractAligned: boolean;
}

function gap(
  kind: DomainPsvReceiptContractGapKind,
  field: string,
  message: string,
): DomainPsvReceiptContractGap {
  return Object.freeze({ kind, field, message });
}

function pickScope(
  input: IssuerPsvReceiptShape,
  gaps: DomainPsvReceiptContractGap[],
): DomainPsvReceiptScope | undefined {
  const s = input.scope;
  if (
    !s ||
    !s.claimType ||
    !s.covers ||
    !s.doesNotCover ||
    !s.sourceOrganizationName
  ) {
    gaps.push(
      gap(
        'missing_scope',
        'scope',
        'DomainPsvReceipt requires a scope with claimType / covers / doesNotCover / sourceOrganizationName.',
      ),
    );
    return undefined;
  }
  return Object.freeze({
    claimType: s.claimType,
    covers: s.covers,
    doesNotCover: s.doesNotCover,
    sourceOrganizationName: s.sourceOrganizationName,
  });
}

function pickLimitations(
  input: IssuerPsvReceiptShape,
  gaps: DomainPsvReceiptContractGap[],
): ReadonlyArray<DomainPsvReceiptLimitation> | undefined {
  if (!input.limitations) {
    gaps.push(
      gap(
        'missing_limitations',
        'limitations',
        'DomainPsvReceipt requires a limitations array (may be empty if the upstream had none, but the field itself is required).',
      ),
    );
    return undefined;
  }
  // Skip malformed entries entirely — the mapper must not fabricate
  // a `kind` or substitute a placeholder `description`. Each
  // malformed entry surfaces a gap; the output array contains only
  // the well-formed entries.
  const validEntries: DomainPsvReceiptLimitation[] = [];
  for (const l of input.limitations) {
    if (!l.kind || !l.description) {
      gaps.push(
        gap(
          'missing_limitations',
          'limitations[].kind|description',
          'Each limitation entry requires both `kind` and `description`. Malformed entries are dropped, not synthesized.',
        ),
      );
      continue;
    }
    validEntries.push(
      Object.freeze({
        kind: l.kind,
        description: l.description,
      }),
    );
  }
  return Object.freeze(validEntries);
}

function pickSourceBasis(
  input: IssuerPsvReceiptShape,
  gaps: DomainPsvReceiptContractGap[],
): DomainPsvReceiptSourceBasis | undefined {
  const s = input.sourceBasis;
  if (
    !s ||
    !s.sourceOrganizationName ||
    typeof s.isContractedAgent !== 'boolean'
  ) {
    gaps.push(
      gap(
        'missing_source_basis',
        'sourceBasis',
        'DomainPsvReceipt requires a sourceBasis with sourceOrganizationName and isContractedAgent.',
      ),
    );
    return undefined;
  }
  if (s.isContractedAgent && (!s.agentName || !s.agentActsFor)) {
    gaps.push(
      gap(
        'missing_source_basis',
        'sourceBasis.agentName|agentActsFor',
        'A contracted-agent sourceBasis requires both agentName and agentActsFor.',
      ),
    );
  }
  return Object.freeze({
    sourceOrganizationName: s.sourceOrganizationName,
    isContractedAgent: s.isContractedAgent,
    agentName: s.agentName,
    agentActsFor: s.agentActsFor,
    basisNote: s.basisNote,
  });
}

function pickResponderAttribution(
  input: IssuerPsvReceiptShape,
  gaps: DomainPsvReceiptContractGap[],
): DomainPsvReceiptResponderAttribution | undefined {
  const r = input.attributedResponder;
  if (!r || !r.name || !r.attributedAt || !r.attributionMethod) {
    gaps.push(
      gap(
        'missing_responder_attribution',
        'attributedResponder',
        'DomainPsvReceipt requires attributedResponder with name, attributedAt, and attributionMethod.',
      ),
    );
    return undefined;
  }
  return Object.freeze({
    name: r.name,
    role: r.role,
    attributedAt: r.attributedAt,
    attributionMethod: r.attributionMethod,
  });
}

function pickFreshness(
  input: IssuerPsvReceiptShape,
  gaps: DomainPsvReceiptContractGap[],
): DomainPsvReceiptFreshness | undefined {
  const f = input.freshness;
  if (
    !f ||
    typeof f.ttlDays !== 'number' ||
    !f.issuedAt ||
    !f.staleAfter
  ) {
    gaps.push(
      gap(
        'missing_freshness',
        'freshness',
        'DomainPsvReceipt requires freshness with ttlDays, issuedAt, and staleAfter.',
      ),
    );
    return undefined;
  }
  return Object.freeze({
    ttlDays: f.ttlDays,
    issuedAt: f.issuedAt,
    staleAfter: f.staleAfter,
  });
}

function pickCandidateReference(
  input: IssuerPsvReceiptShape,
): DomainPsvReceiptCandidateReference | undefined {
  if (
    !input.psvCandidateId &&
    !input.receiptCandidateId &&
    !input.requestId
  ) {
    return undefined;
  }
  return Object.freeze({
    psvCandidateId: input.psvCandidateId,
    receiptCandidateId: input.receiptCandidateId,
    requestId: input.requestId,
  });
}

function checkForbiddenFields(
  input: IssuerPsvReceiptShape,
  gaps: DomainPsvReceiptContractGap[],
): void {
  if (Object.prototype.hasOwnProperty.call(input, 'globalCredentialTruth')) {
    gaps.push(
      gap(
        'forbidden_global_credential_truth_field',
        'globalCredentialTruth',
        'DomainPsvReceipt does not carry a globalCredentialTruth field; the mapper drops it.',
      ),
    );
  }
}

function decideStatus(
  gaps: ReadonlyArray<DomainPsvReceiptContractGap>,
  writerConfirmation: DomainPsvReceiptWriterConfirmation | undefined,
  hasUpstreamCandidate: boolean,
): DomainPsvReceiptStatus {
  // No writer confirmation → never persisted.
  if (!writerConfirmation) {
    return hasUpstreamCandidate ? 'candidate' : 'pending_not_persisted';
  }
  // Writer confirmation present but bad mode → not persisted.
  if (
    writerConfirmation.writerMode !== 'repository' &&
    writerConfirmation.writerMode !== 'external'
  ) {
    return 'pending_not_persisted';
  }
  // If structural gaps exist, refuse to mark persisted.
  // missing_candidate_reference covers the missing psvReceiptId
  // case (no honest id to persist against).
  const blockingKinds: DomainPsvReceiptContractGapKind[] = [
    'missing_limitations',
    'missing_source_basis',
    'missing_responder_attribution',
    'missing_freshness',
    'missing_scope',
    'missing_candidate_reference',
    'invalid_writer_mode',
  ];
  if (gaps.some((g) => blockingKinds.includes(g.kind))) {
    return 'pending_not_persisted';
  }
  return 'persisted';
}

/**
 * Pure: validate that a (possibly partial) DomainPsvReceipt satisfies
 * the contract for its declared status. Returns the gap list. Empty
 * array means the receipt is valid for that status.
 */
export function validateDomainPsvReceiptContract(
  receipt: DomainPsvReceipt,
): ReadonlyArray<DomainPsvReceiptContractGap> {
  const gaps: DomainPsvReceiptContractGap[] = [];
  if (!receipt.scope) {
    gaps.push(
      gap('missing_scope', 'scope', 'scope is required for non-pending receipts.'),
    );
  }
  if (!receipt.limitations) {
    gaps.push(
      gap(
        'missing_limitations',
        'limitations',
        'limitations array is required for non-pending receipts (may be empty).',
      ),
    );
  }
  if (!receipt.sourceBasis) {
    gaps.push(
      gap(
        'missing_source_basis',
        'sourceBasis',
        'sourceBasis is required for non-pending receipts.',
      ),
    );
  }
  if (!receipt.responderAttribution) {
    gaps.push(
      gap(
        'missing_responder_attribution',
        'responderAttribution',
        'responderAttribution is required for non-pending receipts.',
      ),
    );
  }
  if (!receipt.freshness) {
    gaps.push(
      gap('missing_freshness', 'freshness', 'freshness is required for non-pending receipts.'),
    );
  }
  if (
    receipt.status === 'persisted' &&
    (!receipt.writerConfirmation ||
      (receipt.writerConfirmation.writerMode !== 'repository' &&
        receipt.writerConfirmation.writerMode !== 'external'))
  ) {
    gaps.push(
      gap(
        'missing_writer_confirmation_for_persisted',
        'writerConfirmation',
        'A receipt with status=persisted requires writerConfirmation with writerMode in {repository, external}.',
      ),
    );
  }
  return Object.freeze(gaps);
}

/**
 * Pure: map an issuer-shape PSVReceipt into the domain receipt. Does
 * NOT fabricate missing fields. Caller may pass an explicit
 * `writerConfirmation` to permit the result to carry
 * `status: 'persisted'`; absence keeps it at `candidate` (or
 * `pending_not_persisted` if no candidate reference is present).
 */
export function mapIssuerPsvReceiptToDomainReceipt(
  input: IssuerPsvReceiptShape,
  options: MapIssuerToDomainOptions = {},
): MapIssuerToDomainResult {
  const gaps: DomainPsvReceiptContractGap[] = [];
  checkForbiddenFields(input, gaps);

  // Empty string is the honest "absent id" representation. The
  // mapper does NOT synthesize a placeholder string. The missing
  // id surfaces both as `receiptId: ''` AND as an explicit gap.
  const receiptId = input.psvReceiptId ?? '';
  if (!input.psvReceiptId) {
    gaps.push(
      gap(
        'missing_candidate_reference',
        'psvReceiptId',
        'IssuerPsvReceiptShape.psvReceiptId is required for mapping; the mapper does not fabricate one. Result will carry receiptId="" and cannot reach status="persisted".',
      ),
    );
  }

  const scope = pickScope(input, gaps);
  const limitations = pickLimitations(input, gaps);
  const sourceBasis = pickSourceBasis(input, gaps);
  const responderAttribution = pickResponderAttribution(input, gaps);
  const freshness = pickFreshness(input, gaps);
  const candidateReference = pickCandidateReference(input);
  const writerConfirmation = options.writerConfirmation;

  if (
    writerConfirmation &&
    writerConfirmation.writerMode !== 'repository' &&
    writerConfirmation.writerMode !== 'external'
  ) {
    gaps.push(
      gap(
        'invalid_writer_mode',
        'writerConfirmation.writerMode',
        'writerMode must be one of {repository, external} to support a persisted status.',
      ),
    );
  }

  const status = decideStatus(
    gaps,
    writerConfirmation,
    Boolean(candidateReference),
  );

  if (status !== 'persisted' && writerConfirmation) {
    // Writer was supplied but the result cannot be persisted because
    // structural gaps remain. Surface a gap so callers see it.
    gaps.push(
      gap(
        'missing_writer_confirmation_for_persisted',
        'status',
        'writerConfirmation was supplied but structural gaps prevent the receipt from reaching status=persisted.',
      ),
    );
  }

  const receipt: DomainPsvReceipt = Object.freeze({
    receiptId,
    status,
    scope,
    limitations,
    sourceBasis,
    responderAttribution,
    freshness,
    candidateReference,
    writerConfirmation: status === 'persisted' ? writerConfirmation : undefined,
  });

  return {
    receipt,
    gaps: Object.freeze(gaps),
    contractAligned: gaps.length === 0,
  };
}

/**
 * Pure: map a legacy `PsvReceiptSnapshot` to a `DomainPsvReceipt`.
 * Always emits a `legacy_snapshot_only` gap because the legacy
 * shape does not carry the issuer trust-contract fields. The
 * resulting domain receipt is `pending_not_persisted` regardless of
 * any writer confirmation — the legacy snapshot cannot be the basis
 * of a persisted issuer-aligned receipt.
 */
export function mapLegacySnapshotToDomainReceipt(
  snapshot: PsvReceiptSnapshot,
): MapIssuerToDomainResult {
  const gaps: DomainPsvReceiptContractGap[] = [
    gap(
      'legacy_snapshot_only',
      'PsvReceiptSnapshot',
      'PsvReceiptSnapshot is the legacy shape (receiptId / fetchedAt / ttlSeconds / revoked); it does not carry limitations / sourceBasis / responderAttribution / scope. A full DomainPsvReceipt requires the issuer trust-contract fields.',
    ),
    gap(
      'missing_limitations',
      'limitations',
      'Legacy snapshot has no limitations array.',
    ),
    gap(
      'missing_source_basis',
      'sourceBasis',
      'Legacy snapshot has no source basis.',
    ),
    gap(
      'missing_responder_attribution',
      'responderAttribution',
      'Legacy snapshot has no responder attribution.',
    ),
    gap(
      'missing_scope',
      'scope',
      'Legacy snapshot has no scope object.',
    ),
  ];
  const receipt: DomainPsvReceipt = Object.freeze({
    receiptId: snapshot.receiptId,
    status: 'pending_not_persisted',
    freshness: Object.freeze({
      ttlDays: Math.max(1, Math.round(snapshot.ttlSeconds / 86400)),
      issuedAt: snapshot.fetchedAt,
      staleAfter: new Date(
        Date.parse(snapshot.fetchedAt) + snapshot.ttlSeconds * 1000,
      ).toISOString(),
    }),
  });
  return {
    receipt,
    gaps: Object.freeze(gaps),
    contractAligned: false,
  };
}

/**
 * Plain-language explanation of a contract gap. Surfaced verbatim by
 * the persistence-decision review surface.
 */
export function explainDomainPsvReceiptContractGap(
  gap: DomainPsvReceiptContractGap,
): string {
  return `[${gap.kind}] ${gap.field}: ${gap.message}`;
}
