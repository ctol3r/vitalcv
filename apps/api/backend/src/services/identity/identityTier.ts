/**
 * identityTier — derived clinician-identity tiers over existing signals.
 *
 * VitalCV cannot (yet) assert "this person is a licensed clinician" — that is
 * the source-verified license lane (state board / FSMB), which stays honestly
 * gated. What it CAN do today, from columns that already exist:
 *
 *   account               signed in; nothing bound
 *   preview               a clinician-in-training / student self-declared, no
 *                         NPI bound (PersonProfile.profession = 'student').
 *                         A PREVIEW-ONLY, self-attested state — it confers NO
 *                         verification beyond `account` and can never satisfy a
 *                         higher gate. It upgrades to npi_bound automatically
 *                         when the person later binds an NPI.
 *   npi_bound             an NPI from the public registry is exclusively bound
 *                         to this account (PersonProfile.npi is unique)
 *   work_email_confirmed  npi_bound + a confirmed email at an institutional
 *                         domain (free-mail and disposable domains do not
 *                         qualify — they prove contact, not affiliation)
 *
 * `preview` shares the same trust FLOOR as `account` on purpose: a self-declared
 * trainee is not more identity-verified than a bare account — it is a distinct
 * *state* the UI can name and steer, not a step up the verification ladder. It
 * therefore sits below npi_bound and never unlocks a clinician-only power
 * (publish / apply / AI), which is what "slot into the ladder, don't bypass the
 * gate" requires.
 *
 * Tier names and labels deliberately state the checked fact. Nothing here may
 * ever be rendered as a bare "Verified" or "verified clinician" claim, and a
 * preview must never be presented as source-backed or decision-grade.
 */

export type EmailDomainClass = 'institutional' | 'free' | 'disposable' | 'unknown';

export type IdentityTier = 'account' | 'preview' | 'npi_bound' | 'work_email_confirmed';

/** Self-attested profession value that marks a no-NPI preview profile. */
export const PREVIEW_PROFESSION = 'student';

/** Consumer mailbox providers — prove contact, not institutional affiliation. */
const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'rocketmail.com',
  'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'aol.com',
  'icloud.com', 'me.com', 'mac.com', 'proton.me', 'protonmail.com', 'pm.me',
  'gmx.com', 'gmx.net', 'mail.com', 'zoho.com', 'yandex.com', 'yandex.ru',
  'fastmail.com', 'hey.com', 'duck.com', 'mail.ru', 'qq.com', '163.com',
  '126.com', 'comcast.net', 'att.net', 'verizon.net', 'sbcglobal.net',
]);

/** Throwaway providers — never a meaningful signal. */
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com',
  'temp-mail.org', 'throwawaymail.com', 'yopmail.com', 'sharklasers.com',
  'getnada.com', 'trashmail.com', 'dispostable.com', 'maildrop.cc',
]);

export function emailDomainOf(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf('@');
  if (at < 1 || at === email.length - 1) return null;
  return email.slice(at + 1).trim().toLowerCase();
}

function inSetOrSubdomain(domain: string, set: Set<string>): boolean {
  if (set.has(domain)) return true;
  for (const known of set) {
    if (domain.endsWith(`.${known}`)) return true;
  }
  return false;
}

export function classifyEmailDomain(email: string | null | undefined): EmailDomainClass {
  const domain = emailDomainOf(email);
  if (!domain || !domain.includes('.')) return 'unknown';
  if (inSetOrSubdomain(domain, DISPOSABLE_EMAIL_DOMAINS)) return 'disposable';
  if (inSetOrSubdomain(domain, FREE_EMAIL_DOMAINS)) return 'free';
  return 'institutional';
}

export interface IdentitySignals {
  npiBound: boolean;
  emailConfirmed: boolean;
  emailDomain: string | null;
  emailDomainClass: EmailDomainClass | null;
  /**
   * A self-attested, no-NPI preview profile (clinician-in-training / student).
   * True only at the `preview` tier. Preview data is self-attested and NEVER
   * source-backed or decision-grade — UIs must label it as such.
   */
  previewProfile: boolean;
  /** The source-verified license lane is not live; stated so UIs stay honest. */
  licenseSourceVerified: false;
}

export interface IdentityState {
  tier: IdentityTier;
  signals: IdentitySignals;
}

const TIER_ORDER: Record<IdentityTier, number> = {
  account: 0,
  // Same trust floor as `account` — a self-declared preview is not a
  // verification step, so it must never satisfy an npi_bound-or-above gate.
  preview: 0,
  npi_bound: 1,
  work_email_confirmed: 2,
};

export function tierAtLeast(tier: IdentityTier, min: IdentityTier): boolean {
  return TIER_ORDER[tier] >= TIER_ORDER[min];
}

export function deriveIdentityState(profile: {
  npi: string | null;
  verifiedEmail: string | null;
  profession?: string | null;
} | null): IdentityState {
  const npiBound = Boolean(profile?.npi);
  const emailDomain = emailDomainOf(profile?.verifiedEmail);
  const emailDomainClass = profile?.verifiedEmail
    ? classifyEmailDomain(profile.verifiedEmail)
    : null;
  const emailConfirmed = Boolean(profile?.verifiedEmail);
  const institutional = emailConfirmed && emailDomainClass === 'institutional';
  // A no-NPI, self-attested trainee. Only meaningful below npi_bound: an NPI
  // binding always wins (and overwrites the student profession on upgrade).
  const previewProfile = !npiBound && profile?.profession === PREVIEW_PROFESSION;

  const tier: IdentityTier = npiBound
    ? institutional
      ? 'work_email_confirmed'
      : 'npi_bound'
    : previewProfile
      ? 'preview'
      : 'account';

  return {
    tier,
    signals: {
      npiBound,
      emailConfirmed,
      emailDomain,
      emailDomainClass,
      previewProfile,
      licenseSourceVerified: false,
    },
  };
}

/** Honest gate copy, reused by every enforcement point. */
export function tierRequirementMessage(min: IdentityTier): string {
  if (min === 'work_email_confirmed') {
    return 'This clinician feature unlocks after you confirm a work email at your organization (a personal or free email confirms contact only). Add it in Get Ready → email confirmation.';
  }
  if (min === 'npi_bound') {
    return 'This feature unlocks after you connect your NPI in Get Ready.';
  }
  return 'Sign in to continue.';
}
