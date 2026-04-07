/**
 * roiReportService.ts — Pilot ROI Executive Report
 *
 * Converts raw PilotKpiSnapshot into buyer-readable ROI metrics.
 * Compares against published industry baselines (cited below).
 *
 * TRUTH CONTRACT
 * ─────────────
 * - All VitalCV metrics come from real event data (no fabrication)
 * - Industry baselines are labeled with source and year
 * - "time saved" = industry baseline − VitalCV observed only when the denominators match
 * - If insufficient data (< MIN_DECISIONS), confidence = LOW with explicit note
 * - Every metric shows sample size
 * - Window-derived readiness mix is labeled as latest-review-in-window, not a live score
 *
 * INDUSTRY BASELINES (sourced)
 * ────────────────────────────
 * - First-review-to-decision: 14 days
 *   Source: NAMSS 2022 Credentialing Survey — median employer decision latency
 * - Blocker resolution: 7–14 days per blocker
 *   Source: CAQH 2023 — average per-gap resolution time
 *
 * Revenue use: hand this to a buyer in the first 60 seconds.
 */

import type { PilotKpiSnapshot } from './pilotKpiService';

// ── Industry baselines ────────────────────────────────────────────────────────

const BASELINES = {
  medianDaysReviewToDecision: {
    value: 14,
    source: 'NAMSS 2022 Credentialing Survey',
    label: 'Median employer decision latency (industry)',
  },
  avgDaysPerBlockerResolution: {
    value: 10,
    source: 'CAQH 2023 — average per-gap resolution time',
    label: 'Average days per blocker resolution (industry)',
  },
  percentReadyAtReview: {
    value: 22,
    source: 'CAQH Index 2023 — providers fully verified at first review',
    label: 'Providers fully credentialed at first review, industry baseline (%)',
  },
} as const;

const MIN_DECISIONS_FOR_HIGH_CONFIDENCE = 5;
const MIN_DECISIONS_FOR_MEDIUM_CONFIDENCE = 2;

// ── Types ─────────────────────────────────────────────────────────────────────

export type RoiConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_DATA';

export interface RoiMetric {
  id: string;
  label: string;
  vcvValue: number | null;
  vcvUnit: string;
  industryBaseline: number | null;
  industryBaselineLabel: string;
  industryBaselineSource: string;
  /** Positive = VitalCV faster/better. Negative = not yet beating baseline. */
  delta: number | null;
  deltaLabel: string;
  confidence: RoiConfidence;
  sampleSize: number;
  note: string | null;
}

export interface RoiSection {
  id: string;
  title: string;
  headline: string;
  metrics: RoiMetric[];
}

export interface RoiReport {
  // ── Identity ───────────────────────────────────────────────────────────────
  reportId: string;
  generatedAt: string;
  windowDays: number;
  methodology: string;
  dataDisclaimer: string;

  // ── Executive summary ──────────────────────────────────────────────────────
  executiveSummary: string;
  overallConfidence: RoiConfidence;

  // ── Top-line numbers (for slide deck) ─────────────────────────────────────
  topLine: {
    daysDecisionLatency: number | null;
    daysSavedVsBaseline: number | null;
    percentReadyAtLatestReviewInWindow: number | null;
    blockersResolvedCount: number;
    startOutcomeCount: number;
  };

  // ── Full metric breakdown ──────────────────────────────────────────────────
  sections: RoiSection[];

  // ── Event chain health ─────────────────────────────────────────────────────
  eventChain: PilotKpiSnapshot['eventChain'];

