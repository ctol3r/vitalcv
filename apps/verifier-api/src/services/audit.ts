import crypto from 'crypto';

/**
 * Audit Service for Verifier API
 * B110B-EUDI-018: Proper audit logging for EUDI wallet enforcement
 *
 * Logs security events including blocked non-EUDI presentations.
 * Uses Prisma if available, otherwise falls back to console logging.
 */

interface AuditEventData {
  userId?: string;
  reason: string;
  path: string;
  method: string;
  headers?: Record<string, string | undefined>;
  timestamp: string;
  [key: string]: any;
}

interface VerificationEventInput {
  credentialId: string;
  verifierId: string;
  valid: boolean;
  vc: unknown;
  issuer?: string;
  subject?: string;
}

function sha256Hex(payload: string): string {
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Log an audit event
 *
 * @param eventType - Type of event (e.g., 'eudi_presentation_blocked')
 * @param data - Event data
 */
export async function auditLog(
  eventType: string,
  data: AuditEventData
): Promise<void> {
  const auditEvent = {
    type: eventType,
    userId: data.userId || 'anonymous',
    data: {
      reason: data.reason,
      path: data.path,
      method: data.method,
      headers: data.headers,
      timestamp: data.timestamp,
      ...data,
    },
    createdAt: new Date(),
  };

  // Try to use Prisma if available
  try {
    // Dynamic import to avoid requiring Prisma as a hard dependency
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    await prisma.auditEvent.create({
      data: {
        type: auditEvent.type,
        userId: auditEvent.userId !== 'anonymous' ? auditEvent.userId : null,
        data: auditEvent.data as any,
      },
    });

    await prisma.$disconnect();
  } catch (error) {
    // Prisma not available or error - fall back to console logging
    // This ensures audit logging always works, even without database
    console.warn('[AUDIT]', {
      ...auditEvent,
      _fallback: true,
      _error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export async function logVerificationEvent(input: VerificationEventInput): Promise<void> {
  const createdAt = new Date();
  const vcHash = sha256Hex(JSON.stringify(input.vc));
  await auditLog('VERIFY_CREDENTIAL', {
    reason: 'credential_verification',
    path: '/verify/credential',
    method: 'POST',
    timestamp: createdAt.toISOString(),
    credentialId: input.credentialId,
    verifierId: input.verifierId,
    valid: input.valid,
    issuer: input.issuer,
    subject: input.subject,
    vcHash,
  });
}
