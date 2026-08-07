import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  AI_DRAFT_LINE,
  DEMO_BRANCHES,
  DEMO_CV_ENTRIES,
  DEMO_OPPORTUNITIES,
  DEMO_PUB_CANDIDATES,
  DEMO_RESEARCH_ITEMS,
  DEMO_ROOTS,
  DEMO_SEASON_EVENTS,
  DEMO_SEEDS,
  DEMO_TODAY_TASKS,
  DRAFT_ONLY_LINE,
  GARDEN_PRIVACY_LINE,
  NOTE_PRIVACY_LINE,
  PROVENANCE_LABEL,
  findOpportunity,
  findSeed,
} from '@/lib/career-garden/demoData';

/**
 * The Career Garden fixture is a UI fixture and nothing more. These tests
 * pin the safety contract: nothing in it can name a real person, imitate a
 * real external identifier, assert a source-backed claim, or smuggle in a
 * packet-shaped record.
 */

const WEB_ROOT = join(__dirname, '..');
const RAW_FIXTURE_SOURCE = readFileSync(join(WEB_ROOT, 'lib/career-garden/demoData.ts'), 'utf8');
// The module documents these rules in its own comments, so scan code only —
// a naive scan would match the prose that states the rule.
const FIXTURE_SOURCE = RAW_FIXTURE_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function allFixtureStrings(): string[] {
  const out: string[] = [];
  const walk = (value: unknown): void => {
    if (typeof value === 'string') out.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk([
    DEMO_SEEDS,
    DEMO_ROOTS,
    DEMO_BRANCHES,
    DEMO_CV_ENTRIES,
    DEMO_PUB_CANDIDATES,
    DEMO_RESEARCH_ITEMS,
    DEMO_OPPORTUNITIES,
    DEMO_SEASON_EVENTS,
    DEMO_TODAY_TASKS,
    Object.values(PROVENANCE_LABEL),
    GARDEN_PRIVACY_LINE,
    NOTE_PRIVACY_LINE,
    AI_DRAFT_LINE,
    DRAFT_ONLY_LINE,
  ]);
  return out;
}

describe('career-garden fixture safety', () => {
  it('contains no 10+ digit runs anywhere in the module (nothing NPI-shaped)', () => {
    expect(FIXTURE_SOURCE).not.toMatch(/\d{10,}/);
  });

  it('contains no realistic external identifiers (ORCID- or DOI-shaped)', () => {
    expect(FIXTURE_SOURCE).not.toMatch(/\d{4}-\d{4}-\d{4}-\d{3}[\dX]/);
    expect(FIXTURE_SOURCE).not.toMatch(/\b10\.\d{4,}\//);
    for (const root of DEMO_ROOTS) {
      expect(root.externalRef).toMatch(/sample|no lookup/i);
    }
  });

  it('marks every fictional employer, venue, and posting as sample', () => {
    for (const opp of DEMO_OPPORTUNITIES) {
      expect(opp.org.toLowerCase()).toContain('sample');
      expect(opp.title.toLowerCase()).toContain('sample');
      expect(opp.compensation.toLowerCase()).toContain('sample');
    }
    for (const item of [...DEMO_RESEARCH_ITEMS, ...DEMO_PUB_CANDIDATES]) {
      expect(item.venue.toLowerCase()).toContain('sample');
    }
    const employerLine = DEMO_CV_ENTRIES.find((e) => e.id === 'cv-hospitalist-role');
    expect(employerLine?.headline.toLowerCase()).toContain('sample employer');
  });

  it('asserts no source-backed claim and no readiness score', () => {
    // The workspace provenance vocabulary carries no source-backed value.
    expect(Object.keys(PROVENANCE_LABEL)).toEqual(
      expect.arrayContaining(['self-attested', 'ai-assisted-draft']),
    );
    for (const key of Object.keys(PROVENANCE_LABEL)) {
      expect(key).not.toMatch(/source/);
    }
    for (const entry of DEMO_CV_ENTRIES) {
      expect(['self-attested', 'ai-assisted-draft']).toContain(entry.provenance);
    }
    // Opportunity evidence rows may only use the honest non-source states.
    const allowed = new Set(['self_attested', 'needs_review', 'unavailable', 'access_required']);
    for (const opp of DEMO_OPPORTUNITIES) {
      for (const row of [...opp.requiredEvidence, ...opp.optionalEvidence]) {
        expect(allowed.has(row.state)).toBe(true);
      }
    }
    expect(FIXTURE_SOURCE).not.toMatch(/readiness\s*score/i);
    expect(FIXTURE_SOURCE).not.toMatch(/\b\d{1,3}\s*%/);
  });

  it('has no packet-like persistence shape', () => {
    expect(FIXTURE_SOURCE).not.toMatch(/packetHash|consentReceipt|packetVersion|selectedSections/);
    expect(FIXTURE_SOURCE).not.toMatch(/interface\s+\w*Packet/);
  });

  it('never uses the state word Verified or banned truth-contract phrases', () => {
    const banned = [
      ['automatically', 'verified'].join(' '),
      ['guaranteed', 'verification'].join(' '),
      ['complete', 'credentialing'].join(' '),
      ['instant', 'credentialing'].join(' '),
      ['legally', 'accepted'].join(' '),
      ['risk', 'transferred'].join(' '),
      ['certified', 'compliant'].join(' '),
      ['HIPAA', 'compliant'].join(' '),
      ['SOC2', 'certified'].join(' '),
    ];
    const haystack = allFixtureStrings().join('\n').toLowerCase();
    for (const phrase of banned) {
      expect(haystack).not.toContain(phrase.toLowerCase());
    }
    expect(haystack).not.toMatch(/\bverified\b/);
  });

  it('keeps the pinned trust copy exact', () => {
    expect(GARDEN_PRIVACY_LINE).toBe(
      'Private workspace — only you can see notes until you choose to share.',
    );
    expect(NOTE_PRIVACY_LINE).toBe('Only you can see this.');
    expect(AI_DRAFT_LINE).toBe('AI-assisted draft — review before sharing.');
    expect(DRAFT_ONLY_LINE).toBe('Draft only — review before sharing.');
  });

  it('resolves lookups used by the flows', () => {
    expect(findSeed('seed-journal-club')?.growDraft.section).toBe('service');
    expect(findOpportunity('opp-cedar-grove')?.org).toContain('Cedar Grove');
    expect(findSeed('nope')).toBeUndefined();
    expect(findOpportunity(undefined)).toBeUndefined();
  });

  it('is imported only by career-garden surfaces and tests', () => {
    const offenders: string[] = [];
    const allowedPrefixes = [
      'apps/web/lib/career-garden/',
      'apps/web/components/career-garden/',
      'apps/web/app/holder/garden/',
      'apps/web/app/dev/career-garden/',
      'apps/web/__tests__/',
    ];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        if (['node_modules', '.next', '.turbo', 'dist', 'coverage', '_archive'].includes(name)) continue;
        const full = join(dir, name);
        const st = statSync(full);
        if (st.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(name)) {
          const text = readFileSync(full, 'utf8');
          if (text.includes('career-garden/demoData')) {
            const rel = full.slice(full.indexOf('apps/web/'));
            if (!allowedPrefixes.some((p) => rel.startsWith(p))) offenders.push(rel);
          }
        }
      }
    };
    walk(WEB_ROOT);
    expect(offenders).toEqual([]);
  });
});