  // ── Gaps — what data would improve confidence ──────────────────────────────
  dataGaps: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function confidence(sampleSize: number): RoiConfidence {
  if (sampleSize >= MIN_DECISIONS_FOR_HIGH_CONFIDENCE) return 'HIGH';
  if (sampleSize >= MIN_DECISIONS_FOR_MEDIUM_CONFIDENCE) return 'MEDIUM';
  if (sampleSize >= 1) return 'LOW';
  return 'INSUFFICIENT_DATA';
}

function deltaLabel(delta: number | null, unit: string): string {
  if (delta === null) return 'Insufficient data';
  if (delta > 0) return `${delta} ${unit} faster than industry baseline`;
  if (delta < 0) return `${Math.abs(delta)} ${unit} slower than baseline — more data needed`;
  return 'On par with industry baseline';
}

function pctReadyAtLatestReview(snap: PilotKpiSnapshot): number | null {
  const total = snap.readinessDistribution.total;
  if (total === 0) return null;
  const ready = snap.readinessDistribution.ready;
  return Math.round((ready / total) * 100);
}

function resolvedBlockerCount(snap: PilotKpiSnapshot): number {
  return snap.blockers.reduce((sum, b) => sum + (b.resolvedCount ?? 0), 0);
}

function averageResolvedBlockerDays(snap: PilotKpiSnapshot): number | null {
  let resolvedCount = 0;
  let totalResolutionDays = 0;

  for (const blocker of snap.blockers) {
    if (blocker.resolvedCount <= 0 || blocker.avgResolutionDays === null) {
      continue;
    }

    resolvedCount += blocker.resolvedCount;
    totalResolutionDays += blocker.avgResolutionDays * blocker.resolvedCount;
  }

  return resolvedCount > 0 ? totalResolutionDays / resolvedCount : null;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function generateRoiReport(snap: PilotKpiSnapshot): RoiReport {
  const generatedAt = new Date().toISOString();
  const decisionCount = snap.decisions.total;
  const decisionLatencySampleSize = snap.velocity.sampleSizes.reviewToDecision;
  const overallConfidence = confidence(decisionLatencySampleSize);

  // ── Decision latency metric ────────────────────────────────────────────────
  const observedLatency = snap.velocity.medianDaysFirstReviewToDecision;
  const latencyDelta =
    observedLatency !== null
      ? Math.round(BASELINES.medianDaysReviewToDecision.value - observedLatency)
      : null;

  const latencyMetric: RoiMetric = {
    id: 'decision_latency',
    label: 'Median days: first review → employer decision',
    vcvValue: observedLatency,
    vcvUnit: 'days',
    industryBaseline: BASELINES.medianDaysReviewToDecision.value,
    industryBaselineLabel: BASELINES.medianDaysReviewToDecision.label,
    industryBaselineSource: BASELINES.medianDaysReviewToDecision.source,
    delta: latencyDelta,
    deltaLabel: deltaLabel(latencyDelta, 'days'),
    confidence: overallConfidence,
    sampleSize: decisionLatencySampleSize,
    note: decisionLatencySampleSize < MIN_DECISIONS_FOR_HIGH_CONFIDENCE
      ? `Based on ${decisionLatencySampleSize} measured review-to-decision pair${decisionLatencySampleSize === 1 ? '' : 's'}${decisionCount !== decisionLatencySampleSize ? ` (${decisionCount} decision event${decisionCount === 1 ? '' : 's'} recorded overall)` : ''} — more data will improve accuracy`
      : null,
  };

  // ── Time-to-start metric ───────────────────────────────────────────────────
  const observedTts = snap.velocity.medianDaysFirstReviewToStart;
  const ttsSampleSize = snap.velocity.sampleSizes.reviewToStart;
  const ttsConf = confidence(ttsSampleSize);

  const ttsMetric: RoiMetric = {
    id: 'time_to_start',
    label: 'Median days: first review → actual start',
    vcvValue: observedTts,
    vcvUnit: 'days',
    industryBaseline: null,
    industryBaselineLabel: 'No direct industry baseline for review-to-start yet',
    industryBaselineSource: 'N/A',
    delta: null,
    deltaLabel: 'No direct industry comparison yet',
    confidence: ttsConf,
    sampleSize: ttsSampleSize,
    note: snap.startOutcomes.totalStarts === 0
      ? 'No confirmed start outcomes yet — record start outcomes via POST /api/internal/pilot/start-outcome'
      : ttsSampleSize === 0
        ? 'Confirmed start outcomes exist, but none are yet paired to a measured first-review timestamp.'
        : 'Measured from first employer review to recorded start outcome. Not compared to credentialing-initiation baselines because the denominators do not match.',
  };

  // ── Latest-review readiness mix metric ────────────────────────────────────
  const pctReady = pctReadyAtLatestReview(snap);
  const readyConf = confidence(snap.readinessDistribution.total);

  const readyMetric: RoiMetric = {
    id: 'ready_at_latest_review',
    label: '% of reviewed clinicians READY at latest review in window',
    vcvValue: pctReady,
    vcvUnit: '%',
    industryBaseline: null,
    industryBaselineLabel: 'No direct industry baseline for latest-review readiness mix',
    industryBaselineSource: 'N/A',
    delta: null,
    deltaLabel: 'Window-derived readiness mix; not compared to first-review industry baselines',
    confidence: readyConf,
    sampleSize: snap.readinessDistribution.total,
    note: 'Derived from the latest employer review event per clinician in the selected window. This is not a live score or a first-review benchmark.',
  };

  // ── Blocker resolution metric ──────────────────────────────────────────────
  const resolvedCount = resolvedBlockerCount(snap);
  const avgBlockerDays = averageResolvedBlockerDays(snap);
  const blockerDelta = avgBlockerDays !== null
    ? Math.round(BASELINES.avgDaysPerBlockerResolution.value - avgBlockerDays)
    : null;

  const blockerMetric: RoiMetric = {
    id: 'blocker_resolution',
    label: 'Average days per blocker resolved',
    vcvValue: avgBlockerDays !== null ? Math.round(avgBlockerDays) : null,
    vcvUnit: 'days',
    industryBaseline: BASELINES.avgDaysPerBlockerResolution.value,
    industryBaselineLabel: BASELINES.avgDaysPerBlockerResolution.label,
    industryBaselineSource: BASELINES.avgDaysPerBlockerResolution.source,
    delta: blockerDelta,
    deltaLabel: deltaLabel(blockerDelta, 'days'),
    confidence: confidence(resolvedCount),
    sampleSize: resolvedCount,
    note: resolvedCount === 0
      ? 'No resolved blocker samples in this window.'
      : `${resolvedCount} resolved blocker${resolvedCount === 1 ? '' : 's'} in this window. Derived from the live per-code averages in the KPI snapshot.`,
  };

  // ── Funnel metrics ─────────────────────────────────────────────────────────
  const shareCount = snap.packetShares.total;
  const reviewCount = snap.reviewsOpened.total;
  const acceptCount = snap.decisions.proceedCount ?? snap.decisions.byType?.PROCEED ?? 0;

  const funnelConversionShareToReview = shareCount > 0
    ? Math.round((reviewCount / shareCount) * 100)
    : null;
  const funnelConversionReviewToAccept = reviewCount > 0
    ? Math.round((acceptCount / reviewCount) * 100)
    : null;

  const funnelMetrics: RoiMetric[] = [
    {
      id: 'shares',
      label: 'Packets shared by clinicians',
      vcvValue: shareCount,
      vcvUnit: 'shares',
      industryBaseline: null,
      industryBaselineLabel: '',
      industryBaselineSource: '',
      delta: null,
      deltaLabel: 'No baseline — new metric enabled by VitalCV',
      confidence: shareCount > 0 ? 'HIGH' : 'INSUFFICIENT_DATA',
      sampleSize: shareCount,
      note: null,
    },
    {
      id: 'share_to_review_conversion',
      label: 'Share → employer review open rate',
      vcvValue: funnelConversionShareToReview,
      vcvUnit: '%',
      industryBaseline: null,
      industryBaselineLabel: 'No industry baseline for digital trust packet acceptance',
      industryBaselineSource: 'N/A',
      delta: null,
      deltaLabel: 'No baseline — new capability',
      confidence: confidence(shareCount),
      sampleSize: shareCount,
      note: null,
    },
    {
      id: 'review_to_accept_conversion',
      label: 'Employer review → accept as head start rate',
      vcvValue: funnelConversionReviewToAccept,
      vcvUnit: '%',
      industryBaseline: null,
      industryBaselineLabel: 'No industry baseline for head start acceptance',
      industryBaselineSource: 'N/A',
      delta: null,
      deltaLabel: 'No baseline — new capability',
      confidence: confidence(reviewCount),
      sampleSize: reviewCount,
      note: null,
    },
  ];

  // ── Executive summary ──────────────────────────────────────────────────────
  const summaryParts: string[] = [];

  if (observedLatency !== null && latencyDelta !== null && latencyDelta > 0) {
    summaryParts.push(`${latencyDelta}-day reduction in employer decision latency vs industry baseline`);
  }
  if (observedTts !== null) {
    summaryParts.push(`${observedTts} median days from first review to confirmed start`);
  }
  if (pctReady !== null) {
    summaryParts.push(`${pctReady}% of reviewed clinicians were READY at the latest review in the selected window`);
  }
  if (resolvedCount > 0) {
    summaryParts.push(`${resolvedCount} credential blocker${resolvedCount === 1 ? '' : 's'} resolved`);
  }

  const executiveSummary = summaryParts.length > 0
    ? `In this ${snap.windowDays}-day pilot window, VitalCV showed: ${summaryParts.join('; ')}.`
    : `Pilot in early stage (${decisionLatencySampleSize} measured review-to-decision pair${decisionLatencySampleSize === 1 ? '' : 's'}${decisionCount !== decisionLatencySampleSize ? `, ${decisionCount} decision event${decisionCount === 1 ? '' : 's'} recorded overall` : ''}). ` +
      'Share a passport and capture a start outcome to build ROI evidence.';

  // ── Data gaps ──────────────────────────────────────────────────────────────
  const dataGaps = new Set<string>(snap.gaps ?? []);

  if (snap.startOutcomes.totalStarts === 0) {
    dataGaps.add('No start outcomes recorded — POST /api/internal/pilot/start-outcome when a clinician starts');
  }
  if (decisionLatencySampleSize < MIN_DECISIONS_FOR_HIGH_CONFIDENCE) {
    dataGaps.add(`Only ${decisionLatencySampleSize} measured review-to-decision pair${decisionLatencySampleSize === 1 ? '' : 's'} — need ${MIN_DECISIONS_FOR_HIGH_CONFIDENCE} for HIGH confidence`);
  }
  if (snap.packetShares.total === 0) {
    dataGaps.add('No packets shared — clinicians must share passports for funnel tracking');
  }

  // ── Top-line ───────────────────────────────────────────────────────────────
  const topLine = {
    daysDecisionLatency: observedLatency,
    daysSavedVsBaseline: latencyDelta !== null && latencyDelta > 0 ? latencyDelta : null,
    percentReadyAtLatestReviewInWindow: pctReady,
    blockersResolvedCount: resolvedCount,
    startOutcomeCount: snap.startOutcomes.totalStarts,
  };

  return {
    reportId: crypto.randomUUID(),
    generatedAt,
    windowDays: snap.windowDays,
    methodology: 'pilot-roi-report/v1.0',
    dataDisclaimer:
      'VitalCV metrics are derived from real event data. Industry baselines are cited estimates from publicly available research. ' +
      'Industry deltas are shown only where the baseline matches the measured pilot denominator. Latest-review readiness share is window-derived, not a live score or first-review benchmark. All numbers show sample size for transparency.',
    executiveSummary,
    overallConfidence,
    topLine,
    sections: [
      {
        id: 'velocity',
        title: 'Decision Velocity',
        headline: observedLatency !== null
          ? `${observedLatency} median days from review to decision (industry: ${BASELINES.medianDaysReviewToDecision.value} days)`
          : 'No decision velocity data yet',
        metrics: [latencyMetric, ttsMetric],
      },
      {
        id: 'quality',
        title: 'Candidate Readiness Quality',
        headline: pctReady !== null
          ? `${pctReady}% of candidates READY at the latest review in this window`
          : 'No readiness distribution data yet',
        metrics: [readyMetric, blockerMetric],
      },
      {
        id: 'funnel',
        title: 'Engagement Funnel',
        headline: shareCount > 0
          ? `${shareCount} passports shared → ${reviewCount} reviews → ${acceptCount} accepted`
          : 'No funnel data yet — share a passport to start tracking',
        metrics: funnelMetrics,
      },
    ],
    eventChain: snap.eventChain,
    dataGaps: [...dataGaps],
  };
}

// ── HTML export ───────────────────────────────────────────────────────────────

/**
 * Renders the ROI report as a self-contained, print-ready HTML page.
 * No external dependencies. Works as print-to-PDF in any browser.
 * No styling frameworks — all inline CSS for maximum portability.
 */
export function roiReportToHtml(report: RoiReport): string {
  const fmt = (n: number | null, unit: string) =>
    n !== null ? `${n}${unit}` : '—';

  const confBadge = (c: RoiConfidence) => {
    const colors: Record<RoiConfidence, string> = {
      HIGH: '#22c55e', MEDIUM: '#f59e0b', LOW: '#94a3b8', INSUFFICIENT_DATA: '#475569',
    };
    return `<span style="background:${colors[c]};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">${c.replace('_', ' ')}</span>`;
  };

  const metricRow = (m: RoiMetric) => `
    <tr style="border-bottom:1px solid #e2e8f0">
      <td style="padding:10px 8px;font-size:13px;color:#334155">${m.label}</td>
      <td style="padding:10px 8px;font-size:13px;font-weight:700;color:#0f172a;text-align:right">${fmt(m.vcvValue, m.vcvUnit)}</td>
      <td style="padding:10px 8px;font-size:12px;color:#64748b;text-align:right">${m.industryBaseline !== null ? fmt(m.industryBaseline, m.vcvUnit) : '—'}</td>
      <td style="padding:10px 8px;font-size:12px;color:${m.delta !== null && m.delta > 0 ? '#16a34a' : '#64748b'};text-align:right">${m.deltaLabel}</td>
      <td style="padding:10px 8px;text-align:center">${confBadge(m.confidence)}</td>
      <td style="padding:10px 8px;font-size:11px;color:#94a3b8;text-align:right">n=${m.sampleSize}</td>
    </tr>
    ${m.note ? `<tr><td colspan="6" style="padding:4px 8px 10px;font-size:11px;color:#94a3b8;font-style:italic">${m.note}</td></tr>` : ''}
  `;

  const sections = report.sections.map(s => `
    <div style="margin-bottom:32px">
      <h2 style="font-size:16px;font-weight:700;color:#1e293b;margin:0 0 4px">${s.title}</h2>
      <p style="font-size:13px;color:#64748b;margin:0 0 12px">${s.headline}</p>
      <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:8px">
        <thead>
          <tr style="background:#f1f5f9">
            <th style="padding:8px;font-size:11px;color:#94a3b8;text-align:left">Metric</th>
            <th style="padding:8px;font-size:11px;color:#94a3b8;text-align:right">VitalCV</th>
            <th style="padding:8px;font-size:11px;color:#94a3b8;text-align:right">Industry</th>
            <th style="padding:8px;font-size:11px;color:#94a3b8;text-align:right">Delta</th>
            <th style="padding:8px;font-size:11px;color:#94a3b8;text-align:center">Confidence</th>
            <th style="padding:8px;font-size:11px;color:#94a3b8;text-align:right">Sample</th>
          </tr>
        </thead>
        <tbody>
          ${s.metrics.map(metricRow).join('')}
        </tbody>
      </table>
    </div>
  `).join('');

  const chainStatus = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:8px">
      ${Object.entries(report.eventChain).map(([k, v]) => `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:10px">
          <p style="font-size:10px;color:#94a3b8;margin:0 0 2px;text-transform:uppercase;letter-spacing:.05em">${k.replace(/([A-Z])/g,' $1').trim()}</p>
          <p style="font-size:20px;font-weight:700;color:#0f172a;margin:0">${v}</p>
        </div>
      `).join('')}
    </div>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>VitalCV Pilot ROI Report — ${new Date(report.generatedAt).toLocaleDateString()}</title>
<style>
  @page { size: A4; margin: 20mm; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #0f172a; margin: 0; padding: 32px; background: #fff; }
  table { page-break-inside: avoid; }
</style>
</head>
<body>
  <div style="border-bottom:3px solid #0ea5e9;padding-bottom:20px;margin-bottom:28px">
    <p style="font-size:11px;color:#94a3b8;margin:0 0 6px;text-transform:uppercase;letter-spacing:.1em">VitalCV · Pilot ROI Report</p>
    <h1 style="font-size:26px;font-weight:800;color:#0f172a;margin:0 0 6px">${report.executiveSummary}</h1>
    <p style="font-size:12px;color:#64748b;margin:0">${report.windowDays}-day window · Generated ${new Date(report.generatedAt).toLocaleString()} · Confidence: ${report.overallConfidence}</p>
  </div>

  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:32px">
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px">
      <p style="font-size:11px;color:#16a34a;margin:0 0 4px;text-transform:uppercase">Decision latency</p>
      <p style="font-size:28px;font-weight:800;color:#15803d;margin:0">${fmt(report.topLine.daysDecisionLatency, 'd')}</p>
      <p style="font-size:11px;color:#4ade80;margin:2px 0 0">baseline: ${BASELINES.medianDaysReviewToDecision.value}d</p>
    </div>
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px">
      <p style="font-size:11px;color:#2563eb;margin:0 0 4px;text-transform:uppercase">Days saved</p>
      <p style="font-size:28px;font-weight:800;color:#1d4ed8;margin:0">${fmt(report.topLine.daysSavedVsBaseline, 'd')}</p>
      <p style="font-size:11px;color:#93c5fd;margin:2px 0 0">vs industry</p>
    </div>
    <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:14px">
      <p style="font-size:11px;color:#7c3aed;margin:0 0 4px;text-transform:uppercase">Ready at review</p>
      <p style="font-size:28px;font-weight:800;color:#6d28d9;margin:0">${fmt(report.topLine.percentReadyAtLatestReviewInWindow, '%')}</p>
      <p style="font-size:11px;color:#c4b5fd;margin:2px 0 0">latest review in selected window</p>
    </div>
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:14px">
      <p style="font-size:11px;color:#ea580c;margin:0 0 4px;text-transform:uppercase">Blockers resolved</p>
      <p style="font-size:28px;font-weight:800;color:#c2410c;margin:0">${report.topLine.blockersResolvedCount}</p>
      <p style="font-size:11px;color:#fdba74;margin:2px 0 0">${report.topLine.startOutcomeCount} confirmed start${Number(report.topLine.startOutcomeCount) === 1 ? '' : 's'}</p>
    </div>
  </div>

  ${sections}

  <div style="margin-bottom:24px">
    <h2 style="font-size:16px;font-weight:700;color:#1e293b;margin:0 0 8px">Event Chain Health</h2>
    ${chainStatus}
  </div>

  ${report.dataGaps.length > 0 ? `
  <div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:16px;margin-bottom:24px">
    <h3 style="font-size:13px;font-weight:700;color:#854d0e;margin:0 0 8px">Data gaps — collect these to improve confidence</h3>
    ${report.dataGaps.map(g => `<p style="font-size:12px;color:#713f12;margin:2px 0">· ${g}</p>`).join('')}
  </div>
  ` : ''}

  <div style="border-top:1px solid #e2e8f0;padding-top:16px;margin-top:24px">
    <p style="font-size:10px;color:#94a3b8;line-height:1.6">${report.dataDisclaimer}</p>
    <p style="font-size:10px;color:#cbd5e1;margin-top:4px">Report ID: ${report.reportId} · Methodology: ${report.methodology}</p>
  </div>
</body>
</html>`;
}
