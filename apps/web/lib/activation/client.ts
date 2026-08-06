/**
 * Browser calls into the clinician-profile proxies — Wave 1076 B1.
 *
 * Thin on purpose. Its whole job is to normalize two error shapes into one, so
 * the surface can act on a refusal instead of printing whatever came back:
 *
 *   { error: { code, message, field? } }   the backend's normalized envelope
 *   { error: "…" }                          the web proxy's own edge failures
 *
 * The distinction that matters downstream is between "the profile is not
 * complete yet" (422, with the list of fields), "you typed something this field
 * cannot hold" (400, with the field name), "your session ended" (401) and "the
 * service is down" (503). Those produce four different sentences and one of
 * them is not an error at all in the clinician's terms — flattening them into a
 * single `catch` is how a product ends up telling someone their profile broke
 * when they mistyped an email address.
 */

import type { ProfileView } from './profileView';

export interface ApiError {
  status: number;
  message: string;
  code?: string;
  /** Present on a field-level validation refusal. */
  field?: string;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

const GENERIC = 'Something went wrong. Nothing was changed.';

function normalizeError(status: number, body: unknown): ApiError {
  const err = (body as { error?: unknown } | null)?.error;

  if (typeof err === 'string') return { status, message: err };

  if (err && typeof err === 'object') {
    const e = err as { message?: unknown; code?: unknown; field?: unknown };
    return {
      status,
      message: typeof e.message === 'string' && e.message ? e.message : GENERIC,
      code: typeof e.code === 'string' ? e.code : undefined,
      field: typeof e.field === 'string' ? e.field : undefined,
    };
  }

  return { status, message: GENERIC };
}

async function call<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-store', ...init });
  } catch {
    // The request never landed, so nothing changed. Say that, rather than
    // leaving the clinician wondering whether their edit half-applied.
    return {
      ok: false,
      error: { status: 0, message: 'You appear to be offline. Nothing was changed.' },
    };
  }

  const body = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) return { ok: false, error: normalizeError(res.status, body) };
  return { ok: true, data: body as T };
}

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

/** Create the draft for this NPI, or recover the one already owned. */
export function claimProfile(npi: string): Promise<ApiResult<ProfileView>> {
  return call<ProfileView>('/api/clinician-profile/claim', json({ npi }));
}

export function readProfile(npi: string): Promise<ApiResult<ProfileView>> {
  return call<ProfileView>(`/api/clinician-profile/${npi}`);
}

/** Persist corrections. A draft write — it does not save or activate anything. */
export function saveCorrections(
  npi: string,
  corrections: Record<string, unknown>,
): Promise<ApiResult<ProfileView>> {
  return call<ProfileView>(`/api/clinician-profile/${npi}`, {
    ...json({ corrections }),
    method: 'PATCH',
  });
}

export function confirmReview(npi: string): Promise<ApiResult<ProfileView>> {
  return call<ProfileView>(`/api/clinician-profile/${npi}/review`, json({}));
}

export function confirmSharing(npi: string): Promise<ApiResult<ProfileView>> {
  return call<ProfileView>(`/api/clinician-profile/${npi}/sharing`, json({}));
}

/** The explicit save. 422 means incomplete, and carries what is missing. */
export function saveReusableProfile(npi: string): Promise<ApiResult<ProfileView>> {
  return call<ProfileView>(`/api/clinician-profile/${npi}/save`, json({}));
}

/**
 * Every profile this clinician has, drafts included.
 *
 * The last-resort recovery path: a clinician on a new machine has no URL and no
 * local storage, and this is what stops the product asking them to start over.
 */
export async function listProfiles(): Promise<ApiResult<ProfileView[]>> {
  const res = await call<{ profiles?: ProfileView[] }>('/api/clinician-profile?include=all');
  if (!res.ok) return res;
  return { ok: true, data: Array.isArray(res.data.profiles) ? res.data.profiles : [] };
}
