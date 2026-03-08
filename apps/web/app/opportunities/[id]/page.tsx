import Breadcrumb from '@/components/ui/Breadcrumb';
import { Building2, ChevronRight, Clock, DollarSign, MapPin, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Opportunity — VitalCV',
};

interface Props {
  params: Promise<{ id: string }>;
}

const STUB_OPPORTUNITIES: Record<string, {
  title: string; facility: string; location: string;
  pay: string; start: string; type: string;
  requirements: { label: string; level: string }[];
  description: string; employerSlug: string;
}> = {
  r1: {
    title: 'Locums Cardiologist', facility: 'Bay Area Cardiac Group',
    location: 'San Francisco, CA', pay: '$350–$420/hr',
    start: 'As early as 2 weeks', type: 'Locums',
    requirements: [
      { label: 'Active CA Medical License', level: 'L3' },
      { label: 'Board Certified Cardiology', level: 'L3' },
      { label: 'DEA Active', level: 'L2' },
      { label: 'Malpractice Insurance', level: 'L2' },
      { label: 'NPI Verified', level: 'L3' }
    ],
    description: 'Join our interventional cardiology team for locums coverage. Full case load, supportive staff, competitive compensation.',
    employerSlug: 'bay-area-cardiac-group',
  },
  r2: {
    title: 'Telehealth Psychiatrist', facility: 'MindBridge Health',
    location: 'Remote — CA licensed', pay: '$280–$320/hr',
    start: 'Flexible', type: 'Telehealth',
    requirements: [
      { label: 'Active CA Psychiatry License', level: 'L2+' },
      { label: 'DEA Active Schedule IV', level: 'L2' },
      { label: 'Malpractice Insurance', level: 'L2' }
    ],
    description: 'See patients from anywhere. MindBridge operates a fully async + synchronous telehealth platform for outpatient psychiatry.',
    employerSlug: 'mindbridge-health',
  },
  r3: {
    title: 'ICU / Critical Care NP', facility: 'Sacramento Medical Center',
    location: 'Sacramento, CA', pay: '$120–$145/hr',
    start: 'Immediate', type: 'Perm',
    requirements: [
      { label: 'Active CA NP License', level: 'L3' },
      { label: 'ACNP-BC or AGACNP-BC', level: 'L3' },
      { label: 'BLS + ACLS + PALS', level: 'L3' },
      { label: 'Malpractice Insurance', level: 'L2' }
    ],
    description: 'Full-time critical care NP role in a 28-bed medical ICU. Collaborative practice model.',
    employerSlug: 'sacramento-medical-center',
  },
};

function LevelBadge({ level }: { level: string }) {
  const color =
    level.startsWith('L3') ? 'bg-vt-success/15 text-vt-success ring-vt-success/30' :
    level.startsWith('L2') ? 'bg-vt-info/15    text-vt-info    ring-vt-info/30'    :
                             'bg-vt-neutral-800/20 text-vt-neutral-200 ring-vt-neutral-700';
  return (
    <span className={`rounded-full px-2 py-0.5 tag ring-1 ${color}`}>{level}</span>
  );
}

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

        <section className="mb-8 rounded-3xl border border-vt-neutral-800 bg-vt-surface-ops-raised/30 p-8 shadow-[0_4px_30px_rgba(0,0,0,0.1)]">
          <h2 className="heading-sm mb-4 text-vt-neutral-100">What This Employer Requires From You</h2>
          <ul className="space-y-3">
            {opp.requirements.map((r) => (
              <li key={r.label} className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 p-3 rounded-2xl bg-vt-surface-ops-base border border-vt-neutral-800/60">
                <div className="flex items-center gap-3">
                  <div className="flex shrink-0 h-8 w-8 items-center justify-center rounded-xl bg-vt-success/10 text-vt-success ring-1 ring-vt-success/20">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <span className="body-sm font-medium text-white">{r.label}</span>
                </div>
                <LevelBadge level={r.level} />
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-8 rounded-3xl border border-vt-neutral-800 bg-vt-surface-ops-raised/30 p-8 shadow-[0_4px_30px_rgba(0,0,0,0.1)]">
          <h2 className="heading-sm mb-4 text-vt-neutral-100">About This Role</h2>
          <p className="body text-vt-neutral-200 leading-relaxed">{opp.description}</p>
        </section>

        <section className="mb-8 rounded-3xl border border-vt-info/20 bg-vt-surface-ops-raised/40 p-8 shadow-[inset_0_2px_10px_rgba(99,102,241,0.05)] relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Building2 className="w-32 h-32" />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
            <div className="max-w-md">
              <h3 className="heading-md text-white mb-2">Ask about this employer</h3>
              <p className="body-sm text-vt-neutral-200">
                AI can answer your questions about {opp.facility}'s typical onboarding time, requirements, or process directly from our index.
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full md:w-auto shrink-0">
              <Link
                href={`/ask?q=${encodeURIComponent(`What does ${opp.facility} require to start?`)}`}
                className="rounded-xl border border-vt-neutral-800 bg-vt-surface-ops-base px-5 py-3 text-sm text-vt-neutral-200 hover:border-vt-info/50 hover:text-white transition-all shadow-sm"
              >
                "Requirements to start?" →
              </Link>
              <Link
                href={`/ask?q=${encodeURIComponent(`How fast can I start at ${opp.facility}?`)}`}
                className="rounded-xl border border-vt-neutral-800 bg-vt-surface-ops-base px-5 py-3 text-sm text-vt-neutral-200 hover:border-vt-info/50 hover:text-white transition-all shadow-sm"
              >
                "How fast can I start?" →
              </Link>
            </div>
          </div>
        </section>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/get-ready"
            className="flex-1 rounded-2xl bg-vt-success px-6 py-4 flex items-center justify-center gap-2 text-sm font-semibold text-black hover:bg-vt-success/90 hover:shadow-[0_0_20px_rgba(20,184,166,0.3)] transition-all"
          >
            Apply with VitalCV <ChevronRight className="h-4 w-4" />
          </Link>
          <Link
            href={`/employers/${opp.employerSlug}`}
            className="flex-1 rounded-2xl vt-glass border border-vt-neutral-800 px-6 py-4 text-center text-sm font-medium text-white hover:bg-vt-surface-ops-raised transition-all"
          >
            Learn about employer
          </Link>
        </div>
      </main>
    </div>
  );
}
