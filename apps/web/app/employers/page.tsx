import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ArrowRight,
  BriefcaseBusiness,
  ShieldCheck,
  Stethoscope,
  Users,
} from 'lucide-react';

interface EmployerSummary {
  id: string;
  slug: string;
  name: string;
  facilityType: string;
  tagline: string;
  specialties: string[];
  states: string[];
  openRoles: number;
  trustScore: number;
  hiringStatus: string;
  verified: boolean;
  trustIndicators: string[];
}

interface EmployerListPayload {
  employers: EmployerSummary[];
  total: number;
}

interface OpportunityListPayload {
  total: number;
}

const BACKEND = (
  process.env.BACKEND_URL
  || process.env.NEXT_PUBLIC_API_BASE
  || process.env.NEXT_PUBLIC_BACKEND_URL
  || 'http://localhost:4000'
).replace(/\/$/, '');

export const metadata: Metadata = {
  title: 'Employers — VitalCV',
  description:
    'Live employer directory with trust signals, open roles, and launch-safe entry points for clinicians, employers, and demo reviewers.',
};

function hiringStatusLabel(value: string): string {
  switch (value) {
    case 'HIRING_NOW':
      return 'Hiring now';
    case 'ACTIVELY_HIRING':
      return 'Actively hiring';
    case 'ACCEPTING_APPLICATIONS':
      return 'Accepting applications';
    case 'NOT_HIRING':
      return 'Not hiring';
    default:
      return value.replace(/_/g, ' ').toLowerCase();
  }
}

async function fetchEmployers(): Promise<EmployerListPayload> {
  try {
    const response = await fetch(`${BACKEND}/api/employers?limit=12`, {
      cache: 'no-store',
    });
    if (!response.ok) {
      return { employers: [], total: 0 };
    }

    return await response.json() as EmployerListPayload;
  } catch {
    return { employers: [], total: 0 };
  }
}

async function fetchOpportunitySummary(): Promise<OpportunityListPayload> {
  try {
    const response = await fetch(`${BACKEND}/api/opportunities?limit=1`, {
      cache: 'no-store',
    });
    if (!response.ok) {
      return { total: 0 };
    }

    return await response.json() as OpportunityListPayload;
  } catch {
    return { total: 0 };
  }
}

function RoleEntryCard({
  icon,
  title,
  detail,
  href,
  action,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  href: string;
  action: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white/80">
        {icon}
      </div>
      <h2 className="mt-4 text-lg font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-white/60">{detail}</p>
      <Link
        href={href}
        className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-emerald-300 transition hover:text-emerald-200"
      >
        {action}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

export default async function EmployersPage() {
  const [employerPayload, opportunityPayload] = await Promise.all([
    fetchEmployers(),
    fetchOpportunitySummary(),
  ]);

  const employers = employerPayload.employers;
  const coveredStates = new Set(employers.flatMap((employer) => employer.states)).size;
  const openRoles = employers.reduce((sum, employer) => sum + employer.openRoles, 0);

  return (
    <div className="min-h-screen bg-ops-gradient text-white surface-operator">
      <section className="border-b border-white/10 px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300">
              Live Employer Directory
            </span>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white">
              Launch-safe entry point for hiring teams and clinician demos.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/65">
              This page uses the live employer and opportunity feeds. Counts here stay aligned with
              the marketplace truth so demos and pilot reviews do not overstate network activity.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Employers</p>
              <p className="mt-2 text-3xl font-semibold text-white">{employerPayload.total}</p>
              <p className="mt-2 text-sm text-white/55">Visible in the public launch directory.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Open Roles</p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {opportunityPayload.total > 0 ? opportunityPayload.total : openRoles}
              </p>
              <p className="mt-2 text-sm text-white/55">Live roles currently discoverable in explore/apply.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Coverage</p>
              <p className="mt-2 text-3xl font-semibold text-white">{coveredStates}</p>
              <p className="mt-2 text-sm text-white/55">States represented across the current employer set.</p>
            </div>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            <RoleEntryCard
              icon={<Stethoscope className="h-5 w-5" />}
              title="Clinician entry"
              detail="Resolve your profile, see current role fit, and apply from a verified workspace."
              href="/onboarding?returnTo=%2Fexplore"
              action="Start clinician onboarding"
            />
            <RoleEntryCard
              icon={<BriefcaseBusiness className="h-5 w-5" />}
              title="Employer entry"
              detail="Open the employer workspace to review applicants, actions, and launch-day queue state."
              href="/verifier/inbox"
              action="Open employer workspace"
            />
            <RoleEntryCard
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Verifier / demo reviewer"
              detail="Open the operator dashboard with route checks, counts, graph truth, and launch alerts."
              href="/intelligence?view=dashboard"
              action="Open launch dashboard"
            />
          </div>
        </div>
      </section>

      <section className="px-6 py-14">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Verified Employers</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Current launch cohort</h2>
            </div>
            <Link
              href="/explore"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/70 transition hover:text-white"
            >
              Browse live roles
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {employers.length === 0 ? (
            <div className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-6">
              <h3 className="text-lg font-semibold text-white">Employer directory is empty right now</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
                No verified employers were returned from the live directory. The next step is to
                confirm seeded launch employers finished bootstrapping before using this page for a demo.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              {employers.map((employer) => (
                <article
                  key={employer.id}
                  className="rounded-3xl border border-white/10 bg-white/[0.04] p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-semibold text-white">{employer.name}</h3>
                        {employer.verified ? (
                          <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
                            Verified
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm text-white/55">{employer.facilityType}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-white/45">Trust</p>
                      <p className="mt-1 text-lg font-semibold text-white">{employer.trustScore}</p>
                    </div>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-white/65">{employer.tagline}</p>

                  <div className="mt-5 flex flex-wrap gap-2 text-xs text-white/60">
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                      {hiringStatusLabel(employer.hiringStatus)}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                      {employer.openRoles} open role{employer.openRoles === 1 ? '' : 's'}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                      {employer.states.join(', ')}
                    </span>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {employer.specialties.slice(0, 4).map((specialty) => (
                      <span
                        key={specialty}
                        className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100"
                      >
                        {specialty}
                      </span>
                    ))}
                  </div>

                  {employer.trustIndicators.length > 0 ? (
                    <div className="mt-5 space-y-2">
                      {employer.trustIndicators.slice(0, 2).map((indicator) => (
                        <p key={indicator} className="text-sm text-white/60">
                          {indicator}
                        </p>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link
                      href={`/employers/${employer.slug}`}
                      className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-emerald-400"
                    >
                      View employer profile
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link
                      href="/explore"
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/70 transition hover:text-white"
                    >
                      Open live roles
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Launch note</p>
                <h3 className="mt-2 text-xl font-semibold text-white">Use this surface for real counts, not synthetic demo claims</h3>
                <p className="mt-3 text-sm leading-6 text-white/65">
                  Employer cards and counts are pulled from the live launch set. If a pilot reviewer needs
                  the broader operator truth, move directly into the intelligence dashboard from here.
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/70">
                <Users className="h-4 w-4" />
                Public directory + operator handoff
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
