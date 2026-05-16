import { randomUUID } from 'node:crypto';
import { sha256ForPayload } from '../utils/deterministic';

export type RuntimeMutationAction =
  | 'accept'
  | 'request-refresh'
  | 'route-to-review'
  | 'packet-export'
  | 'share-packet'
  | 'confirm-start'
  | 'denied-mutation'
  | 'dossier-replay';

export type RuntimeReplayCategory =
  | 'R-CAT-1'
  | 'R-CAT-2'
  | 'R-CAT-3'
  | 'R-CAT-4'
  | 'R-CAT-5'
  | 'R-CAT-6';

export type RuntimeMutationClassification =
  | 'TRUST_ACCEPTANCE'
  | 'TRUST_REFRESH_REQUEST'
  | 'TRUST_REVIEW_ROUTING'
  | 'TRUST_PACKET_EXPORT'
  | 'TRUST_PACKET_SHARE'
  | 'TRUST_START_ATTESTATION'
  | 'DENIED_MUTATION'
  | 'DOSSIER_REPLAY';

export interface RuntimeTrustActor {
  actorId: string;
  actorType: 'human' | 'system' | 'unknown';
  attributionSource: 'x-clerk-user-id' | 'system' | 'unknown';
}

export interface RuntimeReadonlyIndicator {
  attemptedByReadonly: boolean;
  source: string | null;
}

export interface RuntimeTrustMetadata {
  schema: 'vitalcv.runtime-trust-cohesion.v1';
  correlationId: string;
  mutationFingerprint: string;
  actor: RuntimeTrustActor;
  mutationClassification: RuntimeMutationClassification;
  replayCategory: RuntimeReplayCategory;
  payloadHash: string;
  outcome: 'allowed' | 'denied' | 'replayed';
  denialReason?: string;
  readonly: RuntimeReadonlyIndicator;
  /**
   * W2-PR36A: tenant-bound fingerprint separation.
   *
   * When the call site supplies `tenantId`, both `mutationFingerprint` and
   * `payloadHash` fold the tenant into their pre-image. Two tenants doing the
   * same action on the same entity therefore produce DIFFERENT fingerprints —
   * cross-tenant replay collision is structurally impossible.
   *
   * When `tenantId` is absent (back-compat), the fingerprint is computed
   * exactly as in v1 — existing stored fingerprints reproduce identically.
   * `tenantBound` flips the consumer's interpretation: `true` means the hash
   * is a tenant-scoped boundary; `false` means the hash predates tenant
   * isolation and MUST NOT be merged into a tenant-scoped lineage.
   */
  tenantId?: string;
  tenantBound: boolean;
}

export interface RuntimeReplayMetadata {
  schema: 'vitalcv.runtime-trust-replay.v1';
  correlationId: string;
  mutationFingerprint: string;
  mutationClassification: 'DOSSIER_REPLAY';
  replayCategory: 'R-CAT-6';
  payloadHash: string;
  /** See RuntimeTrustMetadata.tenantId — same back-compat semantics. */
  tenantId?: string;
  tenantBound: boolean;
}

const SENSITIVE_PAYLOAD_KEYS = new Set([
  'npi',
  'clinicianNpi',
  'subjectNpi',
  'notes',
  'message',
  'shareToken',
  'shareUrl',
  'token',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function redactPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactPayload);
  }

  if (!isRecord(value)) {
    return value;
  }

  const result: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    result[key] = SENSITIVE_PAYLOAD_KEYS.has(key)
      ? '[redacted]'
      : redactPayload(nested);
  }
  return result;
}

export function resolveReplayCategory(action: RuntimeMutationAction): RuntimeReplayCategory {
  switch (action) {
    case 'accept':
      return 'R-CAT-1';
    case 'request-refresh':
    case 'route-to-review':
      return 'R-CAT-2';
    case 'packet-export':
    case 'share-packet':
      return 'R-CAT-3';
    case 'confirm-start':
      return 'R-CAT-4';
    case 'denied-mutation':
      return 'R-CAT-5';
    case 'dossier-replay':
      return 'R-CAT-6';
    default:
      return 'R-CAT-5';
  }
}

