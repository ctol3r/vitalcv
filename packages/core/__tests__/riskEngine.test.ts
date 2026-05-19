import { describe, expect, it } from 'vitest';
import {
  SPECIALTY_RISK_PROFILES,
  evaluateMarketRisk,
  isKnownTaxonomyForRisk,
  isRuralZipHeuristic,
  listSupportedTaxonomiesForRisk,
} from '../src/services/riskEngine';

describe('specialty risk profiles', () => {
  it('covers at least seven specialties (incl. procedural + behavioral health)', () => {
    expect(listSupportedTaxonomiesForRisk().length).toBeGreaterThanOrEqual(7);
  });

  it('procedural specialties carry higher cost bands than non-procedural', () => {
    const surgery = SPECIALTY_RISK_PROFILES['208600000X'];
    const psych = SPECIALTY_RISK_PROFILES['2084P0800X'];
    expect(surgery.replacementCostUsd.high).toBeGreaterThan(
      psych.replacementCostUsd.high,
    );
    expect(surgery.procedural).toBe(true);
    expect(psych.procedural).toBe(false);
  });

  it('every profile has a non-zero risk multiplier and a cost band', () => {
    for (const code of listSupportedTaxonomiesForRisk()) {
      const p = SPECIALTY_RISK_PROFILES[code];
      expect(p.baseRiskMultiplier).toBeGreaterThan(1);
      expect(p.replacementCostUsd.low).toBeGreaterThan(0);
      expect(p.replacementCostUsd.high).toBeGreaterThan(
        p.replacementCostUsd.low,
      );
    }
  });
});

describe('isRuralZipHeuristic', () => {
  it('matches sparsely-populated state prefixes', () => {
    expect(isRuralZipHeuristic('57301')).toBe(true); // SD
    expect(isRuralZipHeuristic('82001')).toBe(true); // WY
    expect(isRuralZipHeuristic('99501')).toBe(true); // AK
  });

  it('rejects urban prefixes', () => {
    expect(isRuralZipHeuristic('10001')).toBe(false); // NY
    expect(isRuralZipHeuristic('94103')).toBe(false); // SF
    expect(isRuralZipHeuristic('60601')).toBe(false); // Chicago
  });

  it('handles nullish and short input safely', () => {
    expect(isRuralZipHeuristic(null)).toBe(false);
    expect(isRuralZipHeuristic('')).toBe(false);
    expect(isRuralZipHeuristic('1')).toBe(false);
  });
});

describe('evaluateMarketRisk', () => {
  it('returns null for unknown taxonomies (no fabricated fallback)', () => {
    expect(evaluateMarketRisk({ taxonomyCode: '999X99999X' })).toBeNull();
  });

  it('urban internal medicine sits in the low/moderate band', () => {
    const r = evaluateMarketRisk({
      taxonomyCode: '207R00000X',
      zipCode: '94103',
    });
    expect(r).not.toBeNull();
    expect(r?.geography).toBe('urban');
    expect(r?.attritionRiskMultiplier).toBeCloseTo(1.1, 2);
    expect(r?.riskBand).toBe('low');
  });

  it('rural orthopedic surgery escalates to severe', () => {
    const r = evaluateMarketRisk({
      taxonomyCode: '207X00000X',
      isRural: true,
    });
    expect(r?.geography).toBe('rural');
    // 1.5 * 1.6 = 2.4 → severe
    expect(r?.attritionRiskMultiplier).toBeCloseTo(2.4, 2);
    expect(r?.riskBand).toBe('severe');
  });

  it('rural surgery sits in the high band', () => {
    const r = evaluateMarketRisk({
      taxonomyCode: '208600000X',
      isRural: true,
    });
    // 1.4 * 1.6 = 2.24 → high (< 2.25 threshold for severe)
    expect(r?.attritionRiskMultiplier).toBeCloseTo(2.24, 2);
    expect(r?.riskBand).toBe('high');
  });

  it('explicit isRural overrides the ZIP heuristic', () => {
    const r = evaluateMarketRisk({
      taxonomyCode: '207R00000X',
      isRural: true,
      zipCode: '94103', // urban prefix
    });
    expect(r?.geography).toBe('rural');
    expect(r?.rationale).toContain('operator-flagged');
  });

  it('rural geography lifts the replacement-cost band', () => {
    const urban = evaluateMarketRisk({
      taxonomyCode: '208600000X',
      isRural: false,
    });
    const rural = evaluateMarketRisk({
      taxonomyCode: '208600000X',
      isRural: true,
    });
    expect(rural?.replacementCost.midpoint).toBeGreaterThan(
      urban?.replacementCost.midpoint ?? 0,
    );
  });

  it('midpoint is the average of low and high (within rounding)', () => {
    const r = evaluateMarketRisk({
      taxonomyCode: '207R00000X',
      isRural: false,
    });
    expect(r?.replacementCost.midpoint).toBe(
      Math.round(
        (r!.replacementCost.low + r!.replacementCost.high) / 2,
      ),
    );
  });

  it('source citation references OpenEvidence', () => {
    const r = evaluateMarketRisk({ taxonomyCode: '207R00000X' });
    expect(r?.source).toMatch(/OpenEvidence/);
  });

  it('rationale names procedural vs non-procedural', () => {
    const surgery = evaluateMarketRisk({ taxonomyCode: '208600000X' });
    const im = evaluateMarketRisk({ taxonomyCode: '207R00000X' });
    expect(surgery?.rationale).toContain('procedural');
    expect(im?.rationale).toContain('non-procedural');
  });

  it('isKnownTaxonomyForRisk gates lookup', () => {
    expect(isKnownTaxonomyForRisk('207R00000X')).toBe(true);
    expect(isKnownTaxonomyForRisk('not-real')).toBe(false);
  });
});

describe('truth-contract · risk-engine copy', () => {
  it('source citation includes "OpenEvidence" on every profile', () => {
    for (const code of listSupportedTaxonomiesForRisk()) {
      // Per-profile source citation flows through evaluateMarketRisk result.
      const r = evaluateMarketRisk({ taxonomyCode: code });
      expect(r?.source).toMatch(/OpenEvidence/);
    }
  });

  it('no marketing puffery in specialty labels', () => {
    const banned = ['seamless', 'magical', 'guaranteed', 'effortless'];
    for (const code of listSupportedTaxonomiesForRisk()) {
      const label = SPECIALTY_RISK_PROFILES[code].specialty.toLowerCase();
      for (const b of banned) {
        expect(label.includes(b)).toBe(false);
      }
    }
  });
});
