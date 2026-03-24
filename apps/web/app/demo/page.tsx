import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, BriefcaseBusiness, ShieldCheck, Stethoscope, Telescope } from 'lucide-react';
import {
  fetchLaunchEmployers,
  fetchLaunchOpportunities,
} from '@/lib/launch/marketplace';

export const metadata: Metadata = {
  title: 'Demo — VitalCV',
  description: 'Launch-safe demo entry points using the current employer, opportunity, onboarding, and intelligence surfaces.',
};

function buildSignInHref(href: string): string {
  return `/sign-in?redirect_url=${encodeURIComponent(href)}`;
}

function DemoCard({
  eyebrow,
  title,
  detail,
  href,
  action,
  tone,
  children,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  href: string;
  action: string;
  tone: 'emerald' | 'cyan' | 'amber' | 'violet';
  children?: ReactNode;
}) {
  const toneClasses: Record<typeof tone, string> = {
    emerald: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
    cyan: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-100',
    amber: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
    violet: 'border-violet-400/20 bg-violet-400/10 text-violet-100',
  };

  return (
    <article className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
      <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${toneClasses[tone]}`}>
        {eyebrow}
      </span>
      <h2 className="mt-4 text-2xl font-semibold text-white">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-white/65">{detail}</p>
      {children ? (
        <div className="mt-5 space-y-2 text-sm text-white/60">
          {children}
        </div>
      ) : null}
      <Link
        href={href}
        className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-emerald-300 transition hover:text-emerald-200"
      >
        {action}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </article>
  );
}

export default async function DemoPage() {
  const [employersPayload, opportunitiesPayload] = await Promise.all([
    fetchLaunchEmployers(6),
    fetchLaunchOpportunities({ limit: 6 }),
  ]);

  const featuredEmployer = employersPayload.employers[0] ?? null;
  const featuredOpportunity = opportunitiesPayload.opportunities[0] ?? null;
  const clinicianHref = featuredOpportunity
    ? `/onboarding?returnTo=${encodeURIComponent(`/explore?apply=${featuredOpportunity.id}&organizationSlug=${featuredOpportunity.organizationSlug}`)}`
    : '/onboarding?returnTo=%2Fexplore';
  const employerHref = featuredEmployer ? `/employers/${featuredEmployer.slug}` : '/employers';
  const employerWorkspaceHref = buildSignInHref('/verifier/inbox');
  const investigationHref = buildSignInHref('/intelligence?view=investigations&npi=1902301456');
  const launchTruthHref = buildSignInHref('/intelligence?view=system-health');

  return (
    <div className="min-h-screen bg-ops-gradient px-6 py-14 text-white surface-operator">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-300">
            Launch Demo Environment
          </span>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white">
            Demo the current launch package inside a launch-safe environment.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/65">
            Every path on this page uses the same seeded employers, opportunities, investigation data,
            and operator telemetry that the product exposes elsewhere. Guest mode stays read-only and
            the employer/application loop stays on the current marketplace flow.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Employers</p>
            <p className="mt-2 text-3xl font-semibold text-white">{employersPayload.total}</p>
            <p className="mt-2 text-sm text-white/55">Visible in the public launch cohort.</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Launch Roles</p>
            <p className="mt-2 text-3xl font-semibold text-white">{opportunitiesPayload.total}</p>
            <p className="mt-2 text-sm text-white/55">Available through the current explore/apply loop.</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Investigation Case</p>
            <p className="mt-2 text-3xl font-semibold text-white">1902301456</p>
            <p className="mt-2 text-sm text-white/55">Seeded provider case for operator demo review.</p>
          </div>
        </div>

        <div className="mt-10 grid gap-5 xl:grid-cols-2">
          <DemoCard
            eyebrow="Clinician path"
            title="Guest onboarding into live role fit"
            detail="Use the three-step guest flow to resolve a real NPI, preview current fit, and land in `/explore` with the matching role scope already applied."
            href={clinicianHref}
            action="Open clinician demo"
            tone="emerald"
          >
            <p><Stethoscope className="mr-2 inline h-4 w-4" />Guest mode is read-only and does not claim persistence.</p>
            <p>{featuredOpportunity ? `Starts with ${featuredOpportunity.title} at ${featuredOpportunity.organizationName}.` : 'Falls back to the full live role board if no featured role is available.'}</p>
          </DemoCard>

          <DemoCard
            eyebrow="Employer path"
            title="Public employer review plus operator inbox"
            detail="Start from the public employer profile to show believable demand, then move into the employer queue where current application state is visible to the hiring team."
            href={employerHref}
            action="Open employer demo"
            tone="cyan"
          >
            <p><BriefcaseBusiness className="mr-2 inline h-4 w-4" />Public profile: {featuredEmployer ? featuredEmployer.name : 'Live employer directory'}.</p>
            <p>
              Operator inbox:{' '}
              <Link href={employerWorkspaceHref} className="text-cyan-200 transition hover:text-white">
                Demo unavailable — sign in to continue
              </Link>
            </p>
          </DemoCard>

          <DemoCard
            eyebrow="Investigation path"
            title="Seeded provider case for trust review"
            detail="Use a seeded investigation with seeded findings, storylines, graph context, and evidence inspection so the operator demo feels like an actual case review."
            href={investigationHref}
            action="Sign in for investigation demo"
            tone="amber"
          >
            <p><Telescope className="mr-2 inline h-4 w-4" />Anchored to the seeded provider case for NPI 1902301456.</p>
            <p>Demo unavailable — sign in to continue.</p>
          </DemoCard>

          <DemoCard
            eyebrow="Operator truth"
            title="Launch health and rollback confidence"
            detail="Show the current route checks, live counts, action/application health, and deployed frontend/backend markers before or after any demo run."
            href={launchTruthHref}
            action="Sign in for launch truth"
            tone="violet"
          >
            <p><ShieldCheck className="mr-2 inline h-4 w-4" />Use this view to confirm what is actually live.</p>
            <p>Demo unavailable — sign in to continue.</p>
          </DemoCard>
        </div>
      </div>
    </div>
  );
}
