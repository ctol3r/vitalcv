import { randomUUID } from 'crypto';
import type {
  NormalizedCredentialPayload,
  PsvArtifact,
  DecisionWindow,
  WindowStatus,
  EvidenceIntegrity,
  Monitoring,
} from '../types/psv';
import { canonicalize } from '../utils/canonicalize';
import { sha256 } from '../utils/hash';

const DEFAULT_WINDOW_DAYS = 120;

export interface SigningResult {
  signature: string;
  publicKeyId: string;
  signedAt: string;
}

export type SignFunction = (payload: string) => Promise<SigningResult>;

/**
 * Stores the raw payload blob and returns the storage path.
 * Injected so the builder stays testable without disk I/O.
 */
export type StoreFunction = (
  artifactId: string,
  payload: unknown,
) => Promise<string>;

export interface BuildResult {
  artifact: PsvArtifact;
  rawPayloadStorageRef: string;
}

export async function buildPsvArtifact(
  payload: NormalizedCredentialPayload,
  sign: SignFunction,
  store?: StoreFunction,
): Promise<BuildResult> {
  const now = new Date();
  const generatedAt = now.toISOString();

  // Step 1-2: Canonicalize and hash the raw payload
  const rawCanonical = canonicalize(payload.rawPayload);
  const rawPayloadHash = sha256(rawCanonical);

  // Step 3: Generate artifact ID
  const artifactId = randomUUID();

  // Step 4: Store raw payload blob (immutable)
  const rawPayloadStorageRef = store
    ? await store(artifactId, payload.rawPayload)
    : '';

  // Step 5: Calculate decision window
  const decisionWindow = calculateDecisionWindow(generatedAt, DEFAULT_WINDOW_DAYS);

  // Step 5: Build monitoring (initial state — no deltas yet)
  const monitoring: Monitoring = {
    enabled: true,
    lastCheckedAt: generatedAt,
    checkIntervalHours: 24,
    deltaLog: [],
  };

  // Step 6: Build partial artifact (no integrity block)
  const partial = {
    artifactId,
    artifactVersion: '1.0' as const,
    generatedAt,
    provider: payload.provider,
    credentials: payload.credentials,
    retrieval: payload.retrieval,
    decisionWindow,
    monitoring,
    enrollment: payload.enrollment,
    deltaLog: [],
  };

  // Step 7-8: Canonicalize partial, hash it, sign it
  const partialCanonical = canonicalize(partial);
  const artifactHash = sha256(partialCanonical);
  const signingResult = await sign(partialCanonical);

  // Step 9: Assemble integrity block
  const integrity: EvidenceIntegrity = {
    rawPayloadHash,
    artifactHash,
    signatureAlgorithm: 'ES256',
    signature: signingResult.signature,
    publicKeyId: signingResult.publicKeyId,
    signedAt: signingResult.signedAt,
  };

  // Step 11: Return artifact + storage ref
  return {
    artifact: { ...partial, integrity },
    rawPayloadStorageRef,
  };
}

function calculateDecisionWindow(verifiedAt: string, windowDays: number): DecisionWindow {
  const verified = new Date(verifiedAt);
  const validUntil = new Date(verified);
  validUntil.setDate(validUntil.getDate() + windowDays);

  const now = new Date();
  const msRemaining = validUntil.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.floor(msRemaining / (1000 * 60 * 60 * 24)));

  let windowStatus: WindowStatus;
  if (msRemaining <= 0) {
    windowStatus = 'EXPIRED';
  } else if (daysRemaining <= 30) {
    windowStatus = 'EXPIRING_SOON';
  } else {
    windowStatus = 'WITHIN_WINDOW';
  }

  return {
    windowStatus,
    verifiedAt,
    validUntil: validUntil.toISOString(),
    windowDays,
    daysRemaining,
  };
}
