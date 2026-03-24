/**
 * blockerLifecycle.test.ts
 *
 * Tests for syncBlockerEvents() lifecycle state machine:
 *   open → resolve → re-open (new episode)
 *   no-op on unchanged blockers
 *   KPI export shape from pilotKpiService helpers
 *
 * All DB calls are mocked via jest.mock — no real DB required.
 */

// ── Mock Prisma before importing anything that uses it ──────────────────────

const mockFindMany  = jest.fn();
const mockCreateMany = jest.fn();
const mockUpdate    = jest.fn();
const mockFindUnique = jest.fn();

jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    blockerResolutionEvent: {
      findMany:   (...args: unknown[]) => mockFindMany(...args),
      createMany: (...args: unknown[]) => mockCreateMany(...args),
      update:     (...args: unknown[]) => mockUpdate(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
}));

// ── Import after mocking ────────────────────────────────────────────────────

import { syncBlockerEvents } from '../sealEventCapture';
import { kpiSnapshotToCsv }  from '../../pilot/pilotKpiService';
import type { PilotKpiSnapshot } from '../../pilot/pilotKpiService';

// ── Helpers ─────────────────────────────────────────────────────────────────

const ENTITY_ID = '00000000-0000-0000-0000-000000000001';

function makeOpenRow(code: string, id = `id-${code}`) {
  return { id, blockerCode: code, openedAt: new Date('2026-01-01T00:00:00Z') };
}

