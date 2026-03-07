/**
 * hipaaGuard.ts — Wave B (salvaged from feature/interoperability-wave65)
 *
 * HIPAA compliance guardrails:
 *   - PHI pattern detection in text blobs
 *   - AES-256-GCM encryption / decryption for PHI fields
 *   - In-memory access log with circular buffer (production: persist to AuditEvent)
 *   - Text redaction for safe logging / display
 *
 * Usage:
 *   - Call detectPhiInText() before logging any user-supplied string
 *   - Call redactPhi() before returning text in API responses to verifiers
 *   - Call logAccess() for every read/write/export of a clinician record
 *   - Use encryptPhi() / decryptPhi() for any PHI field stored outside Postgres RLS
 *
 * Production upgrade path:
 *   - Replace in-memory accessLog with prisma.auditEvent.create()
 *   - Replace env-var key derivation with KMS (AWS KMS, GCP KMS, or HashiCorp Vault)
 */

import crypto from 'crypto';

// ── Types ──────────────────────────────────────────────────────────────────

export interface AccessLogEntry {
  timestamp: string;
  userId: string;
  action: 'read' | 'write' | 'delete' | 'export';
  resourceType: string;
  resourceId: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  reason?: string;
}

export interface PhiDetectionResult {
  containsPhi: boolean;
  matches: Array<{ name: string; classification: PhiField['classification'] }>;
}

export interface PhiField {
  fieldName: string;
  encrypted: boolean;
  classification: 'identifier' | 'demographic' | 'clinical' | 'financial';
}

// ── PHI Patterns ───────────────────────────────────────────────────────────
// Ordered by specificity — more specific first to avoid partial overlaps.

const PHI_PATTERNS: Array<{
  name: string;
  pattern: RegExp;
  classification: PhiField['classification'];
}> = [
  { name: 'SSN',                 pattern: /\b\d{3}-\d{2}-\d{4}\b/,                                       classification: 'identifier'  },
  { name: 'Medical Record Number', pattern: /\bMRN[:\s#]?\d{6,}\b/i,                                   classification: 'clinical'    },
  { name: 'Date of Birth',       pattern: /\b(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}\b/,          classification: 'demographic' },
  { name: 'Phone Number',        pattern: /\b(\+1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/,        classification: 'demographic' },
  { name: 'Email',               pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,          classification: 'demographic' },
  { name: 'Credit Card',         pattern: /\b(?:\d{4}[\s-]?){3}\d{4}\b/,                                 classification: 'financial'   },
  { name: 'DEA Number',          pattern: /\b[A-Z]{2}\d{7}\b/,                                           classification: 'identifier'  },
];

// ── PHI Detection ──────────────────────────────────────────────────────────

export function detectPhiInText(text: string): PhiDetectionResult {
  const matches: PhiDetectionResult['matches'] = [];
  for (const p of PHI_PATTERNS) {
    if (p.pattern.test(text)) {
      matches.push({ name: p.name, classification: p.classification });
    }
  }
  return { containsPhi: matches.length > 0, matches };
}

export function containsPhi(text: string): boolean {
  return PHI_PATTERNS.some((p) => p.pattern.test(text));
}

// ── Text Redaction ─────────────────────────────────────────────────────────

export function redactPhi(text: string): string {
  let result = text;
  for (const p of PHI_PATTERNS) {
    result = result.replace(p.pattern, `[${p.name} REDACTED]`);
  }
  return result;
}

// ── Encryption ─────────────────────────────────────────────────────────────
// AES-256-GCM: authenticated encryption with 96-bit IV and 128-bit tag.
// Wire format: base64( IV[12] || TAG[16] || CIPHERTEXT )

const ALGO = 'aes-256-gcm' as const;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Derive a 256-bit key from a passphrase. In production replace with KMS.
 */
export function deriveKeyFromPassphrase(passphrase: string): Buffer {
  return crypto.scryptSync(passphrase, 'vitalcv-hipaa-salt-v1', 32);
}

export function encryptPhi(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptPhi(encoded: string, key: Buffer): string {
  const data = Buffer.from(encoded, 'base64');
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8');
}

// ── Access Log ─────────────────────────────────────────────────────────────
// Circular buffer — max 10,000 entries in memory.
// Production: replace push with prisma.auditEvent.create().

const MAX_LOG_SIZE = 10_000;
const accessLog: AccessLogEntry[] = [];

export function logAccess(entry: Omit<AccessLogEntry, 'timestamp'>): void {
  accessLog.push({ ...entry, timestamp: new Date().toISOString() });
  if (accessLog.length > MAX_LOG_SIZE) accessLog.shift();
}

export function getAccessLog(filters?: {
  userId?: string;
  resourceType?: string;
  since?: string;
}): AccessLogEntry[] {
  let entries = [...accessLog];
  if (filters?.userId) entries = entries.filter((e) => e.userId === filters.userId);
  if (filters?.resourceType) entries = entries.filter((e) => e.resourceType === filters.resourceType);
  if (filters?.since) {
    const since = new Date(filters.since).getTime();
    entries = entries.filter((e) => new Date(e.timestamp).getTime() >= since);
  }
  return entries;
}

export const hipaaGuard = {
  detectPhiInText,
  containsPhi,
  redactPhi,
  encryptPhi,
  decryptPhi,
  deriveKeyFromPassphrase,
  logAccess,
  getAccessLog,
};
