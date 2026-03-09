/**
 * Wave 191/192 — Referral + Ambassador Dashboard
 * /holder/referrals
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Share2, Gift, Users, Zap, ShieldCheck,
  ChevronRight, Copy, TrendingUp,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Referrals & Ambassador — VitalCV',
  description: 'Refer colleagues, earn credits, and grow the VitalCV trust network.',
};

const COMPLIANCE_NOTE =
  'Rewards are tied to hiring platform activity and completed work only. ' +
  'VitalCV referral incentives do not apply to patient referrals or regulated healthcare service referrals.';

export default function HolderReferralsPage() {
  return (
    <div className="min-h-screen bg-ops-gradient text-white surface-operator">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-8">
          <nav className="flex items-center gap-2 text-xs text-white/40 mb-4">
            <Link href="/holder/home" className="hover:text-white/70">Clinician Home</Link>
            <span>/</span>
            <span className="text-white/60">Referrals</span>
          </nav>
          <h1 className="heading-xl font-bold text-white">Refer Colleagues. Earn Credits.</h1>
          <p className="text-white/60 mt-2 max-w-xl">
            When the clinicians you refer get placed and complete work, you earn VitalCV credits.
            No shortcuts — rewards are tied to real outcomes only.
          </p>
        </div>

        {/* Compliance notice */}
        <div className="mb-8 rounded-xl border border-white/10 bg-white/[0.02] p-4 flex items-start gap-3">
          <ShieldCheck className="w-4 h-4 text-white/40 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-white/40 leading-relaxed">{COMPLIANCE_NOTE}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Referred', value: '0', icon: <Users className="w-4 h-4" /> },
            { label: 'Prequalified', value: '0', icon: <Zap className="w-4 h-4" /> },
            { label: 'Placed', value: '0', icon: <TrendingUp className="w-4 h-4" /> },
            { label: 'Credits Earned', value: '0', icon: <Gift className="w-4 h-4" /> },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 text-white/40 mb-2">{s.icon} <span className="text-xs">{s.label}</span></div>
              <p className="text-2xl font-bold text-white">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Earnings cap */}
        <div className="mb-8 rounded-xl border border-blue-500/20 bg-blue-900/10 p-4">
          <p className="text-sm font-medium text-blue-400 mb-1">Monthly Cap</p>
          <div className="flex items-center gap-4 text-sm text-white/60">
            <span>Credits: 0 / 500</span>
            <span>Cash: $0 / $500</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-white/5">
            <div className="h-full rounded-full bg-blue-500" style={{ width: '0%' }} />
          </div>
        </div>

        {/* Link creation */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Share2 className="w-5 h-5 text-blue-400" /> Your Referral Links
          </h2>
          <p className="text-sm text-white/50 mb-4">
            Agree to the referral terms to generate your first link.
          </p>

          <div className="space-y-3">
            {/* Link type cards */}
            {[
              { type: 'direct', label: 'Direct Referral', desc: 'Invite any clinician to VitalCV' },
              { type: 'role_specific', label: 'Role-Specific Link', desc: 'Share a specific opportunity with a colleague' },
              { type: 'employer_specific', label: 'Employer Link', desc: 'Point colleagues to a specific employer' },
            ].map(lt => (
              <div key={lt.type} className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/8">
                <div>
                  <p className="text-sm font-medium text-white">{lt.label}</p>
                  <p className="text-xs text-white/40 mt-0.5">{lt.desc}</p>
                </div>
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/30 border border-blue-500/30 text-blue-400 text-sm hover:bg-blue-600/50 transition-colors"
                  title="Consent required — click to get started"
                >
                  <Copy className="w-3.5 h-3.5" /> Get Link
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Ambassador teaser */}
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-900/10 p-6">
          <div className="flex items-start gap-4">
            <Zap className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-white">Ambassador Program</h3>
              <p className="text-sm text-white/60 mt-1 leading-relaxed">
                Refer 3+ colleagues who get placed and unlock Ambassador status — with badge tiers,
                invite codes, and exclusive employer content.
              </p>
              <Link
                href="/holder/referrals#ambassador"
                className="mt-3 inline-flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                Learn about Ambassador tracks <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
