/**
 * Demo/launch fixtures must never reach real clinicians.
 *
 * The incident this pins: production served a public, unauthenticated posting
 * titled "Staff Internist - East Bay Access Clinics" under the organization
 * name "Kaiser Permanente NorCal" — a real health system's brand on a job that
 * did not exist. The read-time exclusion was already shipped and already
 * covered "the seeded Kaiser Permanente org" in its own doc comment, but the
 * seeded row carried slug `kaiser-permanente-norcal` while the exclusion list
 * carried `kaiser-permanente-northern-california`. `notIn` matched nothing, so
 * the guard passed while publishing the exact row it named.
 *
 * Two properties follow, and both are asserted here:
 *   1. a slug the fixture has ever emitted stays excluded forever, so renaming
 *      an entry cannot strand a row that already exists in a database;
 *   2. no fixture may carry a real organization's name.
 */

import {
  LEGACY_SEEDED_ORG_SLUGS,
  SEEDED_LAUNCH_OPPORTUNITIES,
  SEEDED_ORGANIZATIONS,
  SEEDED_ORG_SLUGS,
  retireSeededLaunchOpportunities,
  seededOrgExclusionFilter,
} from '../launchOpportunitySeed';

const ORIGINAL_FLAG = process.env.SEED_DEMO_OPPORTUNITIES;

afterEach(() => {
  if (ORIGINAL_FLAG === undefined) delete process.env.SEED_DEMO_OPPORTUNITIES;
  else process.env.SEED_DEMO_OPPORTUNITIES = ORIGINAL_FLAG;
});

describe('seeded demo employers — exclusion coverage', () => {
  it('excludes the slug the production row actually carried', () => {
    // The literal that was live on /api/opportunities. Asserting the string
    // rather than a derived value is the point: a rename that drops it from
    // the fixture must not drop it from the exclusion.
    expect(SEEDED_ORG_SLUGS).toContain('kaiser-permanente-norcal');
  });

  it('keeps every retired slug in the exclusion list', () => {
    for (const slug of LEGACY_SEEDED_ORG_SLUGS) {
      expect(SEEDED_ORG_SLUGS).toContain(slug);
    }
  });

  it('builds a notIn filter over those slugs when demo seeding is off', () => {
    delete process.env.SEED_DEMO_OPPORTUNITIES;
    const filter = seededOrgExclusionFilter();
    expect(filter.organization?.slug.notIn).toEqual(
      expect.arrayContaining(['kaiser-permanente-norcal']),
    );
  });

  it('lists no duplicate slugs', () => {
    expect(new Set(SEEDED_ORG_SLUGS).size).toBe(SEEDED_ORG_SLUGS.length);
  });
});

describe('seeded demo employers — the fixture refers only to itself', () => {
  /**
   * Renaming an organization entry strands every opportunity still pointing at
   * the old slug: the seeder resolves `organizationSlug` through a map built
   * from the organization fixture, and an unresolved slug is `continue`d past
   * with only a warn log. The posting then silently never exists.
   *
   * This is the same drift the exclusion list was hardened against, one level
   * in — and it is invisible to the exclusion tests, because a stranded slug is
   * by construction a LEGACY slug and so still passes `SEEDED_ORG_SLUGS`
   * membership. It has to be checked against the organization fixture itself.
   */
  it('resolves every seeded opportunity to an organization the fixture emits', () => {
    const emitted = new Set(SEEDED_ORGANIZATIONS.map((organization) => organization.slug));

    const stranded = SEEDED_LAUNCH_OPPORTUNITIES.filter(
      (opportunity) => !emitted.has(opportunity.organizationSlug),
    ).map(
      (opportunity) =>
        `"${opportunity.title}" points at "${opportunity.organizationSlug}", which no organization entry emits`,
    );

    expect(stranded).toEqual([]);
  });
});

