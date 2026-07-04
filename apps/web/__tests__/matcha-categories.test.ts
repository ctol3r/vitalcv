import { describe, expect, it } from 'vitest';

import { ALL_PREFERENCE_FIELDS, type MatchaPreferences } from '../lib/matcha/preferences';
import {
  CATEGORY_ORDER,
  FIELD_CATEGORY,
  allCategoryProgress,
  categoryFields,
  categoryProgress,
  stepsForCategory,
} from '../lib/matcha/categories';

describe('matcha categories — every field is categorized exactly once', () => {
  it('maps every preference field to a category', () => {
    for (const field of ALL_PREFERENCE_FIELDS) {
      expect(FIELD_CATEGORY[field]).toBeDefined();
      expect(CATEGORY_ORDER).toContain(FIELD_CATEGORY[field]);
    }
  });

  it('has no category entries for non-existent fields', () => {
    for (const field of Object.keys(FIELD_CATEGORY)) {
      expect(ALL_PREFERENCE_FIELDS).toContain(field);
    }
  });

  it('partitions all fields across the three categories with no overlap', () => {
    const buckets = CATEGORY_ORDER.map((c) => categoryFields(c));
    const flat = buckets.flat();
    // no field appears in two categories
    expect(new Set(flat).size).toBe(flat.length);
    // every field is covered
    expect(flat.length).toBe(ALL_PREFERENCE_FIELDS.length);
  });
});

describe('matcha categories — progress', () => {
  it('reports 0 for empty preferences', () => {
    for (const p of allCategoryProgress({})) {
      expect(p.answered).toBe(0);
      expect(p.percent).toBe(0);
      expect(p.total).toBeGreaterThan(0);
    }
  });

  it('counts answered fields within the right category', () => {
    // preferredStates is a Place field; currentSpecialties is Professional.
    const prefs: MatchaPreferences = { preferredStates: ['CA'], currentSpecialties: ['Cardiology'] };
    const place = categoryProgress(prefs, 'place');
    const professional = categoryProgress(prefs, 'professional');
    const personal = categoryProgress(prefs, 'personal');
    expect(place.answered).toBe(1);
    expect(professional.answered).toBe(1);
    expect(personal.answered).toBe(0);
  });

  it('percent equals answered/total rounded', () => {
    const prefs: MatchaPreferences = { careerGoals: ['attending'] };
    const personal = categoryProgress(prefs, 'personal');
    expect(personal.percent).toBe(Math.round((personal.answered / personal.total) * 100));
  });
});

describe('matcha categories — steps', () => {
  it('returns only steps whose field belongs to the category', () => {
    for (const cat of CATEGORY_ORDER) {
      const steps = stepsForCategory(cat);
      expect(steps.length).toBeGreaterThan(0);
      for (const step of steps) {
        expect(step.field).toBeDefined();
        expect(FIELD_CATEGORY[step.field!]).toBe(cat);
        expect(step.kind).not.toBe('intro');
      }
    }
  });
});
