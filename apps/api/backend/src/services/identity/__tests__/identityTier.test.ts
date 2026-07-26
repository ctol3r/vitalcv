/**
 * identityTier — the derived clinician-identity ladder must be strict and
 * honest: free/disposable inboxes never reach work_email_confirmed, malformed
 * input degrades to the lowest tier, and the license lane is always reported
 * as not source-verified (it is not live).
 */
import {
  classifyEmailDomain,
  deriveIdentityState,
  emailDomainOf,
  tierAtLeast,
  tierRequirementMessage,
} from '../identityTier';

describe('classifyEmailDomain', () => {
  it('classifies institutional domains', () => {
    expect(classifyEmailDomain('m.miller@cedarhealth.org')).toBe('institutional');
    expect(classifyEmailDomain('doc@stanfordhealthcare.org')).toBe('institutional');
    expect(classifyEmailDomain('a@sub.hospital.edu')).toBe('institutional');
  });

  it('classifies consumer free-mail', () => {
    for (const d of ['gmail.com', 'yahoo.com', 'outlook.com', 'icloud.com', 'proton.me', 'aol.com']) {
      expect(classifyEmailDomain(`user@${d}`)).toBe('free');
    }
  });

  it('classifies disposable providers', () => {
    expect(classifyEmailDomain('x@mailinator.com')).toBe('disposable');
    expect(classifyEmailDomain('x@yopmail.com')).toBe('disposable');
  });

  it('degrades malformed input to unknown', () => {
    expect(classifyEmailDomain('')).toBe('unknown');
    expect(classifyEmailDomain(null)).toBe('unknown');
    expect(classifyEmailDomain('not-an-email')).toBe('unknown');
    expect(classifyEmailDomain('trailing@')).toBe('unknown');
    expect(classifyEmailDomain('@nodomain')).toBe('unknown');
  });

  it('is case-insensitive on the domain', () => {
    expect(classifyEmailDomain('USER@GMAIL.COM')).toBe('free');
    expect(emailDomainOf('A@Cedar.ORG')).toBe('cedar.org');
  });
});

describe('deriveIdentityState', () => {
  it('account tier with no profile', () => {
    expect(deriveIdentityState(null).tier).toBe('account');
  });

  it('npi_bound with an NPI but no confirmed email', () => {
    const s = deriveIdentityState({ npi: '1234567890', verifiedEmail: null });
    expect(s.tier).toBe('npi_bound');
    expect(s.signals.emailConfirmed).toBe(false);
  });

  it('npi_bound (NOT confirmed) when the confirmed email is free-mail', () => {
    const s = deriveIdentityState({ npi: '1234567890', verifiedEmail: 'doc@gmail.com' });
    expect(s.tier).toBe('npi_bound');
    expect(s.signals.emailConfirmed).toBe(true);
    expect(s.signals.emailDomainClass).toBe('free');
  });

  it('npi_bound when the confirmed email is disposable', () => {
    const s = deriveIdentityState({ npi: '1234567890', verifiedEmail: 'x@mailinator.com' });
    expect(s.tier).toBe('npi_bound');
  });

  it('work_email_confirmed only with NPI + institutional email', () => {
    const s = deriveIdentityState({ npi: '1234567890', verifiedEmail: 'm.miller@cedarhealth.org' });
    expect(s.tier).toBe('work_email_confirmed');
    expect(s.signals.emailDomain).toBe('cedarhealth.org');
  });

  it('institutional email WITHOUT an NPI stays account tier', () => {
    const s = deriveIdentityState({ npi: null, verifiedEmail: 'm.miller@cedarhealth.org' });
    expect(s.tier).toBe('account');
  });

  it('always reports the license lane as not source-verified', () => {
    const s = deriveIdentityState({ npi: '1234567890', verifiedEmail: 'a@b.org' });
    expect(s.signals.licenseSourceVerified).toBe(false);
  });

  it('preview tier for a no-NPI, self-attested student profile', () => {
    const s = deriveIdentityState({ npi: null, verifiedEmail: null, profession: 'student' });
    expect(s.tier).toBe('preview');
    expect(s.signals.previewProfile).toBe(true);
    // A preview is never a completed identity/license check.
    expect(s.signals.npiBound).toBe(false);
    expect(s.signals.licenseSourceVerified).toBe(false);
  });

  it('a no-NPI, non-student profession stays account (not a preview)', () => {
    const s = deriveIdentityState({ npi: null, verifiedEmail: null, profession: 'physician' });
    expect(s.tier).toBe('account');
    expect(s.signals.previewProfile).toBe(false);
  });

  it('binding an NPI overrides a leftover student profession — upgrades out of preview', () => {
    const s = deriveIdentityState({ npi: '1234567890', verifiedEmail: null, profession: 'student' });
    expect(s.tier).toBe('npi_bound');
    expect(s.signals.previewProfile).toBe(false);
  });

  it('previewProfile is false for every NPI-bound state', () => {
    expect(deriveIdentityState({ npi: '1234567890', verifiedEmail: null }).signals.previewProfile).toBe(false);
    expect(
      deriveIdentityState({ npi: '1234567890', verifiedEmail: 'm.miller@cedarhealth.org' }).signals.previewProfile,
    ).toBe(false);
    expect(deriveIdentityState(null).signals.previewProfile).toBe(false);
  });
});

describe('tierAtLeast + gate copy', () => {
  it('orders the ladder strictly', () => {
    expect(tierAtLeast('work_email_confirmed', 'npi_bound')).toBe(true);
    expect(tierAtLeast('npi_bound', 'work_email_confirmed')).toBe(false);
    expect(tierAtLeast('account', 'npi_bound')).toBe(false);
    expect(tierAtLeast('npi_bound', 'npi_bound')).toBe(true);
  });

  it('preview never satisfies a clinician-power gate (slots in, does not bypass)', () => {
    // The whole point: a preview profile can never unlock publish / apply / AI,
    // all of which gate at npi_bound or above.
    expect(tierAtLeast('preview', 'npi_bound')).toBe(false);
    expect(tierAtLeast('preview', 'work_email_confirmed')).toBe(false);
    // Same trust floor as a bare account — neither is a verification rung.
    expect(tierAtLeast('preview', 'account')).toBe(true);
    expect(tierAtLeast('account', 'preview')).toBe(true);
  });

  it('gate copy never claims verification of the person', () => {
    for (const min of ['npi_bound', 'work_email_confirmed'] as const) {
      const msg = tierRequirementMessage(min).toLowerCase();
      expect(msg).not.toContain('verified clinician');
      expect(msg).not.toContain('identity verified');
    }
  });
});
