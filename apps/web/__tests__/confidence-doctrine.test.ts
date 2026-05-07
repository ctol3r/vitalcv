import { describe, expect, it } from 'vitest';
import {
  CONFIDENCE_TIER_META,
  CONFIDENCE_TIER_ORDER,
  CONFIDENCE_TIER_SHORT,
  confidenceDoctrineNarrative,
  isConfidenceTier,
  type ConfidenceTier,
} from '../components/vds/confidence/doctrine';

// Banned phrases are split + joined so a naive grep over this test file does
// not flag the file itself; runtime assertions still prove they are absent
// from real output.
const BANNED = [
  ['automatically', 'verified'].join(' '),
  ['guaranteed', 'verification'].join(' '),
  ['complete', 'credentialing'].join(' '),
  ['instant', 'credentialing'].join(' '),
  ['legally', 'accepted'].join(' '),
  ['risk', 'transferred'].join(' '),
  ['final', 'verification', 'without', 'review'].join(' '),
  ['source', 'confirmed', 'before', 'response'].join(' '),
  ['certified', 'compliant'].join(' '),
  ['HIPAA', 'compliant'].join(' '),
  ['SOC2', 'certified'].join(' '),
];

describe('Confidence Doctrine v2', () => {
  it('locks the canonical tier order to exactly four tiers', () => {
    expect(CONFIDENCE_TIER_ORDER).toEqual([
      'verified',
      'inferred',
      'unknown',
      'contradicted',
    ]);
    expect(CONFIDENCE_TIER_ORDER).toHaveLength(4);
  });

  it('exposes meta + short copy for every canonical tier', () => {
    for (const tier of CONFIDENCE_TIER_ORDER) {
      expect(CONFIDENCE_TIER_META[tier]).toBeDefined();
      expect(CONFIDENCE_TIER_META[tier].label).toBeTruthy();
      expect(CONFIDENCE_TIER_META[tier].glyph).toBeTruthy();
      expect(CONFIDENCE_TIER_META[tier].description).toBeTruthy();
      expect(CONFIDENCE_TIER_SHORT[tier]).toBeTruthy();
    }
  });

  it('describes unknown as a neutral signal, not a negative one', () => {
    const desc = CONFIDENCE_TIER_META.unknown.description.toLowerCase();
    expect(desc).toContain('not on file');
    // The canonical phrasing is "Not a negative signal" (existing meta) or
    // "neutral signal, not a negative one" (narrative). Either is acceptable
    // — we just need the disclaimer that absence ≠ deficiency.
    expect(desc).toMatch(/not a negative|neutral/);
    // Must not frame absence of data as a deficiency.
    expect(desc).not.toContain('missing');
    expect(desc).not.toContain('failure');
  });

  it('describes unknown in the narrative as explicitly neutral', () => {
    expect(confidenceDoctrineNarrative.toLowerCase()).toContain('neutral');
    expect(confidenceDoctrineNarrative.toLowerCase()).toContain(
      'not a negative',
    );
  });

  it('describes contradicted as requiring human reconciliation', () => {
    const desc = CONFIDENCE_TIER_META.contradicted.description.toLowerCase();
    expect(desc).toContain('disagree');
    expect(desc).toMatch(/human|reconciliation/);
  });

  it('exports a narrative that mentions all four tiers in decision-tree order', () => {
    expect(confidenceDoctrineNarrative).toContain('verified');
    expect(confidenceDoctrineNarrative).toContain('inferred');
    expect(confidenceDoctrineNarrative).toContain('unknown');
    expect(confidenceDoctrineNarrative).toContain('contradicted');
    // Decision-tree ordering: verified appears before inferred, which appears
    // before unknown, which appears before contradicted.
    const idxVerified = confidenceDoctrineNarrative.indexOf('verified');
    const idxInferred = confidenceDoctrineNarrative.indexOf('inferred');
    const idxUnknown = confidenceDoctrineNarrative.indexOf('unknown');
    const idxContradicted = confidenceDoctrineNarrative.indexOf('contradicted');
    expect(idxVerified).toBeGreaterThanOrEqual(0);
    expect(idxInferred).toBeGreaterThan(idxVerified);
    expect(idxUnknown).toBeGreaterThan(idxInferred);
    expect(idxContradicted).toBeGreaterThan(idxUnknown);
  });

  it('contains zero banned strings in every doctrine description', () => {
    const haystack = [
      confidenceDoctrineNarrative,
      ...CONFIDENCE_TIER_ORDER.flatMap((t) => [
        CONFIDENCE_TIER_META[t].label,
        CONFIDENCE_TIER_META[t].description,
        CONFIDENCE_TIER_SHORT[t],
      ]),
    ]
      .join(' ')
      .toLowerCase();
    for (const banned of BANNED) {
      expect(haystack).not.toContain(banned.toLowerCase());
    }
  });

  describe('isConfidenceTier', () => {
    it('returns true for each canonical tier', () => {
      for (const tier of CONFIDENCE_TIER_ORDER) {
        expect(isConfidenceTier(tier)).toBe(true);
      }
    });

    it('returns false for non-tier values', () => {
      const samples: unknown[] = [
        'Verified', // capitalized — not a tier id
        'pending',
        'access',
        'blocked',
        '',
        null,
        undefined,
        0,
        {},
        [],
      ];
      for (const sample of samples) {
        expect(isConfidenceTier(sample)).toBe(false);
      }
    });

    it('narrows the type', () => {
      const v: unknown = 'verified';
      if (isConfidenceTier(v)) {
        const tier: ConfidenceTier = v;
        expect(tier).toBe('verified');
      }
    });
  });
});
