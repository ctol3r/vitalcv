import {
  buildPecosEnrollmentNote,
  buildPecosFreshnessLabel,
  buildPecosFetchedRecord,
  buildPecosSingleProviderQueryUrl,
  buildPecosStatusLabel,
  computePecosRevalidationDue,
  extractPecosArtifactSnapshot,
  isPecosFresh,
  pecosRevalidationDaysRemaining,
  pecosReadinessStatus,
  resolvePecosCurrentStatus,
} from '../pecosContract';

describe('pecosContract', () => {
  it('builds the single-provider PECOS query with an encoded NPI filter', () => {
    expect(buildPecosSingleProviderQueryUrl('1558302470')).toBe(
      'https://data.cms.gov/data-api/v1/dataset/2457ea29-fc82-48b0-86ec-3b0755de7515/data?filter%5BNPI%5D=1558302470&size=5',
    );
  });

  it('computes quarterly revalidation windows from observed PECOS evidence', () => {
    expect(computePecosRevalidationDue({
      status: 'ENROLLED',
      observedAt: '2026-03-24T12:00:00.000Z',
    })).toBe('2026-06-22T12:00:00.000Z');
    expect(computePecosRevalidationDue({
      status: 'UNKNOWN',
      observedAt: '2026-03-24T12:00:00.000Z',
    })).toBe('2026-06-22T12:00:00.000Z');
    expect(computePecosRevalidationDue({
      status: 'UNCHECKED',
      observedAt: '2026-03-24T12:00:00.000Z',
    })).toBeNull();
  });

  it('builds a found PECOS fetch record with normalized quarter and freshness contract', () => {
    const record = buildPecosFetchedRecord({
      npi: '1558302470',
      row: {
        ENRLMT_CLSFCTN_TYPE_DESC: 'Physician',
      },
      fetchedAt: '2026-03-24T12:00:00.000Z',
      lastModified: 'Mon, 23 Mar 2026 02:09:21 GMT',
    });

    expect(record).toMatchObject({
      claimState: 'ENROLLED',
      enrolled: true,
      enrollmentType: 'Physician',
      dataVersion: '2026-Q1',
      source: 'PECOS',
      sourceLatency: 'QUARTERLY',
      dataFreshness: 'QUARTERLY',
      revalidationDue: '2026-06-22T12:00:00.000Z',
    });
  });

  it('derives stale PECOS artifacts from the stored contract instead of a parallel local rule', () => {
    const snapshot = extractPecosArtifactSnapshot({
      status: 'ACTIVE',
      verifiedAt: new Date('2026-03-24T12:00:00.000Z'),
      rawPayload: {
        _claims: [
          {
            claimType: 'ENROLLMENT_STATUS',
            value: {
              claimState: 'ENROLLED',
              enrolled: true,
              observedAt: '2026-03-24T12:00:00.000Z',
              dataVersion: '2026-Q1',
            },
          },
        ],
      },
    });

    expect(snapshot.status).toBe('ENROLLED');
    expect(snapshot.revalidationDue).toBe('2026-06-22T12:00:00.000Z');
    expect(isPecosFresh({
      status: snapshot.status,
      revalidationDue: snapshot.revalidationDue,
      observedAt: snapshot.observedAt,
    }, new Date('2026-06-01T00:00:00.000Z'))).toBe(true);
    expect(isPecosFresh({
      status: snapshot.status,
      revalidationDue: snapshot.revalidationDue,
      observedAt: snapshot.observedAt,
    }, new Date('2026-06-23T00:00:00.000Z'))).toBe(false);
    expect(resolvePecosCurrentStatus({
      checked: snapshot.checked,
      status: snapshot.status,
      fresh: false,
    })).toBe('UNKNOWN');
  });

  it('keeps readiness-facing PECOS language aligned across statuses', () => {
    expect(buildPecosStatusLabel('NOT_FOUND', '2026-Q1')).toBe(
      'Medicare enrollment not found in quarterly PECOS snapshot — as of Q1 2026',
    );
    expect(buildPecosEnrollmentNote('NOT_FOUND', '2026-Q1')).toBe(
      'Not found in the quarterly CMS PECOS release (Q1 2026) — may indicate non-enrollment or publication lag',
    );
    expect(pecosReadinessStatus('NOT_FOUND')).toBe('Blocked — PECOS quarterly enrollment not found');
    expect(pecosReadinessStatus('UNKNOWN')).toBe('Unresolved — PECOS enrollment outcome is unknown');
    expect(pecosReadinessStatus('UNCHECKED')).toBe('Unresolved — PECOS enrollment has not been checked');
  });

  it('labels due-soon PECOS freshness from the same revalidation contract', () => {
    expect(pecosRevalidationDaysRemaining('2026-04-05T00:00:00.000Z', new Date('2026-04-01T00:00:00.000Z'))).toBe(4);
    expect(buildPecosFreshnessLabel({
      status: 'ENROLLED',
      observedAt: '2026-03-24T12:00:00.000Z',
      revalidationDue: '2026-04-05T00:00:00.000Z',
    }, new Date('2026-04-01T00:00:00.000Z'))).toBe('Revalidation due in 4 days');
    expect(buildPecosFreshnessLabel({
      status: 'ENROLLED',
      observedAt: '2026-03-24T12:00:00.000Z',
      revalidationDue: '2026-03-20T00:00:00.000Z',
    }, new Date('2026-04-01T00:00:00.000Z'))).toBe('Stale — refresh required');
  });
});
