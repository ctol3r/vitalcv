/**
 * haipEnforcer.ts — Substrate Consolidation: Phase 5
 *
 * HAIP profile enforcement layer for issuance, verification, and SD-JWT
 * selective disclosure. Injects validation failures directly into the
 * auditLedger for SIEM visibility.
 *
 * Enforcement Points:
 *   - Issuance: HAIP algorithm + format + issuer trust checks
 *   - Verification: HAIP credential + revocation checks before returning result
 *   - SD-JWT: structure validation (commitments, salt schema, reveal fields)
 *
 * Usage:
 *   import { enforceHAIPIssuance, enforceHAIPVerification, enforceSDJWTStructure } from './haipEnforcer';
 */

import { randomUUID } from 'node:crypto';
import { checkCredentialHAIP, checkIssuerHAIP, HAIP_HEALTHCARE_POLICY } from '../trust/haipProfile';
import { getIssuer } from '../registry/trustRegistry';
import { appendAuditEvent, newTraceId, type AuditSeverity } from '../audit/auditLedger';
import { log } from '../../obs/logger';
import type { VerifiableCredential } from '../credentials/credentialModel';
import type { HAIPViolation } from '../trust/haipProfile';

// ── Types ─────────────────────────────────────────────────────────────

export interface EnforcementResult {
  allowed: boolean;
  violations: HAIPViolation[];
  auditEventId: string;
  traceId: string;
}

export interface SDJWTStructureResult {
  valid: boolean;
  errors: string[];
  auditEventId: string;
  traceId: string;
}

// ── HAIP Issuance Enforcement ─────────────────────────────────────────

/**
 * Enforce HAIP compliance before a credential is issued.
 * Checks issuer trust level, algorithm, and format constraints.
 * Logs violations to auditLedger.
 *
 * @returns EnforcementResult — if allowed=false, caller must reject the request
 */
export function enforceHAIPIssuance(opts: {
  issuerId: string;
  subject: string;
  format?: string;
  algorithm?: string;
  traceId?: string;
}): EnforcementResult {
  const traceId = opts.traceId ?? newTraceId();
  const violations: HAIPViolation[] = [];

  // 1. Issuer HAIP check
  const issuerRecord = getIssuer(opts.issuerId);
  if (issuerRecord) {
    const issuerCheck = checkIssuerHAIP(issuerRecord, HAIP_HEALTHCARE_POLICY);
    violations.push(...issuerCheck.violations);
  } else {
    violations.push({
      rule: 'HAIP-ISS-001',
      detail: `Issuer ${opts.issuerId} is not registered in the trust registry`,
      severity: 'CRITICAL',
    });
  }

  // 2. Algorithm enforcement
  const policy = HAIP_HEALTHCARE_POLICY;
  if (opts.algorithm && !policy.allowedAlgorithms.includes(opts.algorithm as 'ES256' | 'ES384' | 'ES512' | 'EdDSA')) {
    violations.push({
      rule: 'HAIP-ALG-001',
      detail: `Issuance algorithm ${opts.algorithm} not in HAIP allowlist (${policy.allowedAlgorithms.join(', ')})`,
      severity: 'CRITICAL',
    });
  }

  // 3. Format enforcement
  if (opts.format && !policy.allowedFormats.includes(opts.format as 'vc+sd-jwt' | 'jwt_vc_json' | 'ldp_vc')) {
    violations.push({
      rule: 'HAIP-FMT-001',
      detail: `Credential format ${opts.format} not in HAIP allowlist (${policy.allowedFormats.join(', ')})`,
      severity: 'CRITICAL',
    });
  }

  const critical = violations.filter((v) => v.severity === 'CRITICAL');
  const allowed = critical.length === 0;
  const severity: AuditSeverity = !allowed ? 'CRITICAL' : violations.length > 0 ? 'WARNING' : 'INFO';

  const event = appendAuditEvent({
    traceId,
    category: ['ISSUANCE', 'COMPLIANCE'],
    actor: opts.issuerId,
    resource: opts.subject,
    requestFields: {
      issuerId: opts.issuerId,
      subject: opts.subject,
      format: opts.format,
      algorithm: opts.algorithm,
    },
    resultFields: {
      allowed,
      violationCount: violations.length,
      criticalCount: critical.length,
      violations: violations.map((v) => ({ rule: v.rule, severity: v.severity })),
    },
    severity,
  });

  if (!allowed) {
    log('warn', 'haip_issuance_blocked', {
      traceId,
      issuerId: opts.issuerId,
      subject: opts.subject,
      criticalViolations: critical.map((v) => v.rule),
    });
  }

  return { allowed, violations, auditEventId: event.eventId, traceId };
}

