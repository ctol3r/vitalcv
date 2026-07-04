import { describe, expect, it } from 'vitest';

import {
  ALL_PREFERENCE_FIELDS,
  ENGINE_BACKED_FIELDS,
  completenessPercent,
  countAnsweredFields,
  emptyPreferences,
  isFieldAnswered,
  toCandidateIntent,
  type MatchaPreferences,
} from '../lib/matcha/preferences';
import { deriveMatchaProfile } from '../lib/matcha/profile';
import {
  ANSWERABLE_STEP_COUNT,
  ONBOARDING_STEPS,
  coerceAnswer,
} from '../lib/matcha/onboarding';
import { diffPreferences } from '../lib/matcha/storage';

describe('matcha preferences — completeness', () => {
  it('empty preferences are 0% complete', () => {
    expect(completenessPercent(emptyPreferences())).toBe(0);
    expect(countAnsweredFields({})).toBe(0);
  });

  it('treats empty arrays and blank strings as unanswered', () => {
    expect(isFieldAnswered([])).toBe(false);
    expect(isFieldAnswered('')).toBe(false);
    expect(isFieldAnswered('  ')).toBe(false);
    expect(isFieldAnswered(['CA'])).toBe(true);
    expect(isFieldAnswered(0)).toBe(true);
    expect(isFieldAnswered(false)).toBe(true);
  });

  it('scales linearly with answered fields', () => {
    const prefs: MatchaPreferences = { preferredStates: ['CA'], currentSpecialties: ['Cardiology'] };
    expect(countAnsweredFields(prefs)).toBe(2);
    expect(completenessPercent(prefs)).toBe(
      Math.round((2 / ALL_PREFERENCE_FIELDS.length) * 100),
    );
  });
});

describe('matcha preferences — engine mapping (honesty boundary)', () => {
  it('maps only the engine-backed subset into CandidateIntent', () => {
    const prefs: MatchaPreferences = {
      preferredStates: ['CA', 'WA'],
      currentSpecialties: ['Cardiology'],
      desiredSpecialties: ['Interventional Cardiology'],
      employmentTypes: ['full_time', 'locums', 'telehealth'],
      minimumSalary: 275000,
      remoteInterest: 'passionate',
      startUrgency: 'within_month',
      // a non-engine field should NOT leak into the intent payload
      ptoImportance: 'high',
    };
    const intent = toCandidateIntent('1003000126', prefs, '2026-07-03T00:00:00.000Z');

    expect(intent.npi).toBe('1003000126');
    expect(intent.preferredStates).toEqual(['CA', 'WA']);
    expect(intent.preferredSpecialties).toEqual(['Interventional Cardiology', 'Cardiology']);
    expect(intent.preferredHiringTypes).toEqual(['perm', 'locums', 'telehealth']);
    expect(intent.payMin).toBe(275000);
    expect(intent.remoteOnly).toBe(true);
    expect(intent.openToLocums).toBe(true);
    expect(intent.openToTelehealth).toBe(true);
    expect(intent.startUrgency).toBe('within_month');
    expect(intent.capturedAt).toBe('2026-07-03T00:00:00.000Z');
    // no field on CandidateIntent corresponds to PTO — confirm it was dropped
    expect(JSON.stringify(intent)).not.toContain('pto');
  });

  it('omits engine fields that are unanswered rather than sending empties', () => {
    const intent = toCandidateIntent('123', {});
    expect(intent).toEqual({ npi: '123' });
  });

  it('only lists real preference fields as engine-backed', () => {
    for (const field of ENGINE_BACKED_FIELDS) {
      expect(ALL_PREFERENCE_FIELDS).toContain(field);
    }
  });
});