function resetMocks() {
  mockFindMany.mockReset();
  mockCreateMany.mockReset().mockResolvedValue({ count: 0 });
  mockUpdate.mockReset().mockResolvedValue({});
  mockFindUnique.mockReset();
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('syncBlockerEvents — lifecycle state machine', () => {
  beforeEach(resetMocks);

  // ── 1. First open ────────────────────────────────────────────────────────
  it('opens new blockers when none exist', async () => {
    mockFindMany.mockResolvedValue([]); // no open rows

    const result = await syncBlockerEvents(ENTITY_ID, ['LICENSE_EXPIRED', 'ENROLLMENT_NOT_FOUND']);

    expect(result.opened).toBe(2);
    expect(result.resolved).toBe(0);
    expect(result.noOp).toBe(0);

    expect(mockCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ blockerCode: 'LICENSE_EXPIRED',      status: 'OPEN' }),
          expect.objectContaining({ blockerCode: 'ENROLLMENT_NOT_FOUND', status: 'OPEN' }),
        ]),
        skipDuplicates: true,
      }),
    );
  });

  // ── 2. Resolve ───────────────────────────────────────────────────────────
  it('resolves blockers no longer in the current list', async () => {
    mockFindMany.mockResolvedValue([
      makeOpenRow('LICENSE_EXPIRED',      'row-1'),
      makeOpenRow('ENROLLMENT_NOT_FOUND', 'row-2'),
    ]);
    // resolveBlockerEvent fetches the row to compute timing
    mockFindUnique.mockResolvedValue({ openedAt: new Date('2026-01-01T00:00:00Z') });

    // Only LICENSE_EXPIRED remains current — ENROLLMENT_NOT_FOUND resolved
    const result = await syncBlockerEvents(ENTITY_ID, ['LICENSE_EXPIRED']);

    expect(result.opened).toBe(0);
    expect(result.resolved).toBe(1);
    expect(result.noOp).toBe(1); // LICENSE_EXPIRED unchanged

    // Should have updated ENROLLMENT_NOT_FOUND to RESOLVED
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'row-2' },
        data: expect.objectContaining({
          status:           'RESOLVED',
          resolutionMethod: 'SOURCE_UPDATE',
        }),
      }),
    );
  });

  // ── 3. No-op — unchanged blockers ────────────────────────────────────────
  it('does not create duplicate events for unchanged open blockers', async () => {
    mockFindMany.mockResolvedValue([
      makeOpenRow('LICENSE_EXPIRED', 'row-1'),
    ]);

    const result = await syncBlockerEvents(ENTITY_ID, ['LICENSE_EXPIRED']);

    expect(result.opened).toBe(0);
    expect(result.resolved).toBe(0);
    expect(result.noOp).toBe(1);
    expect(mockCreateMany).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  // ── 4. Re-open after resolve ─────────────────────────────────────────────
  // A re-opened blocker appears in the current list but has no OPEN row
  // (prior episode was RESOLVED). syncBlockerEvents must create a NEW open row.
  it('re-opens a blocker that was previously resolved', async () => {
    // No OPEN rows — prior episode was resolved
    mockFindMany.mockResolvedValue([]);

    const result = await syncBlockerEvents(ENTITY_ID, ['LICENSE_EXPIRED']);

    expect(result.opened).toBe(1);
    expect(mockCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ blockerCode: 'LICENSE_EXPIRED', status: 'OPEN' }),
        ]),
      }),
    );
  });

  // ── 5. Empty current list — all open blockers resolved ───────────────────
  it('resolves all open blockers when current list is empty', async () => {
    mockFindMany.mockResolvedValue([
      makeOpenRow('LICENSE_EXPIRED',      'row-1'),
      makeOpenRow('ENROLLMENT_NOT_FOUND', 'row-2'),
    ]);
    mockFindUnique.mockResolvedValue({ openedAt: new Date('2026-01-01T00:00:00Z') });

    const result = await syncBlockerEvents(ENTITY_ID, []);

    expect(result.opened).toBe(0);
    expect(result.resolved).toBe(2);
    expect(result.noOp).toBe(0);
  });

  // ── 6. Partial overlap — mixed open/resolve/no-op ────────────────────────
  it('handles mixed state: some new, some resolved, some unchanged', async () => {
    mockFindMany.mockResolvedValue([
      makeOpenRow('OLD_BLOCKER',  'row-old'),
      makeOpenRow('SAME_BLOCKER', 'row-same'),
    ]);
    mockFindUnique.mockResolvedValue({ openedAt: new Date('2026-01-01T00:00:00Z') });

    const result = await syncBlockerEvents(ENTITY_ID, ['SAME_BLOCKER', 'NEW_BLOCKER']);

    expect(result.opened).toBe(1);   // NEW_BLOCKER
    expect(result.resolved).toBe(1); // OLD_BLOCKER
    expect(result.noOp).toBe(1);     // SAME_BLOCKER

    // NEW_BLOCKER opened
    expect(mockCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ blockerCode: 'NEW_BLOCKER' })],
      }),
    );
    // OLD_BLOCKER resolved
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'row-old' } }),
    );
  });

  // ── 7. DB failure — graceful, does not throw ─────────────────────────────
  it('does not throw when the DB call fails', async () => {
    mockFindMany.mockRejectedValue(new Error('DB connection lost'));

    await expect(syncBlockerEvents(ENTITY_ID, ['LICENSE_EXPIRED'])).resolves.toEqual({
      opened: 0, resolved: 0, noOp: 0,
    });
  });
});

// ── KPI CSV export shape ─────────────────────────────────────────────────────

