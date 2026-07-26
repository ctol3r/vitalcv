import {
  buildAcceptanceSourceSnapshot,
  buildEmployerAcceptanceMetadata,
  EMPLOYER_ACCEPTANCE_METADATA_SCHEMA,
} from '../acceptanceSourceSnapshot';

describe('buildAcceptanceSourceSnapshot', () => {
  it('projects coverage checks onto the AcceptanceSourceCheck shape with catalog labels', () => {
    const snapshot = buildAcceptanceSourceSnapshot([
      { sourceId: 'OIG_LEIE', state: 'checked', checkedAt: '2026-07-01T00:00:00.000Z' },
      { sourceId: 'NPPES_API', state: 'checked', checkedAt: '2026-07-02T00:00:00.000Z' },
    ]);

    expect(snapshot).toEqual([
      {
        sourceId: 'NPPES_API',
        label: 'CMS NPI Registry API',
        state: 'checked',
        checkedAt: '2026-07-02T00:00:00.000Z',
      },
      {
        sourceId: 'OIG_LEIE',
        label: 'HHS OIG List of Excluded Individuals/Entities (LEIE)',
        state: 'checked',
        checkedAt: '2026-07-01T00:00:00.000Z',
      },
    ]);
  });

  it('falls back to the raw sourceId as label for sources outside the catalog', () => {
    const snapshot = buildAcceptanceSourceSnapshot([
      { sourceId: 'SOME_FUTURE_SOURCE', state: 'pending' },
    ]);
    expect(snapshot).toEqual([
      { sourceId: 'SOME_FUTURE_SOURCE', label: 'SOME_FUTURE_SOURCE', state: 'pending', checkedAt: null },
    ]);
  });

  it('normalizes a missing checkedAt to null (never undefined — this is persisted JSON)', () => {
    const [check] = buildAcceptanceSourceSnapshot([{ sourceId: 'STATE_BOARD', state: 'pending' }]);
    expect(check.checkedAt).toBeNull();
  });

  it('dedupes by sourceId with last-wins, matching the diff consumer Map semantics', () => {
    const snapshot = buildAcceptanceSourceSnapshot([
      { sourceId: 'OIG_LEIE', state: 'pending', checkedAt: null },
      { sourceId: 'OIG_LEIE', state: 'checked', checkedAt: '2026-07-01T00:00:00.000Z' },
    ]);
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0].state).toBe('checked');
  });

  it('returns an empty snapshot for missing coverage and skips blank sourceIds', () => {
    expect(buildAcceptanceSourceSnapshot(undefined)).toEqual([]);
    expect(buildAcceptanceSourceSnapshot(null)).toEqual([]);
    expect(buildAcceptanceSourceSnapshot([{ sourceId: '', state: 'checked' }])).toEqual([]);
  });
});

describe('buildEmployerAcceptanceMetadata', () => {
  it('wraps a non-empty snapshot in the versioned envelope', () => {
    const metadata = buildEmployerAcceptanceMetadata({
      capturedAt: '2026-07-18T12:00:00.000Z',
      checks: [
        { sourceId: 'NPPES_API', label: 'CMS NPI Registry API', state: 'checked', checkedAt: null },
      ],
    });

    expect(metadata).toEqual({
      schema: EMPLOYER_ACCEPTANCE_METADATA_SCHEMA,
      acceptedSourceSnapshot: {
        capturedAt: '2026-07-18T12:00:00.000Z',
        checks: [
          { sourceId: 'NPPES_API', label: 'CMS NPI Registry API', state: 'checked', checkedAt: null },
        ],
      },
    });
  });

  it('returns null when there is no coverage to freeze — the column stays NULL, not an empty husk', () => {
    expect(buildEmployerAcceptanceMetadata({ capturedAt: '2026-07-18T12:00:00.000Z', checks: [] }))
      .toBeNull();
  });
});
