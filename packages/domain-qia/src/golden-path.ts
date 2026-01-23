/**
 * Golden Path Orchestration - Wave 5
 *
 * Answer: "Can this clinician start today — yes or no — and why?"
 *
 * ORCHESTRATION ONLY - uses existing domain packages:
 * - domain-credentials (validity, revocation, freshness)
 * - domain-authority (authority status)
 * - domain-qia (intent, decision capsule, trust gradient)
 * - domain-readiness (CRS computation)
 *
 * Rules:
 * - Missing/stale/unclear data → BLOCK
 * - No assumptions
 * - Pure functions (no network, no UI, no persistence)
 * - Deterministic and replayable
 */

import type { Credential, RevocationRecord } from '@domain/credentials';
import { checkCredentialStatus } from '@domain/credentials';
import type { AuthoritySnapshot } from '@domain/authority';
import type { TrustGradient } from './types';
import type { CRSInput, CRSResult } from '@domain/readiness';
import { computeCRS } from '@domain/readiness';
import { createDecisionCapsule } from './DecisionCapsule';
import type { DecisionCapsule, DecisionModelRef } from './DecisionCapsule';
import type { IntentBinding } from './IntentBinding';
import { AmbiguousQiaStateError } from './types';

export interface ShareToken {
  readonly token_id: string;
  readonly holder_id: string;
  readonly scope: readonly string[];
  readonly purpose: string;
  readonly issued_at: Date;
  readonly expires_at: Date;
  readonly revoked_at?: Date;
  readonly metadata?: Record<string, unknown>;
}

export interface CreateShareTokenInput {
  readonly holder_id: string;
  readonly scope: readonly string[];
  readonly purpose: string;
  readonly ttl_seconds?: number;
  readonly now?: Date;
}

const DEFAULT_TTL_SECONDS = 60 * 60 * 24;

export function createShareToken(input: CreateShareTokenInput): ShareToken {
  if (!input.holder_id || typeof input.holder_id !== 'string') {
    throw new AmbiguousQiaStateError('holder_id is required');
  }
  if (!Array.isArray(input.scope) || input.scope.length === 0) {
    throw new AmbiguousQiaStateError('scope must be a non-empty array');
  }
  if (!input.purpose || typeof input.purpose !== 'string') {
    throw new AmbiguousQiaStateError('purpose is required');
  }

  const issuedAt = input.now ?? new Date();
  const ttl = input.ttl_seconds ?? DEFAULT_TTL_SECONDS;
  const expiresAt = new Date(issuedAt.getTime() + ttl * 1000);

  const tokenId = 'share:' + input.holder_id + ':' + issuedAt.getTime().toString();

  return {
    token_id: tokenId,
    holder_id: input.holder_id,
    scope: input.scope,
    purpose: input.purpose,
    issued_at: issuedAt,
    expires_at: expiresAt,
  };
}

export interface CredentialSummary {
  readonly credential_id: string;
  readonly type: string[];
  readonly status: string;
  readonly valid_until?: Date;
  readonly checked_at: Date;
  readonly reason?: string;
}

export interface VerificationSummary {
  readonly token_id: string;
  readonly holder_id: string;
  readonly verified_at: Date;
  readonly credentials: readonly CredentialSummary[];
  readonly crs: CRSResult;
  readonly blockers: readonly string[];
}

export interface VerifyForEmployerInput {
  readonly token: ShareToken;
  readonly credentials: readonly Credential[];
  readonly revocation_records: ReadonlyMap<string, RevocationRecord>;
  readonly authority_snapshot: AuthoritySnapshot;
  readonly trust_gradient: TrustGradient;
  readonly now?: Date;
}

function isTokenValid(token: ShareToken, now: Date): { ok: true } | { ok: false; reason: string } {
  if (token.revoked_at) {
    return { ok: false, reason: 'Token revoked at ' + token.revoked_at.toISOString() };
  }
  if (now < token.issued_at) {
    return { ok: false, reason: 'Token not yet valid' };
  }
  if (now >= token.expires_at) {
    return { ok: false, reason: 'Token expired at ' + token.expires_at.toISOString() };
  }
  return { ok: true };
}