describe('kpiSnapshotToCsv — blocker section', () => {
  const snapshot: PilotKpiSnapshot = {
    generatedAt:  '2026-03-23T21:00:00Z',
    windowDays:   90,
    since:        '2026-01-01T00:00:00Z',
    appliedFilter: {
      pilotId: null,
      workflowLane: null,
      orgContextId: null,
      geographyTag: null,
    },
    isFiltered: false,
    packetShares: {
      total: 5, distinctEntities: 3, distinctOrgs: 2,
      byDeliveryStatus: { DELIVERED: 4, FAILED: 1 },
      earliestSharedAt: '2026-01-15T00:00:00Z',
      latestSharedAt:   '2026-03-20T00:00:00Z',
    },
    reviewsOpened: {
      total: 4, distinctEntities: 3, byOrgContext: [],
      earliestAt: '2026-02-01T00:00:00Z',
      latestAt:   '2026-03-22T00:00:00Z',
    },
    decisions: {
      total: 3, byType: { PROCEED: 2, REQUEST_REFRESH: 1 },
      proceedCount: 2, refreshCount: 1, routeCount: 0, rejectCount: 0, holdCount: 0,
    },
    velocity: {
      medianDaysFirstReviewToDecision: 3,
      medianDaysFirstReviewToReady:    7,
      medianDaysFirstReviewToStart:    14,
      medianDaysShareToDecision:       5,
      sampleSizes: { reviewToDecision: 2, reviewToReady: 1, reviewToStart: 1, shareToDecision: 2 },
    },
    blockers: [
      {
        code:                 'LICENSE_EXPIRED',
        openCount:            2,
        resolvedCount:        3,
        avgResolutionDays:    6,
        medianResolutionDays: 5,
        byResolutionMethod:   { SOURCE_UPDATE: 3 },
      },
      {
        code:                 'ENROLLMENT_NOT_FOUND',
        openCount:            1,
        resolvedCount:        0,
        avgResolutionDays:    null,
        medianResolutionDays: null,
        byResolutionMethod:   {},
      },
    ],
    startOutcomes: {
      totalStarts: 2, distinctEntities: 2,
      readinessAtStart: { avgScore: 82, medianScore: 85, withBlockers: 0 },
    },
    eventChain: {
      bundleShareEvents: 5, advisoryOutcomeEvents: 12, employerDecisionEvents: 3,
      blockerResolutionEvents: 6, startOutcomeEvents: 2,
      employerAcceptances: 2, startAttestations: 2,
    },
    readinessDistribution: {
      ready: 1,
      partial: 1,
      blocked: 0,
      total: 2,
      noScore: 0,
    },
    gaps: [],
  };

  it('includes blocker section in CSV output', () => {
    const csv = kpiSnapshotToCsv(snapshot);
    expect(csv).toContain('filters,pilot_id,(all)');
    expect(csv).toContain('blocker:license_expired,open_count,2');
    expect(csv).toContain('blocker:license_expired,resolved_count,3');
    expect(csv).toContain('blocker:enrollment_not_found,open_count,1');
  });

  it('includes avg and median resolution days in blocker rows', () => {
    const csv = kpiSnapshotToCsv(snapshot);
    expect(csv).toContain('blocker:license_expired,avg_resolution_days,6');
    expect(csv).toContain('blocker:license_expired,median_resolution_days,5');
  });

  it('outputs n/a for unresolved blockers', () => {
    const csv = kpiSnapshotToCsv(snapshot);
    expect(csv).toContain('n/a');
  });

  it('includes velocity section with real values', () => {
    const csv = kpiSnapshotToCsv(snapshot);
    expect(csv).toContain('3'); // medianDaysFirstReviewToDecision
    expect(csv).toContain('14'); // medianDaysFirstReviewToStart
  });

  it('includes event chain counts', () => {
    const csv = kpiSnapshotToCsv(snapshot);
    expect(csv).toContain('bundle_share_events');
    expect(csv).toContain('blocker_resolution_events');
  });

  it('outputs No gaps message when gaps array is empty', () => {
    const csv = kpiSnapshotToCsv(snapshot);
    expect(csv).toContain('gaps,status,none');
  });

  it('outputs gap messages when gaps are present', () => {
    const withGaps: PilotKpiSnapshot = {
      ...snapshot,
      appliedFilter: {
        pilotId: 'acme-q1',
        workflowLane: 'locum-rn',
        orgContextId: 'org-ctx-1',
        geographyTag: 'CA',
      },
      isFiltered: true,
      gaps: ['Missing: employer review events.'],
    };
    const csv = kpiSnapshotToCsv(withGaps);
    expect(csv).toContain('filters,pilot_id,acme-q1');
    expect(csv).toContain('gaps,gap_1,Missing: employer review events.');
  });
});
