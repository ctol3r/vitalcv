import PrequalifyTrigger from '@/components/prequalify/PrequalifyTrigger';
import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin, Clock, DollarSign, ShieldCheck, ChevronRight, Sparkles } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Explore Opportunities — VitalCV',
  description: 'Trust-native clinical opportunities matched to your verified credential state.',
};

const STUB_ROLES = [
  {
    id: 'r1',
    title: 'Locums Cardiologist',
    facility: 'Bay Area Cardiac Group',
    location: 'San Francisco, CA',
    pay: '$350–$420/hr',
    startWindow: 'As early as 2 weeks',
    activity: '3 hired this month',
    requirementLevel: 'L3',
    status: 'CLEAR' as const,
  },
  {
    id: 'r2',
    title: 'Telehealth Psychiatrist',
    facility: 'MindBridge Health',
    location: 'Remote — CA licensed',
    pay: '$280–$320/hr',
    startWindow: 'Flexible',
    activity: '8 hired this month',
    requirementLevel: 'L2',
    status: 'NEAR_CLEAR' as const,
  },
  {
    id: 'r3',
    title: 'ICU / Critical Care NP',
    facility: 'Sacramento Medical Center',
    location: 'Sacramento, CA',
    pay: '$120–$145/hr',
    startWindow: 'Immediate',
    activity: '1 hired this month',
    requirementLevel: 'L3',
    status: 'GET_READY' as const,
  },
];

const STATUS_CONFIG = {
  CLEAR:      { label: 'Clear to Start', className: 'bg-vt-success/15 text-vt-success ring-1 ring-vt-success/30' },
  NEAR_CLEAR: { label: 'Almost Ready',   className: 'bg-vt-warning/15 text-vt-warning ring-1 ring-vt-warning/30' },
  GET_READY:  { label: 'Get Ready',      className: 'bg-vt-neutral-800/30 text-vt-neutral-200 ring-1 ring-vt-neutral-700' },
};

export default function ExplorePage() {
  return (
    <div className="min-h-screen bg-ops-gradient text-white surface-operator">

      {/* Hero */}
      <section className="border-b border-vt-neutral-800 px-6 py-16 text-center">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-vt-success/10 px-4 py-1.5 tag text-vt-success ring-1 ring-vt-success/20">
          <Sparkles className="h-3 w-3" />
          Trust-Native Matching
        </span>
        <h1 className="heading-xl mt-3 text-white">
          Find Your Next<br />
          <span className="text-vt-success">Clinical Role.</span>
        </h1>
        <p className="body-lg mx-auto mt-4 max-w-xl text-vt-neutral-200">
          Opportunities matched to your verified credential state — not just your resume.
          Know exactly what's blocking you before you apply.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <PrequalifyTrigger label="Get Prequalified" className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-[oklch(0.22_0.01_60)] hover:bg-white/90" />
          <Link
            href="/search"
            className="inline-flex items-center gap-2 rounded-full vt-glass px-6 py-3 text-sm font-medium text-white transition hover:bg-vt-surface-ops-raised"
          >
            Search by specialty
          </Link>
        </div>
      </section>

      {/* Filters row */}
      <section className="border-b border-vt-neutral-800 bg-vt-surface-ops-raised/30 px-6 py-4">
        <div className="mx-auto flex max-w-7xl flex-wrap gap-2">
          {['All Specialties', 'Remote', 'Locums', 'Perm', 'ICU / Critical Care', 'Psychiatry', 'Cardiology', 'Primary Care'].map((f) => (
            <button
              key={f}
              className="rounded-full vt-glass px-4 py-1.5 text-xs font-medium text-vt-neutral-200 hover:bg-vt-surface-ops-raised hover:text-white transition"
            >
              {f}
            </button>
          ))}
        </div>
      </section>

      {/* Role cards */}
      <main className="mx-auto max-w-7xl px-6 py-10">
        <p className="label mb-6 text-vt-neutral-800">Showing {STUB_ROLES.length} opportunities · AI-powered matching coming soon</p>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {STUB_ROLES.map((role) => {
            const status = STATUS_CONFIG[role.status];
            return (
              <article
                key={role.id}
                className="rounded-2xl border border-vt-neutral-800 bg-vt-surface-ops-raised/40 p-6 hover:border-vt-neutral-700 transition-colors"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="heading-sm text-white">{role.title}</h2>
                    <p className="body-sm mt-0.5 text-vt-neutral-200">{role.facility}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 tag ${status.className}`}>
                    {status.label}
                  </span>
                </div>

                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2 text-vt-neutral-200">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-vt-neutral-800" />
                    {role.location}
                  </li>
                  <li className="flex items-center gap-2 text-vt-neutral-200">
                    <DollarSign className="h-3.5 w-3.5 shrink-0 text-vt-success" />
                    {role.pay}
                  </li>
                  <li className="flex items-center gap-2 text-vt-neutral-200">
                    <Clock className="h-3.5 w-3.5 shrink-0 text-vt-neutral-800" />
                    {role.startWindow}
                  </li>
                  <li className="flex items-center gap-2 text-vt-neutral-200">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-vt-info" />
                    Requires L{role.requirementLevel.replace('L', '')} · {role.activity}
                  </li>
                </ul>

                <div className="mt-5 flex gap-2">
                  <Link
                    href={`/opportunities/${role.id}`}
                    className="flex-1 rounded-xl bg-vt-success px-4 py-2.5 text-center text-sm font-semibold text-black transition hover:bg-vt-success/90"
                  >
                    Apply with VitalCV
                  </Link>
                  <Link
                    href="/employers"
                    className="rounded-xl vt-glass px-4 py-2.5 text-sm font-medium text-vt-neutral-200 transition hover:text-white"
                  >
                    Employer
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        {/* Coming soon block */}
        <div className="mt-12 rounded-2xl border border-vt-success/20 bg-vt-success/5 p-8 text-center">
          <Sparkles className="mx-auto mb-3 h-6 w-6 text-vt-success" />
          <h3 className="heading-md text-white">AI-Powered Matching Coming Soon</h3>
          <p className="body-sm mx-auto mt-2 max-w-md text-vt-neutral-200">
            Get prequalified and VitalCV will automatically surface roles you're already cleared for —
            no applications, just instant offers.
          </p>
          <PrequalifyTrigger label="Get Prequalified Free" className="mt-5" />
        </div>
      </main>
    </div>
  );
}
