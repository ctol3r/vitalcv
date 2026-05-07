import { describe, expect, it } from 'vitest';
import {
  KNOWN_PRIMARY_SOURCES,
  resolveConfidenceTier,
} from '../lib/confidence/tier-resolver';

describe('resolveConfidenceTier', () => {
  it('returns the explicit tier when present, ignoring everything else', () => {
    expect(
      resolveConfidenceTier({
        tier: 'contradicted',
        source: 'NPPES',
        recall: 'primary',
        value: 'anything',
      }),
    ).toBe('contradicted');
  });

  it('returns contradicted when conflict flag is true', () => {
    expect(
      resolveConfidenceTier({
        conflict: true,
        source: 'NPPES',
        recall: 'primary',
        value: '1346053246',
      }),
    ).toBe('contradicted');
  });

  it('returns contradicted when recall is conflict', () => {
    expect(
      resolveConfidenceTier({
        recall: 'conflict',
        source: 'NPPES',
        value: '1346053246',
      }),
    ).toBe('contradicted');
  });

  describe('returns unknown when data is not on file', () => {
    it('value is null', () => {
      expect(resolveConfidenceTier({ value: null })).toBe('unknown');
    });
    it('value is undefined', () => {
      expect(resolveConfidenceTier({ value: undefined })).toBe('unknown');
    });
    it('value is empty string', () => {
      expect(resolveConfidenceTier({ value: '' })).toBe('unknown');
    });
    it('value is whitespace', () => {
      expect(resolveConfidenceTier({ value: '   ' })).toBe('unknown');
    });
    it('value is empty array', () => {
      expect(resolveConfidenceTier({ value: [] })).toBe('unknown');
    });
    it('onFile is false', () => {
      expect(
        resolveConfidenceTier({ onFile: false, value: '1346053246' }),
      ).toBe('unknown');
    });
    it('recall is none', () => {
      expect(
        resolveConfidenceTier({
          recall: 'none',
          value: '1346053246',
        }),
      ).toBe('unknown');
    });
  });

  describe('returns verified for primary-source recall', () => {
    it('explicit recall: primary', () => {
      expect(
        resolveConfidenceTier({
          recall: 'primary',
          value: '1346053246',
        }),
      ).toBe('verified');
    });

    it.each([...KNOWN_PRIMARY_SOURCES])(
      'known primary source %s',
      (source) => {
        expect(resolveConfidenceTier({ source, value: 'x' })).toBe('verified');
      },
    );

    it('matches primary source as substring (NPPES (CMS))', () => {
      expect(
        resolveConfidenceTier({
          source: 'NPPES (CMS)',
          value: '1346053246',
        }),
      ).toBe('verified');
    });

    it('matches primary source case-insensitively', () => {
      expect(
        resolveConfidenceTier({
          source: 'oig leie',
          value: 'no-match',
        }),
      ).toBe('verified');
    });
  });

  describe('returns inferred for AI-derived recall', () => {
    it('recall: inferred', () => {
      expect(
        resolveConfidenceTier({
          recall: 'inferred',
          value: 'UCSF, 2018',
        }),
      ).toBe('inferred');
    });

    it('recall: document', () => {
      expect(
        resolveConfidenceTier({
          recall: 'document',
          value: 'UCSF, 2018',
        }),
      ).toBe('inferred');
    });

    it('source: cv-upload', () => {
      expect(
        resolveConfidenceTier({
          source: 'cv-upload',
          value: 'UCSF, 2018',
        }),
      ).toBe('inferred');
    });

    it('unknown source defaults to inferred', () => {
      expect(
        resolveConfidenceTier({
          source: 'some-third-party-feed',
          value: 'UCSF, 2018',
        }),
      ).toBe('inferred');
    });

    it('no metadata at all defaults to inferred when value is present', () => {
      expect(resolveConfidenceTier({ value: 'something' })).toBe('inferred');
    });
  });

  describe('precedence', () => {
    it('contradicted wins over unknown', () => {
      expect(
        resolveConfidenceTier({
          conflict: true,
          value: null,
        }),
      ).toBe('contradicted');
    });

    it('explicit tier wins over conflict', () => {
      expect(
        resolveConfidenceTier({
          tier: 'unknown',
          conflict: true,
        }),
      ).toBe('unknown');
    });

    it('unknown wins over verified when value is empty', () => {
      expect(
        resolveConfidenceTier({
          source: 'NPPES',
          recall: 'primary',
          value: '',
        }),
      ).toBe('unknown');
    });
  });
});
