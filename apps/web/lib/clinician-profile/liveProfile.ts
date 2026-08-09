/**
 * liveProfile — pure helpers for the live /clinician/profile surface.
 *
 * Data flow: GET /api/me/workspaces returns the full workspace payload whose
 * `personProfile` is the backend PersonProfile row (bound at /onboarding via
 * the NPPES bootstrap). The surface renders that record plus the clinician's
 * live passport (ClinicianProfileSections) and writes self-attested fields
 * through the existing intake proxies:
 *
 *   POST /api/profile/links      { linkedinUrl?, portfolioUrl? }
 *   POST /api/profile/work-auth  { workAuthStatus: 'authorized'|'visa_required'|'other' }
 *   POST /api/profile/resume/upload { fileName, fileUrl }
 *
 * Truth contract: everything the clinician types here is SELF-ATTESTED.
 * Nothing in this module may present a user-entered value as verified, and
 * completeness is filled-ness only — it never implies verification.
 */

import type { ProfileProvenance } from '@/lib/profile/provenance';
import { parseSelfAttested, type SelfAttestedProfile } from '@/lib/clinician-profile/selfAttested';

export const WORK_AUTH_OPTIONS = [
  { value: 'authorized', label: 'Authorized to work in the U.S.' },
  { value: 'visa_required', label: 'Visa sponsorship required' },
  { value: 'other', label: 'Other / prefer to explain later' },
] as const;

export type WorkAuthStatus = (typeof WORK_AUTH_OPTIONS)[number]['value'];

export function isWorkAuthStatus(value: unknown): value is WorkAuthStatus {
  return WORK_AUTH_OPTIONS.some((option) => option.value === value);
}

/** The PersonProfile fields this surface consumes from /api/me/workspaces. */
export interface WorkspacePersonProfile {
  npi: string | null;
  firstName: string | null;
  lastName: string | null;
  specialty: string | null;
  stateOfPractice: string | null;
  workAuthStatus: string | null;
  resumeUrl: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  completeness: number | null;
  /** The clinician's USER_ENTERED structured sections. Never source-verified. */
  selfAttested: SelfAttestedProfile;
}

export function extractPersonProfile(payload: unknown): WorkspacePersonProfile | null {
  if (!payload || typeof payload !== 'object') return null;
  const raw = (payload as { personProfile?: unknown }).personProfile;
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;

  const str = (key: string): string | null =>
    typeof p[key] === 'string' && (p[key] as string).length > 0 ? (p[key] as string) : null;

  return {
    npi: str('npi'),
    firstName: str('firstName'),
    lastName: str('lastName'),
    specialty: str('specialty'),
    stateOfPractice: str('stateOfPractice'),
    workAuthStatus: str('workAuthStatus'),
    resumeUrl: str('resumeUrl'),
    linkedinUrl: str('linkedinUrl'),
    portfolioUrl: str('portfolioUrl'),
    completeness: typeof p.completeness === 'number' ? (p.completeness as number) : null,
    selfAttested: parseSelfAttested(p.selfAttested),
  };
}

export function displayName(profile: WorkspacePersonProfile): string | null {
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
  return name.length > 0 ? name : null;
}

export interface UrlValidation {
  ok: boolean;
  /** Normalized URL when ok (https:// prefixed when scheme was omitted). */
  url: string | null;
  reason: string | null;
}

/** Validates a self-attested link. Empty input is valid-and-null (clearing). */
export function validateProfileUrl(raw: string): UrlValidation {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: true, url: null, reason: null };
  }
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { ok: false, url: null, reason: 'Enter a valid link (for example, linkedin.com/in/you).' };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, url: null, reason: 'Links must use http or https.' };
  }
  if (!parsed.hostname.includes('.')) {
    return { ok: false, url: null, reason: 'That link is missing a domain (for example, example.com).' };
  }
  return { ok: true, url: parsed.toString(), reason: null };
}

/** Derives an honest file name for a resume attached by URL. */
export function resumeFileNameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const tail = parsed.pathname.split('/').filter(Boolean).pop();
    if (tail && tail.length <= 120) return decodeURIComponent(tail);
  } catch {
    // fall through to the generic name
  }
  return 'resume-link';
}

/** Editable form values on the live profile surface. */
export interface ProfileFormValues {
  linkedinUrl: string;
  portfolioUrl: string;
  resumeUrl: string;
  workAuthStatus: string;
}

export interface ProfileFormDiff {
  /** True when any field differs from the saved profile. */
  dirty: boolean;
  linksChanged: boolean;
  resumeChanged: boolean;
  workAuthChanged: boolean;
  /** Per-field clears: a previously saved value the form now leaves empty. */
  clearLinkedin: boolean;
  clearPortfolio: boolean;
  clearResume: boolean;
  clearWorkAuth: boolean;
  /**
   * Human labels of previously saved fields the form now clears. Used to
   * confirm the removal in the UI — clearing is supported, not blocked.
   */
  clearedFields: string[];
}