describe('matcha profile — derivation carries provenance', () => {
  it('produces no insights and 0 confidence for empty input', () => {
    const p = deriveMatchaProfile({});
    expect(p.insights).toHaveLength(0);
    expect(p.confidenceScore).toBe(0);
    expect(p.dreamRole).toBeNull();
    expect(p.dreamEmployer).toBeNull();
  });

  it('every insight cites at least one answered source field', () => {
    const prefs: MatchaPreferences = {
      currentSpecialties: ['Cardiology'],
      preferredStates: ['CA'],
      teachingInterest: 'passionate',
      academicHospitalInterest: 'interested',
      leadershipAspiration: 'passionate',
      desiredSalary: 320000,
      shiftPreference: 'days',
    };
    const { insights } = deriveMatchaProfile(prefs);
    expect(insights.length).toBeGreaterThan(0);
    for (const insight of insights) {
      expect(insight.provenance.length).toBeGreaterThan(0);
      for (const field of insight.provenance) {
        expect(isFieldAnswered(prefs[field])).toBe(true);
      }
    }
  });

  it('never invents an insight whose source is absent', () => {
    // Only a preferred state is set — there must be no compensation/schedule insights.
    const { insights } = deriveMatchaProfile({ preferredStates: ['TX'] });
    const categories = insights.map((i) => i.category);
    expect(categories).not.toContain('ideal_compensation');
    expect(categories).not.toContain('ideal_schedule');
    expect(categories).toContain('ideal_location');
  });

  it('confidence equals preference completeness', () => {
    const prefs: MatchaPreferences = { preferredStates: ['CA'], desiredSalary: 300000 };
    expect(deriveMatchaProfile(prefs).confidenceScore).toBe(completenessPercent(prefs));
  });

  it('derives a dream role only when a specialty is known', () => {
    expect(deriveMatchaProfile({ leadershipAspiration: 'passionate' }).dreamRole).toBeNull();
    const withSpecialty = deriveMatchaProfile({
      desiredSpecialties: ['Cardiology'],
      leadershipAspiration: 'passionate',
    });
    expect(withSpecialty.dreamRole).toContain('Cardiology');
    expect(withSpecialty.dreamRole).toContain('Lead');
  });
});

describe('matcha onboarding — script integrity', () => {
  it('answerable step count excludes intro steps and matches non-intro steps', () => {
    const nonIntro = ONBOARDING_STEPS.filter((s) => s.kind !== 'intro');
    expect(ANSWERABLE_STEP_COUNT).toBe(nonIntro.length);
  });

  it('every answerable step maps to a real preference field', () => {
    for (const step of ONBOARDING_STEPS) {
      if (step.kind === 'intro') continue;
      expect(step.field).toBeDefined();
      expect(ALL_PREFERENCE_FIELDS).toContain(step.field!);
    }
  });

  it('coerces number and boolean answers to the right types', () => {
    const numberStep = ONBOARDING_STEPS.find((s) => s.kind === 'number')!;
    expect(coerceAnswer(numberStep, '$300,000')).toBe(300000);
    const boolStep = ONBOARDING_STEPS.find((s) => s.kind === 'boolean')!;
    expect(coerceAnswer(boolStep, true)).toBe(true);
  });

  it('flags every engineBacked step field as engine-backed', () => {
    for (const step of ONBOARDING_STEPS) {
      if (step.engineBacked && step.field) {
        expect(ENGINE_BACKED_FIELDS).toContain(step.field);
      }
    }
  });
});

describe('matcha memory — grounded diffing', () => {
  it('reports added, updated, and removed fields with grounded messages', () => {
    const before: MatchaPreferences = { preferredStates: ['CA'], minimumSalary: 250000 };
    const after: MatchaPreferences = { preferredStates: ['CA', 'WA'], desiredSalary: 320000 };
    const notes = diffPreferences(before, after, [
      'preferredStates',
      'minimumSalary',
      'desiredSalary',
    ]);
    const byField = Object.fromEntries(notes.map((n) => [n.field, n]));
    expect(byField.preferredStates.kind).toBe('updated');
    expect(byField.preferredStates.message).toContain('WA');
    expect(byField.minimumSalary.kind).toBe('removed');
    expect(byField.desiredSalary.kind).toBe('added');
  });

  it('emits nothing when fields are unchanged', () => {
    const same: MatchaPreferences = { preferredStates: ['CA'] };
    expect(diffPreferences(same, { ...same }, ['preferredStates'])).toHaveLength(0);
  });
});