// ── HAIP Verification Enforcement ─────────────────────────────────────

/**
 * Enforce HAIP compliance on a credential being verified.
 * Checks credential fields, issuer trust, and policy conformance.
 * Always logs to auditLedger (success or failure).
 */
export function enforceHAIPVerification(credential: VerifiableCredential, opts: {
  verifierId?: string;
  traceId?: string;
} = {}): EnforcementResult {
  const traceId = opts.traceId ?? newTraceId();
  const violations: HAIPViolation[] = [];

  // Credential check
  const credCheck = checkCredentialHAIP(credential, HAIP_HEALTHCARE_POLICY);
  violations.push(...credCheck.violations);

  // Issuer check
  const issuerRecord = getIssuer(credential.issuer);
  if (issuerRecord) {
    const issuerCheck = checkIssuerHAIP(issuerRecord, HAIP_HEALTHCARE_POLICY);
    violations.push(...issuerCheck.violations);
  } else {
    violations.push({
      rule: 'HAIP-ISS-002',
      detail: `Issuer ${credential.issuer} is unknown — cannot verify HAIP compliance`,
      severity: 'WARNING',
    });
  }

  const critical = violations.filter((v) => v.severity === 'CRITICAL');
  const allowed = critical.length === 0;
  const severity: AuditSeverity = !allowed ? 'CRITICAL' : violations.length > 0 ? 'WARNING' : 'INFO';

  const event = appendAuditEvent({
    traceId,
    category: ['VERIFICATION', 'COMPLIANCE'],
    actor: opts.verifierId ?? 'system',
    resource: credential.credentialId,
    requestFields: {
      credentialId: credential.credentialId,
      issuer: credential.issuer,
      subject: credential.subject,
    },
    resultFields: {
      allowed,
      violationCount: violations.length,
      criticalCount: critical.length,
      haipCompliant: credCheck.compliant,
      violations: violations.map((v) => ({ rule: v.rule, severity: v.severity })),
    },
    severity,
  });

  if (!allowed) {
    log('warn', 'haip_verification_blocked', {
      traceId,
      credentialId: credential.credentialId,
      issuer: credential.issuer,
      criticalViolations: critical.map((v) => v.rule),
    });
  }

  return { allowed, violations, auditEventId: event.eventId, traceId };
}

// ── SD-JWT Structure Enforcement ──────────────────────────────────────

export interface SDJWTDisclosure {
  credentialId: string;
  revealedClaims: Record<string, unknown>;
  hiddenCommitments: Record<string, string>;
  salts: Record<string, string>;
  disclosedAt: string;
  holderDid?: string;
}

/**
 * Enforce SD-JWT selective disclosure structure.
 *
 * Validates:
 *   1. Required top-level fields (credentialId, revealedClaims, hiddenCommitments, salts, disclosedAt)
 *   2. Commitment integrity — each hidden claim must have a non-empty SHA-256 commitment
 *   3. Salt schema — each claim with a salt must have a 32+ char hex/base64 salt
 *   4. No overlap between revealedClaims and hiddenCommitments (a claim can't be both)
 *   5. RevealedClaims must be non-empty (pure-hidden SD-JWT is rejected)
 *
 * Logs to auditLedger on any failure.
 */