function normalizedUrlOrRaw(raw: string): string {
  const v = validateProfileUrl(raw);
  return v.ok ? (v.url ?? '') : raw.trim();
}

/**
 * Compares the form against the saved profile. URL fields compare on their
 * normalized form so "linkedin.com/in/you" is not "dirty" against a saved
 * "https://linkedin.com/in/you".
 */
export function computeProfileFormDiff(
  profile: WorkspacePersonProfile,
  form: ProfileFormValues,
): ProfileFormDiff {
  const savedLinkedin = profile.linkedinUrl ?? '';
  const savedPortfolio = profile.portfolioUrl ?? '';
  const savedResume = profile.resumeUrl ?? '';
  const savedWorkAuth = profile.workAuthStatus ?? '';

  const nextLinkedin = normalizedUrlOrRaw(form.linkedinUrl);
  const nextPortfolio = normalizedUrlOrRaw(form.portfolioUrl);
  const nextResume = normalizedUrlOrRaw(form.resumeUrl);
  const nextWorkAuth = form.workAuthStatus;

  const clearLinkedin = Boolean(savedLinkedin) && nextLinkedin === '';
  const clearPortfolio = Boolean(savedPortfolio) && nextPortfolio === '';
  const clearResume = Boolean(savedResume) && nextResume === '';
  const clearWorkAuth = Boolean(savedWorkAuth) && nextWorkAuth === '';

  const clearedFields: string[] = [];
  if (clearLinkedin) clearedFields.push('LinkedIn');
  if (clearPortfolio) clearedFields.push('Portfolio');
  if (clearResume) clearedFields.push('Resume link');
  if (clearWorkAuth) clearedFields.push('Work authorization');

  const linksChanged =
    (nextLinkedin !== savedLinkedin && nextLinkedin !== '') ||
    (nextPortfolio !== savedPortfolio && nextPortfolio !== '');
  const resumeChanged = nextResume !== savedResume && nextResume !== '';
  const workAuthChanged = nextWorkAuth !== savedWorkAuth && nextWorkAuth !== '';

  return {
    dirty: linksChanged || resumeChanged || workAuthChanged || clearedFields.length > 0,
    linksChanged,
    resumeChanged,
    workAuthChanged,
    clearLinkedin,
    clearPortfolio,
    clearResume,
    clearWorkAuth,
    clearedFields,
  };
}

/** Confirm copy when a save will remove previously saved self-attested fields. */
export function describeClearedFields(clearedFields: string[]): string {
  const list = clearedFields.join(', ');
  return `Saving will remove ${list} from your profile. ${clearedFields.length > 1 ? 'These are' : 'This is'} self-attested — clearing only removes what you entered.`;
}

/**
 * Read the server's own message out of an error body.
 *
 * The backend error handler emits `{ error: { code, message } }` — an OBJECT.
 * This used to test `typeof body.error === 'string'`, which never matched, so
 * every validation failure fell through to the generic copy and the specific
 * reason (e.g. the work-auth enum list) was never shown. Both shapes are read
 * here because the web proxies pass the backend body through verbatim and a
 * bare-string `error` is still what some sibling routes return.
 */
function extractServerMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const error = (body as { error?: unknown }).error;
  if (typeof error === 'string') return error.trim() || null;
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message.trim() || null;
  }
  return null;
}

export function describeProfileSaveError(status: number, body: unknown): string {
  const message = extractServerMessage(body);
  if (status === 401) {
    return 'Your session expired. Sign in again to save your profile.';
  }
  if (status === 400 || status === 422) {
    return message ?? 'That value could not be saved. Check it and try again.';
  }
  // 404 here means "no VitalCV user record for this account" — a permanent
  // account state, not an outage. Calling it temporary sends the clinician
  // into a retry loop that can never succeed.
  if (status === 404) {
    return 'Your account is not connected to a VitalCV profile yet. Connect your NPI to start saving.';
  }
  return 'Saving is temporarily unavailable. This is a system state — your entries were not lost; try again shortly.';
}

/**
 * Completeness copy: filled-ness only. This string is asserted in tests to
 * keep the surface from ever presenting completeness as verification.
 */
export function completenessStatement(score: number): string {
  const bounded = Math.max(0, Math.min(100, Math.round(score)));
  return `${bounded}% of profile fields are filled in. Completeness measures filled-ness only — it is not verification.`;
}

/* ── Completeness guidance (GET /api/profile/completeness) ──────────────── */

/** Boolean dimension breakdown computed by the backend intake service. */
export interface CompletenessDimensions {
  npiVerified: boolean;
  resumeUploaded: boolean;
  linksAdded: boolean;
  workAuthProvided: boolean;
  credentialsImported: boolean;
}

export interface CompletenessBreakdown {
  score: number;
  dimensions: CompletenessDimensions;
}

const DIMENSION_KEYS = [
  'npiVerified',
  'resumeUploaded',
  'linksAdded',
  'workAuthProvided',
  'credentialsImported',
] as const;

