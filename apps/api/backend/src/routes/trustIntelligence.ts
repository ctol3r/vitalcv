/**
 * trustIntelligence.ts — Trust Intelligence API
 *
 * Exposes VitalCV's Trust Score V1, Freshness Model, and Divergence Engine
 * as first-class API primitives.
 *
 * Routes:
 *   GET  /api/trust/score/:npi          — Trust Score V1 full breakdown
 *   GET  /api/trust/score/:npi/summary  — Lightweight score summary
 *   POST /api/trust/score/batch         — Batch score up to 50 NPIs
 *   GET  /api/trust/freshness/:npi      — Freshness report per claim class
 *   GET  /api/trust/divergence/:npi     — Cross-source conflict report
 *   GET  /api/trust/score/:npi/explain  — Human-readable explanation
 *   GET  /api/trust/methodology         — Methodology documentation
 */

import type { Express, Request, Response } from 'express';
import { computeTrustScoreV1, batchTrustScore, TRUST_SCORE_VERSION, DIMENSION_WEIGHTS } from '../services/trust/trustScoreV1';
import { computeTrustFreshness } from '../services/identity/freshnessModel';
import {
  detectDivergence,
  batchDivergenceScan,
  listDivergenceHistory,
  resolveDivergenceConflict,
} from '../services/identity/divergenceEngine';
import {
  recordFreshnessDecaySignals,
  recordTrustScoreSnapshot,
  syncDivergenceReport,
} from '../services/intelligence/intelligenceEngineService';
import { log } from '../obs/logger';

const NPI_RE = /^\d{10}$/;

function validateNpi(res: Response, npi: string): boolean {
  if (!NPI_RE.test(npi)) {
    res.status(400).json({ error: 'Invalid NPI — must be 10 digits', npi });
    return false;
  }
  return true;
}

/**
 * AUTHORIZATION (2026-08-08). Nothing is operator-gated in this file, on
 * purpose.
 *
 * The two divergence-resolution writes DO already require an actor: they read
 * `x-clerk-user-id` inline and 401 without it, and they record it as
 * `resolvedBy`. That makes them **identity** surfaces, not operator ones — so
 * an operator secret is the wrong control even though the actor header is
 * caller-supplied and therefore not yet a real boundary (gap G1; it becomes one
 * when CLERK_JWT_VERIFICATION reaches enforce and verifiedIdentity rewrites the
 * header from the verified `sub`).
 *
 * `POST /api/trust/score/batch` is likewise not gated here — it is fronted by
 * the live `app/api/intelligence/providers` proxy.
 *
 * Both dispositions are recorded in
 * docs/security/turnstile-route-dispositions.md.
 */
