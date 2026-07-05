import { describe, expect, it } from 'vitest';
import {
  countSelfAttestedSections,
  hasSelfAttestedContent,
  parseSelfAttested,
  selfAttestedToExtended,
} from '@/lib/clinician-profile/selfAttested';

describe('parseSelfAttested', () => {
  it('keeps known non-empty fields, trims strings, bounds years, drops junk', () => {
    const sa = parseSelfAttested({
      contact: { practiceEmail: '  dr@x.org ', practicePhone: '', evil: 'x' },
      medicalSchool: { institutionName: 'State U', graduationYear: '2010', degree: 'MD' },
      subspecialty: 'Cards',
      workHistory: [
        { employer: 'Cedar', role: 'PA', startYear: 2018, endYear: 2022 },
        { role: 'no employer' },
      ],
      affiliations: [{ organization: 'County' }, { role: 'no org' }],
      careerGoals: '  Rural medicine  ',
      researchSummary: '',
      unknown: 'nope',
    });

    expect(sa).toEqual({
      contact: { practiceEmail: 'dr@x.org' },
      medicalSchool: { institutionName: 'State U', degree: 'MD', graduationYear: 2010 },
      subspecialty: 'Cards',
      workHistory: [{ employer: 'Cedar', role: 'PA', startYear: 2018, endYear: 2022 }],
      affiliations: [{ organization: 'County' }],
      careerGoals: 'Rural medicine',
    });
  });

  it('returns an empty object for null/garbage', () => {
    expect(parseSelfAttested(null)).toEqual({});
    expect(parseSelfAttested('nope')).toEqual({});
    expect(parseSelfAttested(undefined)).toEqual({});
  });
});

describe('selfAttestedToExtended', () => {
  it('projects saved values onto the sections ExtendedProfileData shape', () => {
    const ext = selfAttestedToExtended({
      contact: { practiceEmail: 'dr@x.org' },
      medicalSchool: { institutionName: 'State U', graduationYear: 2010 },
      workHistory: [{ employer: 'Cedar', role: 'PA' }],
      affiliations: [{ organization: 'County' }],
      careerGoals: 'Rural medicine',
    });

    expect(ext.contact?.practiceEmail).toBe('dr@x.org');
    expect(ext.contact?.practicePhone).toBeNull();
    expect(ext.medicalSchool?.institutionName).toBe('State U');
    expect(ext.medicalSchool?.degree).toBeNull();
    expect(ext.workHistory).toEqual([{ employer: 'Cedar', role: 'PA', startYear: null, endYear: null }]);
    expect(ext.affiliations).toEqual([{ organization: 'County', role: null }]);
    expect(ext.careerGoals).toBe('Rural medicine');
  });

  it('yields empty collections and nulls when nothing is saved', () => {
    const ext = selfAttestedToExtended({});
    expect(ext.workHistory).toEqual([]);
    expect(ext.affiliations).toEqual([]);
    expect(ext.careerGoals).toBeNull();
    expect(ext.researchSummary).toBeNull();
  });
});

describe('content helpers', () => {
  it('detects and counts filled sections', () => {
    expect(hasSelfAttestedContent({})).toBe(false);
    expect(countSelfAttestedSections({})).toBe(0);
    const sa = {
      contact: { practiceEmail: 'a@b.c' },
      subspecialty: 'Cards',
      workHistory: [{ employer: 'X' }],
      careerGoals: 'g',
    };
    expect(hasSelfAttestedContent(sa)).toBe(true);
    expect(countSelfAttestedSections(sa)).toBe(4);
  });
});