describe('seeded demo employers — no borrowed identities', () => {
  /**
   * Real healthcare organizations whose names must not appear on a fixture.
   * A demo posting wearing one of these is impersonation, not test data.
   */
  const REAL_ORGANIZATIONS = [
    'Kaiser Permanente',
    'HCA Healthcare',
    'CommonSpirit',
    'Ascension',
    'Providence',
    'Sutter Health',
    'Cleveland Clinic',
    'Mayo Clinic',
    'Tenet Healthcare',
    'UnitedHealth',
    'Optum',
  ];

  it('names no real organization in the seed fixture', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'launchOpportunitySeed.ts'),
      'utf8',
    );

    // The legacy-slug list and this incident's comments necessarily mention the
    // name; only `name:` fields are impersonation.
    const fixtureNames = [...source.matchAll(/^\s*name: '([^']+)'/gm)].map((m) => m[1]);
    expect(fixtureNames.length).toBeGreaterThan(0);

    const borrowed = fixtureNames.flatMap((fixtureName) =>
      REAL_ORGANIZATIONS.filter((real) =>
        fixtureName.toLowerCase().includes(real.toLowerCase()),
      ).map((real) => `"${fixtureName}" borrows the real organization "${real}"`),
    );

    expect(borrowed).toEqual([]);
  });

  /**
   * A slug is identity too — it keys the organization row and is the handle
   * employer surfaces address an org by, so a real system's slug on a demo row
   * is the same impersonation the display name was fixed for.
   *
   * Scoped to the slugs the fixture EMITS. `LEGACY_SEEDED_ORG_SLUGS` must keep
   * naming the retired real-world slugs forever — that list is what stops a
   * rename from stranding a live row — so it is legitimately exempt.
   */
  it('emits no slug derived from a real organization', () => {
    const emitted = [
      ...SEEDED_ORGANIZATIONS.map((organization) => organization.slug),
      ...SEEDED_LAUNCH_OPPORTUNITIES.map((opportunity) => opportunity.organizationSlug),
    ];

    const borrowed = [...new Set(emitted)].flatMap((slug) =>
      REAL_ORGANIZATIONS.filter((real) =>
        slug.includes(real.toLowerCase().replace(/\s+/g, '-')),
      ).map((real) => `slug "${slug}" borrows the real organization "${real}"`),
    );

    expect(borrowed).toEqual([]);
  });
});

describe('retireSeededLaunchOpportunities', () => {
  function prismaDouble(count: number) {
    const updateMany = jest.fn().mockResolvedValue({ count });
    return { client: { opportunity: { updateMany } } as never, updateMany };
  }

  it('closes ACTIVE seeded postings when demo seeding is off', async () => {
    delete process.env.SEED_DEMO_OPPORTUNITIES;
    const { client, updateMany } = prismaDouble(1);

    const result = await retireSeededLaunchOpportunities({ prismaClient: client });

    expect(result).toEqual({ retiredOpportunityCount: 1, skipped: false });
    expect(updateMany).toHaveBeenCalledTimes(1);
    const arg = updateMany.mock.calls[0][0];
    expect(arg.data).toEqual({ status: 'CLOSED' });
    expect(arg.where.status).toBe('ACTIVE');
    expect(arg.where.organization.slug.in).toEqual(
      expect.arrayContaining(['kaiser-permanente-norcal']),
    );
  });

  it('writes nothing when demo seeding is explicitly enabled', async () => {
    process.env.SEED_DEMO_OPPORTUNITIES = '1';
    const { client, updateMany } = prismaDouble(0);

    const result = await retireSeededLaunchOpportunities({ prismaClient: client });

    expect(result).toEqual({ retiredOpportunityCount: 0, skipped: true });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('is idempotent — a second run finds nothing left to close', async () => {
    delete process.env.SEED_DEMO_OPPORTUNITIES;
    const { client, updateMany } = prismaDouble(0);

    const result = await retireSeededLaunchOpportunities({ prismaClient: client });

    expect(result.retiredOpportunityCount).toBe(0);
    expect(result.skipped).toBe(false);
    expect(updateMany).toHaveBeenCalledTimes(1);
  });
});
