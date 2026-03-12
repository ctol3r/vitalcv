'use client';
/**
 * ExploreClient — Wave 228
 * Fetches live opportunities from /api/opportunities.
 * Falls back to SEED_OPPORTUNITIES when DB is empty (pre-employer launch).
 */

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  MapPin, DollarSign, Users, ShieldCheck,
  Zap, Building2, ChevronRight, X, Filter, Loader2,
} from 'lucide-react';
import ApplyModal from './ApplyModal';

/* ── API shape ───────────────────────────────────────────────── */

interface ApiOpportunity {
  id: string;
  organizationId: string;
  organizationName: string;
  title: string;
  specialty: string;
  hiringType: string;
  state: string;
  payRange: string | null;
  requirementLevel: string;
  description: string | null;
  remote: boolean;
  status: string;
  createdAt: string;
}

/* ── Seed data — shown when DB has no opportunities yet ──────── */

const SEED_OPPORTUNITIES: ApiOpportunity[] = [
  { id: 's-001', organizationId: '', organizationName: 'Bay Area Cardiac Group', title: 'Locums Interventional Cardiologist', specialty: 'Cardiology', hiringType: 'locums', state: 'CA', payRange: '$310–$380/hr', requirementLevel: 'L3', description: null, remote: false, status: 'ACTIVE', createdAt: '' },
  { id: 's-002', organizationId: '', organizationName: 'Bay Area Cardiac Group', title: 'Perm Electrophysiologist', specialty: 'Cardiology', hiringType: 'perm', state: 'CA', payRange: '$420K–$500K', requirementLevel: 'L3', description: null, remote: false, status: 'ACTIVE', createdAt: '' },
  { id: 's-003', organizationId: '', organizationName: 'MindBridge Health', title: 'Telehealth Psychiatrist', specialty: 'Psychiatry', hiringType: 'telehealth', state: 'CA', payRange: '$200–$270/hr', requirementLevel: 'L2', description: null, remote: true, status: 'ACTIVE', createdAt: '' },
  { id: 's-004', organizationId: '', organizationName: 'Sacramento Medical Center', title: 'ICU / Critical Care NP', specialty: 'Critical Care', hiringType: 'locums', state: 'CA', payRange: '$120–$145/hr', requirementLevel: 'L3', description: null, remote: false, status: 'ACTIVE', createdAt: '' },
  { id: 's-005', organizationId: '', organizationName: 'Northwest Locums Alliance', title: 'Family Medicine — Rural WA', specialty: 'Family Medicine', hiringType: 'locums', state: 'WA', payRange: '$180–$220/hr', requirementLevel: 'L2', description: null, remote: false, status: 'ACTIVE', createdAt: '' },
  { id: 's-006', organizationId: '', organizationName: 'Kaiser Permanente NorCal', title: 'Staff Internist — Perm', specialty: 'Internal Medicine', hiringType: 'perm', state: 'CA', payRange: null, requirementLevel: 'L3', description: null, remote: false, status: 'ACTIVE', createdAt: '' },
  { id: 's-007', organizationId: '', organizationName: 'MindBridge Health', title: 'Telepsychiatry — TX & FL', specialty: 'Psychiatry', hiringType: 'telehealth', state: 'TX', payRange: '$200–$270/hr', requirementLevel: 'L2', description: null, remote: true, status: 'ACTIVE', createdAt: '' },
  { id: 's-008', organizationId: '', organizationName: 'Austin Regional Clinic', title: 'Staff Hospitalist', specialty: 'Internal Medicine', hiringType: 'perm', state: 'TX', payRange: '$280K–$320K', requirementLevel: 'L2', description: null, remote: false, status: 'ACTIVE', createdAt: '' },
  { id: 's-009', organizationId: '', organizationName: 'Miami Telehealth Group', title: 'Remote Urgent Care Physician', specialty: 'Emergency Medicine', hiringType: 'telehealth', state: 'FL', payRange: '$150–$190/hr', requirementLevel: 'L1', description: null, remote: true, status: 'ACTIVE', createdAt: '' },
  { id: 's-010', organizationId: '', organizationName: 'Chicago Pediatric Alliance', title: 'Locums Pediatrician', specialty: 'Pediatrics', hiringType: 'locums', state: 'IL', payRange: '$140–$170/hr', requirementLevel: 'L2', description: null, remote: false, status: 'ACTIVE', createdAt: '' },
  { id: 's-011', organizationId: '', organizationName: 'NorthShore Radiology', title: 'Interventional Radiologist', specialty: 'Radiology', hiringType: 'perm', state: 'IL', payRange: '$550K–$650K', requirementLevel: 'L3', description: null, remote: false, status: 'ACTIVE', createdAt: '' },
  { id: 's-012', organizationId: '', organizationName: 'Seattle General Health', title: 'OB/GYN Hospitalist — Nights', specialty: 'OB/GYN', hiringType: 'locums', state: 'WA', payRange: '$220–$260/hr', requirementLevel: 'L3', description: null, remote: false, status: 'ACTIVE', createdAt: '' },
];

