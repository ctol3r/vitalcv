import { describe, expect, it } from 'vitest';

import { deriveNextActions, type NextActionInput } from '../lib/matcha/nextActions';

const CATS: NextActionInput['categories'] = [
  { category: 'personal', answered: 5, total: 17, percent: 29 },
  { category: 'professional', answered: 2, total: 19, percent: 11 },
  { category: 'place', answered: 10, total: 16, percent: 63 },
];

describe('deriveNextActions — grounded in real gaps', () => {
  it('leads with adding an NPI when missing', () => {
    const actions = deriveNextActions({ hasNpi: false, completeness: 40, categories: CATS, newMatches: 0, savedMatches: 0 });
    expect(actions[0].id).toBe('add-npi');
    expect(actions[0].primary).toBe(true);
    expect(actions[0].href).toBe('/holder');
  });

  it('surfaces new matches with a correct count and pluralization', () => {
    const one = deriveNextActions({ hasNpi: true, completeness: 40, categories: CATS, newMatches: 1, savedMatches: 0 });
    expect(one.find((a) => a.id === 'review-matches')?.label).toContain('1 new match');
    const many = deriveNextActions({ hasNpi: true, completeness: 40, categories: CATS, newMatches: 3, savedMatches: 0 });
    expect(many.find((a) => a.id === 'review-matches')?.label).toContain('3 new matches');
  });

  it('nudges the thinnest match-question category', () => {
    const actions = deriveNextActions({ hasNpi: true, completeness: 40, categories: CATS, newMatches: 0, savedMatches: 0 });
    // professional is thinnest (11%)
    expect(actions.some((a) => a.id === 'answer-professional')).toBe(true);
  });

  it('asks the clinician to start when nothing is answered', () => {
    const actions = deriveNextActions({ hasNpi: true, completeness: 0, categories: [], newMatches: 0, savedMatches: 0 });
    expect(actions.some((a) => a.id === 'meet-matcha')).toBe(true);
  });

  it('de-duplicates by href and caps at four', () => {
    const actions = deriveNextActions({ hasNpi: true, completeness: 30, categories: CATS, newMatches: 2, savedMatches: 4 });
    const hrefs = actions.map((a) => a.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(actions.length).toBeLessThanOrEqual(4);
  });

  it('falls back to a single neutral action when everything is in good shape', () => {
    const full: NextActionInput['categories'] = CATS.map((c) => ({ ...c, percent: 100 }));
    const actions = deriveNextActions({ hasNpi: true, completeness: 100, categories: full, newMatches: 0, savedMatches: 0 });
    expect(actions).toHaveLength(1);
    expect(actions[0].id).toBe('browse');
  });
});
