import { describe, expect, it } from 'vitest';

import {
  buildCoverLetterMessages,
  summarizeProfileForLetter,
} from '../lib/matcha/coverLetter';
import type { MatchaPreferences } from '../lib/matcha/preferences';

describe('cover letter — profile summary is grounded in stated preferences only', () => {
  it('includes only answered preference fields', () => {
    const prefs: MatchaPreferences = {
      currentSpecialties: ['Cardiology'],
      preferredStates: ['CA'],
      workLifeBalanceImportance: 'high',
      teachingInterest: 'passionate',
    };
    const summary = summarizeProfileForLetter(prefs, 'Alex');
    expect(summary).toContain('Name: Alex');
    expect(summary).toContain('Cardiology');
    expect(summary).toContain('CA');
    expect(summary).toContain('work–life balance');
    expect(summary).toContain('teaching');
    // nothing about credentials/licenses (not a preference field)
    expect(summary.toLowerCase()).not.toContain('license');
    expect(summary.toLowerCase()).not.toContain('board cert');
  });

  it('returns an empty string when nothing is answered', () => {
    expect(summarizeProfileForLetter({})).toBe('');
  });

  it('omits low-interest values', () => {
    const summary = summarizeProfileForLetter({ teachingInterest: 'none', researchInterest: 'curious' });
    expect(summary).not.toContain('teaching');
    expect(summary).not.toContain('research');
  });
});

describe('cover letter — prompt forbids fabrication', () => {
  it('system prompt bans inventing credentials and verification claims', () => {
    const { system } = buildCoverLetterMessages({ profileSummary: 'Practices: Cardiology', opportunity: {} });
    const lower = system.toLowerCase();
    expect(lower).toContain('do not invent');
    expect(lower).toContain('credential');
    expect(lower).toContain('license');
    expect(lower).toContain('verified');
  });

  it('user message carries the opportunity and the profile as the only facts', () => {
    const { user } = buildCoverLetterMessages({
      profileSummary: 'Practices: Cardiology\nPrefers to work in: CA',
      opportunity: { title: 'Cardiologist', organization: 'Bay Health', specialty: 'Cardiology', location: 'Oakland, CA' },
    });
    expect(user).toContain('Cardiologist');
    expect(user).toContain('Bay Health');
    expect(user).toContain('Oakland, CA');
    expect(user).toContain('the only facts you may use');
    expect(user).toContain('Practices: Cardiology');
  });

  it('handles an empty profile without breaking', () => {
    const { user } = buildCoverLetterMessages({ profileSummary: '', opportunity: { title: 'Nurse' } });
    expect(user).toContain('keep the letter general');
  });
});
