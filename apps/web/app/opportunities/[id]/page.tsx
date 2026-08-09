/**
 * /opportunities/[id] — public landing page for one ACTIVE opening.
 *
 * This is where employer-embedded "Apply with VitalCV" buttons land (see
 * OpportunityEmbedPanel): a no-login view of the role plus the apply path.
 * "Apply with VitalCV" deep-links into the signed-in role page —
 * /holder/opportunities/[id] — and the middleware walks a signed-out
 * clinician through sign-in and back. New clinicians get the /onboarding lane.
 * Honest copy: a posting is a plain listing; nothing here implies VitalCV
 * verified the employer.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBackendBase } from '@/lib/api';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface PublicOpportunity {
  id: string;
  title: string;
  specialty?: string | null;
  hiringType?: string | null;
  state?: string | null;
  payRange?: string | null;
  description?: string | null;
  remote?: boolean;
  status?: string;
  organizationName?: string | null;
  organization?: { name?: string | null } | null;
}

const HIRING_LABEL: Record<string, string> = {
  perm: 'Permanent',
  locums: 'Locums',
  travel: 'Travel',
  telehealth: 'Telehealth',
  per_diem: 'Per diem',
};

async function fetchOpportunity(id: string): Promise<PublicOpportunity | null> {
  try {
    const res = await fetch(`${getBackendBase()}/api/opportunities/${encodeURIComponent(id)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { opportunity?: PublicOpportunity };
    return body.opportunity ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params;
  if (!UUID_RE.test(id)) return { title: 'Opportunity' };
  const opp = await fetchOpportunity(id);
  return {
    title: opp ? { absolute: `${opp.title} — Apply with VitalCV` } : 'Opportunity',
    description: opp
      ? 'Apply with your VitalCV profile — readiness snapshot attached, no résumé re-typing.'
      : undefined,
  };
}

export default async function PublicOpportunityPage(
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const opp = await fetchOpportunity(id);
  if (!opp || (opp.status && opp.status !== 'ACTIVE')) notFound();

  const orgName = opp.organizationName ?? opp.organization?.name ?? null;
  const facts = [
    opp.specialty,
    opp.hiringType ? HIRING_LABEL[opp.hiringType] ?? opp.hiringType : null,
    opp.state,
    opp.remote ? 'Remote' : null,
    opp.payRange,
  ].filter(Boolean);

  return (
    <div className="mz mz-persona-holder min-h-screen">
      <main className="mx-auto w-full max-w-2xl px-5 pb-16 pt-12">
        <p className="mz-eyebrow">Open role{orgName ? ` · ${orgName}` : ''}</p>
        <h1 className="mz-h1 mt-2">{opp.title}</h1>
        {facts.length > 0 ? (
          <p className="mz-small mt-2 opacity-80">{facts.join(' · ')}</p>
        ) : null}

        {opp.description ? (
          <div className="mz-card mz-card-pad mt-6">
            <p className="mz-body whitespace-pre-line">{opp.description}</p>
          </div>
        ) : null}

        <div className="mz-card mz-card-pad mt-6">
          <h2 className="mz-h2">Apply with your career evidence, not a résumé</h2>
          <p className="mz-body mt-2">
            VitalCV is the clinician-owned career profile: your NPI-backed
            readiness snapshot and source-backed evidence travel with your
            application, so this employer can act on it as a head start.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={`/holder/opportunities/${opp.id}`}
              className="mz-btn"
              data-testid="apply-with-vitalcv"
            >
              Apply with VitalCV →
            </Link>
            <Link href="/onboarding" className="mz-btn-ghost">
              New here? Build your profile first
            </Link>
          </div>
          <p className="mz-small mt-3 opacity-70">
            Signing in keeps your application tied to your own profile. Applying
            shares your readiness snapshot with this employer — nothing more.
          </p>
        </div>

        <p className="mz-small mt-8 opacity-60">
          This posting is a listing created by the employer. VitalCV verifies
          clinician career evidence against primary sources; it does not verify
          employers or endorse openings.{' '}
          <Link href="/employer/post" className="underline underline-offset-4">
            Employers: post and embed your own roles.
          </Link>
        </p>
      </main>
    </div>
  );
}
