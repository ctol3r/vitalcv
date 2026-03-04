/**
 * matchaEvaluate.ts — Wave 51: MATCHA Evaluation API
 *
 * POST /api/matcha/evaluate  — evaluates a clinician against an employer policy
 * GET  /api/matcha/readiness/:npi — quick readiness check across all active policies
 *
 * Wires the CRS Evaluator and Gap Analyzer together, exposing the MATCHA
 * intelligence engine to the ATS Widget and internal dashboards.
 */

import type { Express, Request, Response } from 'express';
import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';
import { sha256Hex } from '../utils/deterministic';
import { crsEvaluator } from '../services/intelligence/crsEvaluator';
import { gapAnalyzer } from '../services/intelligence/gapAnalyzer';
import type { CrsBand } from '../services/intelligence/crsEvaluator';

// ── Types ─────────────────────────────────────────────────────────────────

interface EvaluateBody {
  npi: string;
  policyId: string;
}

// ── Routes ────────────────────────────────────────────────────────────────

export function registerMatchaEvaluateRoutes(app: Express): void {
  /**
   * POST /api/matcha/evaluate
   *
   * Evaluates a clinician's credential readiness against a specific
   * employer policy. Returns CRS score, band, and gap analysis.
   */
  app.post('/api/matcha/evaluate', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const npi = typeof body.npi === 'string' ? body.npi.trim() : '';
    const policyId = typeof body.policyId === 'string' ? body.policyId.trim() : '';

    if (!npi || !/^\d{10}$/.test(npi)) {
      return res
        .status(400)
        .json({ error: 'Invalid NPI format — expected 10 digits' });
    }

    if (!policyId) {
      return res
        .status(400)
        .json({ error: 'policyId is required' });
    }

    try {
      // ── Step 1: Evaluate CRS ────────────────────────────────────────
      const evaluation = await crsEvaluator.evaluateCrs(npi, policyId);

      // ── Step 2: Generate Gap Analysis ───────────────────────────────
      const gaps = gapAnalyzer.analyzeGaps(evaluation);

      // ── Step 3: Audit Event ─────────────────────────────────────────
      const auditHash = sha256Hex(
        `${npi}:${policyId}:${evaluation.crsScore}:${evaluation.evaluatedAt}`,
      );

      await prisma.auditEvent.create({
        data: {
          type: 'MATCHA_EVALUATION',
          hash: auditHash,
          referenceId: policyId,
          clinicianId: npi,
          metadata: JSON.parse(JSON.stringify({
            crsScore: evaluation.crsScore,
            crsBand: evaluation.crsBand,
            isCleared: evaluation.isCleared,
            matchedCount: evaluation.matchedCredentials.length,
            missingCount: evaluation.missingCredentials.length,
            gapCount: gaps.gapCount,
          })),
        },
      });

      log('info', 'matcha_evaluate: complete', {
        npi: npi.slice(0, 4) + '****',
        policyId,
        crsScore: evaluation.crsScore,
        crsBand: evaluation.crsBand,
      });

      return res.json({
        evaluation,
        gapAnalysis: gaps,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'matcha_evaluate: failed', { npi: npi.slice(0, 4) + '****', policyId, error: message });
      return res.status(500).json({ error: 'Evaluation failed', detail: message });
    }
  });

  /**
   * GET /api/matcha/readiness/:npi
   *
   * Evaluates a clinician against ALL active employer policies.
   * Returns a summary with individual evaluations and an overall band.
   */
  app.get('/api/matcha/readiness/:npi', async (req: Request, res: Response) => {
    const { npi } = req.params;

    if (!npi || !/^\d{10}$/.test(npi)) {
      return res
        .status(400)
        .json({ error: 'Invalid NPI format — expected 10 digits' });
    }

    try {
      const policies = await prisma.employerPolicy.findMany({
        where: { isActive: true },
        take: 50, // Safety cap
      });

      if (policies.length === 0) {
        return res.json({
          npi,
          evaluations: [],
          overallBand: 'GREEN' as CrsBand,
          message: 'No active policies to evaluate against',
          timestamp: new Date().toISOString(),
        });
      }

      const evaluations = [];
      let worstScore = 100;

      for (const policy of policies) {
        const evaluation = await crsEvaluator.evaluateCrs(npi, policy.id);
        const gaps = gapAnalyzer.analyzeGaps(evaluation);
        evaluations.push({ evaluation, gapAnalysis: gaps });
        if (evaluation.crsScore < worstScore) {
          worstScore = evaluation.crsScore;
        }
      }

      const overallBand = crsEvaluator.computeBand(worstScore);

      log('info', 'matcha_readiness: complete', {
        npi: npi.slice(0, 4) + '****',
        policiesEvaluated: policies.length,
        overallBand,
        worstScore,
      });

      return res.json({
        npi,
        evaluations,
        overallBand,
        overallScore: worstScore,
        policiesEvaluated: policies.length,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'matcha_readiness: failed', { npi: npi.slice(0, 4) + '****', error: message });
      return res.status(500).json({ error: 'Readiness check failed', detail: message });
    }
  });
}
