/**
 * Wave 188 — Holder Opportunities Workspace
 * /holder/opportunities — Personalized matched opportunities for the active clinician
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ShieldCheck, Zap, ChevronRight, Lock,
  Building2, MapPin, Clock, DollarSign,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'My Opportunities — VitalCV',
  description: 'Opportunities matched to your verified credential state.',
};

// Stub — Wave 190 connects to /api/matcha/opportunities/:npi
const DEMO_NPI = '1003000126';

const MATCHED = [
  {
    id: 'opp-003',
    title: 'Telehealth Psychiatrist',
    facility: 'MindBridge Health',
    employerSlug: 'mindbridge-health',
    location: 'Remote',
    pay: '$200–$270/hr',
    urgency: 'Flexible',
    band: 'CLEAR' as const,
    score: 91,
    instantOffer: true,
    blockers: [],
  },
  {
    id: 'opp-001',
    title: 'Locums Interventional Cardiologist',
    facility: 'Bay Area Cardiac Group',
    employerSlug: 'bay-area-cardiac-group',
    location: 'San Francisco, CA',
    pay: '$310–$380/hr',
    urgency: 'In 2 weeks',
    band: 'NEAR_CLEAR' as const,
    score: 74,
    instantOffer: false,
    blockers: ['Malpractice insurance missing'],
  },
  {
    id: 'opp-006',
    title: 'Staff Internist — Perm',
    facility: 'Kaiser Permanente NorCal',
    employerSlug: 'kaiser-permanente-northern-california',
    location: 'Sacramento, CA',
    pay: 'Competitive',
    urgency: 'Within a month',
    band: 'NEAR_CLEAR' as const,
    score: 68,
    instantOffer: false,
    blockers: ['KP Privileging not started'],
  },
];

const BAND_CONFIG = {
  CLEAR:      { label: 'Clear to Start', color: 'bg-green-500/15 text-green-400 ring-1 ring-green-500/30' },
  NEAR_CLEAR: { label: 'Almost Ready',   color: 'bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30' },
  PARTIAL:    { label: 'Partial Match',  color: 'bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/30' },
  INELIGIBLE: { label: 'Not Eligible',   color: 'bg-white/5 text-white/30 ring-1 ring-white/10' },
};

export default function HolderOpportunitiesPage() {
  return (
    <div className="min-h-screen bg-ops-gradient text-white surface-operator">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-8">
          <nav className="flex items-center gap-2 text-xs text-white/40 mb-4">
            <Link href="/holder/home" className="hover:text-white/70">Clinician Home</Link>
            <span>/</span>
            <span className="text-white/60">My Opportunities</span>
          </nav>
          <h1 className="heading-xl font-bold text-white">My Matched Opportunities</h1>
          <p className="text-white/60 mt-2">
            Ranked by your verified credential state — not just your resume.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
            <p className="text-2xl font-bold text-green-400">1</p>
            <p className="text-xs text-white/50 mt-1">Clear to Start</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
            <p className="text-2xl font-bold text-yellow-400">2</p>
            <p className="text-xs text-white/50 mt-1">Almost Ready</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">1</p>
            <p className="text-xs text-white/50 mt-1">Instant Offer Eligible</p>
          </div>
        </div>

        {/* Matched opportunities */}
        <div className="space-y-4 mb-10">
          {MATCHED.map(opp => {
            const bandCfg = BAND_CONFIG[opp.band];
            return (
              <div key={opp.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 flex flex-col sm:flex-row gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-start gap-3 flex-wrap">
                    <h3 className="font-semibold text-white">{opp.title}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${bandCfg.color}`}>
                      {bandCfg.label}
                    </span>
                    {opp.instantOffer && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30 flex items-center gap-1">
                        <Zap className="w-3 h-3" /> Instant Offer
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-white/50">{opp.facility}</p>
                  <div className="flex flex-wrap gap-3 text-sm text-white/40">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {opp.location}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {opp.urgency}</span>
                    <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> {opp.pay}</span>
                  </div>
                  {opp.blockers.length > 0 && (
                    <div className="mt-2">
                      {opp.blockers.map(b => (
                        <p key={b} className="text-xs text-yellow-400/80">⚠ {b}</p>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 min-w-[140px]">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">{opp.score}</p>
                    <p className="text-xs text-white/40">match score</p>
                  </div>
                  <Link
                    href={`/opportunities/${opp.id}`}
                    className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-vt-success text-black text-sm font-semibold hover:bg-vt-success/90 transition-colors"
                  >
                    View <ChevronRight className="w-4 h-4" />
                  </Link>
                  <Link
                    href={`/employers/${opp.employerSlug}`}
                    className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-sm transition-all"
                  >
                    <Building2 className="w-3.5 h-3.5" /> Employer
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Unlock more */}
        <div className="rounded-2xl border border-blue-500/20 bg-blue-900/10 p-6 flex items-start gap-4">
          <Lock className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h3 className="font-semibold text-white">See all {DEMO_NPI && '23'} matched roles</h3>
            <p className="text-sm text-white/60 mt-1">
              Complete your AI interview and at least one specialty assessment to unlock your full
              opportunity match list and instant offer eligibility.
            </p>
            <Link
              href="/get-ready"
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
            >
              Complete Prequalification <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
