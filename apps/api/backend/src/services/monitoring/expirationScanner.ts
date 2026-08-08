/**
 * expirationScanner.ts — credential expiration windows.
 *
 * ## What this used to do, and why it was wrong
 *
 * Until 2026-08-08 this scanner did not read the expiry date at all. It
 * computed `(verifiedAt ?? createdAt) + 365 days` and reported the result as
 * fact — so every artifact older than a year was announced as an expired
 * credential, at CRITICAL severity, for a real named clinician, on a public
 * endpoint (`GET /api/monitoring/events`). The real date was sitting unused
 * in `VerificationArtifact.expiresAt` on the same row.
 *
 * ## What it does now
 *
 * Reads `expiresAt`. When it is null, **emits nothing**.
 *
 * There is deliberately no replacement heuristic. An unknown expiry is not a
 * finding: "we do not know when this expires" and "this has expired" are
 * different statements and only one of them can be supported. A credential
 * whose source never published an expiry (NPPES identity, an OIG exclusion
 * check) simply has nothing to say here, and saying nothing is the honest
 * output.
 *
 * The window is pushed into the query rather than applied in a loop, so the
 * scan reads only rows that could produce an alert — no unbounded table
 * scan, and no arbitrary `take` that would silently truncate.
 */

import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────

export type ExpirationSeverity = 'EXPIRED' | 'CRITICAL' | 'WARNING';

export interface ExpirationAlert {
  artifactId: string;
  npi: string;
  source: string;
  status: string;
  severity: ExpirationSeverity;
  daysRemaining: number;
  /**
   * The expiry the SOURCE published, read from the artifact. Named for what
   * it is: the previous field was called `estimatedExpiry` and carried a
   * number this system invented.
   */
  expiresAt: string;
}

/** Alerting horizon. A date further out than this is not yet news. */
const NOTICE_WINDOW_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

function severityFor(daysRemaining: number): ExpirationSeverity {
  if (daysRemaining <= 0) return 'EXPIRED';
  if (daysRemaining <= 30) return 'CRITICAL';
  return 'WARNING';
}

interface ScanOptions {
  /** Injected clock so the windows are testable without waiting a year. */
  now?: Date;
  /** Restrict to one clinician; pushed into the query, not filtered after. */
  npi?: string;
}

export async function scanExpirations(options: ScanOptions = {}): Promise<ExpirationAlert[]> {
  const now = options.now ?? new Date();
  const horizon = new Date(now.getTime() + NOTICE_WINDOW_DAYS * DAY_MS);

  const artifacts = await prisma.verificationArtifact.findMany({
    where: {
      status: { notIn: ['REVOKED', 'SUSPENDED'] },
      // Both halves are load-bearing. `not: null` is the fix — an artifact
      // with no published expiry produces no alert. `lte: horizon` keeps the
      // read bounded by meaning rather than by an arbitrary row cap.
      expiresAt: { not: null, lte: horizon },
      ...(options.npi ? { npi: options.npi } : {}),
    },
    select: { id: true, npi: true, source: true, status: true, expiresAt: true },
    orderBy: { expiresAt: 'asc' },
  });

  const alerts: ExpirationAlert[] = artifacts
    .filter((art): art is typeof art & { expiresAt: Date } => art.expiresAt !== null)
    .map((art) => {
      const daysRemaining = Math.floor((art.expiresAt.getTime() - now.getTime()) / DAY_MS);
      return {
        artifactId: art.id,
        npi: art.npi,
        source: art.source,
        status: art.status,
        severity: severityFor(daysRemaining),
        daysRemaining,
        expiresAt: art.expiresAt.toISOString(),
      };
    });

  log('info', 'expiration_scanner: scan complete', {
    windowDays: NOTICE_WINDOW_DAYS,
    alerts: alerts.length,
    ...(options.npi ? { npi: `${options.npi.slice(0, 4)}****` } : {}),
  });
  return alerts;
}

/**
 * Scan for one clinician. The NPI now goes into the query — this previously
 * scanned every artifact in the table and filtered the result in memory.
 */
export async function scanExpirationsByNpi(
  npi: string,
  options: Omit<ScanOptions, 'npi'> = {},
): Promise<ExpirationAlert[]> {
  return scanExpirations({ ...options, npi });
}