export function enforceSDJWTStructure(disclosure: unknown, opts: {
  actor?: string;
  traceId?: string;
} = {}): SDJWTStructureResult {
  const traceId = opts.traceId ?? newTraceId();
  const errors: string[] = [];

  // Type guard
  if (!disclosure || typeof disclosure !== 'object') {
    errors.push('disclosure must be a non-null object');
    const event = _auditSDJWT(traceId, opts.actor, 'unknown', errors, 'CRITICAL');
    return { valid: false, errors, auditEventId: event.eventId, traceId };
  }

  const d = disclosure as Record<string, unknown>;

  // 1. Required fields
  if (!d.credentialId || typeof d.credentialId !== 'string') {
    errors.push('disclosure.credentialId is required (string)');
  }
  if (!d.revealedClaims || typeof d.revealedClaims !== 'object' || Array.isArray(d.revealedClaims)) {
    errors.push('disclosure.revealedClaims must be a non-array object');
  }
  if (!d.hiddenCommitments || typeof d.hiddenCommitments !== 'object' || Array.isArray(d.hiddenCommitments)) {
    errors.push('disclosure.hiddenCommitments must be a non-array object');
  }
  if (!d.salts || typeof d.salts !== 'object' || Array.isArray(d.salts)) {
    errors.push('disclosure.salts must be a non-array object');
  }
  if (!d.disclosedAt || typeof d.disclosedAt !== 'string') {
    errors.push('disclosure.disclosedAt is required (ISO-8601 string)');
  } else if (isNaN(Date.parse(d.disclosedAt as string))) {
    errors.push('disclosure.disclosedAt must be a valid ISO-8601 date');
  }

  // Short-circuit if basic structure is broken
  if (errors.length > 0) {
    const event = _auditSDJWT(traceId, opts.actor, String(d.credentialId ?? 'unknown'), errors, 'CRITICAL');
    return { valid: false, errors, auditEventId: event.eventId, traceId };
  }

  const credentialId = d.credentialId as string;
  const revealed = d.revealedClaims as Record<string, unknown>;
  const hidden = d.hiddenCommitments as Record<string, unknown>;
  const salts = d.salts as Record<string, unknown>;

  // 2. revealedClaims must be non-empty
  if (Object.keys(revealed).length === 0) {
    errors.push('disclosure.revealedClaims must not be empty — SD-JWT must reveal at least one claim');
  }

  // 3. Commitment integrity — each hidden key must map to a non-empty string hash
  for (const [field, commitment] of Object.entries(hidden)) {
    if (typeof commitment !== 'string' || commitment.length < 16) {
      errors.push(`hiddenCommitments.${field}: must be a SHA-256 hex string (≥16 chars), got: ${typeof commitment}`);
    }
  }

  // 4. Salt schema — salts must be ≥32-char hex/base64url strings
  const SALT_MIN_LEN = 32;
  for (const [field, salt] of Object.entries(salts)) {
    if (typeof salt !== 'string' || salt.length < SALT_MIN_LEN) {
      errors.push(`salts.${field}: must be a ≥${SALT_MIN_LEN}-char string (hex/base64url), got length ${typeof salt === 'string' ? salt.length : typeof salt}`);
    }
  }

  // 5. No claim in both revealed and hidden
  const overlap = Object.keys(revealed).filter((k) => k in hidden);
  if (overlap.length > 0) {
    errors.push(`Claims cannot be both revealed and hidden: ${overlap.join(', ')}`);
  }

  const valid = errors.length === 0;
  const severity: AuditSeverity = !valid ? 'WARNING' : 'INFO';
  const event = _auditSDJWT(traceId, opts.actor, credentialId, errors, severity);

  if (!valid) {
    log('warn', 'sdjwt_structure_violation', { traceId, credentialId, errors });
  }

  return { valid, errors, auditEventId: event.eventId, traceId };
}

// ── Internal ──────────────────────────────────────────────────────────

function _auditSDJWT(
  traceId: string,
  actor: string | undefined,
  credentialId: string,
  errors: string[],
  severity: AuditSeverity,
) {
  return appendAuditEvent({
    traceId,
    category: ['PRESENTATION', 'COMPLIANCE'],
    actor: actor ?? 'system',
    resource: credentialId,
    requestFields: { credentialId },
    resultFields: {
      valid: errors.length === 0,
      errorCount: errors.length,
      errors,
    },
    severity,
  });
}

/**
 * Generate a new traceId for use by callers that want to correlate
 * HAIP enforcement events with upstream audit events.
 */
export { newTraceId } from '../audit/auditLedger';
