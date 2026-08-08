/**
 * a0-truth-containment.test.tsx — A0 (production-truth containment).
 *
 * The /holder/readiness surface once shipped a hardcoded buildDemoSnapshot()
 * that rendered a fabricated clinician identity — a real person's name and
 * NPI — with a fabricated verified lane, on a production route, whenever no
 * API was wired. The live surface was replaced with passport-backed readiness
 * (8f68ef004), but nothing guarded the door: any future "temporary" fixture
 * on a clinician product route would ship silently.
 *
 * These tests are that guard. Two properties, asserted independently:
 *
 * 1. The unlinked clinician sees an honest empty state — a CTA to connect
 *    an NPI — never a fabricated snapshot, score, or identity.
 * 2. No clinician product source file contains the historical demo identity,
 *    and no buildDemoSnapshot-style fixture is defined anywhere in the web
 *    app's production source.
 *
 * The demo identity appears here only as split-join constants (repo
 * convention for banned strings) so this file never trips its own sweep.
 * Scope note: /p/[slug] (pilot evidence, labeled and limitation-boxed) and
 * /trust/doctrine (a worked example) legitimately name the pilot subject as
 * CONTENT. The containment boundary is clinician product surfaces rendering
 * an identity as the signed-in user's own state — the directories below.
 */
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ClinicianMobileProvider } from '../components/mobile/ClinicianMobileProvider';
import ReadinessSurface from '../app/holder/readiness/ReadinessSurface';
import type { ClinicianMobileData } from '../lib/mobile/clinician-state';

vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation');
  return {
    ...actual,
    redirect: vi.fn(),
    usePathname: () => '/holder/readiness',
    useSearchParams: () => new URLSearchParams(),
  };
});

/** The identity buildDemoSnapshot() fabricated, split so this file passes its own sweep. */
const DEMO_NAME_UPPER = ['MACIE', 'MILLER'].join(' ');
const DEMO_NAME_TITLE = ['Macie', 'Miller'].join(' ');
const DEMO_NPI = ['1457', '128589'].join('');

function buildUnlinkedData(): ClinicianMobileData {
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

describe('unlinked clinician readiness renders honest empty state', () => {
  const markup = renderToStaticMarkup(
    <ClinicianMobileProvider initialData={buildUnlinkedData()}>
      <ReadinessSurface />
    </ClinicianMobileProvider>,
  );

  it('offers the NPI connection CTA instead of a snapshot', () => {
    expect(markup).toContain('Add your NPI');
    expect(markup).toContain('/onboarding');
  });

  it('serializes no fabricated identity, score, or lane result', () => {
    expect(markup).not.toContain(DEMO_NAME_UPPER);
    expect(markup).not.toContain(DEMO_NAME_TITLE);
    expect(markup).not.toContain(DEMO_NPI);
    // A readiness score may only exist downstream of a real passport fetch —
    // the unlinked initial render can never carry one.
    expect(markup).not.toMatch(/\d+% readiness/);
    expect(markup).not.toContain('receiptId');
  });
});

/**
 * Clinician product surfaces: every directory whose components can render as
 * the signed-in user's own state. /trust and /p are deliberately absent — see
 * the header note.
 */
const CLINICIAN_PRODUCT_DIRS = [
  'app/holder',
  'app/clinician',
  'app/onboarding',
  'components/mobile',
  'components/holder',
  'components/clinician',
  'components/proof',
  'components/recognition',
  'lib/mobile',
  'lib/readiness',
];

const WEB_ROOT = resolve(__dirname, '..');

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
    if (stats.isDirectory()) {
      out.push(...sourceFilesUnder(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('no clinician product source carries the demo identity', () => {
  it.each(CLINICIAN_PRODUCT_DIRS)('%s is free of the fabricated identity', (dir) => {
    const offenders = sourceFilesUnder(join(WEB_ROOT, dir)).filter((file) => {
      const source = readFileSync(file, 'utf-8');
      return (
        source.includes(DEMO_NAME_UPPER) ||
        source.includes(DEMO_NAME_TITLE) ||
        source.includes(DEMO_NPI)
      );
    });
    expect(
      offenders,
      `demo identity found in clinician product source:\n  ${offenders.join('\n  ')}`,
    ).toEqual([]);
  });
});

describe('no demo-snapshot fixture is defined in web app source', () => {
  it('defines no buildDemoSnapshot anywhere under app/, components/, lib/', () => {
    const DEFINITION = /(?:function|const|let|var)\s+buildDemoSnapshot/;
    const offenders = ['app', 'components', 'lib']
      .flatMap((dir) => sourceFilesUnder(join(WEB_ROOT, dir)))
      .filter((file) => DEFINITION.test(readFileSync(file, 'utf-8')));
    expect(
      offenders,
      `buildDemoSnapshot fixture defined in:\n  ${offenders.join('\n  ')}`,
    ).toEqual([]);
  });
});
