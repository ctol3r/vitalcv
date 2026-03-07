/**
 * receiptGenerator.ts — Wave 114 + 126: Audit Receipt Generator
 *
 * Generates cryptographically-structured receipt metadata and persists it
 * through a repository abstraction.
 */

import { createHash, randomUUID } from 'node:crypto';
import { log } from '../../obs/logger';
import {
  PrismaAuditReceiptsRepository,
  type AuditReceiptsRepository,
} from '../../../repositories/auditReceipts.repo';
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

// ── Repository management ────────────────────────────────────────────

let auditReceiptsRepository: AuditReceiptsRepository = new PrismaAuditReceiptsRepository();

export function setAuditReceiptsRepository(repository: AuditReceiptsRepository): void {
  auditReceiptsRepository = repository;
}

export function resetAuditReceiptsRepository(): void {
  setAuditReceiptsRepository(new PrismaAuditReceiptsRepository());
}

// ── Helpers ───────────────────────────────────────────────────────────

function canonicalHash(payload: object): string {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  return 'sha256:' + createHash('sha256').update(canonical).digest('hex');
}

async function storeReceipt(receipt: AuditReceipt): Promise<AuditReceipt> {
  const persisted = await auditReceiptsRepository.saveReceipt(receipt);
  log('info', 'audit_receipt_generated', {
    receiptId: persisted.receiptId,
    type: persisted.type,
    status: persisted.status,
    subject: persisted.subject,
  });
  return persisted;
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Generate an issuance receipt for a credential.
 */
export async function generateIssuanceReceipt(
  credential: VerifiableCredential,
  format = 'jwt_vc_json',
): Promise<AuditReceipt> {
  const receiptId = randomUUID();
  const issuedAt = new Date().toISOString();

  const payload: IssuanceReceiptPayload = {
    credentialId: credential.credentialId,
    issuer: credential.issuer,
    subject: credential.subject,
    credentialTypes: (credential.claims.type as string[]) ?? ['VerifiableCredential'],
    issuedAt: credential.issuedAt,
    expiresAt: credential.expiresAt,
    format,
    schemaVersion: credential.schemaVersion,
  };

  return storeReceipt({
    receiptId,
    type: 'ISSUANCE',
    status: 'SUCCESS',
    issuedAt,
    hash: canonicalHash(payload),
    payload,
    summary: `Credential ${credential.credentialId} issued by ${credential.issuer} to ${credential.subject}`,
    actor: credential.issuer,
    subject: credential.subject,
  });
}

/**
 * Generate a presentation receipt.
 */
export async function generatePresentationReceipt(opts: {
  presentationId: string;
  holder: string;
  verifier: string;
  disclosedClaims: string[];
  withheldClaimsCount: number;
  credentialCount: number;
  requestId?: string;
}): Promise<AuditReceipt> {
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

  return storeReceipt({
    receiptId,
    type: 'PRESENTATION',
    status: 'SUCCESS',
    issuedAt,
    hash: canonicalHash(payload),
    payload,
    summary: `Presentation ${opts.presentationId} by ${opts.holder} to ${opts.verifier} (${opts.disclosedClaims.length} claims disclosed, ${opts.withheldClaimsCount} withheld)`,
    actor: opts.verifier,
    subject: opts.holder,
  });
}

/**
 * Generate a verification receipt.
 */
export async function generateVerificationReceipt(opts: {
  credentialId: string;
  verifier: string;
  subject: string;
  valid: boolean;
  checks: { signature: boolean; issuerTrusted: boolean; statusActive: boolean; notExpired: boolean };
  haipCompliant?: boolean;
  errors: string[];
}): Promise<AuditReceipt> {
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

  return storeReceipt({
    receiptId,
    type: 'VERIFICATION',
    status: opts.valid ? 'SUCCESS' : 'FAILED',
    issuedAt,
    hash: canonicalHash(payload),
    payload,
    summary: `Credential ${opts.credentialId} verified by ${opts.verifier}: ${opts.valid ? 'VALID' : 'INVALID'}`,
    actor: opts.verifier,
    subject: opts.subject,
  });
}

/**
 * Get a receipt by ID.
 */
export async function getReceipt(receiptId: string): Promise<AuditReceipt | null> {
  return auditReceiptsRepository.getReceipt(receiptId);
}

/**
 * List all receipts, optionally filtered by type.
 */
export async function listReceipts(type?: ReceiptType): Promise<AuditReceipt[]> {
  return auditReceiptsRepository.listReceipts(type);
}

/**
 * Count receipts by type.
 */
export async function receiptStats(): Promise<Record<ReceiptType, number>> {
  return auditReceiptsRepository.receiptStats();
}
