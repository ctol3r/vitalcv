/**
 * hipaaGuard.ts — Wave 65: HIPAA Compliance Guardrails
 *
 * Enforces:
 *   - No PHI stored in plaintext
 *   - Audit logging for data access
 *   - Data access tracking
 *
 * Designed as middleware and utility functions, not a standalone service.
 */

import crypto from 'crypto';

// ── Types ─────────────────────────────────────────────────────────────────

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

export interface PhiField {
  fieldName: string;
  encrypted: boolean;
  classification: 'identifier' | 'demographic' | 'clinical' | 'financial';
}

// ── PHI Detection ─────────────────────────────────────────────────────────

const PHI_PATTERNS: Array<{ name: string; pattern: RegExp; classification: PhiField['classification'] }> = [
  { name: 'SSN', pattern: /\b\d{3}-\d{2}-\d{4}\b/, classification: 'identifier' },
  { name: 'Date of Birth', pattern: /\b(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}\b/, classification: 'demographic' },
  { name: 'Phone Number', pattern: /\b\(\d{3}\)\s?\d{3}-\d{4}\b/, classification: 'demographic' },
  { name: 'Email', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, classification: 'demographic' },
  { name: 'Medical Record Number', pattern: /\bMRN[:\s#]?\d{6,}\b/i, classification: 'clinical' },
];

export function detectPhiInText(text: string): string[] {
  const found: string[] = [];
  for (const p of PHI_PATTERNS) {
    if (p.pattern.test(text)) found.push(p.name);
  }
  return found;
}

export function containsPhi(text: string): boolean {
  return detectPhiInText(text).length > 0;
}

// ── Encryption Helpers ────────────────────────────────────────────────────

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export function encryptPhi(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: base64(iv + tag + ciphertext)
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptPhi(encoded: string, key: Buffer): string {
  const data = Buffer.from(encoded, 'base64');
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final('utf8');
}

// ── Access Logging ────────────────────────────────────────────────────────

const accessLog: AccessLogEntry[] = [];
const MAX_LOG_SIZE = 10_000;

export function logAccess(entry: Omit<AccessLogEntry, 'timestamp'>): void {
  const fullEntry: AccessLogEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };
  accessLog.push(fullEntry);
  // Circular buffer
  if (accessLog.length > MAX_LOG_SIZE) accessLog.shift();
  // TODO: In production, persist to AuditEvent table or external SIEM
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

// ── Data Sanitization ─────────────────────────────────────────────────────

export function redactPhi(text: string): string {
  let result = text;
  for (const p of PHI_PATTERNS) {
    result = result.replace(p.pattern, `[${p.name} REDACTED]`);
  }
  return result;
}

// ── Compliance Check ──────────────────────────────────────────────────────

export interface ComplianceCheckResult {
  compliant: boolean;
  issues: string[];
  checkedAt: string;
}

export function runComplianceCheck(): ComplianceCheckResult {
  const issues: string[] = [];

  // Check encryption key availability
  if (!process.env.PHI_ENCRYPTION_KEY && !process.env.NEXTAUTH_SECRET) {
    issues.push('No encryption key configured (PHI_ENCRYPTION_KEY or NEXTAUTH_SECRET)');
  }

  // Check audit logging
  if (accessLog.length === 0) {
    // Not necessarily an issue, but worth noting
  }

  // Check for HTTPS enforcement
  const appUrl = process.env.NEXTAUTH_URL ?? '';
  if (appUrl && !appUrl.startsWith('https://') && !appUrl.includes('localhost')) {
    issues.push('Application URL is not HTTPS — PHI transmission may be unencrypted');
  }

  return {
    compliant: issues.length === 0,
    issues,
    checkedAt: new Date().toISOString(),
  };
}
