import { describe, expect, it } from 'vitest';
import {
  WORK_AUTH_OPTIONS,
  completenessStatement,
  describeProfileSaveError,
  displayName,
  extractPersonProfile,
  isWorkAuthStatus,
  resumeFileNameFromUrl,
  validateProfileUrl,
} from '@/lib/clinician-profile/liveProfile';

describe('extractPersonProfile', () => {
  it('extracts the PersonProfile fields the surface consumes', () => {
    const profile = extractPersonProfile({
      userId: 'u1',
      personProfile: {
        npi: '1234567890',
        firstName: 'Test',
        lastName: 'Clinician',
        specialty: 'Internal Medicine',
        stateOfPractice: 'CA',
        workAuthStatus: 'authorized',
        resumeUrl: 'https://example.com/cv.pdf',
        linkedinUrl: 'https://linkedin.com/in/test',
        portfolioUrl: null,
        completeness: 55,
        extraneous: 'ignored',
      },
    });
    expect(profile).not.toBeNull();
    expect(profile?.npi).toBe('1234567890');
    expect(profile?.completeness).toBe(55);
    expect(profile?.portfolioUrl).toBeNull();
    expect(displayName(profile!)).toBe('Test Clinician');
  });

  it('returns null for signed-out/malformed payloads and empty strings', () => {
    expect(extractPersonProfile(null)).toBeNull();
    expect(extractPersonProfile({})).toBeNull();
    expect(extractPersonProfile({ personProfile: null })).toBeNull();
    const empty = extractPersonProfile({ personProfile: { npi: '' } });
    expect(empty?.npi).toBeNull();
  });
});

describe('validateProfileUrl', () => {
  it('treats empty input as a valid clear', () => {
    expect(validateProfileUrl('')).toEqual({ ok: true, url: null, reason: null });
    expect(validateProfileUrl('   ')).toEqual({ ok: true, url: null, reason: null });
  });

  it('normalizes scheme-less links to https', () => {
    const v = validateProfileUrl('linkedin.com/in/you');
    expect(v.ok).toBe(true);
    expect(v.url).toBe('https://linkedin.com/in/you');
  });

  it('rejects non-http(s) schemes and domain-less input', () => {
    expect(validateProfileUrl('javascript:alert(1)').ok).toBe(false);
    expect(validateProfileUrl('ftp://example.com/cv').ok).toBe(false);
    expect(validateProfileUrl('localhost').ok).toBe(false);
  });
});

describe('resumeFileNameFromUrl', () => {
  it('uses the URL tail when present', () => {
    expect(resumeFileNameFromUrl('https://example.com/files/My%20CV.pdf')).toBe('My CV.pdf');
  });
  it('falls back to a generic name for bare domains', () => {
    expect(resumeFileNameFromUrl('https://example.com/')).toBe('resume-link');
  });
});

describe('work auth', () => {
  it('accepts only the backend-allowed statuses', () => {
    for (const option of WORK_AUTH_OPTIONS) {
      expect(isWorkAuthStatus(option.value)).toBe(true);
    }
    expect(isWorkAuthStatus('citizen')).toBe(false);
    expect(isWorkAuthStatus('')).toBe(false);
  });
});

describe('describeProfileSaveError', () => {
  it('maps auth expiry and validation failures distinctly', () => {
    expect(describeProfileSaveError(401, null)).toContain('Sign in again');
    expect(describeProfileSaveError(400, { error: 'fileName and fileUrl are required.' })).toContain('fileName');
  });
  it('frames system failures as system states', () => {
    expect(describeProfileSaveError(503, null)).toContain('system state');
  });
});

describe('completenessStatement', () => {
  it('is filled-ness only and never a verification claim', () => {
    const statement = completenessStatement(55);
    expect(statement).toContain('55%');
    expect(statement).toContain('not verification');
    expect(statement.toLowerCase()).not.toContain('verified');
  });
  it('bounds out-of-range scores', () => {
    expect(completenessStatement(140)).toContain('100%');
    expect(completenessStatement(-5)).toContain('0%');
  });
});
