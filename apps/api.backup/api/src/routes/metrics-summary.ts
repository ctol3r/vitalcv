// src/routes/metrics-summary.ts — SLO metrics summary for dashboard

import express from 'express';
import type { Request, Response } from 'express';
import client from 'prom-client';

export const metricsSummaryRouter = express.Router();

/** Roll up Prometheus counters/histograms into a tiny JSON for the frontend */
metricsSummaryRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const reg = client.register;
    const m = await reg.getMetricsAsJSON();
    const byName = Object.fromEntries(m.map((x: any) => [x.name, x]));

    const getVal = (name: string, kind: 'counter' | 'gauge' = 'counter') => {
      const r = byName[name];
      if (!r) return 0;
      if (kind === 'counter') return r.values?.[0]?.value ?? 0;
      return r.values?.[0]?.value ?? 0;
    };

    const ttp = byName['vitalcv_ttp_seconds'];
    const ttpDaysP50 = ttp?.values?.find((v: any) => v.quantile === 0.5)?.value / 86400 ?? null;

    // Minutes-in-notes metric (mock for now - would come from actual tracking)
    const minutesInNotes = getVal('vitalcv_minutes_in_notes', 'gauge') || 12.5; // Default mock value

    res.json({
      psvSuccess: getVal('vitalcv_psv_success_total'),
      psvFail: getVal('vitalcv_psv_failure_total'),
      evidenceCompleteRatio: getVal('vitalcv_evidence_complete_ratio', 'gauge'),
      ttpDaysP50,
      minutesInNotes,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Metrics summary error:', error);
    res.status(500).json({ error: 'Failed to generate metrics summary', message: error.message });
  }
});

