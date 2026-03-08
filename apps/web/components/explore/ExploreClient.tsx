'use client';
/**
 * Wave 188 — Explore Opportunities Surface
 * ExploreClient — filters + opportunity cards
 */

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  MapPin, Clock, DollarSign, Users, ShieldCheck,
  Zap, Building2, ChevronRight, X, Filter,
} from 'lucide-react';

// ── Canonical opportunity data (mirrors opportunityRegistry.ts) ───────────────

interface Opportunity {
  id: string;
  title: string;
  employerSlug: string;
  facility: string;
  location: string;
  state: string;
  specialty: string;
  hiringType: string;
  employerType: string;
  startUrgency: string;
  payRange?: string;
  remote: boolean;
  recentHires?: number;
  tags?: string[];
  requirementLevel: 'L1' | 'L2' | 'L3';
  status?: 'CLEAR' | 'NEAR_CLEAR' | 'GET_READY';
}

const OPPORTUNITIES: Opportunity[] = [
  {
    id: 'opp-001',
    title: 'Locums Interventional Cardiologist',
    employerSlug: 'bay-area-cardiac-group',
    facility: 'Bay Area Cardiac Group',
    location: 'San Francisco, CA',
    state: 'CA',
    specialty: 'Cardiology',
    hiringType: 'locums',
    employerType: 'practice',
    startUrgency: 'within_2_weeks',
    payRange: '$310–$380/hr',
    remote: false,
    recentHires: 3,
    tags: ['Cardiology', 'CA', 'Locums'],
    requirementLevel: 'L3',
    status: 'NEAR_CLEAR',
  },
  {
    id: 'opp-002',
    title: 'Perm Electrophysiologist',
    employerSlug: 'bay-area-cardiac-group',
    facility: 'Bay Area Cardiac Group',
    location: 'Oakland, CA',
    state: 'CA',
    specialty: 'Cardiology',
    hiringType: 'perm',
    employerType: 'practice',
    startUrgency: 'within_month',
    payRange: '$420K–$500K',
    remote: false,
    recentHires: 1,
    tags: ['Cardiology', 'CA', 'Perm'],
    requirementLevel: 'L3',
    status: 'GET_READY',
  },
  {
    id: 'opp-003',
    title: 'Telehealth Psychiatrist',
    employerSlug: 'mindbridge-health',
    facility: 'MindBridge Health',
    location: 'Remote — CA licensed',
    state: 'CA',
    specialty: 'Psychiatry',
    hiringType: 'telehealth',
    employerType: 'telehealth',
    startUrgency: 'flexible',
    payRange: '$200–$270/hr',
    remote: true,
    recentHires: 8,
    tags: ['Psychiatry', 'Remote', 'Telehealth'],
    requirementLevel: 'L2',
    status: 'CLEAR',
  },
  {
    id: 'opp-004',
    title: 'ICU / Critical Care NP',
    employerSlug: 'sacramento-medical-center',
    facility: 'Sacramento Medical Center',
    location: 'Sacramento, CA',
    state: 'CA',
    specialty: 'Critical Care',
    hiringType: 'locums',
    employerType: 'hospital',
    startUrgency: 'immediate',
    payRange: '$120–$145/hr',
    remote: false,
    recentHires: 1,
    tags: ['ICU', 'Critical Care', 'NP'],
    requirementLevel: 'L3',
    status: 'GET_READY',
  },
  {
    id: 'opp-005',
    title: 'Family Medicine — Rural WA',
    employerSlug: 'northwest-locums-alliance',
    facility: 'Northwest Locums Alliance',
    location: 'Eastern Washington',
    state: 'WA',
    specialty: 'Family Medicine',
    hiringType: 'locums',
    employerType: 'agency',
    startUrgency: 'within_2_weeks',
    payRange: '$180–$220/hr',
    remote: false,
    recentHires: 5,
    tags: ['Family Medicine', 'WA', 'Rural'],
    requirementLevel: 'L2',
    status: 'NEAR_CLEAR',
  },
  {
    id: 'opp-006',
    title: 'Staff Internist — Perm',
    employerSlug: 'kaiser-permanente-northern-california',
    facility: 'Kaiser Permanente NorCal',
    location: 'Sacramento, CA',
    state: 'CA',
    specialty: 'Internal Medicine',
    hiringType: 'perm',
    employerType: 'health_system',
    startUrgency: 'within_month',
    remote: false,
    recentHires: 12,
    tags: ['Internal Medicine', 'CA', 'Perm', 'Kaiser'],
    requirementLevel: 'L3',
    status: 'NEAR_CLEAR',
  },
  {
    id: 'opp-007',
    title: 'Telepsychiatry — TX & FL',
    employerSlug: 'mindbridge-health',
    facility: 'MindBridge Health',
    location: 'Remote — TX or FL',
    state: 'TX',
    specialty: 'Psychiatry',
    hiringType: 'telehealth',
    employerType: 'telehealth',
    startUrgency: 'flexible',
    payRange: '$200–$270/hr',
    remote: true,
    recentHires: 4,
    tags: ['Psychiatry', 'Telehealth', 'TX'],
    requirementLevel: 'L2',
    status: 'CLEAR',
  },
];

