/**
 * Wave 188 — Verifier Opportunities Workspace
 * /verifier/opportunities — Employer view: published opportunities + applicant activity
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, Users, Zap, ChevronRight, Eye, Clock } from 'lucide-react';

export const metadata: Metadata = {
  title: 'My Opportunities — VitalCV Verifier',
  description: 'Manage posted opportunities and review prequalified candidates.',
};

const MY_OPPS = [
  {
    id: 'opp-001',
    title: 'Locums Interventional Cardiologist',
    applicants: 4,
    clearToStart: 2,
    instantOfferSent: 1,
    posted: '2026-03-01',
    status: 'ACTIVE',
  },
  {
    id: 'opp-002',
    title: 'Perm Electrophysiologist',
    applicants: 2,
    clearToStart: 0,
    instantOfferSent: 0,
    posted: '2026-02-20',
    status: 'ACTIVE',
  },
];

export default function VerifierOpportunitiesPage() {
  return (
    <div className="min-h-screen bg-ops-gradient text-white surface-operator">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="heading-xl font-bold text-white">My Opportunities</h1>
            <p className="text-white/60 mt-1">Posted roles and prequalified candidate pipeline.</p>
          </div>
          <Link
            href="/verifier/company"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
          >
            <Plus className="w-4 h-4" /> Post Opportunity
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Posted', value: '2' },
            { label: 'Total Applicants', value: '6' },
            { label: 'Clear to Start', value: '2' },
            { label: 'Instant Offers Sent', value: '1' },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
              <p className="text-2xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-white/50 mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Opportunity list */}
        <div className="space-y-4">
          {MY_OPPS.map(opp => (
            <div
              key={opp.id}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 flex flex-col sm:flex-row gap-4 items-start"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="font-semibold text-white">{opp.title}</h3>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-green-500/15 text-green-400 ring-1 ring-green-500/30">
                    {opp.status}
                  </span>
                </div>
                <div className="flex flex-wrap gap-4 mt-3 text-sm">
                  <span className="flex items-center gap-1.5 text-white/60">
                    <Users className="w-4 h-4" /> {opp.applicants} applicants
                  </span>
                  <span className="flex items-center gap-1.5 text-green-400">
                    <Zap className="w-4 h-4" /> {opp.clearToStart} clear to start
                  </span>
                  <span className="flex items-center gap-1.5 text-blue-400">
                    <Eye className="w-4 h-4" /> {opp.instantOfferSent} instant offer sent
                  </span>
                  <span className="flex items-center gap-1.5 text-white/40">
                    <Clock className="w-4 h-4" /> Posted {opp.posted}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Link
                  href="/verifier/candidates"
                  className="flex items-center gap-1 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500 transition-colors"
                >
                  Candidates <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
