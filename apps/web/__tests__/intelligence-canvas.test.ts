import {
  buildCanvasOpenPanelParams,
  mergeCanvasOpenPanels,
  parseCanvasOpenPanels,
  parseCompareSelection,
  removeCanvasOpenPanel,
  serializeCompareSelection,
  toggleCompareSelection,
} from '@/lib/intelligence/canvas';

describe('intelligence canvas helpers', () => {
  it('normalizes open panel selections', () => {
    expect(parseCanvasOpenPanels(['provider', 'invalid', 'provider', 'storyline'])).toEqual([
      'provider',
      'storyline',
    ]);
  });

  it('preserves an explicit empty panel state with a sentinel', () => {
    expect(buildCanvasOpenPanelParams([])).toEqual(['none']);
    expect(buildCanvasOpenPanelParams(['provider', 'finding', 'provider'])).toEqual([
      'provider',
      'finding',
    ]);
  });

  it('adds and removes panels without duplicating them', () => {
    expect(mergeCanvasOpenPanels(['provider'], 'finding')).toEqual(['provider', 'finding']);
    expect(removeCanvasOpenPanel(['provider', 'finding'], 'provider')).toEqual(['finding']);
  });

  it('normalizes compare selections to valid NPIs', () => {
    expect(parseCompareSelection('1234567890, invalid, 1234567890, 0987654321, 1111111111, 2222222222')).toEqual([
      '1234567890',
      '0987654321',
      '1111111111',
    ]);
    expect(serializeCompareSelection(['1234567890', 'invalid', '1234567890', '0987654321'])).toBe(
      '1234567890,0987654321',
    );
  });

  it('toggles compare selections and respects the maximum size', () => {
    expect(toggleCompareSelection(['1234567890'], '0987654321')).toEqual([
      '1234567890',
      '0987654321',
    ]);
    expect(toggleCompareSelection(['1234567890', '0987654321'], '1234567890')).toEqual([
      '0987654321',
    ]);
    expect(toggleCompareSelection(['1111111111', '2222222222'], '3333333333', 2)).toEqual([
      '2222222222',
      '3333333333',
    ]);
  });
});
