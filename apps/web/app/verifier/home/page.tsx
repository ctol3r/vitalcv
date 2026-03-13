import type { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import NextBestAction from '@/components/workspace/NextBestAction';
import Breadcrumb from '@/components/ui/Breadcrumb';
import CapacityPanel from '@/components/capacity/CapacityPanel';
import RecentDecisionsPanel from '@/components/decisions/RecentDecisionsPanel';
import { Users, Briefcase, Building2, PlusCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Employer Dashboard — VitalCV',
  description: 'Your verifier workspace for hiring credentialed clinicians.',
};

const QUICK_ACTIONS = [
  {
    icon: Users,
    label: 'View Candidates',
    description: 'Browse prequalified clinicians ready to start.',
    href: '/verifier/candidates',
    color: 'text-vt-success bg-vt-success/10 ring-vt-success/20',
  },
  {
    icon: PlusCircle,
    label: 'Post Opportunity',
    description: 'Publish a new role with trust requirements.',
    href: '/verifier/opportunities',
    color: 'text-vt-info bg-vt-info/10 ring-vt-info/20',
  },
  {
    icon: Building2,
    label: 'Organization Profile',
    description: 'Update your employer profile and requirements.',
    href: '/verifier/company',
    color: 'text-vt-warning bg-vt-warning/10 ring-vt-warning/20',
  },
  {
    icon: Briefcase,
    label: 'Review Applications',
    description: 'Review and action pending candidate submissions.',
    href: '/verifier/candidates',
    color: 'text-vt-neutral-200 bg-vt-surface-ops-raised/40 ring-vt-neutral-800',
  },
];

const NEXT_BEST = [
  {
    title: 'Publish your first opportunity',
    description: 'Set trust requirements and start receiving prequalified candidates.',
    href: '/verifier/opportunities',
    priority: 'high' as const,
  },
  {
    title: 'Complete your organization profile',
    description: 'Clinicians research employers before applying — make yours compelling.',
    href: '/verifier/company',
    priority: 'medium' as const,
  },
];

export default async function VerifierHomePage() {
  // Attempt to read org from Clerk session (best-effort; panel handles missing org gracefully)
  const session = await auth();
  // orgId may be available via session claims; fall back to empty string to render panel in loading state
  const orgId = (session as { orgId?: string }).orgId ?? '';

  return (
    <div className="min-h-screen bg-ops-gradient text-white surface-operator">
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Breadcrumb
          items={[{ label: 'Home', href: '/' }, { label: 'Employer Dashboard' }]}
          className="mb-6"
        />
        <header className="mb-8">
          <h1 className="heading-lg text-white">Employer Dashboard</h1>
          <p className="body mt-1 text-vt-neutral-200">Hire faster with verified clinicians.</p>
        </header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-8">
            <div>
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

            {/* Wave 244: Decision Capsule Timeline */}
            <RecentDecisionsPanel heading="Recent Decisions" limit={5} />
          </div>
          <div className="space-y-6">
            {orgId && <CapacityPanel organizationId={orgId} />}
            <NextBestAction actions={NEXT_BEST} heading="Next Best Action" />
          </div>
        </div>
      </main>
    </div>
  );
}
