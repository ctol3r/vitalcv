/**
 * `/profile/activate` — the clinician activation flow (Wave 1076 B1).
 *
 * One URL for the whole loop, which is what makes it recoverable: whatever
 * happens — a refresh, a closed laptop, a trip through Clerk — coming back here
 * with the same NPI lands the clinician exactly where the server says they are.
 *
 * The route is deliberately reachable signed OUT. A clinician sees what VitalCV
 * found before being asked for anything, because "no account needed to preview"
 * is the reason the NPI wedge works at all. What is signed out is only the
 * PREVIEW — public registry information anyone can look up. Everything durable
 * lives behind `/api/clinician-profile/**`, which answers 401 without a
 * verified Clerk session, so the page being public costs nothing: there is no
 * draft, no correction and no private holding to reach without one.
 *
 * `auth()` is wrapped because it throws when Clerk middleware did not run —
 * keyless local builds and e2e. The honest fallback is the anonymous preview,
 * not a 500: a missing key is our problem, not the visitor's.
 */

import type { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';

import { ActivateProfileFlow } from '@/components/activation/ActivateProfileFlow';
import { ResolvedPreview } from '@/components/activation/ResolvedPreview';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Build your VitalCV profile',
  description:
    'Start with your NPI. See what public sources already know, correct what is wrong, and save one professional profile you can reuse for every application.',
  // A per-clinician working surface has no business in a search index.
  robots: { index: false, follow: false },
};

const NPI_RE = /^\d{10}$/;

async function signedIn(): Promise<boolean> {
  try {
    const session = await auth();
    return Boolean(session.userId);
  } catch {
    return false;
  }
}

export default async function ActivateProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.npi) ? params.npi[0] : params.npi;
  // Validated here, before it reaches a component that will put it in a URL.
  const npi = typeof raw === 'string' && NPI_RE.test(raw.trim()) ? raw.trim() : null;

  return (await signedIn()) ? (
    <ActivateProfileFlow initialNpi={npi} />
  ) : (
    <ResolvedPreview initialNpi={npi} />
  );
}
