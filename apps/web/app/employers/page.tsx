/**
 * Employer Command Center
 * /employers — trust-native employer directory with hiring velocity signals
 */
import { Building2, ChevronRight, MapPin, Plus, ShieldCheck, Users, Zap } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

// Employer data — presented as verified network members
const NETWORK_EMPLOYERS = [
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
  title: 'For Employers — VitalCV',
  description:
    'Hire credentialed clinicians faster than anyone. See candidate readiness instantly, verify credentials in hours, and fill roles before your competitors.',
};

export default function EmployersPage() {
  return (
    <div className="min-h-screen bg-ops-gradient text-white surface-operator">
      {/* Header — command center feel */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        <div className="mb-2">
          <nav className="flex items-center gap-2 text-xs text-white/40">
            <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
            <span>/</span>
            <span className="text-white/60">For Employers</span>
          </nav>
        </div>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="heading-xl font-bold text-white">Hire faster than anyone.</h1>
            <p className="body text-white/60 mt-2 max-w-2xl">
              See candidate readiness instantly. Every clinician on VitalCV has verified credentials
              — no more 90-day credentialing delays.
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
              href="/onboarding"
              className="px-4 py-2 rounded-lg bg-emerald-500 text-sm text-white font-medium hover:bg-emerald-400 transition-colors flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Post a Job Free
            </Link>
          </div>
        </div>
      </div>

      {/* Hiring velocity stats */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="grid grid-cols-3 gap-4">
          {[
            { value: '< 24h', label: 'Average time to verified', icon: Zap },
            { value: '23', label: 'Open roles on network', icon: Users },
            { value: '94%', label: 'Avg employer trust score', icon: ShieldCheck },
          ].map(stat => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="rounded-2xl border border-vt-neutral-800 bg-vt-surface-ops-raised/30 p-5 text-center">
                <Icon className="h-4 w-4 mx-auto mb-2 text-white/30" />
                <p className="text-xl font-bold text-white">{stat.value}</p>
                <p className="text-[11px] text-white/40 uppercase tracking-wider mt-1">{stat.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Employer cards — command center style */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/40">Verified Employers</h2>
          <span className="text-xs text-white/30">{NETWORK_EMPLOYERS.length} organizations</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {NETWORK_EMPLOYERS.map((emp) => (
            <article
              key={emp.slug}
              className="group rounded-2xl border border-vt-neutral-800 bg-vt-surface-ops-raised/30 p-7 hover:border-emerald-500/20 hover:shadow-[0_4px_30px_rgba(16,185,129,0.06)] hover:-translate-y-1 transition-all duration-300 flex flex-col"
            >
              {/* Header */}
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="heading-md text-white group-hover:text-emerald-300 transition-colors">{emp.name}</h3>
                  <p className="body-sm mt-1 text-vt-neutral-200 flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-vt-neutral-800" />
                    {emp.facilityType}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="rounded-full bg-emerald-500/15 px-3 py-1 tag text-emerald-400 ring-1 ring-emerald-500/30 font-semibold tracking-wide flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Hiring Now
                  </span>
                </div>
              </div>

              {/* Trust + hiring velocity */}
              <div className="mb-5 flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
                  <span className="text-sm font-semibold text-blue-400">Trust {emp.trustScore}</span>
                </div>
                <div className="text-xs text-white/40">·</div>
                <div className="text-xs text-white/50">
                  Starts in: <span className="text-white/70 font-medium">{emp.timeToStart}</span>
                </div>
              </div>

              {/* Key metrics */}
              <div className="mb-5 grid grid-cols-2 gap-y-3 gap-x-4 border-y border-vt-neutral-800/50 py-4">
                <div className="flex items-center gap-2 text-sm text-vt-neutral-200">
                  <MapPin className="h-4 w-4 shrink-0 text-vt-neutral-800" />
                  {emp.states.join(', ')}
                </div>
                <div className="flex items-center gap-2 text-sm text-vt-neutral-200">
                  <Users className="h-4 w-4 shrink-0 text-emerald-400/60" />
                  <span className="font-medium">{emp.openRoles} open roles</span>
                </div>
              </div>

              {/* Specialties */}
              <div className="mt-auto flex flex-wrap gap-2 mb-5">
                {emp.specialties.map((s) => (
                  <span key={s} className="rounded-full bg-vt-surface-ops-base px-3 py-1 text-xs font-medium text-vt-neutral-200 ring-1 ring-vt-neutral-800">
                    {s}
                  </span>
                ))}
              </div>

              {/* Quick actions */}
              <div className="flex gap-3">
                <Link
                  href={`/employers/${emp.slug}`}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-400 ring-1 ring-emerald-500/25 hover:bg-emerald-500 hover:text-white hover:shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all"
                >
                  View & Apply <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </article>
          ))}
        </div>

        {/* CTA for new employers */}
        <div className="mt-12 rounded-2xl border border-dashed border-white/15 bg-white/2 p-8 text-center">
          <Building2 className="mx-auto mb-3 h-6 w-6 text-white/20" />
          <h3 className="heading-md text-white mb-2">Join the VitalCV Network</h3>
          <p className="body-sm mx-auto max-w-md text-white/40 mb-5">
            Post jobs for free. See pre-verified candidates. Fill roles in weeks, not months.
          </p>
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-400 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Get Started Free
          </Link>
        </div>
      </div>
    </div>
  );
}
