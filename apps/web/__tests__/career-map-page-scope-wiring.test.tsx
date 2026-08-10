/**
 * /career-map page — proves the ownership check is actually WIRED.
 *
 * WHY THIS EXISTS SEPARATELY from the other two career-map suites.
 *
 * career-map-route-guard.test.ts proves the middleware turnstile works.
 * career-map-ownership-scope.test.ts proves `viewerOwnsNpi` computes the right
 * answer. Both stay green if someone deletes the `notFound()` call from
 * page.tsx — the guard would still exist and still be correct, and simply never
 * be consulted. That is the orphaned-guard shape: a working lock, not fitted to
 * the door.
 *
 * So this suite asserts the OUTCOME at the page boundary: for a caller who does
 * not own the NPI, rendering the page must raise Next's not-found signal and
 * must NOT render the client surface.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

const scope = vi.hoisted(() => ({ owns: true }));
const calls = vi.hoisted(() => ({ notFound: 0, askedAbout: [] as string[] }));

/**
 * Identity of the mocked client component. The page RETURNS an element rather
 * than rendering one, so the assertion is on what it returned — a render
 * counter would read 0 even on the success path, because React does not invoke
 * the component function until the tree is actually rendered.
 */
const CLIENT = vi.hoisted(() => ({ marker: Symbol('CareerMapClient') }));

vi.mock('next/navigation', () => ({
  notFound: () => {
    calls.notFound += 1;
    // Next signals not-found by throwing; mirror that so control flow matches.
    throw new Error('NEXT_NOT_FOUND');
  },
}));

vi.mock('@/lib/auth/npi-ownership-scope', () => ({
  viewerOwnsNpi: async (npi: string) => {
    calls.askedAbout.push(npi);
    return scope.owns;
  },
}));

const CareerMapClientStub = () => null;
CareerMapClientStub.marker = CLIENT.marker;

vi.mock('../app/career-map/[entityId]/CareerMapClient', () => ({
  default: CareerMapClientStub,
}));

const { default: CareerMapPage } = await import('../app/career-map/[entityId]/page');

beforeEach(() => {
  calls.notFound = 0;
  calls.askedAbout = [];
  scope.owns = true;
});

const NPI = '1003000126';

describe('a caller who does not own the NPI', () => {
  it('gets not-found, and the surface never renders', async () => {
    scope.owns = false;

    await expect(
      CareerMapPage({ params: Promise.resolve({ entityId: NPI }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(calls.notFound, 'the page must raise not-found').toBe(1);
    // The page threw, so nothing was returned to render at all.
  });

  /**
   * Not-found rather than a 403: distinguishing "not yours" from "does not
   * exist" would make this route an oracle for whether a given NPI is on
   * VitalCV, which is the enumeration surface the sibling relationships
   * endpoint's uniform 404 exists to prevent.
   */
  it('is refused identically for an NPI shape that could not exist', async () => {
    scope.owns = false;

    await expect(
      CareerMapPage({ params: Promise.resolve({ entityId: '0000000000' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(calls.notFound).toBe(1);
  });
});

describe('a caller who owns the NPI', () => {
  it('is served the surface', async () => {
    scope.owns = true;

    const element = await CareerMapPage({ params: Promise.resolve({ entityId: NPI }) });

    expect(calls.notFound, 'an owner must not be refused').toBe(0);
    expect(
      (element as { type?: { marker?: symbol } })?.type?.marker,
      'the owner must be served the career-map surface',
    ).toBe(CLIENT.marker);
    expect((element as { props?: { entityId?: string } })?.props?.entityId).toBe(NPI);
  });

  it('is checked against the NPI in the URL, not some other one', async () => {
    await CareerMapPage({ params: Promise.resolve({ entityId: NPI }) });

    expect(calls.askedAbout).toEqual([NPI]);
  });
});
