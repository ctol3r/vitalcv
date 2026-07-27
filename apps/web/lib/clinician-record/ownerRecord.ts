/**
 * ownerRecord.ts — resolve the signed-in clinician's own registry record.
 *
 * The clinician profile has always been a form the clinician fills in. What it
 * never showed is the record an employer actually reads about them, which is
 * the NPPES filing — and a clinician cannot fix a filing they cannot see.
 *
 * Fail-open on the surface, fail-closed on the claim: every failure mode here
 * returns a typed reason rather than null, so the page can say WHY it has no
 * record ("you haven't linked an NPI" vs "CMS was unreachable"). Those are
 * different problems with different fixes, and collapsing them into an empty
 * state tells the clinician nothing actionable.
 */

import { headers } from 'next/headers';
import { fetchNppesRecord } from './nppes';
import { buildClinicianRecord } from './build';
import type { ClinicianRecord } from './types';

const BACKEND =
  process.env.BACKEND_URL ??
  process.env.NEXT_PUBLIC_API_BASE ??
  process.env.NEXT_PUBLIC_BACKEND_URL ??
  'http://localhost:4000';

export type OwnerRecordResult =
  | { state: 'ready'; record: ClinicianRecord; npi: string }
  /** Signed in, but no NPI linked to the account yet. */
  | { state: 'no_npi' }
  /** An NPI is linked, but CMS had no record for it or was unreachable. */
  | { state: 'registry_unavailable'; npi: string }
  /** The workspace lookup itself failed — we do not know if an NPI exists. */
  | { state: 'unknown' };

/**
 * Read the caller's NPI from their workspace.
 *
 * Forwards the incoming cookies so the backend sees the same session the
 * browser has; without them this is an unauthenticated call and would
 * silently look like "no NPI linked".
 */
async function resolveOwnNpi(): Promise<string | null | 'error'> {
  try {
    const incoming = await headers();
    const cookie = incoming.get('cookie');

    const res = await fetch(`${BACKEND}/api/me/workspaces`, {
      headers: {
        Accept: 'application/json',
        ...(cookie ? { cookie } : {}),
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) return 'error';

    const payload = (await res.json()) as unknown;
    const person = (payload as { personProfile?: { npi?: unknown } } | null)
      ?.personProfile;
    const npi = typeof person?.npi === 'string' ? person.npi.trim() : '';
    return npi.length > 0 ? npi : null;
  } catch {
    return 'error';
  }
}

export async function loadOwnerRecord(): Promise<OwnerRecordResult> {
  const npi = await resolveOwnNpi();
  if (npi === 'error') return { state: 'unknown' };
  if (npi === null) return { state: 'no_npi' };

  const nppes = await fetchNppesRecord(npi);
  if (!nppes) return { state: 'registry_unavailable', npi };

  return {
    state: 'ready',
    npi,
    record: buildClinicianRecord(nppes.reading, {
      retrievedAt: nppes.retrievedAt,
    }),
  };
}
