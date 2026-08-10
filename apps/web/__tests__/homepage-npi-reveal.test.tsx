/**
 * NpiReveal gates (UX-05) — the recognition moment.
 *
 * The reveal is a STATEFUL surface (EC-26): it renders only what
 * `buildEvidenceCapsule` derived from real responses. These tests drive
 * REAL-SHAPED Bootstrap/TrustState payloads through the real transform and
 * assert the presentation obligations UX-05 exists for:
 *
 *  - equal typographic confidence: an unavailable lane renders in the same
 *    structure at full opacity — nothing kind-conditional dims it;
 *  - what returned is stated in the capsule's plain words, never a verdict;
 *  - provenance is progressive disclosure (closed by default), not a table;
 *  - the correction path is a first-class action;
 *  - an EXCLUDED response renders as attention wording, not a judgment;
 *  - the resolving narration is process-honest: no percentage, no "verified".
 */

import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { buildEvidenceCapsule, type Bootstrap } from '../components/home/evidence/evidenceCapsuleModel';
import type { TrustState } from '../components/readiness/sourceCheckNarration';
import { NpiReveal } from '../components/home/easy/NpiReveal';
import { buildCareerProfile } from '../lib/career-loop/profile';

const BOOT: Bootstrap = {
  firstName: 'Test',
  lastName: 'Clinician',
  specialty: 'Internal Medicine',
  state: 'CA',
  npiType: 'TYPE_1',
  identitySource: 'NPPES_API',
};

// A syntactically valid test NPI shape is deliberately NOT used — the reveal
// renders whatever NPI string the profile carries, so tests use an
// impossible-length marker that can never collide with a real identifier.
const TEST_NPI = 'test-npi';

function renderReveal(trust: TrustState | null): string {
  const profile = buildCareerProfile(TEST_NPI, BOOT, trust);
  if (!profile) throw new Error('profile should resolve for TYPE_1 + NPPES_API');
  const capsule = buildEvidenceCapsule(TEST_NPI, BOOT, trust);
  return renderToStaticMarkup(
    <NpiReveal
      profile={profile}
      capsule={capsule}
      isDemo={false}
      onKeep={() => {}}
      onReset={() => {}}
    />,
  );
}

const FULL_TRUST: TrustState = {
  identityVerified: true,
  exclusionStatus: 'CLEAR',
  pecosStatus: 'ENROLLED',
  licensureStatus: 'unknown',
  blockers: [],
  nextActions: ['Add your preferred locations'],
};

describe('NpiReveal — the evidence rows', () => {
  it('renders the returned rows with their sources, in capsule words', () => {
    const html = renderReveal(FULL_TRUST);
    expect(html).toContain('Returned by source');
    expect(html).toContain('Located in the NPPES registry');
    expect(html).toContain('No match in the current LEIE file');
    expect(html).toContain('An active enrollment was returned');
  });

  it('renders the unavailable lane at equal confidence — full structure, no dimming', () => {
    const html = renderReveal(FULL_TRUST);
    expect(html).toContain('Unavailable without additional access');
    expect(html).toContain('Not read — state-board access required');
    expect(html).toContain('Access required');
    // Structural equality: the unavailable row uses the SAME row classes as a
    // returned row, and no inline opacity exists anywhere in the reveal.
    expect(html).toMatch(/class="ezh-rv-row is-unavailable"/);
    expect(html).toMatch(/class="ezh-rv-row is-returned"/);
    expect(html).not.toMatch(/opacity:\s*0\.\d+/);
  });

  it('keeps provenance behind a closed disclosure, never a table', () => {
    const html = renderReveal(FULL_TRUST);
    expect(html).toContain('Source &amp; limits');
    // <details> without the `open` attribute — closed by default.
    expect(html).toMatch(/<details class="ezh-rv-more">/);
    expect(html).not.toMatch(/<details[^>]*\bopen\b/);
    // The monthly-file limitation is inside the disclosure, stated plainly.
    expect(html).toContain('A monthly file cannot show an exclusion published after it was compiled.');
    expect(html).not.toContain('<table');
  });

  it('renders an EXCLUDED response as attention wording, never a verdict', () => {
    const html = renderReveal({ ...FULL_TRUST, exclusionStatus: 'EXCLUDED' });
    expect(html).toContain('Needs your attention');
    expect(html).toContain('A match was returned in the current LEIE file');
    expect(html).toContain('Review required');
    for (const verdict of ['Excluded provider', 'Barred', 'Failed', 'Rejected']) {
      expect(html).not.toContain(verdict);
    }
  });

  it('offers the correction path as a first-class action', () => {
    const html = renderReveal(FULL_TRUST);
    expect(html).toContain('Not you? Check another NPI');
    expect(html).toContain('Keep this record');
  });

  it('surfaces the one next step when trust-state provides it', () => {
    const html = renderReveal(FULL_TRUST);
    expect(html).toContain('One next step');
    expect(html).toContain('Add your preferred locations');
  });

  it('degrades honestly when trust-state never answered', () => {
    // trust=null is the real non-fatal-failure path on / — identity resolves,
    // lanes are absent. The reveal must not invent rows.
    const html = renderReveal(null);
    expect(html).toContain('Test Clinician');
    expect(html).not.toContain('Returned by source');
    expect(html).not.toContain('No match');
  });

  it('makes no claim the truth contract bans', () => {
    for (const trust of [FULL_TRUST, { ...FULL_TRUST, exclusionStatus: 'EXCLUDED' }, null]) {
      const html = renderReveal(trust as TrustState | null);
      expect(html).not.toMatch(/\bverified\b/i);
      expect(html).not.toMatch(/\bcleared\b/i);
      expect(html).not.toMatch(/\d{1,3}%/);
    }
  });
});

describe('resolving narration — process honesty', () => {
  it('uses process labels with no percentage and no result claims', async () => {
    const { CHECK_SEQUENCE } = await import('../components/readiness/sourceCheckNarration');
    for (const label of CHECK_SEQUENCE) {
      expect(label).not.toMatch(/\bverified\b/i);
      expect(label).not.toMatch(/\d{1,3}%/);
      expect(label).not.toMatch(/\bclear\b/i);
    }
  });
});
