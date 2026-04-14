/**
 * decisionExport.ts — GET /api/export/:npi
 *
 * Assembles the current Omega state into a single JSON artifact
 * suitable for compliance archival. No new computation — pure
 * projection of orchestrateOmega output into a stable export shape.
 */

import type { Express, Request, Response } from 'express';
import { orchestrateOmega } from '../orchestrator/vcv-omega';
import { log } from '../obs/logger';

const NPI_RE = /^\d{10}$/;
const SYSTEM_VERSION = process.env.GIT_SHA ?? 'pilot';

interface ExportArtifact {
  schemaVersion: '1.0';
  generatedAt: string;
  systemVersion: string;
  clinicianNpi: string;
  decisionState: string | null;
  evidence: {
    oig: { sourceId: string; state: string | null; checkedAt: string | null; reason: string | null } | null;
    nppes: { sourceId: string; state: string | null; checkedAt: string | null; reason: string | null } | null;
    license: { sourceId: string; state: string | null; checkedAt: string | null; reason: string | null } | null;
    pecos: { sourceId: string; state: string | null; checkedAt: string | null; reason: string | null } | null;
  };
  trustSignals: unknown;
  drift: unknown;
  acceptance: unknown;
  activation: unknown;
  recentActions: unknown;
  nextBestAction: unknown;
}

function pickCheck(
  checks: Array<{ sourceId: string; state?: string | null; reason?: string | null; checkedAt?: string | null }>,
  ids: string[],
) {
  const match = checks.find((c) => ids.includes(c.sourceId));
  if (!match) return null;
  return {
    sourceId: match.sourceId,
    state: match.state ?? null,
    checkedAt: match.checkedAt ?? null,
    reason: match.reason ?? null,
  };
}

export function registerDecisionExportRoutes(app: Express): void {
  app.get('/api/export/:npi', async (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!npi || !NPI_RE.test(npi)) {
      return res.status(400).json({
        error: 'invalid_npi',
        error_description: 'NPI must be a 10-digit string.',
      });
    }

    try {
      const omega = await orchestrateOmega({
        subject: { npi },
        context: {},
      });

      if (omega.status === 'not_found') {
        return res.status(404).json({
          error: 'passport_not_found',
          error_description: 'No passport data available for the provided NPI.',
        });
      }

      const checks =
        (omega.coverage as { checks?: Array<Record<string, unknown>> } | null)?.checks?.map((c) => ({
          sourceId: String(c.sourceId ?? ''),
          state: typeof c.state === 'string' ? c.state : null,
          reason: typeof c.reason === 'string' ? c.reason : null,
          checkedAt: typeof c.checkedAt === 'string' ? c.checkedAt : null,
        })) ?? [];

      const artifact: ExportArtifact = {
        schemaVersion: '1.0',
        generatedAt: omega.generatedAt,
        systemVersion: SYSTEM_VERSION,
        clinicianNpi: npi,
        decisionState: omega.decision?.decision ?? null,
        evidence: {
          oig: pickCheck(checks, ['OIG_LEIE', 'OIG']),
          nppes: pickCheck(checks, ['NPPES_API', 'NPPES']),
          license: pickCheck(checks, ['STATE_BOARD']),
          pecos: pickCheck(checks, ['PECOS_PUBLIC', 'PECOS']),
        },
        trustSignals: omega.reuse_signal,
        drift: omega.drift,
        acceptance: omega.acceptance,
        activation: omega.activation,
        recentActions: omega.recent_actions,
        nextBestAction: omega.nextBestAction,
      };

      const wantsDownload = req.query.download === '1' || req.query.download === 'true';
      if (wantsDownload) {
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="vitalcv-decision-${npi}-${omega.generatedAt.replace(/[:.]/g, '-')}.json"`,
        );
      }
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      log('info', 'decision_export_served', {
        npi_prefix: npi.slice(0, 4) + '····',
        download: wantsDownload,
      });
      return res.status(200).send(JSON.stringify(artifact, null, 2));
    } catch (error) {
      log('error', 'decision_export_failed', {
        npi_prefix: npi.slice(0, 4) + '····',
        message: error instanceof Error ? error.message : 'unknown',
      });
      return res.status(500).json({
        error: 'export_failed',
        error_description: 'Could not assemble decision export.',
      });
    }
  });
}
