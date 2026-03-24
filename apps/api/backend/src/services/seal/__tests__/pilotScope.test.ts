import { hasScope, mergeScope, parseScopeFromQuery } from '../pilotScope';

describe('pilotScope', () => {
  it('merges only non-null scope fields into metadata', () => {
    expect(
      mergeScope(
        { sharedBy: 'clinician-123', geographyTag: 'legacy' },
        { pilotId: 'acme-q1', workflowLane: 'locum-rn', geographyTag: null },
      ),
    ).toEqual({
      sharedBy: 'clinician-123',
      geographyTag: 'legacy',
      pilotId: 'acme-q1',
      workflowLane: 'locum-rn',
    });
  });

  it('parses scope aliases and trims blank values', () => {
    const scope = parseScopeFromQuery({
      pilot: ' acme-q1 ',
      workflowLane: 'perm-md',
      geo: '  ',
    });

    expect(scope).toEqual({
      pilotId: 'acme-q1',
      workflowLane: 'perm-md',
      geographyTag: null,
    });
    expect(hasScope(scope)).toBe(true);
    expect(hasScope({ pilotId: null, workflowLane: null, geographyTag: null })).toBe(false);
  });
});
