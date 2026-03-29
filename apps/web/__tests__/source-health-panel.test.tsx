import { describe, expect, it } from 'vitest';
import type { SourceOpsEntry, SourceOpsReport } from '@/lib/mission-ops/sourceOpsTypes';
import {
  classifySourceHealthErrors,
  filterPilotSources,
  formatSourceHealthAge,
  formatSourceHealthCoverageState,
} from '@/lib/mission-ops/sourceHealthContract';

function makeReport(overrides: Partial<SourceOpsReport> = {}): SourceOpsReport {
  return {
    timestamp: new Date().toISOString(),
    sources: [
      {
        sourceId: 'NPPES_API',
        name: 'CMS NPI Registry API',
        isSpine: true,
        supportedInLaunchLane: true,
        decisionGrade: true,
        liveDecisionGrade: true,
        coverageState: 'checked',
        lastSuccessAt: new Date().toISOString(),
        lastFailureAt: null,
        consecutiveFailures: 0,
        freshnessSlaHours: 168,
        featureFlag: { key: 'NPPES_API_ENABLED', enabled: true, mismatch: false },
      },
      {
        sourceId: 'OIG_LEIE',
        name: 'OIG LEIE Exclusion List',
        isSpine: true,
        supportedInLaunchLane: true,
        decisionGrade: true,
        liveDecisionGrade: true,
        coverageState: 'checked',
        lastSuccessAt: new Date().toISOString(),
        lastFailureAt: null,
        consecutiveFailures: 0,
        freshnessSlaHours: 720,
        featureFlag: { key: 'OIG_LEIE_ENABLED', enabled: true, mismatch: false },
      },
      {
        sourceId: 'PECOS_PUBLIC',
        name: 'CMS PECOS',
        isSpine: false,
        supportedInLaunchLane: true,
        decisionGrade: false,
        liveDecisionGrade: false,
        coverageState: 'pending',
        lastSuccessAt: null,
        lastFailureAt: null,
        consecutiveFailures: 0,
        freshnessSlaHours: 168,
        featureFlag: { key: 'PECOS_ENABLED', enabled: true, mismatch: false },
      },
    ],
    spineStatus: 'HEALTHY',
    alerts: [],
    ...overrides,
  };
}

function coverageColor(state: SourceOpsEntry['coverageState']): string {
  switch (state) {
    case 'checked':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400';
    case 'stale':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-400';
    case 'gated':
    case 'accessRequired':
      return 'border-sky-500/30 bg-sky-500/10 text-sky-400';
    case 'reviewRequired':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-400';
    case 'notDecisionGrade':
    case 'previewOnly':
      return 'border-zinc-600/30 bg-zinc-600/10 text-zinc-500';
    case 'unavailable':
      return 'border-rose-500/30 bg-rose-500/10 text-rose-400';
    default:
      return 'border-zinc-600/30 bg-zinc-600/10 text-zinc-500';
  }
}

describe('SourceHealthPanel logic', () => {
  it('filters to show spine sources by name', () => {
    const report = makeReport();
    const pilotSources = filterPilotSources(report.sources);
    const names = pilotSources.map((s) => s.name);
    expect(names).toContain('CMS NPI Registry API');
    expect(names).toContain('OIG LEIE Exclusion List');
    expect(names).toContain('CMS PECOS');
  });

  it('exposes spineStatus from the report', () => {
    const report = makeReport();
    expect(report.spineStatus).toBe('HEALTHY');

    const degraded = makeReport({ spineStatus: 'DEGRADED' });
    expect(degraded.spineStatus).toBe('DEGRADED');
  });

  it('shows alerts when present', () => {
    const report = makeReport({
      alerts: ['STALE: CMS NPI Registry API has missed its freshness SLA of 168h.'],
    });
    expect(report.alerts.length).toBe(1);
    expect(report.alerts[0]).toContain('STALE: CMS NPI Registry API');
  });

  it('shows "No active alerts" when alerts are empty', () => {
    const report = makeReport({ alerts: [] });
    expect(report.alerts.length).toBe(0);
  });

  it('formats null lastSuccessAt as "never"', () => {
    expect(formatSourceHealthAge(null)).toBe('never');
  });

  it('applies amber class for stale and rose class for unavailable', () => {
    expect(coverageColor('stale')).toContain('amber');
    expect(coverageColor('unavailable')).toContain('rose');
    expect(coverageColor('checked')).toContain('emerald');
  });

  it('uses canonical operator labels for access-required and unsupported source states', () => {
    expect(formatSourceHealthCoverageState('accessRequired')).toBe('Access required');
    expect(formatSourceHealthCoverageState('notDecisionGrade')).toBe('Not decision-grade');
  });

  it('classifies stale, config, and unsupported operator states without collapsing them', () => {
    const report = makeReport({
      sources: [
        {
          sourceId: 'NPPES_API',
          name: 'CMS NPI Registry API',
          isSpine: true,
          supportedInLaunchLane: true,
          decisionGrade: true,
          liveDecisionGrade: false,
          coverageState: 'pending',
          lastSuccessAt: null,
          lastFailureAt: null,
          consecutiveFailures: 0,
          freshnessSlaHours: 168,
          featureFlag: { key: 'NPPES_API_ENABLED', enabled: false, mismatch: true },
        },
        {
          sourceId: 'OIG_LEIE',
          name: 'OIG LEIE Exclusion List',
          isSpine: true,
          supportedInLaunchLane: true,
          decisionGrade: true,
          liveDecisionGrade: false,
          coverageState: 'stale',
          lastSuccessAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          lastFailureAt: null,
          consecutiveFailures: 0,
          freshnessSlaHours: 24,
          featureFlag: { key: 'OIG_LEIE_ENABLED', enabled: true, mismatch: false },
        },
        {
          sourceId: 'STATE_BOARD',
          name: 'State Medical Boards',
          isSpine: true,
          supportedInLaunchLane: false,
          decisionGrade: false,
          liveDecisionGrade: false,
          coverageState: 'notDecisionGrade',
          lastSuccessAt: null,
          lastFailureAt: null,
          consecutiveFailures: 0,
          freshnessSlaHours: 168,
          featureFlag: { key: 'STATE_BOARD_ENABLED', enabled: true, mismatch: false },
        },
      ],
    });

    const groups = classifySourceHealthErrors(report.sources.filter((source) => source.isSpine));

    expect(groups.map((group) => group.label)).toEqual([
      'Freshness',
      'Configuration',
      'Unsupported',
    ]);
    expect(groups.find((group) => group.label === 'Configuration')?.sources.map((source) => source.sourceId)).toEqual(['NPPES_API']);
    expect(groups.find((group) => group.label === 'Unsupported')?.sources.map((source) => source.sourceId)).toEqual(['STATE_BOARD']);
  });
});
