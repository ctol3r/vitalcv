import PrequalifyTrigger from '@/components/prequalify/PrequalifyTrigger';
import { Clock, DollarSign, MapPin, ShieldCheck, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Explore Opportunities — VitalCV',
  description: 'Trust-native clinical opportunities matched to your verified credential state.',
};

const STUB_ROLES = [
  {
    id: 'r1',
    title: 'Locums Cardiologist',
    employerSlug: 'bay-area-cardiac-group',
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
    employerSlug: 'mindbridge-health',
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
    employerSlug: 'sacramento-medical-center',
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
                className="group rounded-3xl border border-vt-neutral-800 bg-vt-surface-ops-raised/30 p-7 hover:border-vt-info/30 hover:shadow-[0_4px_30px_rgba(99,102,241,0.08)] hover:-translate-y-1 transition-all duration-300 flex flex-col"
              >
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="heading-md text-white group-hover:text-vt-info transition-colors">{role.title}</h2>
                    <p className="body-sm mt-1 text-vt-neutral-200">{role.facility}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 tag font-semibold flex items-center gap-1.5 ${status.className}`}>
                    {status.label}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-y-3 gap-x-4 border-y border-vt-neutral-800/50 py-5 mb-5">
                  <div className="flex items-center gap-2 text-sm text-vt-neutral-200 col-span-2">
                    <MapPin className="h-4 w-4 shrink-0 text-vt-neutral-800" />
                    {role.location}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-vt-neutral-200">
                    <DollarSign className="h-4 w-4 shrink-0 text-vt-success" />
                    {role.pay}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-vt-neutral-200">
                    <Clock className="h-4 w-4 shrink-0 text-vt-neutral-800" />
                    {role.startWindow}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-vt-neutral-200 col-span-2 mt-1">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-vt-info" />
                    Requires L{role.requirementLevel.replace('L', '')} · {role.activity}
                  </div>
                </div>

                <div className="mt-auto flex gap-3">
                  <Link
                    href={`/opportunities/${role.id}`}
                    className="flex-1 rounded-2xl bg-vt-success px-5 py-3 text-center text-sm font-semibold text-black transition-all hover:bg-vt-success/90 hover:shadow-[0_0_15px_rgba(20,184,166,0.3)]"
                  >
                    Apply with VitalCV
                  </Link>
                  <Link
                    href={`/employers/${role.employerSlug}`}
                    className="rounded-2xl vt-glass border border-vt-neutral-800 px-5 py-3 text-sm font-medium text-vt-neutral-200 transition-all hover:text-white hover:border-vt-neutral-700"
                  >
                    Learn about employer
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