/* ── Constants ───────────────────────────────────────────────── */

const SPECIALTIES = ['Cardiology','Critical Care','Emergency Medicine','Family Medicine','Internal Medicine','Neurology','OB/GYN','Oncology','Orthopedics','Pediatrics','Psychiatry','Radiology','Surgery','Other'];
const STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
const HIRING_TYPES = ['locums','perm','telehealth','contract','per_diem'];

const HIRING_TYPE_LABELS: Record<string, string> = {
  locums: 'Locums', perm: 'Permanent', telehealth: 'Telehealth',
  contract: 'Contract', per_diem: 'Per Diem',
};

const LEVEL_COLORS: Record<string, string> = {
  L1: 'text-green-400 bg-green-500/10 ring-green-500/20',
  L2: 'text-yellow-400 bg-yellow-500/10 ring-yellow-500/20',
  L3: 'text-orange-400 bg-orange-500/10 ring-orange-500/20',
};

/* ── Component ───────────────────────────────────────────────── */

export default function ExploreClient() {
  const [specialty, setSpecialty] = useState('');
  const [state, setState] = useState('');
  const [hiringType, setHiringType] = useState('');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [opportunities, setOpportunities] = useState<ApiOpportunity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isSeeded, setIsSeeded] = useState(false);
  const [applyTarget, setApplyTarget] = useState<ApiOpportunity | null>(null);

  const fetchOpportunities = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (specialty) params.set('specialty', specialty);
      if (state) params.set('state', state);
      if (hiringType) params.set('hiringType', hiringType);
      params.set('limit', '40');

      const res = await fetch(`/api/opportunities?${params}`);
      if (res.ok) {
        const data = await res.json() as { opportunities: ApiOpportunity[]; total: number };
        let opps = data.opportunities ?? [];

        // Apply remote filter client-side (not in API yet)
        if (remoteOnly) opps = opps.filter(o => o.remote);

        if (opps.length === 0 && !specialty && !state && !hiringType && !remoteOnly) {
          // DB empty — use seed data
          setOpportunities(SEED_OPPORTUNITIES);
          setTotal(SEED_OPPORTUNITIES.length);
          setIsSeeded(true);
        } else {
          setOpportunities(opps);
          setTotal(remoteOnly ? opps.length : data.total);
          setIsSeeded(false);
        }
      } else {
        // API unavailable — fall back to seed
        setOpportunities(SEED_OPPORTUNITIES);
        setTotal(SEED_OPPORTUNITIES.length);
        setIsSeeded(true);
      }
    } catch {
      setOpportunities(SEED_OPPORTUNITIES);
      setTotal(SEED_OPPORTUNITIES.length);
      setIsSeeded(true);
    }
    setLoading(false);
  }, [specialty, state, hiringType, remoteOnly]);

  useEffect(() => { void fetchOpportunities(); }, [fetchOpportunities]);

  const hasFilters = specialty || state || hiringType || remoteOnly;

  function clearFilters() {
    setSpecialty(''); setState(''); setHiringType(''); setRemoteOnly(false);
  }

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <button
          onClick={() => setShowFilters(f => !f)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
            showFilters ? 'bg-blue-600/30 border border-blue-500/40 text-blue-400' : 'bg-white/5 border border-white/10 text-white/60 hover:text-white'
          }`}
        >
          <Filter className="w-4 h-4" /> Filters
          {hasFilters && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-blue-500 text-white text-xs font-bold">!</span>}
        </button>

        {showFilters && (
          <>
            <select value={specialty} onChange={e => setSpecialty(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/80 focus:outline-none focus:border-blue-500/50">
              <option value="">All Specialties</option>
              {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={state} onChange={e => setState(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/80 focus:outline-none focus:border-blue-500/50">
              <option value="">All States</option>
              {STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={hiringType} onChange={e => setHiringType(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/80 focus:outline-none focus:border-blue-500/50">
              <option value="">All Types</option>
              {HIRING_TYPES.map(t => <option key={t} value={t}>{HIRING_TYPE_LABELS[t]}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer select-none">
              <input type="checkbox" checked={remoteOnly} onChange={e => setRemoteOnly(e.target.checked)} className="rounded" />
              Remote only
            </label>
          </>
        )}

        {hasFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-sm text-white/40 hover:text-white transition-colors ml-auto">
            <X className="w-3 h-3" /> Clear all
          </button>
        )}

        <span className={`${hasFilters ? '' : 'ml-auto'} text-sm text-white/40`}>
          {loading ? '…' : `${total} role${total !== 1 ? 's' : ''}`}
          {isSeeded && !hasFilters && <span className="ml-1 text-white/25">(sample)</span>}
        </span>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-7 w-7 text-vt-neutral-800 animate-spin" />
        </div>
      ) : opportunities.length === 0 ? (
        <div className="text-center py-20 text-white/40">
          <Zap className="w-10 h-10 mx-auto mb-4 opacity-30" />
          <p>No roles match your filters.</p>
          <button onClick={clearFilters} className="mt-3 text-blue-400 hover:text-blue-300 transition-colors">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {opportunities.map(opp => (
            <OpportunityCard key={opp.id} opp={opp} onApply={() => setApplyTarget(opp)} />
          ))}
        </div>
      )}

      {/* AI matching CTA */}
      <div className="mt-16 rounded-2xl border border-vt-success/20 bg-vt-success/5 p-8 text-center">
        <Zap className="mx-auto mb-3 h-6 w-6 text-vt-success" />
        <h3 className="heading-md text-white">See Your Personalized Match Score</h3>
        <p className="body-sm mx-auto mt-2 max-w-md text-vt-neutral-200">
          Get prequalified and VitalCV shows exactly which roles you&apos;re already cleared for —
          based on your verified credentials.
        </p>
        <Link href="/get-ready" className="mt-5 inline-flex items-center gap-2 rounded-full bg-vt-success px-6 py-3 text-sm font-semibold text-black hover:bg-vt-success/90">
          Check My Readiness
        </Link>
      </div>

      {/* Apply Modal */}
      {applyTarget && (
        <ApplyModal
          opportunity={{
            id: applyTarget.id,
            title: applyTarget.title,
            specialty: applyTarget.specialty,
            hiringType: applyTarget.hiringType,
            state: applyTarget.state,
            organizationName: applyTarget.organizationName,
          }}
          onClose={() => setApplyTarget(null)}
        />
      )}
    </main>
  );
}

/* ── Opportunity Card ────────────────────────────────────────── */
// TODO Wave 239+: Add MATCHA match badge per card when user is logged in.
// Pattern: after opportunities load, POST /api/matcha/score for each visible opp.
// Badge: green "Strong Match" / yellow "Partial Match" / red "Not Yet Eligible" / grey "Log in to see match"
// Only show when user has an NPI from /api/me/workspaces.

function OpportunityCard({ opp, onApply }: { opp: ApiOpportunity; onApply: () => void }) {
  const levelColor = LEVEL_COLORS[opp.requirementLevel] ?? LEVEL_COLORS.L1;
  const isSeeded = opp.id.startsWith('s-');

  return (
    <article className="rounded-2xl border border-vt-neutral-800 bg-vt-surface-ops-raised/30 p-6 flex flex-col gap-4 hover:border-vt-neutral-700 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white leading-tight">{opp.title}</h3>
          <div className="flex items-center gap-1.5 mt-1 text-sm text-vt-neutral-300">
            <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{opp.organizationName}</span>
          </div>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-semibold flex-shrink-0 ring-1 ${levelColor}`}>
          Requires {opp.requirementLevel}
        </span>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-2 text-sm text-vt-neutral-300">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-vt-neutral-400" />
          <span>{opp.remote ? `Remote — ${opp.state} licensed` : opp.state}</span>
        </div>
        {opp.payRange && (
          <div className="flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 flex-shrink-0 text-vt-neutral-400" />
            <span>{opp.payRange}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 flex-shrink-0 text-vt-neutral-400" />
          <span>{HIRING_TYPE_LABELS[opp.hiringType] ?? opp.hiringType}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0 text-vt-neutral-400" />
          <span>{opp.specialty}</span>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5">
        <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400">
          {HIRING_TYPE_LABELS[opp.hiringType] ?? opp.hiringType}
        </span>
        {opp.remote && (
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
            Remote
          </span>
        )}
        {opp.description && (
          <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/40 truncate max-w-[180px]">
            {opp.description.slice(0, 40)}{opp.description.length > 40 ? '…' : ''}
          </span>
        )}
      </div>

      {/* CTAs */}
      <div className="flex gap-2 mt-auto pt-3 border-t border-white/5">
        <button
          onClick={isSeeded ? () => window.location.href = '/get-ready' : onApply}
          className="flex-1 flex items-center justify-center gap-1 px-4 py-2.5 rounded-xl bg-vt-success text-black text-sm font-semibold hover:bg-vt-success/90 transition-colors"
        >
          Apply with VitalCV <ChevronRight className="w-4 h-4" />
        </button>
        {!isSeeded && (
          <Link
            href={`/employers/${opp.organizationId}`}
            className="px-4 py-2.5 rounded-xl vt-glass border border-vt-neutral-800 text-sm text-vt-neutral-200 hover:text-white hover:border-vt-neutral-700 transition-all"
          >
            Employer
          </Link>
        )}
      </div>
    </article>
  );
}
