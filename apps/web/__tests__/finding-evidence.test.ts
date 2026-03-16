import { buildFindingEvidenceRows, isEvidenceSourceDegraded } from '@/lib/intelligence/evidence';

describe('finding evidence helpers', () => {
  it('sorts evidence rows by confidence and derives degraded source status', () => {
    const rows = buildFindingEvidenceRows([
      {
        evidenceId: 'evidence-1',
        evidenceType: 'claim_record',
        sourceLabel: 'State Board',
        recordType: 'claim_record',
        snippet: 'License expiration date does not match the renewal feed.',
        observedAt: '2026-03-15T10:00:00.000Z',
        metadata: {
          claimType: 'license_status',
          value: 'Expired',
          confidence: 0.81,
        },
      },
      {
        evidenceId: 'evidence-2',
        evidenceType: 'graph_edge',
        sourceLabel: 'Graph Runtime',
        observedAt: '2026-03-15T09:00:00.000Z',
        metadata: {
          edgeType: 'shared_license',
          value: 'Shared state license reference',
          confidence: 0.94,
        },
      },
    ], 0.5, {
      sources: [
        {
          source: 'STATE_BOARD',
          status: 'DEGRADED',
          lastSeen: '2026-03-15T10:05:00.000Z',
          artifactCount: 14,
        },
      ],
    });

    expect(rows.map((row) => row.id)).toEqual(['evidence-2', 'evidence-1']);
    expect(rows[0]).toMatchObject({
      field: 'Shared License',
      value: 'Shared state license reference',
      degraded: false,
    });
    expect(rows[1]).toMatchObject({
      field: 'License Status',
      value: 'Expired',
      degraded: true,
    });
  });

  it('matches degraded sources by normalized source key', () => {
    expect(isEvidenceSourceDegraded('State Board', {
      sources: [
        {
          source: 'STATE_BOARD',
          status: 'OUTAGE',
          lastSeen: null,
          artifactCount: 0,
        },
      ],
    })).toBe(true);

    expect(isEvidenceSourceDegraded('ABMS', {
      sources: [
        {
          source: 'STATE_BOARD',
          status: 'OUTAGE',
          lastSeen: null,
          artifactCount: 0,
        },
      ],
    })).toBe(false);
  });
});
