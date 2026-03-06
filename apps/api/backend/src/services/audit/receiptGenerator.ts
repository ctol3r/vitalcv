/**
 * receiptGenerator.ts — Wave 114: Audit Receipt Generator
 *
 * Generates cryptographically-structured receipts for key trust events:
 * - Issuance receipts (credential issued)
 * - Presentation receipts (credential presented)
 * - Verification receipts (credential verified / accepted)
 */

import { createHash, randomUUID } from 'node:crypto';
import { log } from '../../obs/logger';
import type { VerifiableCredential } from '../credentials/credentialModel';

// ── Types ─────────────────────────────────────────────────────────────

export type ReceiptType = 'ISSUANCE' | 'PRESENTATION' | 'VERIFICATION';
export type ReceiptStatus = 'SUCCESS' | 'FAILED' | 'PARTIAL';

export interface AuditReceipt {
  receiptId: string;
  type: ReceiptType;
  status: ReceiptStatus;
  /** ISO-8601 timestamp */
  issuedAt: string;
  /** SHA-256 hash of the canonical receipt payload (integrity anchor) */
  hash: string;
  /** The canonical receipt payload (pre-hash) */
  payload: IssuanceReceiptPayload | PresentationReceiptPayload | VerificationReceiptPayload;
  /** Human-readable summary */
  summary: string;
  /** Verifier or issuer DID */
  actor: string;
  /** Subject of the action */
  subject: string;
}

export interface IssuanceReceiptPayload {
  credentialId: string;
  issuer: string;
  subject: string;
  credentialTypes: string[];
  issuedAt: string;
  expiresAt?: string;
  format: string;
  schemaVersion: string;
}

export interface PresentationReceiptPayload {
  presentationId: string;
  holder: string;
  verifier: string;
  credentialCount: number;
  disclosedClaims: string[];
  withheldClaimsCount: number;
  presentedAt: string;
  requestId?: string;
}

export interface VerificationReceiptPayload {
  credentialId: string;
  verifier: string;
  subject: string;
  valid: boolean;
  checks: {
    signature: boolean;
    issuerTrusted: boolean;
    statusActive: boolean;
    notExpired: boolean;
  };
  haipCompliant?: boolean;
  errors: string[];
  verifiedAt: string;
}

// ── In-memory store ───────────────────────────────────────────────────

const receipts = new Map<string, AuditReceipt>();

// ── Helpers ───────────────────────────────────────────────────────────

function canonicalHash(payload: object): string {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  return 'sha256:' + createHash('sha256').update(canonical).digest('hex');
}

function storeReceipt(receipt: AuditReceipt): void {
  receipts.set(receipt.receiptId, receipt);
  log('info', 'audit_receipt_generated', {
    receiptId: receipt.receiptId,
    type: receipt.type,
    status: receipt.status,
    subject: receipt.subject,
  });
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Generate an issuance receipt for a credential.
 */
export function generateIssuanceReceipt(
  credential: VerifiableCredential,
  format = 'jwt_vc_json',
): AuditReceipt {
  const receiptId = randomUUID();
  const issuedAt = new Date().toISOString();

  const payload: IssuanceReceiptPayload = {
    credentialId: credential.credentialId,
    issuer: credential.issuer,
    subject: credential.subject,
    credentialTypes: (credential.claims['type'] as string[]) ?? ['VerifiableCredential'],
    issuedAt: credential.issuedAt,
    expiresAt: credential.expiresAt,
    format,
    schemaVersion: credential.schemaVersion,
  };

  const receipt: AuditReceipt = {
    receiptId,
    type: 'ISSUANCE',
    status: 'SUCCESS',
    issuedAt,
    hash: canonicalHash(payload),
    payload,
    summary: `Credential ${credential.credentialId} issued by ${credential.issuer} to ${credential.subject}`,
    actor: credential.issuer,
    subject: credential.subject,
  };

  storeReceipt(receipt);
  return receipt;
}

/**
 * Generate a presentation receipt.
 */
export function generatePresentationReceipt(opts: {
  presentationId: string;
  holder: string;
  verifier: string;
  disclosedClaims: string[];
  withheldClaimsCount: number;
  credentialCount: number;
  requestId?: string;
}): AuditReceipt {
  const receiptId = randomUUID();
  const issuedAt = new Date().toISOString();

  const payload: PresentationReceiptPayload = {
    presentationId: opts.presentationId,
    holder: opts.holder,
    verifier: opts.verifier,
    credentialCount: opts.credentialCount,
    disclosedClaims: opts.disclosedClaims,
    withheldClaimsCount: opts.withheldClaimsCount,
    presentedAt: issuedAt,
    requestId: opts.requestId,
  };

  const receipt: AuditReceipt = {
    receiptId,
    type: 'PRESENTATION',
    status: 'SUCCESS',
    issuedAt,
    hash: canonicalHash(payload),
    payload,
    summary: `Presentation ${opts.presentationId} by ${opts.holder} to ${opts.verifier} (${opts.disclosedClaims.length} claims disclosed, ${opts.withheldClaimsCount} withheld)`,
    actor: opts.verifier,
    subject: opts.holder,
  };

  storeReceipt(receipt);
  return receipt;
}

/**
 * Generate a verification receipt.
 */
export function generateVerificationReceipt(opts: {
  credentialId: string;
  verifier: string;
  subject: string;
  valid: boolean;
  checks: { signature: boolean; issuerTrusted: boolean; statusActive: boolean; notExpired: boolean };
  haipCompliant?: boolean;
  errors: string[];
}): AuditReceipt {
  const receiptId = randomUUID();
  const issuedAt = new Date().toISOString();

  const payload: VerificationReceiptPayload = {
    credentialId: opts.credentialId,
    verifier: opts.verifier,
    subject: opts.subject,
    valid: opts.valid,
    checks: opts.checks,
    haipCompliant: opts.haipCompliant,
    errors: opts.errors,
    verifiedAt: issuedAt,
  };

  const receipt: AuditReceipt = {
    receiptId,
    type: 'VERIFICATION',
    status: opts.valid ? 'SUCCESS' : 'FAILED',
    issuedAt,
    hash: canonicalHash(payload),
    payload,
    summary: `Credential ${opts.credentialId} verified by ${opts.verifier}: ${opts.valid ? 'VALID' : 'INVALID'}`,
    actor: opts.verifier,
    subject: opts.subject,
  };

  storeReceipt(receipt);
  return receipt;
}

/**
 * Get a receipt by ID.
 */
export function getReceipt(receiptId: string): AuditReceipt | null {
  return receipts.get(receiptId) ?? null;
}

/**
 * List all receipts, optionally filtered by type.
 */
export function listReceipts(type?: ReceiptType): AuditReceipt[] {
  const all = Array.from(receipts.values()).sort(
    (a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime(),
  );
  return type ? all.filter((r) => r.type === type) : all;
}

/**
 * Count receipts by type.
 */
export function receiptStats(): Record<ReceiptType, number> {
  const all = Array.from(receipts.values());
  return {
    ISSUANCE: all.filter((r) => r.type === 'ISSUANCE').length,
    PRESENTATION: all.filter((r) => r.type === 'PRESENTATION').length,
    VERIFICATION: all.filter((r) => r.type === 'VERIFICATION').length,
  };
}
