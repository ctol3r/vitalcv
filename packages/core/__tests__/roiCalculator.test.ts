import { describe, expect, it } from 'vitest';
import {
  CREDENTIALING_BY_PROXY_DAYS,
  DAYS_SAVED,
  TAXONOMY_DAILY_RATES,
  TRADITIONAL_CVO_DAYS,
  calculateOpportunityCost,
  isKnownTaxonomy,
  listSupportedTaxonomies,
} from '../src/services/roiCalculator';

describe('credentialing benchmark constants', () => {
  it('codifies the OpenEvidence baseline (103 days) and CBP target (36 days)', () => {
    expect(TRADITIONAL_CVO_DAYS).toBe(103);
    expect(CREDENTIALING_BY_PROXY_DAYS).toBe(36);
  });

  it('exposes the 67-day delta as a derived constant', () => {
    expect(DAYS_SAVED).toBe(TRADITIONAL_CVO_DAYS - CREDENTIALING_BY_PROXY_DAYS);
    expect(DAYS_SAVED).toBe(67);
  });
});

describe('taxonomy dictionary', () => {
  it('covers at least three distinct specialty cohorts', () => {
    const taxonomies = listSupportedTaxonomies();
    expect(taxonomies.length).toBeGreaterThanOrEqual(3);
  });

  it('covers primary care, surgery, and psychiatry (mission spec)', () => {
    // At least one Primary Care taxonomy (Internal Medicine / Family Medicine)
    expect(isKnownTaxonomy('207R00000X')).toBe(true);
    // At least one Surgery taxonomy
    expect(isKnownTaxonomy('208600000X')).toBe(true);
    // Psychiatry
    expect(isKnownTaxonomy('2084P0800X')).toBe(true);
  });

  it('every entry has a non-zero daily rate and a source citation', () => {
    for (const code of listSupportedTaxonomies()) {
      const rate = TAXONOMY_DAILY_RATES[code];
      expect(rate.specialty).toBeTruthy();
      expect(rate.dailyRevenueUsd).toBeGreaterThan(0);
      expect(rate.source).toBeTruthy();
    }
  });

  it('procedural specialties carry higher daily rates than behavioral health (sanity)', () => {
    expect(TAXONOMY_DAILY_RATES['208600000X'].dailyRevenueUsd).toBeGreaterThan(
      TAXONOMY_DAILY_RATES['2084P0800X'].dailyRevenueUsd,
    );
  });
});

describe('calculateOpportunityCost', () => {
  it('returns null for unknown taxonomies (no fabricated fallback)', () => {
    expect(calculateOpportunityCost('999X99999X')).toBeNull();
    expect(calculateOpportunityCost('')).toBeNull();
  });

  it('multiplies the 67-day delta by the taxonomy daily rate', () => {
    const result = calculateOpportunityCost('207R00000X');
    expect(result).not.toBeNull();
    expect(result?.daysSaved).toBe(67);
    expect(result?.dailyRevenueUsd).toBe(
      TAXONOMY_DAILY_RATES['207R00000X'].dailyRevenueUsd,
    );
    expect(result?.totalUsd).toBe(67 * 6500);
    expect(result?.totalUsd).toBe(435500);
  });

  it('returns the canonical specialty label + source citation', () => {
    const result = calculateOpportunityCost('208600000X');
    expect(result?.specialty).toBe('Surgery');
    expect(result?.source).toContain('OpenEvidence');
  });

  it('result for psychiatry is internally consistent', () => {
    const psych = calculateOpportunityCost('2084P0800X');
    expect(psych?.totalUsd).toBe(67 * 4400);
    expect(psych?.totalUsd).toBe(294800);
  });
});

describe('truth-contract · ROI copy', () => {
  it('source citations include "OpenEvidence" verbatim', () => {
    for (const code of listSupportedTaxonomies()) {
      expect(TAXONOMY_DAILY_RATES[code].source).toMatch(/OpenEvidence/);
    }
  });

  it('no marketing puffery in specialty labels', () => {
    const banned = [
      'seamless',
      'magical',
      'guaranteed',
      'instant',
      'automatically',
    ];
    for (const code of listSupportedTaxonomies()) {
      const label = TAXONOMY_DAILY_RATES[code].specialty.toLowerCase();
      for (const b of banned) {
        expect(label.includes(b), `${code} label contains "${b}"`).toBe(false);
      }
    }
  });
});
