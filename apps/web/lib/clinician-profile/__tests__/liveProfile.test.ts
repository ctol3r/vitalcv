import { describe, expect, it } from 'vitest';
import {
  COMPLETENESS_DIMENSIONS,
  WORK_AUTH_OPTIONS,
  completenessStatement,
  computeProfileFormDiff,
  describeClearedFields,
  describeIdentityFields,
  describeProfileSaveError,
  displayName,
  extractCompletenessBreakdown,
  extractPersonProfile,
  isWorkAuthStatus,
  resumeFileNameFromUrl,
  validateProfileUrl,
  type ProfileFormValues,
  type WorkspacePersonProfile,
} from '@/lib/clinician-profile/liveProfile';

function baseProfile(overrides: Partial<WorkspacePersonProfile> = {}): WorkspacePersonProfile {
  return {
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
    selfAttested: {},
    ...overrides,
  };
}

function formFromProfile(profile: WorkspacePersonProfile): ProfileFormValues {
  return {
    linkedinUrl: profile.linkedinUrl ?? '',
    portfolioUrl: profile.portfolioUrl ?? '',
    resumeUrl: profile.resumeUrl ?? '',
    workAuthStatus: profile.workAuthStatus ?? '',
  };
}

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

describe('computeProfileFormDiff', () => {
  it('is clean when the form mirrors the saved profile', () => {
    const profile = baseProfile();
    const diff = computeProfileFormDiff(profile, formFromProfile(profile));
    expect(diff.dirty).toBe(false);
    expect(diff.clearedFields).toEqual([]);
  });

  it('is clean when a URL differs only by scheme normalization', () => {
    const profile = baseProfile();
    const diff = computeProfileFormDiff(profile, {
      ...formFromProfile(profile),
      linkedinUrl: 'linkedin.com/in/test',
    });
    expect(diff.dirty).toBe(false);
    expect(diff.linksChanged).toBe(false);
  });

  it('flags changed links, resume, and work auth independently', () => {
    const profile = baseProfile();
    const form = formFromProfile(profile);

    const links = computeProfileFormDiff(profile, { ...form, portfolioUrl: 'example.org' });
    expect(links).toMatchObject({ dirty: true, linksChanged: true, resumeChanged: false });

    const resume = computeProfileFormDiff(profile, { ...form, resumeUrl: 'example.com/new-cv.pdf' });
    expect(resume).toMatchObject({ dirty: true, resumeChanged: true, linksChanged: false });

    const workAuth = computeProfileFormDiff(profile, { ...form, workAuthStatus: 'visa_required' });
    expect(workAuth).toMatchObject({ dirty: true, workAuthChanged: true });
  });

  it('reports cleared saved fields as per-field clears, not as set-changes to send', () => {
    const profile = baseProfile();
    const diff = computeProfileFormDiff(profile, {
      ...formFromProfile(profile),
      linkedinUrl: '',
      workAuthStatus: '',
    });
    expect(diff.dirty).toBe(true);
    expect(diff.clearedFields).toEqual(['LinkedIn', 'Work authorization']);
    // Clears are distinct from set-writes: nothing is "changed", it is removed.
    expect(diff.linksChanged).toBe(false);
    expect(diff.workAuthChanged).toBe(false);
    expect(diff.clearLinkedin).toBe(true);
    expect(diff.clearWorkAuth).toBe(true);
    expect(diff.clearPortfolio).toBe(false);
    expect(diff.clearResume).toBe(false);
  });

  it('never reports a never-saved empty field as cleared', () => {
    const profile = baseProfile({ portfolioUrl: null });
    const diff = computeProfileFormDiff(profile, formFromProfile(profile));
    expect(diff.clearedFields).toEqual([]);
    expect(diff.clearPortfolio).toBe(false);
  });

  it('cleared-fields copy names the fields and frames clearing honestly', () => {
    const copy = describeClearedFields(['LinkedIn', 'Resume link']);
    expect(copy).toContain('LinkedIn');
    expect(copy).toContain('Resume link');
    expect(copy).toContain('remove');
    expect(copy).toContain('self-attested');
  });
});