export function registerTrustIntelligenceRoutes(app: Express): void {

  // ── GET /api/trust/score/:npi ─────────────────────────────────────────────
  //
  // Trust Score V1 — full dimensional breakdown with explanation payload.
  //
  app.get('/api/trust/score/:npi', async (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!validateNpi(res, npi)) return;
    try {
      const score = await computeTrustScoreV1(npi);
      await recordTrustScoreSnapshot({
        subjectType: 'NPI',
        subjectId: npi,
        newScore: score.score,
        triggerEvent: 'TRUST_SCORE_COMPUTED',
        confidence: score.confidence,
        band: score.band,
        methodologyVersion: score.methodology,
        metadata: {
          contradictions: score.contradictions.length,
          totalPenalty: score.totalPenalty,
          bandLabel: score.bandLabel,
          gaps: score.gaps,
          trustLimits: score.trustLimits,
          dimensionScores: Object.fromEntries(
            Object.entries(score.dimensions).map(([dimension, detail]) => [dimension, {
              score: detail.score,
              max: detail.max,
              status: detail.status,
              pct: detail.pct,
            }]),
          ),
        },
        recordedAt: score.computedAt,
      });
      const statusCode = score.contradictions.some(c => c.severity === 'HIGH') ? 207 : 200;
      res.status(statusCode).json({
        schema:   'https://vitalcv.com/trust-score/v1',
        ...score,
      });
    } catch (err) {
      log('error', `[TrustIntelligence] score failed for NPI ${npi}: ${(err as Error)?.message}`);
      res.status(500).json({ error: 'Trust score computation failed', npi });
    }
  });

  // ── GET /api/trust/score/:npi/summary ─────────────────────────────────────
  //
  // Lightweight summary — score, band, top gaps, methodology.
  // Useful for embedding in dashboards without full payload.
  //
  app.get('/api/trust/score/:npi/summary', async (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!validateNpi(res, npi)) return;
    try {
      const score = await computeTrustScoreV1(npi);
      res.json({
        npi,
        score:       score.score,
        band:        score.band,
        bandLabel:   score.bandLabel,
        confidence:  score.confidence,
        computedAt:  score.computedAt,
        methodology: score.methodology,
        gaps:        score.gaps,
        trustLimits: score.trustLimits,
        penaltyApplied: score.penaltyApplied,
        dimension_scores: Object.fromEntries(
          Object.entries(score.dimensions).map(([k, d]) => [k, { score: d.score, max: d.max, status: d.status }]),
        ),
      });
    } catch (err) {
      res.status(500).json({ error: 'Trust score computation failed', npi });
    }
  });

  // ── POST /api/trust/score/batch ───────────────────────────────────────────
  //
  // Batch score up to 50 NPIs. Returns lightweight summary per NPI.
  //
  app.post('/api/trust/score/batch', async (req: Request, res: Response) => {
    const { npis } = req.body as { npis?: unknown };
    if (!Array.isArray(npis) || npis.length === 0) {
      return res.status(400).json({ error: 'Body must include npis: string[]' });
    }
    if (npis.length > 50) {
      return res.status(400).json({ error: 'Batch limit is 50 NPIs' });
    }
    const validNpis = (npis as unknown[]).filter(n => typeof n === 'string' && NPI_RE.test(n)) as string[];
    if (validNpis.length === 0) {
      return res.status(400).json({ error: 'No valid NPIs provided' });
    }
    try {
      const results = await batchTrustScore(validNpis);
      res.json({
        count:   results.length,
        results,
        methodology: TRUST_SCORE_VERSION,
        computedAt:  new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({ error: 'Batch trust score failed' });
    }
  });

  // ── GET /api/trust/freshness/:npi ─────────────────────────────────────────
  //
  // Per-claim-class freshness report — staleness, decay, next check dates.
  //
  app.get('/api/trust/freshness/:npi', async (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!validateNpi(res, npi)) return;
    try {
      const report = await computeTrustFreshness(npi);
      await recordFreshnessDecaySignals({
        subjectType: 'NPI',
        subjectId: npi,
        computedAt: report.computedAt,
        dimensions: report.dimensions.map((dimension) => ({
          claimClass: dimension.claimClass,
          status: dimension.status,
          ageHours: dimension.ageHours,
          freshnessScore: dimension.freshnessScore,
          sources: dimension.sources,
        })),
      });
      const hasStale = report.staleDimensions.length > 0;
      res.status(hasStale ? 207 : 200).json({
        schema: 'https://vitalcv.com/trust-freshness/v1',
        ...report,
      });
    } catch (err) {
      log('error', `[TrustIntelligence] freshness failed for NPI ${npi}: ${(err as Error)?.message}`);
      res.status(500).json({ error: 'Freshness computation failed', npi });
    }
  });

  // ── GET /api/trust/divergence/:npi ───────────────────────────────────────
  //
  // Cross-source divergence report — conflicts, penalties, resolution status.
  //
  app.get('/api/trust/divergence/:npi', async (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!validateNpi(res, npi)) return;
    try {
      const report = await detectDivergence(npi);
      await syncDivergenceReport({
        subjectType: 'NPI',
        subjectId: npi,
        conflicts: report.conflicts.map((conflict) => ({
          id: conflict.id,
          ruleId: conflict.ruleId,
          claimType: conflict.claimType,
          severity: conflict.severity,
          description: conflict.description,
          sources: conflict.sources,
          values: conflict.values,
          detectedAt: conflict.detectedAt,
          resolution: conflict.resolution,
          active: conflict.active,
        })),
      });
      const statusCode = report.hasBlocking ? 207 : 200;
      res.status(statusCode).json({
        schema: 'https://vitalcv.com/trust-divergence/v1',
        ...report,
      });
    } catch (err) {
      log('error', `[TrustIntelligence] divergence failed for NPI ${npi}: ${(err as Error)?.message}`);
      res.status(500).json({ error: 'Divergence detection failed', npi });
    }
  });

  app.get('/api/trust/divergence/:npi/history', async (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!validateNpi(res, npi)) return;

    try {
      const history = await listDivergenceHistory(npi);
      res.json({
        schema: 'https://vitalcv.com/trust-divergence-history/v1',
        ...history,
      });
    } catch (err) {
      log('error', `[TrustIntelligence] divergence history failed for NPI ${npi}: ${(err as Error)?.message}`);
      res.status(500).json({ error: 'Divergence history lookup failed', npi });
    }
  });

  app.post('/api/trust/divergence/:npi/:conflictId/resolve', async (req: Request, res: Response) => {
    const { npi, conflictId } = req.params;
    if (!validateNpi(res, npi)) return;

    const resolvedBy = typeof req.headers['x-clerk-user-id'] === 'string'
      ? req.headers['x-clerk-user-id'].trim()
      : '';
    if (!resolvedBy) {
      return res.status(401).json({ error: 'Missing x-clerk-user-id header' });
    }

    const body = req.body as { note?: unknown } | undefined;
    const note = typeof body?.note === 'string' ? body.note.trim() : undefined;

    try {
      const result = await resolveDivergenceConflict({
        npi,
        conflictId,
        resolvedBy,
        note,
      });

      if (!result) {
        return res.status(404).json({ error: 'Divergence conflict not found', npi, conflictId });
      }

      return res.status(200).json({
        schema: 'https://vitalcv.com/trust-divergence-resolution/v1',
        ...result,
      });
    } catch (err) {
      log('error', `[TrustIntelligence] divergence resolve failed for NPI ${npi}: ${(err as Error)?.message}`);
      return res.status(500).json({ error: 'Divergence resolution failed', npi, conflictId });
    }
  });

  // ── POST /api/trust/divergence/batch ─────────────────────────────────────
  //
  // Batch divergence scan — returns conflict count + hasBlocking per NPI.
  //
  app.post('/api/trust/divergence/batch', async (req: Request, res: Response) => {
    const { npis } = req.body as { npis?: unknown };
    if (!Array.isArray(npis) || npis.length === 0) {
      return res.status(400).json({ error: 'Body must include npis: string[]' });
    }
    if (npis.length > 100) {
      return res.status(400).json({ error: 'Batch limit is 100 NPIs' });
    }
    const validNpis = (npis as unknown[]).filter(n => typeof n === 'string' && NPI_RE.test(n)) as string[];
    try {
      const results = await batchDivergenceScan(validNpis);
      res.json({ count: results.length, results, computedAt: new Date().toISOString() });
    } catch (err) {
      res.status(500).json({ error: 'Batch divergence scan failed' });
    }
  });

  // ── GET /api/trust/score/:npi/explain ─────────────────────────────────────
  //
  // Human-readable explanation of the trust score — for rendering in UI
  // without exposing raw numeric breakdown.
  //
  app.get('/api/trust/score/:npi/explain', async (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!validateNpi(res, npi)) return;
    try {
      const score = await computeTrustScoreV1(npi);

      const lines: string[] = [
        `Trust Score: ${score.score}/100 (${score.bandLabel})`,
        `Confidence: ${Math.round(score.confidence * 100)}%`,
        '',
        '--- Dimensions ---',
      ];

      for (const [key, dim] of Object.entries(score.dimensions)) {
        const pct = Math.round(dim.score / dim.max * 100);
        lines.push(`${key.padEnd(12)}: ${dim.score}/${dim.max} pts (${pct}%) — ${dim.status}`);
      }

      if (score.totalPenalty > 0) {
        lines.push('', `--- Penalties ---`);
        for (const c of score.contradictions) {
          lines.push(`  [${c.severity}] ${c.description} (-${c.penalty} pts)`);
        }
      }

      if (score.gaps.length > 0) {
        lines.push('', '--- Gaps ---');
        score.gaps.forEach((g, i) => lines.push(`  ${i + 1}. ${g}`));
      }

      if (score.recommendations.length > 0) {
        lines.push('', '--- Recommendations ---');
        score.recommendations.forEach((r, i) => lines.push(`  ${i + 1}. ${r}`));
      }

      res.json({
        npi,
        band:        score.band,
        score:       score.score,
        computedAt:  score.computedAt,
        explanation: lines.join('\n'),
        gaps:        score.gaps,
        recommendations: score.recommendations,
      });
    } catch (err) {
      res.status(500).json({ error: 'Explanation generation failed', npi });
    }
  });

  // ── GET /api/trust/methodology ────────────────────────────────────────────
  //
  // Methodology documentation — weights, versions, band thresholds.
  // Enables transparency and third-party validation.
  //
  app.get('/api/trust/methodology', (_req: Request, res: Response) => {
    res.json({
      schema:       'https://vitalcv.com/trust-methodology/v1',
      version:      TRUST_SCORE_VERSION,
      description:  'VitalCV Trust Score V1 — composite, multi-source, explainable provider trust scoring.',
      lastUpdated:  '2026-03-15',

      dimensions:   Object.entries(DIMENSION_WEIGHTS).map(([key, weight]) => ({
        key,
        weight,
        description: DIMENSION_DESCRIPTIONS[key as keyof typeof DIMENSION_WEIGHTS],
      })),

      bandThresholds: {
        L3: { min: 80, label: 'VERIFIED',     requirements: ['exclusion=CLEAR', 'no CRITICAL contradictions'] },
        L2: { min: 60, label: 'CREDENTIALED', requirements: ['exclusion != EXCLUDED'] },
        L1: { min: 40, label: 'PARTIAL',      requirements: [] },
        L0: { min: 0,  label: 'UNVERIFIED',   requirements: [] },
      },

      penalties: {
        HIGH:   { deduction: 15, effect: 'Band capped at L1, requires manual review' },
        MEDIUM: { deduction: 7,  effect: 'Score reduced, flagged for review' },
        LOW:    { deduction: 3,  effect: 'Score reduced, logged' },
      },

      freshnessWindows: {
        exclusionSanctions: { freshHours: 24,  staleHours: 72,   priority: 'CRITICAL' },
        licensure:          { freshHours: 168, staleHours: 720,  priority: 'HIGH' },
        npiIdentity:        { freshHours: 168, staleHours: 1440, priority: 'HIGH' },
        enrollment:         { freshHours: 720, staleHours: 2160, priority: 'MEDIUM' },
        boardCertification: { freshHours: 720, staleHours: 8760, priority: 'MEDIUM' },
        openPayments:       { freshHours: 8760, staleHours: 17520, priority: 'LOW' },
        academic:           { freshHours: 2160, staleHours: 8760, priority: 'LOW' },
      },

      divergenceRules: 7,
      sourcesSupported: [
        'NPPES_API', 'NPPES_BULK', 'PECOS_PUBLIC', 'DOCTORS_CLINICIANS',
        'OIG_LEIE', 'SAM_GOV', 'STATE_BOARD', 'NURSYS', 'NURSYS_ENOTIFY',
        'OPEN_PAYMENTS', 'OPENALEX', 'PUBMED', 'CLINICAL_TRIALS', 'ORCID',
      ],
    });
  });
}

const DIMENSION_DESCRIPTIONS: Record<keyof typeof DIMENSION_WEIGHTS, string> = {
  identity:   'NPI identity confirmed by authoritative government source (NPPES)',
  licensure:  'Active, current state medical license verified from state board or PECOS',
  exclusion:  'OIG/LEIE and SAM.gov exclusion/sanction status clear',
  enrollment: 'CMS Medicare/Medicaid enrollment active (PECOS + D&C)',
  boardCert:  'Board certification verified from ABMS or AOA',
  coverage:   'Breadth of Gold-tier source verification (rewards diligence)',
  freshness:  'Recency of verification across all claim classes (decays with age)',
  academic:   'Research/publication identity from OpenAlex, PubMed, ClinicalTrials',
};