/** Defensive parse of the completeness endpoint payload. */
export function extractCompletenessBreakdown(payload: unknown): CompletenessBreakdown | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as { score?: unknown; dimensions?: unknown };
  if (typeof p.score !== 'number' || !p.dimensions || typeof p.dimensions !== 'object') {
    return null;
  }
  const raw = p.dimensions as Record<string, unknown>;
  const dimensions = {} as CompletenessDimensions;
  for (const key of DIMENSION_KEYS) {
    if (typeof raw[key] !== 'boolean') return null;
    dimensions[key] = raw[key] as boolean;
  }
  return { score: Math.max(0, Math.min(100, Math.round(p.score))), dimensions };
}

export interface CompletenessDimensionMeta {
  key: keyof CompletenessDimensions;
  /** Filled-ness label. Must never read as a verification claim. */
  label: string;
  /** Points this dimension adds to the 0–100 score (mirrors backend weights). */
  weight: number;
  whyItMatters: string;
  /** Where the clinician goes to fill this dimension. */
  fixHref: string;
  fixLabel: string;
}

/**
 * Mirrors the backend intake-service dimension weights (30/20/10/15/25).
 * Copy rule: every line is about filled-ness and reviewer usefulness —
 * completing a dimension never implies a source check passed.
 */
export const COMPLETENESS_DIMENSIONS: readonly CompletenessDimensionMeta[] = [
  {
    key: 'npiVerified',
    label: 'NPI connected',
    weight: 30,
    whyItMatters:
      'Your NPPES registry record anchors your profile and is where every source check starts.',
    fixHref: '/onboarding',
    fixLabel: 'Connect your NPI',
  },
  {
    key: 'credentialsImported',
    label: 'Credential evidence attached',
    weight: 25,
    whyItMatters:
      'Uploaded credential documents are what source checks and employer review run against.',
    fixHref: '/holder#evidence-upload',
    fixLabel: 'Upload evidence',
  },
  {
    key: 'resumeUploaded',
    label: 'Resume attached',
    weight: 20,
    whyItMatters:
      'Reviewers line up your stated employment history against source-backed checks faster with a resume on file.',
    fixHref: '#self-attested',
    fixLabel: 'Add your resume link below',
  },
  {
    key: 'workAuthProvided',
    label: 'Work authorization stated',
    weight: 15,
    whyItMatters:
      'Employers ask about work authorization early — stating it now avoids a stall later in an application.',
    fixHref: '#self-attested',
    fixLabel: 'Choose a status below',
  },
  {
    key: 'linksAdded',
    label: 'Career links added',
    weight: 10,
    whyItMatters:
      'LinkedIn or a portfolio gives reviewers self-attested context beyond your registry fields.',
    fixHref: '#self-attested',
    fixLabel: 'Add links below',
  },
];

/* ── Identity field provenance (NPPES-bootstrapped header) ──────────────── */

export type IdentityFieldKey = 'name' | 'npi' | 'specialty' | 'stateOfPractice';

export interface IdentityFieldDescriptor {
  key: IdentityFieldKey;
  label: string;
  value: string | null;
  provenance: ProfileProvenance;
  note: string;
}

/**
 * Provenance for the PersonProfile identity header.
 *
 * Name / specialty / state only ever come from the NPPES lookup at connect
 * time, so a present value is source-backed. The NPI row is only
 * source-confirmed when the registry lookup actually hydrated (name present);
 * otherwise it is the number the clinician entered, awaiting registry
 * hydration — USER_ENTERED, never presented as confirmed.
 */
export function describeIdentityFields(
  profile: WorkspacePersonProfile,
): IdentityFieldDescriptor[] {
  const name = displayName(profile);
  const registryHydrated = name !== null;

  return [
    {
      key: 'name',
      label: 'Name',
      value: name,
      provenance: registryHydrated ? 'VERIFIED' : 'UNKNOWN',
      note: registryHydrated
        ? 'From your NPPES registry record at connect time.'
        : 'Not returned by the registry lookup yet.',
    },
    {
      key: 'npi',
      label: 'NPI',
      value: profile.npi,
      provenance: registryHydrated ? 'VERIFIED' : 'USER_ENTERED',
      note: registryHydrated
        ? 'Matched to your NPPES registry record at connect time.'
        : 'Entered at connect. Registry hydration has not completed for this NPI.',
    },
    {
      key: 'specialty',
      label: 'Specialty',
      value: profile.specialty,
      provenance: profile.specialty ? 'VERIFIED' : 'UNKNOWN',
      note: profile.specialty
        ? 'NPPES primary taxonomy. A specialty claim, not a board-certification claim.'
        : 'Not listed in your registry record.',
    },
    {
      key: 'stateOfPractice',
      label: 'State of practice',
      value: profile.stateOfPractice,
      provenance: profile.stateOfPractice ? 'VERIFIED' : 'UNKNOWN',
      note: profile.stateOfPractice
        ? 'Practice address state from your NPPES registry record.'
        : 'Not listed in your registry record.',
    },
  ];
}
