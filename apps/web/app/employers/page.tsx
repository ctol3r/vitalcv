/**
 * Wave 186 — Employer Knowledge Layer
 * /employers — Employer directory with compare mode and filters
 */
import { Building2, MapPin, ShieldCheck, Users, Zap } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

// Temporary stub data for employers
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

export const metadata: Metadata = {
  title: 'Employer Directory — VitalCV',
  description:
    'Explore verified employers and organizations hiring credentialed clinicians through VitalCV. See requirements, pay ranges, and trust scores.',
};

export default function EmployersPage() {
  return (
    <div className="min-h-screen bg-ops-gradient text-white surface-operator">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        <div className="mb-2">
          <nav className="flex items-center gap-2 text-xs text-white/40">
            <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
            <span>/</span>
            <span className="text-white/60">Employers</span>
          </nav>
        </div>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="heading-xl font-bold text-white">Employer Directory</h1>
            <p className="body text-white/60 mt-2 max-w-2xl">
              Every employer is verified against the VitalCV Trust Registry. See credential
              requirements, pay transparency, trust scores, and typical time-to-clear before you
              apply.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/explore"
              className="px-4 py-2 rounded-lg border border-white/20 text-sm text-white/70 hover:text-white hover:border-white/40 transition-all"
            >
              Browse Opportunities
            </Link>
            <Link
              href="/get-ready"
              className="px-4 py-2 rounded-lg bg-blue-600 text-sm text-white font-medium hover:bg-blue-500 transition-colors"
            >
              Check My Readiness
            </Link>
          </div>
        </div>
      </div>

      {/* Client-side directory with filters + compare */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {STUB_EMPLOYERS.map((emp) => (
            <article
              key={emp.slug}
              className="group rounded-3xl border border-vt-neutral-800 bg-vt-surface-ops-raised/30 p-8 hover:border-vt-info/30 hover:shadow-[0_4px_30px_rgba(99,102,241,0.08)] hover:-translate-y-1 transition-all duration-300 flex flex-col"
            >
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h2 className="heading-md text-white group-hover:text-vt-info transition-colors">{emp.name}</h2>
                  <p className="body-sm mt-1 text-vt-neutral-200 flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-vt-neutral-800" />
                    {emp.facilityType}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="rounded-full bg-vt-success/15 px-3 py-1 tag text-vt-success ring-1 ring-vt-success/30 font-semibold tracking-wide flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-vt-success animate-pulse" />
                    Hiring Now
                  </span>
                  <div className="flex items-center gap-1 text-xs font-semibold text-vt-warning tag">
                    <ShieldCheck className="h-3.5 w-3.5" /> Score {emp.trustScore}
                  </div>
                </div>
              </div>

              <div className="mb-6 grid grid-cols-2 gap-y-3 gap-x-4 border-y border-vt-neutral-800/50 py-5">
                <div className="flex items-center gap-2 text-sm text-vt-neutral-200">
                  <MapPin className="h-4 w-4 shrink-0 text-vt-neutral-800" />
                  {emp.states.join(', ')}
                </div>
                <div className="flex items-center gap-2 text-sm text-vt-neutral-200">
                  <Users className="h-4 w-4 shrink-0 text-vt-info" />
                  {emp.openRoles} roles
                </div>
                <div className="flex items-center gap-2 text-sm text-vt-neutral-200 col-span-2">
                  <Zap className="h-4 w-4 shrink-0 text-vt-warning" />
                  Starts in {emp.timeToStart}
                </div>
              </div>

              <div className="mt-auto flex flex-wrap gap-2 mb-6">
                {emp.specialties.map((s) => (
                  <span key={s} className="rounded-full bg-vt-surface-ops-base px-3 py-1 text-xs font-medium text-vt-neutral-200 ring-1 ring-vt-neutral-800">
                    {s}
                  </span>
                ))}
              </div>

              <div className="mt-2 flex gap-3">
                <Link
                  href={`/employers/${emp.slug}`}
                  className="flex-1 rounded-2xl bg-vt-info/10 px-5 py-3 text-center text-sm font-semibold text-vt-info ring-1 ring-vt-info/30 hover:bg-vt-info hover:text-white hover:shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-all"
                >
                  View Profile
                </Link>
                <Link
                  href="/explore"
                  className="rounded-2xl vt-glass border border-vt-neutral-800 px-5 py-3 text-sm font-medium text-vt-neutral-200 hover:text-white hover:border-vt-neutral-700 transition-all"
                >
                  Roles
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
