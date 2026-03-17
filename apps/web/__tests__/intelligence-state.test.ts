import {
  DEFAULT_STALE_DATA_THRESHOLD_MS,
  deriveSystemHealthSurfaceState,
  formatLastRefreshMessage,
  getFindingsEmptyState,
  getSurfaceFreshnessState,
  hasDegradedDataSources,
} from '@/lib/intelligence/state';

describe('intelligence surface state helpers', () => {
  it('returns the filtered empty state copy', () => {
    expect(getFindingsEmptyState({
      findingCount: 0,
      hasFilters: true,
      providerCount: 0,
    })).toEqual({
      title: 'No findings match your filters.',
      description: 'Adjust or clear the filters to widen the result set.',
    });
  });

  it('returns the first-run onboarding state when providers and findings are both empty', () => {
    expect(getFindingsEmptyState({
      findingCount: 0,
      hasFilters: false,
      providerCount: 0,
    })).toEqual({
      title: 'Add providers to begin monitoring.',
      description: 'No providers are connected yet, so the findings feed has nothing to evaluate.',
    });
  });

  it('returns the unfiltered empty state once providers exist', () => {
    expect(getFindingsEmptyState({
      findingCount: 0,
      hasFilters: false,
      providerCount: 4,
    })).toEqual({
      title: 'No findings generated yet.',
      description: 'Investigators have not generated any findings in the current environment yet.',
    });
  });

  it('prefers payload generation time when evaluating stale data', () => {
    const now = Date.parse('2026-03-15T12:20:00.000Z');
    const stale = getSurfaceFreshnessState({
      generatedAt: '2026-03-15T12:00:00.000Z',
      lastUpdated: '2026-03-15T12:19:30.000Z',
      now,
    });

    expect(stale.isStale).toBe(true);
    expect(stale.ageMinutes).toBe(20);
  });

  it('respects a custom freshness threshold', () => {
    const now = Date.parse('2026-03-15T12:10:00.000Z');
    const fresh = getSurfaceFreshnessState({
      lastUpdated: '2026-03-15T12:00:00.000Z',
      now,
      thresholdMs: DEFAULT_STALE_DATA_THRESHOLD_MS + 60_000,
    });

    expect(fresh.isStale).toBe(false);
    expect(fresh.ageMinutes).toBe(10);
  });

  it('flags degraded source connectivity only when the connectivity card is degraded', () => {
    expect(hasDegradedDataSources({
      cards: [
        {
          id: 'connectivity',
          label: 'Source connectivity',
          tone: 'degraded',
          summary: '2/3 sources nominal',
          detail: 'One source is degraded.',
        },
      ],
    })).toBe(true);

    expect(hasDegradedDataSources({
      cards: [
        {
          id: 'pipeline',
          label: 'Trust pipeline',
          tone: 'critical',
          summary: 'Critical',
          detail: 'Checks failed.',
        },
      ],
    })).toBe(false);
  });

  it('formats the stale refresh banner copy', () => {
    expect(formatLastRefreshMessage(1)).toBe('Data last refreshed 1 min ago.');
    expect(formatLastRefreshMessage(16)).toBe('Data last refreshed 16 min ago.');
    expect(formatLastRefreshMessage(120)).toBe('Data last refreshed 2 hours ago.');
  });

  it('distinguishes empty-but-functioning system health', () => {
    expect(deriveSystemHealthSurfaceState({
      overall: 'healthy',
      headline: 'No source telemetry yet',
      generatedAt: '2026-03-15T12:00:00.000Z',
      cards: [
        { id: 'pipeline', label: 'Trust pipeline', tone: 'healthy', summary: 'HEALTHY', detail: 'Checks clear.' },
        { id: 'verification', label: 'Verification throughput', tone: 'healthy', summary: '0 verifications in the last hour', detail: '0 verifications in the last 24 hours' },
      ],
      incidents: [],
      sources: [],
    }).mode).toBe('empty');
  });

  it('marks system health as broken when critical failures stack up', () => {
    expect(deriveSystemHealthSurfaceState({
      overall: 'critical',
      headline: 'Trust telemetry is failing closed',
      generatedAt: '2026-03-15T12:00:00.000Z',
      cards: [
        { id: 'pipeline', label: 'Trust pipeline', tone: 'critical', summary: 'Critical', detail: 'Checks failed.' },
        { id: 'connectivity', label: 'Source connectivity', tone: 'critical', summary: '0/2 sources nominal', detail: 'All sources offline.' },
      ],
      incidents: [],
      sources: [
        { source: 'STATE_BOARD', status: 'OUTAGE', lastSeen: null, artifactCount: 0 },
        { source: 'NPPES', status: 'OUTAGE', lastSeen: null, artifactCount: 0 },
      ],
    }).mode).toBe('broken');
  });
});
