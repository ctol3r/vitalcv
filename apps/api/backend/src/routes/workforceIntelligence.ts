/**
 * workforceIntelligence.ts — Medical Workforce Intelligence API
 *
 * GET /api/intelligence/summary          — executive dashboard: dataset overview
 * GET /api/intelligence/bottlenecks      — credential bottleneck analysis
 * GET /api/intelligence/mobility         — licensure mobility patterns
 * GET /api/intelligence/deployment       — deployment efficiency metrics
 * GET /api/intelligence/scarcity         — expertise scarcity by specialty + state
 * GET /api/intelligence/export           — anonymized aggregate dataset (JSON/NDJSON)
 * POST /api/intelligence/cache/invalidate— force cache refresh (operator)
 */

import type { Express, Request, Response } from 'express';
import {
  computeCredentialBottlenecks,
  computeLicensureMobility,
  computeDeploymentEfficiency,
  computeExpertiseScarcity,
  computeDatasetSummary,
  invalidateIntelligenceCache,
  getIntelligenceCacheStats,
} from '../services/intelligence/workforceIntelligenceService';
import { log } from '../obs/logger';

export function registerWorkforceIntelligenceRoutes(app: Express): void {

  /**
   * GET /api/intelligence/summary
   * Executive overview of the entire workforce intelligence dataset.
   */
  app.get('/api/intelligence/summary', async (_req: Request, res: Response) => {
    try {
      const [summary, bottlenecks, scarcity] = await Promise.all([
        computeDatasetSummary(),
        computeCredentialBottlenecks(),
        computeExpertiseScarcity(10),
      ]);

      res.json({
        schema: 'https://vitalcv.com/intelligence/v1',
        dataset: summary,
        topBottlenecks: bottlenecks.slice(0, 5).map(b => ({
          source: b.source,
          label: b.label,
          bottleneckScore: b.bottleneckScore,
          bottleneckReason: b.bottleneckReason,
          verificationRate: b.verificationRate,
          totalRecords: b.totalRecords,
        })),
        topScarcitySignals: scarcity.slice(0, 5),
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      log('error', 'intelligence/summary: failed', { error: String(err) });
      res.status(500).json({ error: 'Failed to compute intelligence summary' });
    }
  });

  /**
   * GET /api/intelligence/bottlenecks
   * Which credentials create deployment friction?
   * Query: days=365 (look-back window), limit=20
   */
  app.get('/api/intelligence/bottlenecks', async (req: Request, res: Response) => {
    const days  = Math.min(Number(req.query.days  ?? 365), 730);
    const limit = Math.min(Number(req.query.limit ?? 20),  50);

    try {
      const signals = await computeCredentialBottlenecks(days);

      res.json({
        schema:       'https://vitalcv.com/intelligence/v1',
        windowDays:   days,
        total:        signals.length,
        signals:      signals.slice(0, limit),
        insight: signals.length > 0
          ? `Top bottleneck: ${signals[0]!.label} — ${signals[0]!.bottleneckReason} (score: ${signals[0]!.bottleneckScore}/100)`
          : 'Insufficient data for bottleneck analysis',
        generatedAt:  new Date().toISOString(),
      });
    } catch (err) {
      log('error', 'intelligence/bottlenecks: failed', { error: String(err) });
      res.status(500).json({ error: 'Bottleneck analysis failed' });
    }
  });

  /**
   * GET /api/intelligence/mobility
   * Licensure mobility patterns — multi-state clinicians, compact adoption.
   */
  app.get('/api/intelligence/mobility', async (_req: Request, res: Response) => {
    try {
      const report = await computeLicensureMobility();

      res.json({
        schema: 'https://vitalcv.com/intelligence/v1',
        ...report,
        insight: `${report.multiStateRate}% of clinicians hold licenses in multiple states. ` +
                 `${report.compactLicenseHolders} compact license holders. ` +
                 `Avg ${report.avgStatesPerClinician} states per clinician.`,
      });
    } catch (err) {
      log('error', 'intelligence/mobility: failed', { error: String(err) });
      res.status(500).json({ error: 'Mobility analysis failed' });
    }
  });

  /**
   * GET /api/intelligence/deployment
   * How efficiently do credentials translate into deployed workforce?
   * Query: specialty, state (optional filters)
   */
  app.get('/api/intelligence/deployment', async (req: Request, res: Response) => {
    const specialty = typeof req.query.specialty === 'string' ? req.query.specialty.toLowerCase() : null;
    const state     = typeof req.query.state === 'string' ? req.query.state.toUpperCase() : null;

    try {
      const signals = await computeDeploymentEfficiency();

      const filtered = signals.map(s => {
        if (!specialty && !state) return s;
        return {
          ...s,
          bySpecialty: specialty ? s.bySpecialty.filter(b => b.specialty.includes(specialty)) : s.bySpecialty,
          byState:     state     ? s.byState.filter(b => b.state === state) : s.byState,
        };
      });

      const hiringSignal = filtered.find(s => s.deploymentType === 'HIRING');
      const insight = hiringSignal
        ? `HIRING decisions avg ${hiringSignal.avgDaysToConfirm}d to confirm. ` +
          `Approval rate: ${hiringSignal.approvalRate}%. ` +
          `Slowest specialty: ${hiringSignal.bySpecialty[0]?.specialty ?? 'N/A'} (${hiringSignal.bySpecialty[0]?.avgDays ?? 0}d).`
        : 'Insufficient deployment data.';

      res.json({
        schema: 'https://vitalcv.com/intelligence/v1',
        filters: { specialty, state },
        signals: filtered,
        insight,
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      log('error', 'intelligence/deployment: failed', { error: String(err) });
      res.status(500).json({ error: 'Deployment efficiency analysis failed' });
    }
  });

  /**
   * GET /api/intelligence/scarcity
   * Where is qualified workforce supply dangerously thin?
   * Query: state, specialty, label=CRITICAL|HIGH|MODERATE, limit=50
   */
  app.get('/api/intelligence/scarcity', async (req: Request, res: Response) => {
    const stateFilter     = typeof req.query.state === 'string' ? req.query.state.toUpperCase() : null;
    const specialtyFilter = typeof req.query.specialty === 'string' ? req.query.specialty.toLowerCase() : null;
    const labelFilter     = typeof req.query.label === 'string' ? req.query.label.toUpperCase() : null;
    const limit           = Math.min(Number(req.query.limit ?? 50), 200);

    try {
      let signals = await computeExpertiseScarcity(200);

      if (stateFilter)     signals = signals.filter(s => s.state === stateFilter);
      if (specialtyFilter) signals = signals.filter(s => s.specialty.includes(specialtyFilter));
      if (labelFilter)     signals = signals.filter(s => s.scarcityLabel === labelFilter);

      const critical = signals.filter(s => s.scarcityLabel === 'CRITICAL').length;
      const high     = signals.filter(s => s.scarcityLabel === 'HIGH').length;

      res.json({
        schema: 'https://vitalcv.com/intelligence/v1',
        filters: { state: stateFilter, specialty: specialtyFilter, label: labelFilter },
        total: signals.length,
        bySeverity: { CRITICAL: critical, HIGH: high,
          MODERATE: signals.filter(s => s.scarcityLabel === 'MODERATE').length,
          ADEQUATE: signals.filter(s => s.scarcityLabel === 'ADEQUATE').length },
        signals: signals.slice(0, limit),
        insight: critical > 0
          ? `${critical} CRITICAL scarcity zones — immediate workforce planning action required.`
          : high > 0 ? `${high} HIGH scarcity zones detected across ${new Set(signals.map(s => s.state)).size} states.`
          : 'No critical scarcity signals detected in current dataset.',
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      log('error', 'intelligence/scarcity: failed', { error: String(err) });
      res.status(500).json({ error: 'Scarcity analysis failed' });
    }
  });

  /**
   * GET /api/intelligence/export
   * Anonymized aggregate dataset for workforce planning systems.
   * Returns all four intelligence domains in one response.
   * Query: format=json|ndjson
   */
  app.get('/api/intelligence/export', async (req: Request, res: Response) => {
    const format = req.query.format === 'ndjson' ? 'ndjson' : 'json';

    try {
      const [summary, bottlenecks, mobility, deployment, scarcity] = await Promise.all([
        computeDatasetSummary(),
        computeCredentialBottlenecks(),
        computeLicensureMobility(),
        computeDeploymentEfficiency(),
        computeExpertiseScarcity(200),
      ]);

      const exportAt = new Date().toISOString();

      if (format === 'ndjson') {
        res.setHeader('Content-Type', 'application/x-ndjson');
        res.setHeader('Content-Disposition', `attachment; filename="vitalcv-intelligence-${exportAt.split('T')[0]}.ndjson"`);

        const lines = [
          JSON.stringify({ _type: 'dataset_summary', ...summary }),
          ...bottlenecks.map(b => JSON.stringify({ _type: 'credential_bottleneck', ...b })),
          JSON.stringify({ _type: 'licensure_mobility', ...mobility }),
          ...deployment.map(d => JSON.stringify({ _type: 'deployment_efficiency', ...d })),
          ...scarcity.map(s => JSON.stringify({ _type: 'expertise_scarcity', ...s })),
        ];
        res.send(lines.join('\n'));
        return;
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="vitalcv-intelligence-${exportAt.split('T')[0]}.json"`);

      res.json({
        schema:      'https://vitalcv.com/intelligence/v1',
        exportedAt:  exportAt,
        dataset:     summary,
        bottlenecks,
        mobility,
        deployment,
        scarcity,
        note: 'This dataset contains only anonymized aggregate signals. No PII included.',
      });
    } catch (err) {
      log('error', 'intelligence/export: failed', { error: String(err) });
      res.status(500).json({ error: 'Export failed' });
    }
  });

  /**
   * POST /api/intelligence/cache/invalidate
   * Force-expire the intelligence cache (operator use).
   */
  app.post('/api/intelligence/cache/invalidate', (_req: Request, res: Response) => {
    invalidateIntelligenceCache();
    const stats = getIntelligenceCacheStats();
    res.json({ invalidated: true, cacheSize: stats.size, ttlMs: stats.ttlMs });
  });

  /**
   * GET /api/intelligence/cache/stats
   */
  app.get('/api/intelligence/cache/stats', (_req: Request, res: Response) => {
    res.json(getIntelligenceCacheStats());
  });
}
