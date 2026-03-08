import type { Metadata } from 'next';
import Link from 'next/link';
import NextBestAction from '@/components/workspace/NextBestAction';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { ShieldCheck, Compass, Share2, Users } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Your Workspace — VitalCV',
  description: 'Your clinician credential workspace.',
};

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

const NEXT_BEST_ACTIONS = [
  {
    title: 'Complete your NPI bootstrap',
    description: 'Verify your NPI to activate trust-native matching.',
    href: '/get-ready',
    priority: 'high' as const,
  },
  {
    title: 'Upload your state license',
    description: 'Get L2 verification and unlock more opportunities.',
    href: '/holder/readiness',
    priority: 'medium' as const,
  },
  {
    title: 'Explore open opportunities',
    description: '3 roles match your current credential level.',
    href: '/explore',
    priority: 'low' as const,
  },
];

export default function HolderHomePage() {
  return (
    <div className="min-h-screen bg-ops-gradient text-white surface-operator">
      <main className="mx-auto max-w-5xl px-6 py-10">

        <Breadcrumb
          items={[{ label: 'Home', href: '/' }, { label: 'My Workspace' }]}
          className="mb-6"
        />

        <header className="mb-8">
          <h1 className="heading-lg text-white">Welcome back.</h1>
          <p className="body mt-1 text-vt-neutral-200">
            Your clinician credential workspace.
          </p>
        </header>

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
            <NextBestAction actions={NEXT_BEST_ACTIONS} heading="Next Best Action" />

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