const ALL_SPECIALTIES = [...new Set(OPPORTUNITIES.map(o => o.specialty))].sort();
const ALL_STATES = [...new Set(OPPORTUNITIES.map(o => o.state))].sort();
const ALL_HIRING_TYPES = [...new Set(OPPORTUNITIES.map(o => o.hiringType))].sort();

const STATUS_CONFIG = {
  CLEAR:      { label: 'Clear to Start',  color: 'bg-green-500/15 text-green-400 ring-1 ring-green-500/30' },
  NEAR_CLEAR: { label: 'Almost Ready',    color: 'bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30' },
  GET_READY:  { label: 'Get Ready',       color: 'bg-white/5 text-white/40 ring-1 ring-white/10' },
};

const URGENCY_LABELS: Record<string, string> = {
  immediate: 'Start immediately',
  within_2_weeks: 'Start in 2 weeks',
  within_month: 'Start within a month',
  flexible: 'Flexible start',
};

const HIRING_TYPE_LABELS: Record<string, string> = {
  locums: 'Locums',
  perm: 'Permanent',
  telehealth: 'Telehealth',
  'part-time': 'Part-time',
  prn: 'PRN',
  'short-term': 'Short-term',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExploreClient() {
  const [specialty, setSpecialty] = useState('');
  const [state, setState] = useState('');
  const [hiringType, setHiringType] = useState('');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [status, setStatus] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    return OPPORTUNITIES.filter(o => {
      if (specialty && !o.specialty.toLowerCase().includes(specialty.toLowerCase())) return false;
      if (state && o.state !== state && !o.remote) return false;
      if (hiringType && o.hiringType !== hiringType) return false;
      if (remoteOnly && !o.remote) return false;
      if (status && o.status !== status) return false;
      return true;
    });
  }, [specialty, state, hiringType, remoteOnly, status]);

  const hasFilters = specialty || state || hiringType || remoteOnly || status;

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
          {hasFilters && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-blue-500 text-white text-xs">!</span>}
        </button>

        {showFilters && (
          <>
            <select value={specialty} onChange={e => setSpecialty(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/80 focus:outline-none focus:border-blue-500/50">
              <option value="">All Specialties</option>
              {ALL_SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <select value={state} onChange={e => setState(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/80 focus:outline-none focus:border-blue-500/50">
              <option value="">All States</option>
              {ALL_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <select value={hiringType} onChange={e => setHiringType(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/80 focus:outline-none focus:border-blue-500/50">
              <option value="">All Types</option>
              {ALL_HIRING_TYPES.map(t => <option key={t} value={t}>{HIRING_TYPE_LABELS[t] ?? t}</option>)}
            </select>

            <select value={status} onChange={e => setStatus(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/80 focus:outline-none focus:border-blue-500/50">
              <option value="">All Readiness</option>
              <option value="CLEAR">Clear to Start</option>
              <option value="NEAR_CLEAR">Almost Ready</option>
              <option value="GET_READY">Get Ready</option>
            </select>

            <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer select-none">
              <input type="checkbox" checked={remoteOnly} onChange={e => setRemoteOnly(e.target.checked)}
                className="rounded" />
              Remote only
            </label>
          </>
        )}

        {hasFilters && (
          <button
            onClick={() => { setSpecialty(''); setState(''); setHiringType(''); setRemoteOnly(false); setStatus(''); }}
            className="flex items-center gap-1 text-sm text-white/40 hover:text-white transition-colors ml-auto"
          >
            <X className="w-3 h-3" /> Clear all
          </button>
        )}

        <span className="ml-auto text-sm text-white/40">
          {filtered.length} role{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-white/40">
          <Zap className="w-10 h-10 mx-auto mb-4 opacity-30" />
          <p>No roles match your filters.</p>
          <button onClick={() => { setSpecialty(''); setState(''); setHiringType(''); setRemoteOnly(false); setStatus(''); }}
            className="mt-3 text-blue-400 hover:text-blue-300 transition-colors">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filtered.map(opp => <OpportunityCard key={opp.id} opp={opp} />)}
        </div>
      )}

      {/* AI matching CTA */}
      <div className="mt-16 rounded-2xl border border-vt-success/20 bg-vt-success/5 p-8 text-center">
        <Zap className="mx-auto mb-3 h-6 w-6 text-vt-success" />
        <h3 className="heading-md text-white">See Your Personalized Match Score</h3>
        <p className="body-sm mx-auto mt-2 max-w-md text-vt-neutral-200">
          Get prequalified and VitalCV shows exactly which roles you're already cleared for —
          based on your verified credentials.
        </p>
        <Link href="/get-ready" className="mt-5 inline-flex items-center gap-2 rounded-full bg-vt-success px-6 py-3 text-sm font-semibold text-black hover:bg-vt-success/90">
          Check My Readiness
        </Link>
      </div>
    </main>
  );
}

// ── Opportunity Card ──────────────────────────────────────────────────────────

function OpportunityCard({ opp }: { opp: Opportunity }) {
  const statusCfg = opp.status ? STATUS_CONFIG[opp.status] : null;

  return (
    <article className="rounded-2xl border border-vt-neutral-800 bg-vt-surface-ops-raised/30 p-6 flex flex-col gap-4 hover:border-vt-neutral-700 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white leading-tight">{opp.title}</h3>
          <div className="flex items-center gap-1.5 mt-1 text-sm text-vt-neutral-300">
            <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{opp.facility}</span>
          </div>
        </div>
        {statusCfg && (
          <span className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${statusCfg.color}`}>
            {statusCfg.label}
          </span>
        )}
      </div>

      {/* Meta row */}
      <div className="grid grid-cols-2 gap-2 text-sm text-vt-neutral-300">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-vt-neutral-400" />
          <span className="truncate">{opp.location}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 flex-shrink-0 text-vt-neutral-400" />
          <span>{URGENCY_LABELS[opp.startUrgency] ?? opp.startUrgency}</span>
        </div>
        {opp.payRange && (
          <div className="flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 flex-shrink-0 text-vt-neutral-400" />
            <span>{opp.payRange}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 flex-shrink-0 text-vt-neutral-400" />
          <span>{opp.recentHires ?? 0} hired recently</span>
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
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/50">
          <ShieldCheck className="w-3 h-3" />
          Requires {opp.requirementLevel}
        </span>
      </div>

      {/* CTAs */}
      <div className="flex gap-2 mt-auto pt-3 border-t border-white/5">
        <Link
          href={`/opportunities/${opp.id}`}
          className="flex-1 flex items-center justify-center gap-1 px-4 py-2.5 rounded-xl bg-vt-success text-black text-sm font-semibold hover:bg-vt-success/90 transition-colors"
        >
          Apply with VitalCV <ChevronRight className="w-4 h-4" />
        </Link>
        <Link
          href={`/employers/${opp.employerSlug}`}
          className="px-4 py-2.5 rounded-xl vt-glass border border-vt-neutral-800 text-sm text-vt-neutral-200 hover:text-white hover:border-vt-neutral-700 transition-all"
        >
          Employer
        </Link>
      </div>
    </article>
  );
}