export function verifyForEmployer(input: VerifyForEmployerInput): VerificationSummary {
  const now = input.now ?? new Date();
  const blockers: string[] = [];

  const tokenCheck = isTokenValid(input.token, now);
  if (!tokenCheck.ok) {
    blockers.push(tokenCheck.reason);
  }

  if (input.credentials.length === 0) {
    blockers.push('No credentials provided');
  }

  const credentialSummaries: CredentialSummary[] = [];
  let hasValidCredential = false;

  for (const credential of input.credentials) {
    const revocationRecord = input.revocation_records.get(credential.id) ?? null;
    const validityResult = checkCredentialStatus(credential, revocationRecord, now);

    credentialSummaries.push({
      credential_id: credential.id,
      type: credential.type,
      status: validityResult.status,
      valid_until: validityResult.valid_until,
      checked_at: validityResult.checked_at,
      reason: validityResult.reason,
    });

    if (validityResult.status === 'VALID') {
      hasValidCredential = true;
    } else {
      const blockReason = validityResult.reason ? ' (' + validityResult.reason + ')' : '';
      blockers.push('Credential ' + credential.id + ': ' + validityResult.status + blockReason);
    }
  }

  if (!hasValidCredential) {
    blockers.push('No valid credentials found');
  }

  // ASSUMPTION: Using first credential as primary for CRS computation.
  // TODO: Allow caller to specify primary credential or aggregate multiple credentials.
  // HOLDER-FIRST: Holder should control which credential is prioritized.
  const primaryCredential = input.credentials[0];
  const primaryRevocation = primaryCredential
    ? input.revocation_records.get(primaryCredential.id) ?? null
    : null;
  const primaryValidity = primaryCredential
    ? checkCredentialStatus(primaryCredential, primaryRevocation, now)
    : null;

  if (!primaryValidity) {
    throw new AmbiguousQiaStateError('No primary credential available for CRS computation');
  }

  // NOTE: qiaValidationResult conflates token/credential blockers with QIA validation.
  // This is a simplification - true QIA validation would check QIA-specific invariants.
  const crsInput: CRSInput = {
    credentialValidityResult: primaryValidity,
    authorityStateSummary: input.authority_snapshot,
    qiaValidationResult: { ok: blockers.length === 0 },
    trustGradient: input.trust_gradient,
  };

  const crs = computeCRS(crsInput, now);

  return {
    token_id: input.token.token_id,
    holder_id: input.token.holder_id,
    verified_at: now,
    credentials: credentialSummaries,
    crs,
    blockers,
  };
}

export type DecisionOutcome = 'GREENLIGHT' | 'BLOCK';

export interface DecisionReceipt {
  readonly decision_id: string;
  readonly token_id: string;
  readonly holder_id: string;
  readonly decision_at: Date;
  readonly outcome: DecisionOutcome;
  readonly crs_grade: string;
  readonly crs_score: number;
  readonly blockers: readonly string[];
  readonly capsule: DecisionCapsule;
}

export interface MakeDecisionInput {
  readonly token: ShareToken;
  readonly verification: VerificationSummary;
  readonly intent: IntentBinding;
  readonly model: DecisionModelRef;
  readonly rules_version: string;
  readonly ledger_root: string;
  readonly now?: Date;
}

export function makeDecision(input: MakeDecisionInput): DecisionReceipt {
  const now = input.now ?? new Date();

  const outcome: DecisionOutcome = input.verification.crs.grade === 'GREEN' ? 'GREENLIGHT' : 'BLOCK';

  const allBlockers = [
    ...input.verification.blockers,
    ...input.verification.crs.reasons.map((r) => r.message),
  ];

  const decisionId = 'decision:' + input.token.holder_id + ':' + now.getTime().toString();

  const capsule = createDecisionCapsule({
    capsule_id: decisionId,
    decision_at: now,
    intent: input.intent,
    input_hash_refs: [
      input.token.token_id,
      ...input.verification.credentials.map((c) => c.credential_id),
    ],
    model: input.model,
    rules_version: input.rules_version,
    ledger_root: input.ledger_root,
    confidence: input.verification.crs.grade === 'GREEN' ? 1.0 : 0.0,
    credential_refs: input.verification.credentials.map((c) => c.credential_id),
  });

  return {
    decision_id: decisionId,
    token_id: input.token.token_id,
    holder_id: input.token.holder_id,
    decision_at: now,
    outcome,
    crs_grade: input.verification.crs.grade,
    crs_score: input.verification.crs.score,
    blockers: allBlockers,
    capsule,
  };
}
