import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { MapPin, DollarSign, Clock, ShieldCheck, ChevronRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Opportunity — VitalCV',
};

interface Props {
  params: Promise<{ id: string }>;
}

const STUB_OPPORTUNITIES: Record<string, {
  title: string; facility: string; location: string;
  pay: string; start: string; type: string;
  requirements: string[]; description: string;
}> = {
  r1: {
    title: 'Locums Cardiologist', facility: 'Bay Area Cardiac Group',
    location: 'San Francisco, CA', pay: '$350–$420/hr',
    start: 'As early as 2 weeks', type: 'Locums',
    requirements: ['Active CA Medical License (L3)', 'Board Certified Cardiology', 'DEA Active', 'Malpractice Insurance', 'NPI Verified'],
    description: 'Join our interventional cardiology team for locums coverage. Full case load, supportive staff, competitive compensation.',
  },
  r2: {
    title: 'Telehealth Psychiatrist', facility: 'MindBridge Health',
    location: 'Remote — CA licensed', pay: '$280–$320/hr',
    start: 'Flexible', type: 'Telehealth',
    requirements: ['Active CA Psychiatry License (L2+)', 'DEA Active Schedule IV', 'Malpractice Insurance'],
    description: 'See patients from anywhere. MindBridge operates a fully async + synchronous telehealth platform for outpatient psychiatry.',
  },
  r3: {
    title: 'ICU / Critical Care NP', facility: 'Sacramento Medical Center',
    location: 'Sacramento, CA', pay: '$120–$145/hr',
    start: 'Immediate', type: 'Perm',
    requirements: ['Active CA NP License (L3)', 'ACNP-BC or AGACNP-BC', 'BLS + ACLS + PALS', 'Malpractice Insurance'],
    description: 'Full-time critical care NP role in a 28-bed medical ICU. Collaborative practice model.',
  },
};

export default async function OpportunityDetailPage({ params }: Props) {
  const { id } = await params;
  const opp = STUB_OPPORTUNITIES[id];
  if (!opp) notFound();

  return (
    <div className="min-h-screen bg-ops-gradient text-white surface-operator">
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Breadcrumb
          items={[
            { label: 'Explore', href: '/explore' },
            { label: opp.title },
          ]}
          className="mb-6"
        />

        <header className="mb-8">
          <h1 className="heading-lg text-white">{opp.title}</h1>
          <p className="body-lg mt-1 text-vt-neutral-200">{opp.facility}</p>
        </header>

        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { icon: MapPin,       value: opp.location },
            { icon: DollarSign,   value: opp.pay },
            { icon: Clock,        value: opp.start },
            { icon: ShieldCheck,  value: opp.type },
          ].map(({ icon: Icon, value }) => (
            <div key={value} className="flex items-center gap-2 rounded-xl border border-vt-neutral-800 bg-vt-surface-ops-raised/40 px-4 py-3">
              <Icon className="h-4 w-4 shrink-0 text-vt-neutral-800" />
              <span className="body-sm text-vt-neutral-200">{value}</span>
            </div>
          ))}
        </div>

        <section className="mb-8 rounded-2xl border border-vt-neutral-800 bg-vt-surface-ops-raised/40 p-6">
          <h2 className="heading-sm mb-3 text-vt-neutral-100">What This Employer Requires From You</h2>
          <ul className="space-y-2">
            {opp.requirements.map((r) => (
              <li key={r} className="flex items-center gap-2 body-sm text-vt-neutral-200">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-vt-success" />
                {r}
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-8 rounded-2xl border border-vt-neutral-800 bg-vt-surface-ops-raised/40 p-6">
          <h2 className="heading-sm mb-3 text-vt-neutral-100">About This Role</h2>
          <p className="body text-vt-neutral-200">{opp.description}</p>
        </section>

        <div className="flex gap-3">
          <Link
            href="/get-ready"
            className="flex-1 rounded-xl bg-vt-success px-6 py-3.5 text-center text-sm font-semibold text-black hover:bg-vt-success/90 transition"
          >
            Apply with VitalCV <ChevronRight className="inline h-4 w-4" />
          </Link>
          <Link
            href={`/employers/stub`}
            className="rounded-xl vt-glass px-6 py-3.5 text-sm font-medium text-vt-neutral-200 hover:text-white transition"
          >
            Learn about employer
          </Link>
        </div>
      </main>
    </div>
  );
}
