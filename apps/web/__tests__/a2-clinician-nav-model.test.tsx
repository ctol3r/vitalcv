/**
 * a2-clinician-nav-model.test.tsx — A2 (one clinician nav model).
 *
 * The audit (docs/audits/2026-08-08-signed-in-product-audit-action-plan.md,
 * product decision 2) fixes the clinician IA: primary navigation is Home,
 * Profile, Roles, Updates — Wallet, Readiness, Recognition, sharing, MATCHA,
 * and the Workbench are contextual destinations, never simultaneous global
 * peers. Before A2 the desktop nav raced eight items plus a global Share CTA,
 * the mobile nav disagreed with it, and a five-step ProductLoopRail repeated
 * a third navigation family on three surfaces.
 *
 * Three properties, guarded independently:
 *   1. Both navs render exactly the four primary destinations — no global
 *      Share CTA, no resurrected top-level peers.
 *   2. Every demoted destination stays reachable from at least one clinician
 *      surface (the "route resolves ≠ reachable" lesson: demotion must never
 *      become stranding). This is a source-level sweep so it survives surface
 *      rebuilds — if A3 rewrites the home, the links must move, not vanish.
 *   3. The loop rail stays deleted, and the shell keeps its skip link.
 */
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ClinicianMobileProvider } from '../components/mobile/ClinicianMobileProvider';
import { HolderDesktopNav } from '../components/holder/HolderDesktopNav';
import { MobileBottomNav } from '../components/clinician/MobileBottomNav';
import type { ClinicianMobileData } from '../lib/mobile/clinician-state';

vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation');
  return {
    ...actual,
    redirect: vi.fn(),
    usePathname: () => '/holder/home',
    useSearchParams: () => new URLSearchParams(),
  };
});

vi.mock('@clerk/nextjs', () => ({
  UserButton: () => null,
}));

const PRIMARY = ['Home', 'Profile', 'Roles', 'Updates'] as const;

function buildData(): ClinicianMobileData {
  return {
    signedIn: true,
    workspace: null,
    trustState: null,
    applications: [],
    opportunities: [],
    missingForHigherMatches: [],
    refreshedAt: '2026-08-08T00:00:00.000Z',
    profileCompleteness: null,
    trustHistory: [],
    notifications: [],
    blockers: [],
    activeApplications: [],
    availableOpportunities: [],
    recommendedAction: null,
  };
}

function renderWithProvider(node: React.ReactElement): string {
  return renderToStaticMarkup(
    <ClinicianMobileProvider initialData={buildData()}>{node}</ClinicianMobileProvider>,
  );
}

function hrefsIn(markup: string): string[] {
  return [...markup.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
}

describe('one clinician nav model: exactly four primary destinations', () => {
  it('desktop nav renders Home, Profile, Roles, Updates and nothing else', () => {
    const markup = renderWithProvider(<HolderDesktopNav showClerkAccount={false} />);
    for (const label of PRIMARY) expect(markup).toContain(`>${label}<`);

    // The wordmark plus exactly the four destinations — no Wallet, Readiness,
    // Recognition, Workbench, or Share racing them at top level.
    const hrefs = hrefsIn(markup);
    expect(new Set(hrefs)).toEqual(
      new Set(['/holder/home', '/clinician/profile', '/holder/opportunities', '/holder/applications']),
    );
    expect(markup).not.toContain('Share / prove');
  });

  it('mobile nav renders the same four destinations with compact labels', () => {
    const markup = renderWithProvider(<MobileBottomNav showClerkAccount={false} />);
    for (const label of PRIMARY) expect(markup).toContain(`>${label}<`);
    expect(new Set(hrefsIn(markup))).toEqual(
      new Set(['/holder/home', '/clinician/profile', '/holder/opportunities', '/holder/applications']),
    );
    // Five grid cells: four destinations + account. Full-cell touch targets in
    // a 4rem bar keep the ≥44px floor.
    expect(markup).toContain('grid-cols-5');
  });
});

const WEB_ROOT = resolve(__dirname, '..');

/** Surfaces where contextual links may satisfy reachability. Nav components excluded. */
const SURFACE_DIRS = [
  'app/holder',
  'app/clinician',
  'components/mobile',
  'components/holder',
  'components/recognition',
  'components/career-garden',
  'components/matcha',
  'lib/mobile',
];

const NAV_FILES = new Set([
  join(WEB_ROOT, 'components/holder/HolderDesktopNav.tsx'),
  join(WEB_ROOT, 'components/clinician/MobileBottomNav.tsx'),
]);

function sourceFilesUnder(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) out.push(...sourceFilesUnder(full));
    else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

describe('demoted destinations stay contextually reachable', () => {
  const surfaceSources = SURFACE_DIRS.flatMap((dir) => sourceFilesUnder(join(WEB_ROOT, dir)))
    .filter((file) => !NAV_FILES.has(file))
    .map((file) => readFileSync(file, 'utf-8'))
    .join('\n');

  // Route boundary: quote-agnostic, and for '/holder' (Wallet) an exact match
  // so every deeper /holder/* link does not satisfy it.
  const DEMOTED: Array<[string, RegExp]> = [
    ['/holder (Wallet)', /["'`]\/holder["'`]/],
    ['/holder/readiness', /["'`]\/holder\/readiness/],
    ['/holder/recognition', /["'`]\/holder\/recognition/],
    ['/holder/garden (Workbench)', /["'`]\/holder\/garden/],
    ['/holder/matcha', /["'`]\/holder\/matcha/],
  ];

  it.each(DEMOTED)('%s is linked from at least one clinician surface', (_label, pattern) => {
    expect(surfaceSources).toMatch(pattern);
  });
});

describe('the loop rail stays deleted and the shell stays skippable', () => {
  it('ProductLoopRail no longer exists and nothing imports it', () => {
    expect(existsSync(join(WEB_ROOT, 'components/holder/ProductLoopRail.tsx'))).toBe(false);
    const offenders = ['app', 'components', 'lib']
      .flatMap((dir) => sourceFilesUnder(join(WEB_ROOT, dir)))
      .filter((file) => readFileSync(file, 'utf-8').includes('ProductLoopRail'));
    expect(offenders, `ProductLoopRail referenced by:\n  ${offenders.join('\n  ')}`).toEqual([]);
  });

  it('the workspace frame carries a skip link to the content target', () => {
    const frame = readFileSync(
      join(WEB_ROOT, 'components/holder/HolderWorkspaceFrame.tsx'),
      'utf-8',
    );
    expect(frame).toContain('href="#holder-main"');
    expect(frame).toContain('id="holder-main"');
    expect(frame).toContain('Skip to content');
  });
});