describe('extractCompletenessBreakdown', () => {
  const validDimensions = {
    npiVerified: true,
    resumeUploaded: false,
    linksAdded: true,
    workAuthProvided: false,
    credentialsImported: false,
  };

  it('parses the backend completeness payload', () => {
    const parsed = extractCompletenessBreakdown({
      userId: 'u1',
      score: 55,
      dimensions: validDimensions,
    });
    expect(parsed).not.toBeNull();
    expect(parsed?.score).toBe(55);
    expect(parsed?.dimensions.npiVerified).toBe(true);
    expect(parsed?.dimensions.resumeUploaded).toBe(false);
  });

  it('rejects malformed payloads rather than guessing', () => {
    expect(extractCompletenessBreakdown(null)).toBeNull();
    expect(extractCompletenessBreakdown({})).toBeNull();
    expect(extractCompletenessBreakdown({ score: '55', dimensions: validDimensions })).toBeNull();
    expect(
      extractCompletenessBreakdown({
        score: 55,
        dimensions: { ...validDimensions, credentialsImported: 'yes' },
      }),
    ).toBeNull();
    const { credentialsImported: _dropped, ...missingKey } = validDimensions;
    expect(extractCompletenessBreakdown({ score: 55, dimensions: missingKey })).toBeNull();
  });

  it('bounds out-of-range scores', () => {
    expect(extractCompletenessBreakdown({ score: 140, dimensions: validDimensions })?.score).toBe(100);
    expect(extractCompletenessBreakdown({ score: -3, dimensions: validDimensions })?.score).toBe(0);
  });
});

describe('COMPLETENESS_DIMENSIONS', () => {
  it('mirrors the backend weights and sums to 100', () => {
    const total = COMPLETENESS_DIMENSIONS.reduce((sum, d) => sum + d.weight, 0);
    expect(total).toBe(100);
    expect(COMPLETENESS_DIMENSIONS.map((d) => d.key).sort()).toEqual([
      'credentialsImported',
      'linksAdded',
      'npiVerified',
      'resumeUploaded',
      'workAuthProvided',
    ]);
  });

  it('every dimension has a fix destination', () => {
    for (const dim of COMPLETENESS_DIMENSIONS) {
      expect(dim.fixHref.length).toBeGreaterThan(0);
      expect(dim.fixLabel.length).toBeGreaterThan(0);
      expect(dim.fixHref.startsWith('/') || dim.fixHref.startsWith('#')).toBe(true);
    }
  });

  it('guidance copy is filled-ness only — never a verification claim', () => {
    for (const dim of COMPLETENESS_DIMENSIONS) {
      const copy = `${dim.label} ${dim.whyItMatters}`.toLowerCase();
      expect(copy).not.toContain('verified');
      expect(copy).not.toContain('guaranteed');
      expect(copy).not.toContain('instant');
    }
  });
});

describe('describeIdentityFields', () => {
  it('marks registry-hydrated fields as source-backed', () => {
    const fields = describeIdentityFields(baseProfile());
    const byKey = Object.fromEntries(fields.map((f) => [f.key, f]));
    expect(byKey.name.provenance).toBe('VERIFIED');
    expect(byKey.npi.provenance).toBe('VERIFIED');
    expect(byKey.specialty.provenance).toBe('VERIFIED');
    expect(byKey.stateOfPractice.provenance).toBe('VERIFIED');
  });

  it('keeps a bare NPI user-entered when the registry never hydrated', () => {
    const fields = describeIdentityFields(
      baseProfile({ firstName: null, lastName: null, specialty: null, stateOfPractice: null }),
    );
    const byKey = Object.fromEntries(fields.map((f) => [f.key, f]));
    expect(byKey.name.provenance).toBe('UNKNOWN');
    expect(byKey.npi.provenance).toBe('USER_ENTERED');
    expect(byKey.npi.note).toContain('hydration has not completed');
    expect(byKey.specialty.provenance).toBe('UNKNOWN');
    expect(byKey.stateOfPractice.provenance).toBe('UNKNOWN');
  });

  it('never labels a missing value as source-backed', () => {
    const fields = describeIdentityFields(baseProfile({ specialty: null }));
    for (const field of fields) {
      if (field.value === null) {
        expect(field.provenance).not.toBe('VERIFIED');
      }
    }
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
