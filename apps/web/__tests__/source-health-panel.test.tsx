import { describe, expect, it } from 'vitest';
import type { SourceOpsEntry, SourceOpsReport } from '@/lib/mission-ops/sourceOpsTypes';

function makeReport(overrides: Partial<SourceOpsReport> = {}): SourceOpsReport {
  return {
    timestamp: new Date().toISOString(),
    sources: [
      {
        sourceId: 'NPPES_API',
        name: 'CMS NPI Registry API',
        isSpine: true,
        decisionGrade: true,
        coverageState: 'checked',
        lastSuccessAt: new Date().toISOString(),
        lastFailureAt: null,
        consecutiveFailures: 0,
        freshnessSlaHours: 168,
        featureFlag: { key: 'NPPES_API_ENABLED', enabled: true },
      },
      {
        sourceId: 'OIG_LEIE',
        name: 'OIG LEIE Exclusion List',
        isSpine: true,
        decisionGrade: true,
        coverageState: 'checked',
        lastSuccessAt: new Date().toISOString(),
        lastFailureAt: null,
        consecutiveFailures: 0,
        freshnessSlaHours: 720,
        featureFlag: { key: 'OIG_LEIE_ENABLED', enabled: true },
      },
      {
        sourceId: 'PECOS_PUBLIC',
        name: 'CMS PECOS',
        isSpine: false,
        decisionGrade: false,
        coverageState: 'pending',
        lastSuccessAt: null,
        lastFailureAt: null,
        consecutiveFailures: 0,
        freshnessSlaHours: 168,
        featureFlag: { key: 'PECOS_ENABLED', enabled: true },
      },
    ],
    spineStatus: 'HEALTHY',
    alerts: [],
    ...overrides,
  };
}

const PILOT_SOURCE_IDS = ['NPPES_API', 'OIG_LEIE', 'PECOS_PUBLIC'];

function filterPilotSources(sources: SourceOpsEntry[]): SourceOpsEntry[] {
  return sources.filter(
    (s) => PILOT_SOURCE_IDS.includes(s.sourceId) || s.isSpine,
  );
}

function formatAge(isoDate: string | null): string {
  if (!isoDate) return 'never';
  const ms = Date.now() - new Date(isoDate).getTime();
  if (ms < 0) return 'just now';
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) {
    const mins = Math.floor(ms / 60_000);
    return mins < 1 ? 'just now' : `${mins}m ago`;
  }
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function coverageColor(state: SourceOpsEntry['coverageState']): string {
  switch (state) {
    case 'checked':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400';
    case 'stale':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-400';
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
    expect(formatAge(null)).toBe('never');
  });

  it('applies amber class for stale and rose class for unavailable', () => {
    expect(coverageColor('stale')).toContain('amber');
    expect(coverageColor('unavailable')).toContain('rose');
    expect(coverageColor('checked')).toContain('emerald');
  });
});