export function normalizeMutationClassification(
  action: RuntimeMutationAction,
): RuntimeMutationClassification {
  switch (action) {
    case 'accept':
      return 'TRUST_ACCEPTANCE';
    case 'request-refresh':
      return 'TRUST_REFRESH_REQUEST';
    case 'route-to-review':
      return 'TRUST_REVIEW_ROUTING';
    case 'packet-export':
      return 'TRUST_PACKET_EXPORT';
    case 'share-packet':
      return 'TRUST_PACKET_SHARE';
    case 'confirm-start':
      return 'TRUST_START_ATTESTATION';
    case 'dossier-replay':
      return 'DOSSIER_REPLAY';
    case 'denied-mutation':
    default:
      return 'DENIED_MUTATION';
  }
}

function normalizeTenantForFingerprint(tenantId: unknown): string | null {
  if (typeof tenantId !== 'string') return null;
  const trimmed = tenantId.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function buildRuntimeMutationMetadata(input: {
  action: RuntimeMutationAction;
  actorId?: string | null;
  entityId: string;
  clinicianNpi?: string | null;
  correlationId?: string | null;
  payload?: unknown;
  outcome: 'allowed' | 'denied';
  denialReason?: string | null;
  readonly?: RuntimeReadonlyIndicator;
  /**
   * W2-PR36A: when supplied, folds into payloadHash and mutationFingerprint
   * so two tenants performing the same action on the same entity produce
   * DIFFERENT fingerprints. Omit (or pass null) for back-compat — the hash
   * then matches the v1 pre-tenant fingerprint exactly.
   */
  tenantId?: string | null;
}): RuntimeTrustMetadata {
  const actorId = input.actorId?.trim() || 'unknown';
  const correlationId = input.correlationId?.trim() || randomUUID();
  const tenantId = normalizeTenantForFingerprint(input.tenantId ?? null);
  const tenantBound = tenantId !== null;

  const payloadHash = sha256ForPayload({
    schema: 'vitalcv.runtime-trust-payload.v1',
    action: input.action,
    entityId: input.entityId,
    clinicianNpi: input.clinicianNpi ? '[redacted]' : null,
    payload: redactPayload(input.payload ?? {}),
    ...(tenantBound ? { tenantId } : {}),
  });
  const mutationFingerprint = sha256ForPayload({
    schema: 'vitalcv.runtime-trust-mutation-fingerprint.v1',
    action: input.action,
    actorId,
    entityId: input.entityId,
    payloadHash,
    ...(tenantBound ? { tenantId } : {}),
  });

  return {
    schema: 'vitalcv.runtime-trust-cohesion.v1',
    correlationId,
    mutationFingerprint,
    actor: {
      actorId,
      actorType: actorId === 'unknown' ? 'unknown' : 'human',
      attributionSource: actorId === 'unknown' ? 'unknown' : 'x-clerk-user-id',
    },
    mutationClassification: normalizeMutationClassification(input.action),
    replayCategory: resolveReplayCategory(input.action),
    payloadHash,
    outcome: input.outcome,
    ...(input.denialReason ? { denialReason: input.denialReason } : {}),
    readonly: input.readonly ?? {
      attemptedByReadonly: false,
      source: null,
    },
    ...(tenantBound ? { tenantId } : {}),
    tenantBound,
  };
}

export function buildRuntimeReplayMetadata(input: {
  capsuleId: string;
  correlationId?: string | null;
  payloadHash?: string | null;
  mutationFingerprint?: string | null;
  /** See buildRuntimeMutationMetadata.tenantId — same back-compat semantics. */
  tenantId?: string | null;
}): RuntimeReplayMetadata {
  const tenantId = normalizeTenantForFingerprint(input.tenantId ?? null);
  const tenantBound = tenantId !== null;

  const payloadHash = input.payloadHash?.trim() || sha256ForPayload({
    schema: 'vitalcv.runtime-trust-replay-payload.v1',
    capsuleId: input.capsuleId,
    ...(tenantBound ? { tenantId } : {}),
  });
  const mutationFingerprint = input.mutationFingerprint?.trim() || sha256ForPayload({
    schema: 'vitalcv.runtime-trust-replay-fingerprint.v1',
    capsuleId: input.capsuleId,
    payloadHash,
    ...(tenantBound ? { tenantId } : {}),
  });

  return {
    schema: 'vitalcv.runtime-trust-replay.v1',
    correlationId: input.correlationId?.trim() || randomUUID(),
    mutationFingerprint,
    mutationClassification: 'DOSSIER_REPLAY',
    replayCategory: 'R-CAT-6',
    payloadHash,
    ...(tenantBound ? { tenantId } : {}),
    tenantBound,
  };
}
