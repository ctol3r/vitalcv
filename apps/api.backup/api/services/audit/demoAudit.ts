/**
 * B146C-SEC-002: Demo Audit Logging Service
 *
 * Masks clinician and organization identifiers in demo audit logs by hashing/pseudonymizing
 * them. This ensures that raw IDs are not present in log text, protecting privacy in demo environments.
 *
 * Usage:
 *   import { demoAuditEvent } from './services/audit/demoAudit';
 *   demoAuditEvent('action_type', { clinicianId: '123', orgId: '456', otherData: 'value' });
 */

import crypto from 'crypto';
import { logger } from '../logging/logger';

export interface DemoAuditEvent {
  eventType: string;
  action: string;
  timestamp: Date;
  payload: Record<string, any>;
  // Pseudonymized identifiers
  clinicianIdHash?: string;
  orgIdHash?: string;
}

/**
 * Hash an identifier using SHA-256 with a salt
 * Uses a consistent salt per identifier to enable correlation while masking raw values
 */
function hashIdentifier(identifier: string, salt?: string): string {
  const saltToUse = salt || process.env.DEMO_AUDIT_SALT || 'demo-audit-salt-default';
  const hash = crypto.createHash('sha256').update(`${saltToUse}:${identifier}`).digest('hex');
  // Return first 16 chars for readability (still cryptographically secure for demo purposes)
  return hash.substring(0, 16);
}

/**
 * Pseudonymize an identifier by creating a consistent pseudonym
 * This allows correlation of events from the same entity without exposing the real ID
 */
function pseudonymizeIdentifier(identifier: string): string {
  // Use a deterministic pseudonymization approach
  // In production, consider using a keyed hash function (HMAC) with a secret key
  const hash = hashIdentifier(identifier);
  return `demo_${hash}`;
}

/**
 * Mask clinician and org identifiers in the payload
 * Returns a new payload object with identifiers replaced by hashes/pseudonyms
 */
function maskIdentifiers(payload: Record<string, any>): Record<string, any> {
  const masked: Record<string, any> = { ...payload };

  // Mask clinicianId variants
  if (masked.clinicianId) {
    masked.clinicianIdHash = hashIdentifier(String(masked.clinicianId));
    masked.clinicianId = pseudonymizeIdentifier(String(masked.clinicianId));
  }
  if (masked.clinician_id) {
    masked.clinicianIdHash = hashIdentifier(String(masked.clinician_id));
    masked.clinician_id = pseudonymizeIdentifier(String(masked.clinician_id));
  }
  if (masked.userId && (masked.userId as string).startsWith('clinician_')) {
    masked.clinicianIdHash = hashIdentifier(String(masked.userId));
    masked.userId = pseudonymizeIdentifier(String(masked.userId));
  }

  // Mask orgId variants
  if (masked.orgId) {
    masked.orgIdHash = hashIdentifier(String(masked.orgId));
    masked.orgId = pseudonymizeIdentifier(String(masked.orgId));
  }
  if (masked.org_id) {
    masked.orgIdHash = hashIdentifier(String(masked.org_id));
    masked.org_id = pseudonymizeIdentifier(String(masked.org_id));
  }
  if (masked.organizationId) {
    masked.orgIdHash = hashIdentifier(String(masked.organizationId));
    masked.organizationId = pseudonymizeIdentifier(String(masked.organizationId));
  }

  return masked;
}

/**
 * Log a demo audit event with masked identifiers
 *
 * @param eventType - Type of event (e.g., 'DEMO_ACTION', 'DEMO_ACCESS')
 * @param action - Specific action taken (e.g., 'view_profile', 'submit_application')
 * @param payload - Event payload (will have clinicianId/orgId masked)
 * @returns The audit event object
 */
export function demoAuditEvent(
  eventType: string,
  action: string,
  payload: Record<string, any> = {}
): DemoAuditEvent {
  // Mask identifiers in payload
  const maskedPayload = maskIdentifiers(payload);

  const event: DemoAuditEvent = {
    eventType,
    action,
    timestamp: new Date(),
    payload: maskedPayload,
    clinicianIdHash: maskedPayload.clinicianIdHash,
    orgIdHash: maskedPayload.orgIdHash,
  };

  // Log the event (logger will also filter PHI)
  logger.info(`[DEMO_AUDIT] ${eventType}:${action}`, {
    eventType,
    action,
    timestamp: event.timestamp.toISOString(),
    clinicianIdHash: event.clinicianIdHash,
    orgIdHash: event.orgIdHash,
    payload: maskedPayload,
  });

  return event;
}

/**
 * Check if a string contains raw clinician or org IDs (for testing)
 * Used in tests to verify that raw IDs are not present in log output
 */
export function containsRawIdentifiers(text: string): boolean {
  // Patterns that might indicate raw IDs leaked
  // This is a simple heuristic - adjust based on your ID format
  const rawIdPatterns = [
    /clinician_[a-f0-9]{32}/i,  // UUID-like clinician IDs
    /org_[a-f0-9]{32}/i,        // UUID-like org IDs
    /\b\d{10,}\b/,              // Long numeric IDs (likely not pseudonyms)
  ];

  return rawIdPatterns.some(pattern => pattern.test(text));
}

