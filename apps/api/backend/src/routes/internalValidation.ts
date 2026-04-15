/**
 * internalValidation.ts — GET /api/internal/validation
 *
 * Operator-only validation summary. Thin read-through aggregator over
 * existing tables (AuditEvent, DriftEvent, TrustAlertRecord). NO new
 * compute, NO user-facing side effects, NO writes.
 *
 * status = 'degraded' when the summary surfaces any unacknowledged
 * anomaly or active drift case; 'ok' otherwise. The calling dashboard
 * is expected to render the degraded banner + require human
 * investigation.
 */

import type { Express, Request, Response } from 'express';
import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';

interface ValidationSummaryResponse {
  status: 'ok' | 'degraded';
  generatedAt: string;
  lastRun: {
    type: string;
    createdAt: string;
    npi: string | null;
  } | null;
  anomalies: Array<{
    id: string;
    subject: string | null;
    severity: string;
    reason: string;
    createdAt: string;
    acknowledged: boolean;
  }>;
  driftCases: Array<{
    id: string;
    subjectNpi: string;
    source: string;
    driftType: string;
    detectedAt: string;
  }>;
}

export function registerInternalValidationRoutes(app: Express): void {
  app.get('/api/internal/validation', async (_req: Request, res: Response) => {
    const generatedAt = new Date().toISOString();
    try {
      // Run all three reads in parallel. Any failure caps the response
      // at empty-list for that subsystem rather than collapsing the page.
      const [lastRunRow, anomalyRows, driftRows] = await Promise.allSettled([
        prisma.auditEvent.findFirst({
          where: {
            type: {
              in: [
                'monitoring.reverify_required',
                'drift.detected',
                'drift.detected.ingest',
                'monitor.completed',
              ],
            },
          },
          orderBy: { createdAt: 'desc' },
          select: { id: true, type: true, createdAt: true, clinicianId: true },
        }),
        prisma.trustAlertRecord.findMany({
          orderBy: { createdAt: 'desc' },
          take: 25,
          select: {
            id: true,
            subject: true,
            severity: true,
            description: true,
            createdAt: true,
            acknowledged: true,
          },
        }),
        prisma.driftEvent.findMany({
          orderBy: { detectedAt: 'desc' },
          take: 25,
          select: {
            id: true,
            subjectNpi: true,
            source: true,
            driftType: true,
            detectedAt: true,
          },
        }),
      ]);

      const anomalies =
        anomalyRows.status === 'fulfilled'
          ? anomalyRows.value.map((row) => ({
              id: row.id,
              subject: row.subject,
              severity: row.severity,
              reason: row.description,
              createdAt: row.createdAt.toISOString(),
              acknowledged: row.acknowledged,
            }))
          : [];

      const driftCases =
        driftRows.status === 'fulfilled'
          ? driftRows.value.map((row) => ({
              id: row.id,
              subjectNpi: row.subjectNpi,
              source: row.source,
              driftType: row.driftType,
              detectedAt: row.detectedAt.toISOString(),
            }))
          : [];

      const lastRun =
        lastRunRow.status === 'fulfilled' && lastRunRow.value
          ? {
              type: lastRunRow.value.type,
              createdAt: lastRunRow.value.createdAt.toISOString(),
              npi: lastRunRow.value.clinicianId,
            }
          : null;

      const unackedAnomalies = anomalies.filter((a) => !a.acknowledged).length;
      const activeDrifts = driftCases.length;
      const status: 'ok' | 'degraded' =
        unackedAnomalies > 0 || activeDrifts > 0 ? 'degraded' : 'ok';

      const payload: ValidationSummaryResponse = {
        status,
        generatedAt,
        lastRun,
        anomalies,
        driftCases,
      };

      log('info', 'internal_validation_served', {
        status,
        unackedAnomalies,
        activeDrifts,
      });
      return res.status(200).json(payload);
    } catch (error) {
      log('error', 'internal_validation_failed', {
        message: error instanceof Error ? error.message : 'unknown',
      });
      return res.status(500).json({
        status: 'degraded',
        generatedAt,
        error: 'validation_summary_failed',
      });
    }
  });
}
