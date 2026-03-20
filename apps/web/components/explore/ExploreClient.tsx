'use client';
/**
 * ExploreClient — "Inevitable" Redesign
 * Fetches live opportunities from /api/opportunities.
 */

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  MapPin, DollarSign, Users, ShieldCheck,
  Zap, Building2, ChevronRight, X, Filter, Loader2,
  Clock, Flame,
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

/* ── Constants ───────────────────────────────────────────────── */

const SPECIALTIES = ['Cardiology','Critical Care','Emergency Medicine','Family Medicine','Internal Medicine','Neurology','OB/GYN','Oncology','Orthopedics','Pediatrics','Psychiatry','Radiology','Surgery','Other'];
const STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
const HIRING_TYPES = ['locums','perm','telehealth','contract','per_diem'];

const HIRING_TYPE_LABELS: Record<string, string> = {
  locums: 'Locums', perm: 'Permanent', telehealth: 'Telehealth',
  contract: 'Contract', per_diem: 'Per Diem',
};

const LEVEL_LABELS: Record<string, string> = {
  L1: 'Basic verification',
  L2: 'Standard verification',
  L3: 'Full primary source verification',
};

const LEVEL_COLORS: Record<string, string> = {
  L1: 'text-green-400 bg-green-500/10 ring-green-500/20',
  L2: 'text-yellow-400 bg-yellow-500/10 ring-yellow-500/20',
  L3: 'text-orange-400 bg-orange-500/10 ring-orange-500/20',
};

/* ── Component ───────────────────────────────────────────────── */

export default function ExploreClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [specialty, setSpecialty] = useState('');
  const [state, setState] = useState('');
  const [hiringType, setHiringType] = useState('');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [opportunities, setOpportunities] = useState<ApiOpportunity[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
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

        if (remoteOnly) opps = opps.filter(o => o.remote);

        setOpportunities(opps);
        setTotal(remoteOnly ? opps.length : data.total ?? opps.length);
      } else {
        setOpportunities([]);
        setTotal(0);
      }
    } catch {
      setOpportunities([]);
      setTotal(0);
    }
    setLoading(false);
  }, [specialty, state, hiringType, remoteOnly]);

  useEffect(() => { void fetchOpportunities(); }, [fetchOpportunities]);

  const updateApplyParam = useCallback((opportunityId: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (opportunityId) {
      params.set('apply', opportunityId);
    } else {
      params.delete('apply');
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    const applyId = searchParams.get('apply');
    if (!applyId) {
      return;
    }

    if (loading) {
      return;
    }

    const target = opportunities.find((opportunity) => opportunity.id === applyId) ?? null;
    if (target) {
      setApplyTarget(target);
      return;
    }

    updateApplyParam(null);
  }, [loading, opportunities, searchParams, updateApplyParam]);

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
        </span>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-7 w-7 text-vt-neutral-800 animate-spin" />
        </div>
      ) : opportunities.length === 0 ? (
        <div className="text-center py-20">
          <Zap className="w-10 h-10 mx-auto mb-4 text-white/20" />
          <p className="text-white/50 text-lg font-medium mb-2">No live opportunities match right now</p>
          <p className="text-white/30 text-sm mb-6 max-w-md mx-auto">
            Postings appear here as employers publish them. Clear filters or check back after new roles land.
          </p>
          <button onClick={clearFilters} className="text-blue-400 hover:text-blue-300 transition-colors text-sm font-medium">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {opportunities.map(opp => (
            <OpportunityCard
              key={opp.id}
              opp={opp}
              onApply={() => {
                setApplyTarget(opp);
                updateApplyParam(opp.id);
              }}
            />
          ))}
        </div>
      )}

      {/* AI matching CTA */}
      <div className="mt-16 rounded-2xl border border-vt-success/20 bg-vt-success/5 p-8 text-center">
        <Zap className="mx-auto mb-3 h-6 w-6 text-vt-success" />
        <h3 className="heading-md text-white">See Your Personalized Match Score</h3>
        <p className="body-sm mx-auto mt-2 max-w-md text-vt-neutral-200">
          Get verified and VitalCV shows exactly which roles you&apos;re already cleared for —
          based on your verified credentials.
        </p>
        <Link href="/onboarding" className="mt-5 inline-flex items-center gap-2 rounded-full bg-vt-success px-6 py-3 text-sm font-semibold text-black hover:bg-vt-success/90">
          Get Verified Now
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
          onClose={() => {
            setApplyTarget(null);
            updateApplyParam(null);
          }}
        />
      )}
    </main>
  );
}

/* ── Opportunity Card — Redesigned ───────────────────────────── */

function OpportunityCard({ opp, onApply }: { opp: ApiOpportunity; onApply: () => void }) {
  const levelColor = LEVEL_COLORS[opp.requirementLevel] ?? LEVEL_COLORS.L1;
  const levelLabel = LEVEL_LABELS[opp.requirementLevel] ?? 'Verification required';

  return (
    <article className="group rounded-2xl border border-vt-neutral-800 bg-vt-surface-ops-raised/30 p-6 flex flex-col gap-4 transition-all duration-300 hover:border-vt-neutral-700 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(16,185,129,0.06)]">
      {/* Header — employer identity prominent */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white leading-tight text-base group-hover:text-emerald-300 transition-colors">{opp.title}</h3>
          <div className="flex items-center gap-1.5 mt-1.5">
            <Building2 className="w-3.5 h-3.5 flex-shrink-0 text-vt-neutral-400" />
            <span className="text-sm font-medium text-vt-neutral-200">{opp.organizationName}</span>
          </div>
        </div>
        {/* Urgency badge */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400 ring-1 ring-emerald-500/25">
            <Flame className="w-3 h-3" />
            Hiring Now
          </span>
        </div>
      </div>

      {/* Meta grid — key info at a glance */}
      <div className="grid grid-cols-2 gap-2.5 text-sm">
        <div className="flex items-center gap-2 text-vt-neutral-200">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-vt-neutral-400" />
          <span>{opp.remote ? `Remote — ${opp.state} licensed` : opp.state}</span>
        </div>
        {opp.payRange && (
          <div className="flex items-center gap-2 text-vt-neutral-200">
            <DollarSign className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400/60" />
            <span className="font-medium">{opp.payRange}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-vt-neutral-200">
          <Users className="w-3.5 h-3.5 flex-shrink-0 text-vt-neutral-400" />
          <span>{HIRING_TYPE_LABELS[opp.hiringType] ?? opp.hiringType}</span>
        </div>
        <div className="flex items-center gap-2 text-vt-neutral-200">
          <Clock className="w-3.5 h-3.5 flex-shrink-0 text-vt-neutral-400" />
          <span className="text-xs">Responds in 24h</span>
        </div>
      </div>

      {/* Trust & readiness row */}
      <div className="flex items-center gap-3 pt-1">
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold flex-shrink-0 ring-1 ${levelColor}`}>
          {opp.requirementLevel}
        </span>
        <span className="text-[11px] text-vt-neutral-300">{levelLabel}</span>
        <div className="ml-auto flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-[11px] font-semibold text-blue-400">Verified employer</span>
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
        <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/40">
          {opp.specialty}
        </span>
      </div>

      {/* CTAs */}
      <div className="flex gap-2 mt-auto pt-3 border-t border-white/5">
        <button
          onClick={onApply}
          className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-vt-success text-black text-sm font-semibold hover:bg-vt-success/90 transition-all active:scale-[0.98]"
        >
          Apply with VitalCV <ChevronRight className="w-4 h-4" />
        </button>
        {opp.organizationId && (
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
