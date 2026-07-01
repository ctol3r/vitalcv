/**
 * liveProfile — pure helpers for the live /clinician/profile surface.
 *
 * Data flow: GET /api/me/workspaces returns the full workspace payload whose
 * `personProfile` is the backend PersonProfile row (bound at /get-ready via
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

export function describeProfileSaveError(status: number, body: unknown): string {
  const message =
    body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string'
      ? (body as { error: string }).error
      : null;
  if (status === 401) {
    return 'Your session expired. Sign in again to save your profile.';
  }
  if (status === 400 || status === 422) {
    return message ?? 'That value could not be saved. Check it and try again.';
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
