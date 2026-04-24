import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
);

vi.mock('next/navigation', () => ({
  notFound: notFoundMock,
}));

// Count confidence badges by type in a rendered markup string.
// The route renders one badge per field via ProfileView's I2 invariant;
// these assertions pin that no verified/inferred badges leak into the
// valid-but-unknown branch, and no unknown badges escape the known branch.
function countConfidenceBadges(markup: string, type: string): number {
  const re = new RegExp(`data-confidence="${type}"`, 'g');
  return markup.match(re)?.length ?? 0;
}

describe('/profile/[npi] route', () => {
  beforeEach(() => {
    vi.resetModules();
    notFoundMock.mockClear();
  });

  it('renders invalid NPI params safely as an unknown profile surface', async () => {
    const { default: ProfilePage } = await import('../app/profile/[npi]/page');

    const node = await ProfilePage({
      params: Promise.resolve({ npi: 'not-an-npi' }),
    });
    const markup = renderToStaticMarkup(node);

    expect(notFoundMock).not.toHaveBeenCalled();
    expect(markup).toContain('Invalid NPI');
    expect(markup).toContain('not-an-npi');
    expect(countConfidenceBadges(markup, 'unknown')).toBe(5);
    expect(markup).not.toContain('[object Object]');
  });

  it('trims whitespace around a valid ten-digit NPI before lookup', async () => {
    const { default: ProfilePage } = await import('../app/profile/[npi]/page');

    // 1003000126 is a known demo NPI — padded here to exercise trim.
    const node = await ProfilePage({
      params: Promise.resolve({ npi: ' 1003000126 ' }),
    });
    const markup = renderToStaticMarkup(node);

    expect(notFoundMock).not.toHaveBeenCalled();
    expect(markup).toContain('1003000126');
    expect(markup).not.toContain(' 1003000126 ');
  });

  it('renders the known demo profile for NPI 1003000126', async () => {
    const { default: ProfilePage } = await import('../app/profile/[npi]/page');

    const node = await ProfilePage({
      params: Promise.resolve({ npi: '1003000126' }),
    });
    const markup = renderToStaticMarkup(node);

    // Identity markers come from DEMO_PROFILES[1003000126].
    expect(markup).toContain('Sarah Chen, MD');
    expect(markup).toContain('Internal Medicine');
    expect(markup).toContain('1003000126');

    // Known demo path does NOT use the unresolved subtitle.
    expect(markup).not.toContain('No enrichment data available');

    // Name is sourced from NPPES → verified badge.
    expect(countConfidenceBadges(markup, 'verified')).toBeGreaterThanOrEqual(1);
  });

  it('renders all-unknown fields and an unresolved banner for a valid-but-unknown NPI', async () => {
    const { default: ProfilePage } = await import('../app/profile/[npi]/page');

    // 9999999999 passes the /^\d{10}$/ regex but is not in DEMO_PROFILES.
    // This exercises ProfileView's I3 safety net at the route boundary.
    const node = await ProfilePage({
      params: Promise.resolve({ npi: '9999999999' }),
    });
    const markup = renderToStaticMarkup(node);

    expect(notFoundMock).not.toHaveBeenCalled();
    expect(markup).toContain('9999999999');
    expect(markup).toContain('No enrichment data available');

    // Every field collapses to unknown — no verified or inferred leakage.
    expect(countConfidenceBadges(markup, 'verified')).toBe(0);
    expect(countConfidenceBadges(markup, 'inferred')).toBe(0);
    expect(countConfidenceBadges(markup, 'unknown')).toBe(5);

    // Must NOT echo any demo provider's name.
    expect(markup).not.toContain('Sarah Chen');
    expect(markup).not.toContain('Marcus Williams');
    expect(markup).not.toContain('Priya Nair');
  });

  it('renders without crashing when demo data has a partial/empty specialty', async () => {
    // Inject a partial-data fixture via vi.doMock. vi.resetModules() in
    // beforeEach ensures this override applies only to this test's import.
    vi.doMock('@/lib/demo/demoProfiles', () => ({
      DEMO_PROFILES: {
        '1003000126': {
          npi: '1003000126',
          name: 'Sarah Chen, MD',
          specialty: '', // partial data — empty specialty
          readiness: 'READY' as const,
          readinessScore: 87,
          verifiedItems: [],
          missingItems: [],
          gatedItems: [],
          blockers: [],
          estimatedStart: '7-14 days',
          sources: {
            nppes: { status: 'checked', npiVerified: true },
            oigLeie: { status: 'checked', exclusionClear: true },
            pecos: { status: 'previewOnly', enrolled: true },
            nursys: { status: 'access-required' },
            fsmb: { status: 'access-required' },
          },
        },
      },
      DEMO_FALLBACK: null,
      getDemoProfile: () => null,
    }));

    const { default: ProfilePage } = await import('../app/profile/[npi]/page');

    // Must not throw — ProfileView's formatFieldValue collapses empty
    // strings to the Unknown sentinel rather than crashing.
    const node = await ProfilePage({
      params: Promise.resolve({ npi: '1003000126' }),
    });
    const markup = renderToStaticMarkup(node);

    // Name still renders (non-partial field).
    expect(markup).toContain('Sarah Chen, MD');
    // Empty specialty collapses to Unknown via stringifyValue's whitespace
    // trim branch. The field row still exists with its unknown-empty display.
    expect(markup).toContain('Unknown');
    // Every row still carries a badge (I2 invariant at the route boundary).
    const totalBadges =
      countConfidenceBadges(markup, 'verified') +
      countConfidenceBadges(markup, 'inferred') +
      countConfidenceBadges(markup, 'unknown');
    expect(totalBadges).toBe(5);
  });
});
