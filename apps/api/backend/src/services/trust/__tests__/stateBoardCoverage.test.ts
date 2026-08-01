/**
 * The state-board lane may not report a check that never happened.
 *
 * What shipped: /verify rendered "State License · mbc.ca.gov · 2026-04-03 ·
 * 115d ago · **Stale**" for a real clinician. Stale says the board WAS
 * consulted and the answer aged. Nothing was ever consulted — STATE_BOARD is
 * `liveAvailable: false` behind STATE_BOARD_ENABLED (unset in production,
 * alongside FSMB_API_KEY), and FSMB DocInfo is a paid aggregator the cost
 * policy rules out.
 *
 * Two independent defences had both closed:
 *   1. `resolveSourceCoverageState` self-gates an inaccessible lane, but only
 *      `&& !checked` — and a gated fetch stores a PLACEHOLDER artifact
 *      (`sourceUrl: 'GATED_NURSYS_CONFIG_REQUIRED'`) that satisfies `checked`.
 *   2. STATE_BOARD's governance records `accessBoundary: 'public'`, which
 *      describes the portal a human may search by hand, not VitalCV's
 *      automated access.
 *
 * These assert the OUTCOME a reader sees — never-checked never reads as
 * checked-then-aged — rather than the mechanism that produces it, so a better
 * fix stays green and a regression cannot.
 */

import { artifactCoverage, isUnreachedState } from '../trustStateEngine';
import { getSource, isSourceFlagEnabled } from '../../identity/sourceCatalog';

/** The placeholder a gated fetch persists — the thing that looked like proof. */
const placeholderArtifact = {
  id: 'artifact-placeholder',
  verifiedAt: new Date('2026-04-03T09:35:11.800Z'),
  sourceUrl: 'GATED_NURSYS_CONFIG_REQUIRED',
  checksum: 'abc123',
  parserVersion: 'v1.0.0',
} as never;

describe('state board reachability', () => {
  it('is unreachable in this configuration — the premise of the fix', () => {
    const source = getSource('STATE_BOARD');
    expect(source).not.toBeNull();
    expect(source!.liveAvailable).toBe(false);
    expect(isSourceFlagEnabled(source!)).toBe(false);
  });
});

describe('a gated lane carries no check time and no source link', () => {
  it('drops checkedAt and sourceUrl even when a placeholder artifact exists', () => {
    const coverage = artifactCoverage('STATE_BOARD', placeholderArtifact, {
      fresh: false,
      gated: true,
      reason: 'State board verification requires access VitalCV does not have yet.',
    });

    expect(coverage.state).toBe('gated');
    // The date is the whole reason the surface could imply a check happened.
    expect(coverage.checkedAt).toBeNull();
    // A gated placeholder is not a source citation.
    expect(coverage.sourceUrl).toBeNull();
    // ...but the artifact stays traceable for support.
    expect(coverage.artifactId).toBe('artifact-placeholder');
  });

  it('never resolves to stale, whatever the artifact timestamp says', () => {
    const coverage = artifactCoverage('STATE_BOARD', placeholderArtifact, {
      fresh: false,
      gated: true,
      reason: 'gated',
    });
    expect(coverage.state).not.toBe('stale');
    expect(coverage.state).not.toBe('checked');
  });
});

describe('the fix does not erase real checks or real staleness', () => {
  it('an ungated lane keeps its check time and source link', () => {
    const coverage = artifactCoverage('NPPES_API', placeholderArtifact, {
      fresh: true,
      reason: 'Identity checked',
    });
    expect(coverage.checkedAt).toBe('2026-04-03T09:35:11.800Z');
    expect(coverage.sourceUrl).toBe('GATED_NURSYS_CONFIG_REQUIRED');
    expect(isUnreachedState(coverage.state)).toBe(false);
  });

  it('a genuinely stale ungated lane still reports stale', () => {
    // The fix must remove only the FABRICATED staleness, not real staleness.
    const coverage = artifactCoverage('NPPES_API', placeholderArtifact, {
      fresh: false,
      reason: 'Identity evidence is stale',
    });
    expect(coverage.state).toBe('stale');
    expect(coverage.checkedAt).not.toBeNull();
  });
});
