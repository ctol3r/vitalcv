import type { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import NextBestAction from '@/components/workspace/NextBestAction';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { AlertTriangle, Compass, Share2, ShieldCheck, Users } from 'lucide-react';
import { ApplyWidgetSection } from '@/components/apply/ApplyWidgetSection'; // Wave 246

export const metadata: Metadata = {
  title: 'Your Workspace — VitalCV',
  description: 'Your clinician credential workspace.',
};

type WorkspaceResponse = {
  personProfile?: {
    npi?: string | null;
    firstName?: string | null;
  } | null;
};

type TrustStateResponse = {
  readiness_level: 'L0' | 'L1' | 'L2' | 'L3';
  readiness_score: number;
  readiness_status: string;
  gap_summary: string[];
};

const BACKEND =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

function buildForwardHeaders(session: Awaited<ReturnType<typeof auth>>): Headers {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  headers.set('x-clerk-user-id', session.userId ?? '');

  const emailClaim = (session.sessionClaims as Record<string, unknown> | undefined)?.email;
  if (typeof emailClaim === 'string' && emailClaim.length > 0) {
    headers.set('x-clerk-user-email', emailClaim);
  }

  return headers;
}

async function fetchWorkspace(session: Awaited<ReturnType<typeof auth>>): Promise<WorkspaceResponse> {
  const response = await fetch(`${BACKEND}/api/me/workspaces`, {
    headers: buildForwardHeaders(session),
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    throw new Error(`workspace_lookup_failed:${response.status}`);
  }

  return response.json() as Promise<WorkspaceResponse>;
}

async function fetchTrustState(npi: string): Promise<TrustStateResponse | null> {
  try {
    const response = await fetch(`${BACKEND}/api/trust-state/${encodeURIComponent(npi)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      return null;
    }

    return response.json() as Promise<TrustStateResponse>;
  } catch {
    return null;
  }
}

const QUICK_ACTIONS = [
  {
    icon: ShieldCheck,
    label: 'View Readiness',
    description: 'See your credential state and what\'s missing.',
    href: '/holder/readiness',
    color: 'text-vt-success bg-vt-success/10 ring-vt-success/20',
  },
  {
    icon: Compass,
    label: 'Explore Opportunities',
    description: 'Browse roles matched to your trust level.',
    href: '/holder/opportunities',
    color: 'text-vt-info bg-vt-info/10 ring-vt-info/20',
  },
  {
    icon: Share2,
    label: 'Share Your Passport',
    description: 'Send your verified credential link to employers.',
    href: '/holder/share',
    color: 'text-vt-warning bg-vt-warning/10 ring-vt-warning/20',
  },
  {
    icon: Users,
    label: 'Refer Colleagues',
    description: 'Earn rewards by growing the trust network.',
    href: '/holder/referrals',
    color: 'text-vt-neutral-200 bg-vt-surface-ops-raised/40 ring-vt-neutral-800',
  },
];

export default async function HolderHomePage() {
  const session = await auth();
  if (!session.userId) {
    redirect('/sign-in?redirect_url=/holder/home');
  }

  const workspace = await fetchWorkspace(session);
  const firstName = workspace.personProfile?.firstName?.trim() ?? null;
  const npi = workspace.personProfile?.npi?.trim() ?? null;
  const trustState = npi ? await fetchTrustState(npi) : null;
  const gaps = trustState?.gap_summary ?? [];

  const nextBestActions = !npi
    ? [
        {
          title: 'Complete your NPI bootstrap',
          description: 'Verify your clinician identity to activate your marketplace profile.',
          href: '/onboarding',
          priority: 'high' as const,
        },
        {
          title: 'Explore opportunities',
          description: 'Review open roles while you finish onboarding.',
          href: '/explore',
          priority: 'low' as const,
        },
      ]
    : [
        {
          title: gaps[0] ? 'Close your top credential gap' : 'Readiness is live',
          description: gaps[0] ?? 'Your readiness score is already available on your dashboard.',
          href: '/holder/readiness',
          priority: 'high' as const,
        },
        {
          title: 'Explore open opportunities',
          description: 'Use your live readiness score when you apply.',
          href: '/explore',
          priority: 'medium' as const,
        },
        {
          title: 'Share your trust passport',
          description: 'Send a verified profile to employers and verifiers.',
          href: '/holder/share',
          priority: 'low' as const,
        },
      ];

  return (
    <div className="min-h-screen bg-ops-gradient text-white surface-operator">
      <main className="mx-auto max-w-5xl px-6 py-10">

        <Breadcrumb
          items={[{ label: 'Home', href: '/' }, { label: 'My Workspace' }]}
          className="mb-6"
        />

        <header className="mb-8">
          <h1 className="heading-lg text-white">
            {firstName ? `Welcome back, ${firstName}.` : 'Welcome back.'}
          </h1>
          <p className="body mt-1 text-vt-neutral-200">
            Your clinician credential workspace and live marketplace readiness.
          </p>
        </header>

        <section className="mb-8 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-vt-neutral-800 bg-vt-surface-ops-raised/50 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-vt-neutral-800">Readiness</p>
                <h2 className="mt-2 text-3xl font-semibold text-white">
                  {trustState ? `${trustState.readiness_score}/100` : 'Not activated yet'}
                </h2>
                <p className="mt-2 text-sm text-vt-neutral-200">
                  {trustState
                    ? trustState.readiness_status
                    : 'Finish onboarding to unlock readiness-based applications and credential visibility.'}
                </p>
              </div>
              <div className="rounded-full border border-vt-success/20 bg-vt-success/10 px-4 py-2 text-sm font-semibold text-vt-success">
                {trustState?.readiness_level ?? 'Setup'}
              </div>
            </div>
            <div className="mt-6 h-3 overflow-hidden rounded-full bg-vt-surface-ops-base">
              <div
                className="h-full rounded-full bg-vt-success transition-all"
                style={{ width: `${Math.max(8, trustState?.readiness_score ?? 12)}%` }}
              />
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={npi ? '/holder/readiness' : '/onboarding'}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-zinc-200"
              >
                {npi ? 'Open readiness' : 'Finish onboarding'}
              </Link>
              <Link
                href="/explore"
                className="inline-flex items-center gap-2 rounded-full border border-vt-neutral-800 px-5 py-2.5 text-sm font-semibold text-vt-neutral-200 transition hover:border-vt-neutral-700 hover:text-white"
              >
                Explore roles
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-vt-neutral-800 bg-vt-surface-ops-raised/40 p-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-vt-warning" />
              <p className="heading-sm text-white">Missing credentials</p>
            </div>
            {gaps.length > 0 ? (
              <ul className="mt-4 space-y-3 text-sm text-vt-neutral-200">
                {gaps.slice(0, 3).map((gap) => (
                  <li key={gap} className="rounded-2xl border border-vt-neutral-800 bg-vt-surface-ops-base px-4 py-3">
                    {gap}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-vt-neutral-200">
                {npi
                  ? 'No blocking gaps surfaced in the latest readiness snapshot.'
                  : 'You will see credential gaps here once your NPI is activated.'}
              </p>
            )}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">

          {/* Quick actions (2/3 width) */}
          <div className="lg:col-span-2">
            <h2 className="heading-sm mb-4 text-vt-neutral-200">Quick Actions</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {QUICK_ACTIONS.map(({ icon: Icon, label, description, href, color }) => (
                <Link
                  key={href}
                  href={href}
                  className="group rounded-2xl border border-vt-neutral-800 bg-vt-surface-ops-raised/40 p-5 hover:border-vt-neutral-700 transition-colors"
                >
                  <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${color}`}>
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <p className="heading-sm text-white">{label}</p>
                  <p className="body-sm mt-1 text-vt-neutral-200">{description}</p>
                </Link>
              ))}
            </div>
          </div>

          {/* Next Best Action (1/3 width) */}
          <div>
            <NextBestAction actions={nextBestActions} heading="Next Best Action" />

            {/* Wave 246: Apply with VitalCV */}
            <div className="mt-4">
              <ApplyWidgetSection npi={npi} />
            </div>

            {/* Workspace switcher hint */}
            <div className="mt-4 rounded-xl border border-vt-neutral-800 bg-vt-surface-ops-base p-4">
              <p className="label mb-1 text-vt-neutral-800">Also an employer?</p>
              <p className="body-sm text-vt-neutral-200 mb-3">Switch to your verifier workspace without re-logging in.</p>
              <Link href="/workspace/switch" className="tag text-vt-info hover:underline">
                Switch workspace →
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
