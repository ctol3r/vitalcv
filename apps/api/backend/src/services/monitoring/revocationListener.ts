/**
 * revocationListener.ts — Wave 85: Revocation Signal Listener
 *
 * Detects revocation signals from issuers by scanning recent
 * audit events and artifact status changes.
 */

import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────

export interface RevocationSignal {
  artifactId: string;
  npi: string;
  source: string;
  previousState: string;
  currentState: string;
  detectedAt: string;
}

// ── Listener ──────────────────────────────────────────────────────────

/**
 * Scan for recent revocation events (last 24h by default).
 */
export async function detectRevocationSignals(
  lookbackHours: number = 24,
): Promise<RevocationSignal[]> {
  const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

  const events = await prisma.auditEvent.findMany({
    where: {
      type: { in: ['BIDIRECTIONAL_FLAG_INVALID', 'DECISION_CASCADE_TRIGGERED', 'STATUS_CHANGE_REVOKED'] },
      createdAt: { gte: since },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const signals: RevocationSignal[] = events.map((ev) => {
    const meta = ev.metadata as Record<string, unknown> | null;
    return {
      artifactId: ev.referenceId ?? '',
      npi: ev.clinicianId ?? '',
      source: typeof meta?.['decisionType'] === 'string' ? meta['decisionType'] : ev.type,
      previousState: typeof meta?.['previousStatus'] === 'string' ? meta['previousStatus'] : 'UNKNOWN',
      currentState: typeof meta?.['newStatus'] === 'string' ? meta['newStatus'] : 'REVOKED',
      detectedAt: ev.createdAt.toISOString(),
    };
  });

  log('info', 'revocation_listener: signals detected', { lookbackHours, count: signals.length });
  return signals;
}
