/**
 * expirationScanner.ts — Wave 85: Credential Expiration Scanner
 *
 * Scans credential artifacts and detects expiration windows:
 * expired, < 30 days, < 90 days.
 */

import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────

export type ExpirationSeverity = 'EXPIRED' | 'CRITICAL' | 'WARNING' | 'OK';

export interface ExpirationAlert {
  artifactId: string;
  npi: string;
  source: string;
  status: string;
  severity: ExpirationSeverity;
  daysRemaining: number;
  estimatedExpiry: string;
}

// ── Scanner ───────────────────────────────────────────────────────────

export async function scanExpirations(): Promise<ExpirationAlert[]> {
  const artifacts = await prisma.verificationArtifact.findMany({
    where: { status: { notIn: ['REVOKED', 'SUSPENDED'] } },
    select: { id: true, npi: true, source: true, status: true, verifiedAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  const alerts: ExpirationAlert[] = [];
  const now = Date.now();

  for (const art of artifacts) {
    const baseDate = art.verifiedAt ?? art.createdAt;
    const estimatedExpiry = new Date(baseDate).getTime() + 365 * 24 * 60 * 60 * 1000;
    const daysRemaining = Math.floor((estimatedExpiry - now) / (24 * 60 * 60 * 1000));

    let severity: ExpirationSeverity = 'OK';
    if (daysRemaining <= 0) severity = 'EXPIRED';
    else if (daysRemaining <= 30) severity = 'CRITICAL';
    else if (daysRemaining <= 90) severity = 'WARNING';

    if (severity !== 'OK') {
      alerts.push({
        artifactId: art.id,
        npi: art.npi,
        source: art.source,
        status: art.status,
        severity,
        daysRemaining,
        estimatedExpiry: new Date(estimatedExpiry).toISOString(),
      });
    }
  }

  log('info', 'expiration_scanner: scan complete', { total: artifacts.length, alerts: alerts.length });
  return alerts.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

/**
 * Scan expirations for a specific NPI.
 */
export async function scanExpirationsByNpi(npi: string): Promise<ExpirationAlert[]> {
  const all = await scanExpirations();
  return all.filter((a) => a.npi === npi);
}
