/**
 * sanitizeSelfAttested — whitelist-sanitizes the untrusted self-attested
 * profile payload before it is stored in the PersonProfile.selfAttested JSON
 * column. Pure function (no DB), so it runs without a database.
 *
 * Guards: unknown keys dropped, strings trimmed + length-capped, years bounded,
 * array rows without their required field removed, empty sections omitted.
 */

import { sanitizeSelfAttested } from '../src/services/intake/intakeService';

describe('sanitizeSelfAttested', () => {
  it('keeps only known, non-empty fields and trims strings', () => {
    const out = sanitizeSelfAttested({
      contact: { practiceEmail: '  dr@example.com  ', practicePhone: '', hacker: 'x' },
      medicalSchool: { institutionName: 'State U', degree: 'MD', graduationYear: '2010' },
      subspecialty: 'Cardiology',
      careerGoals: '  Lead a rural clinic  ',
      researchSummary: '',
      unknownTopLevel: 'nope',
    });

    expect(out).toEqual({
      contact: { practiceEmail: 'dr@example.com' },
      medicalSchool: { institutionName: 'State U', degree: 'MD', graduationYear: 2010 },
      subspecialty: 'Cardiology',
      careerGoals: 'Lead a rural clinic',
    });
    expect('unknownTopLevel' in out).toBe(false);
    expect('researchSummary' in out).toBe(false);
    expect((out.contact as Record<string, unknown>).hacker).toBeUndefined();
  });

  it('drops work-history/affiliation rows missing their required field and caps rows', () => {
    const out = sanitizeSelfAttested({
      workHistory: [
        { employer: 'Cedar Health', role: 'PA-C', startYear: 2018, endYear: 2022 },
        { role: 'no employer' },
        { employer: '   ' },
      ],
      affiliations: [
        { organization: 'County Hospital', role: 'Attending' },
        { role: 'no org' },
      ],
    });

    expect(out.workHistory).toEqual([
      { employer: 'Cedar Health', role: 'PA-C', startYear: 2018, endYear: 2022 },
    ]);
    expect(out.affiliations).toEqual([{ organization: 'County Hospital', role: 'Attending' }]);
  });

  it('bounds out-of-range or non-numeric years', () => {
    const out = sanitizeSelfAttested({
      medicalSchool: { institutionName: 'X', graduationYear: 3005 },
      workHistory: [{ employer: 'Y', startYear: 'abc', endYear: 1850 }],
    });
    expect(out.medicalSchool).toEqual({ institutionName: 'X' });
    expect(out.workHistory).toEqual([{ employer: 'Y' }]);
  });

  it('returns an empty object for junk input', () => {
    expect(sanitizeSelfAttested(null)).toEqual({});
    expect(sanitizeSelfAttested('string')).toEqual({});
    expect(sanitizeSelfAttested(42)).toEqual({});
    expect(sanitizeSelfAttested({})).toEqual({});
  });
});
