import type { Metadata } from 'next';
import Link from 'next/link';
import { Building2, MapPin, Users, ShieldCheck, ChevronRight, Zap } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Employer Directory — VitalCV',
  description: 'Verified employers and organizations hiring credentialed clinicians through VitalCV.',
};

const STUB_EMPLOYERS = [
  {
    slug: 'bay-area-cardiac-group',
    name: 'Bay Area Cardiac Group',
    facilityType: 'Specialty Practice',
    specialties: ['Cardiology', 'Electrophysiology'],
    states: ['CA'],
    openRoles: 4,
    hiringStatus: 'HIRING_NOW' as const,
    timeToStart: '2–3 weeks',
    trustScore: 94,
  },
  {
    slug: 'mindbridge-health',
    name: 'MindBridge Health',
    facilityType: 'Telehealth Platform',
    specialties: ['Psychiatry', 'Psychology', 'Behavioral Health'],
    states: ['CA', 'TX', 'FL', 'NY'],
    openRoles: 12,
    hiringStatus: 'HIRING_NOW' as const,
    timeToStart: 'Flexible',
    trustScore: 91,
  },
  {
    slug: 'sacramento-medical-center',
    name: 'Sacramento Medical Center',
    facilityType: 'Hospital System',
    specialties: ['Critical Care', 'Emergency Medicine', 'Internal Medicine'],
    states: ['CA'],
    openRoles: 7,
    hiringStatus: 'HIRING_NOW' as const,
    timeToStart: 'Immediate',
    trustScore: 88,
  },
];

export default function EmployersPage() {
  return (
    <div className="min-h-screen bg-ops-gradient text-white surface-operator">

      {/* Hero */}
      <section className="border-b border-vt-neutral-800 px-6 py-16 text-center">
        <h1 className="heading-xl text-white">
          Work with<br />
          <span className="text-vt-info">Trusted Employers.</span>
        </h1>
        <p className="body-lg mx-auto mt-4 max-w-xl text-vt-neutral-200">
          Every employer on VitalCV has published their credential requirements.
          Know exactly what's needed before you start.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/explore"
            className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[oklch(0.22_0.01_60)] hover:bg-white/90 transition"
          >
            Explore Roles <ChevronRight className="h-4 w-4" />
          </Link>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 rounded-full vt-glass px-6 py-3 text-sm font-medium text-white hover:bg-vt-surface-ops-raised transition"
          >
            List Your Organization
          </Link>
        </div>
      </section>

      {/* Employer grid */}
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <p className="label text-vt-neutral-800">{STUB_EMPLOYERS.length} verified employers</p>
          <button className="rounded-full vt-glass px-4 py-1.5 text-xs font-medium text-vt-neutral-200 hover:text-white transition">
            Compare employers
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {STUB_EMPLOYERS.map((emp) => (
            <article
              key={emp.slug}
              className="rounded-2xl border border-vt-neutral-800 bg-vt-surface-ops-raised/40 p-6 hover:border-vt-neutral-700 transition-colors"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="heading-sm text-white">{emp.name}</h2>
                  <p className="body-sm mt-0.5 text-vt-neutral-200">{emp.facilityType}</p>
                </div>
                <span className="rounded-full bg-vt-success/15 px-2.5 py-1 tag text-vt-success ring-1 ring-vt-success/30">
                  Hiring Now
                </span>
              </div>

              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2 text-vt-neutral-200">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-vt-neutral-800" />
                  {emp.states.join(', ')}
                </li>
                <li className="flex items-center gap-2 text-vt-neutral-200">
                  <Users className="h-3.5 w-3.5 shrink-0 text-vt-info" />
                  {emp.openRoles} open roles
                </li>
                <li className="flex items-center gap-2 text-vt-neutral-200">
                  <Zap className="h-3.5 w-3.5 shrink-0 text-vt-warning" />
                  Start in {emp.timeToStart}
                </li>
                <li className="flex items-center gap-2 text-vt-neutral-200">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-vt-success" />
                  Trust score {emp.trustScore}/100
                </li>
              </ul>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {emp.specialties.map((s) => (
                  <span key={s} className="rounded-full bg-vt-surface-ops-base px-2.5 py-1 tag text-vt-neutral-200 ring-1 ring-vt-neutral-800">
                    {s}
                  </span>
                ))}
              </div>

              <div className="mt-5 flex gap-2">
                <Link
                  href={`/employers/${emp.slug}`}
                  className="flex-1 rounded-xl bg-vt-info/10 px-4 py-2.5 text-center text-sm font-semibold text-vt-info ring-1 ring-vt-info/30 hover:bg-vt-info/20 transition"
                >
                  View Profile
                </Link>
                <Link
                  href="/explore"
                  className="rounded-xl vt-glass px-4 py-2.5 text-sm font-medium text-vt-neutral-200 hover:text-white transition"
                >
                  Roles
                </Link>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
