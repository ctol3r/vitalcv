import type { Metadata } from 'next';
import Link from 'next/link';
import EmptyState from '@/components/ui/EmptyState';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { Users } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Referrals — VitalCV',
  description: 'Refer colleagues and earn rewards for growing the trust network.',
};

export default function HolderReferralsPage() {
  return (
    <div className="min-h-screen bg-ops-gradient text-white surface-operator">
      <main className="mx-auto max-w-4xl px-6 py-10">
        <Breadcrumb
          items={[{ label: 'Workspace', href: '/holder/home' }, { label: 'Referrals' }]}
          className="mb-6"
        />
        <header className="mb-8">
          <h1 className="heading-lg text-white">Refer Colleagues, Earn Rewards</h1>
          <p className="body mt-1 text-vt-neutral-200">
            Share VitalCV with colleagues. Earn credits when they complete onboarding and get hired.
          </p>
        </header>

        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Referred', value: '—' },
            { label: 'Active', value: '—' },
            { label: 'Earnings', value: '$0' },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-vt-neutral-800 bg-vt-surface-ops-raised/40 p-4 text-center">
              <p className="heading-lg text-vt-neutral-100">{value}</p>
              <p className="label mt-1 text-vt-neutral-800">{label}</p>
            </div>
          ))}
        </div>

        <EmptyState
          icon={<Users className="h-10 w-10" />}
          title="No referrals yet"
          description="Share your referral link with colleagues to start earning rewards when they complete onboarding and get placed."
          cta={{ label: 'Get Referral Link', href: '/get-ready' }}
        />
      </main>
    </div>
  );
}
