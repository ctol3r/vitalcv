import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { MARKETPLACE_BACKEND, buildMarketplaceHeaders } from '@/lib/server/marketplace-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Career Timeline · VitalCV',
  description:
    'Your professional timeline — evidence checks, trust milestones, recognition, and mobility changes, projected from recorded events.',
};

type Resolution =
  | { kind: 'signed_out' }
  | { kind: 'no_npi' }
  | { kind: 'npi'; npi: string }
  | { kind: 'error' };

async function resolveClinicianNpi(): Promise<Resolution> {
  const session = await auth();
  if (!session.userId) return { kind: 'signed_out' };

  try {
    const res = await fetch(`${MARKETPLACE_BACKEND}/api/me/workspaces`, {
      headers: buildMarketplaceHeaders(session),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { kind: 'error' };
    const payload = (await res.json()) as { personProfile?: { npi?: string | null } | null };
    const npi = payload.personProfile?.npi ?? null;
    return npi ? { kind: 'npi', npi } : { kind: 'no_npi' };
  } catch {
    return { kind: 'error' };
  }
}

/**
 * /holder/timeline — the signed-in clinician's entry to their own career
 * timeline. Resolves the workspace NPI server-side and lands on the
 * canonical timeline surface (/activity/[entityId], Wave 300/600), so the
 * holder hub and the workspace cluster stay one product with no dead ends.
 */
export default async function HolderTimelinePage() {
  const resolution = await resolveClinicianNpi();

  if (resolution.kind === 'signed_out') {
    redirect('/sign-in?redirect_url=%2Fholder%2Ftimeline');
  }
  if (resolution.kind === 'no_npi') {
    redirect('/get-ready');
  }
  if (resolution.kind === 'npi') {
    redirect(`/activity/${encodeURIComponent(resolution.npi)}`);
  }

  // kind === 'error' — honest system-state page (redirect targets unknown).
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6">
      <div className="max-w-sm space-y-4 text-center">
        <p className="font-medium text-foreground">Couldn&apos;t open your timeline</p>
        <p className="text-sm text-zinc-400">
          Your workspace lookup is temporarily unavailable. This is a system state — not a finding
          about your record. Try again shortly.
        </p>
        <Link
          href="/holder/home"
          className="inline-flex items-center justify-center rounded-lg border border-zinc-700 px-5 py-2 text-sm text-zinc-300 transition hover:text-white"
        >
          Back to your dashboard
        </Link>
      </div>
    </main>
  );
}
