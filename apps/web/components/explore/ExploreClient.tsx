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
  Zap, Building2, X, Filter, Loader2,
  Clock, FileCheck2,
} from 'lucide-react';
import { useRoleContext } from '@/components/auth/RoleContext';
import type { OpportunitySummary } from '@/lib/launch/marketplace';
import { trackClinicianEventOncePerSession } from '@/lib/mobile/analytics';
import {
  applicationStatusLabel,
  applicationStatusTone,
  normalizeClinicianApplications,
  upsertClinicianApplication,
  type MobileApplication,
} from '@/lib/mobile/dashboard';
import ApplyModal from './ApplyModal';
import { AdvisoryPanelUI } from '@/components/advisory/AdvisoryPanel';

/* ── API shape ───────────────────────────────────────────────── */

type ApiOpportunity = OpportunitySummary;
type SurfaceControl = {
  surfaceId: string;
  mode: 'enabled' | 'degraded' | 'disabled' | 'hidden';
  reason?: string | null;
};

/* ── Constants ───────────────────────────────────────────────── */

const SPECIALTIES = ['Cardiology','Critical Care','Emergency Medicine','Family Medicine','Internal Medicine','Neurology','OB/GYN','Oncology','Orthopedics','Pediatrics','Psychiatry','Radiology','Surgery','Other'];
const STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
const HIRING_TYPES = ['locums','perm','telehealth','contract','per_diem'];
const PAY_MODELS = ['salary', 'hourly', 'locums', 'shift'];
const VISA_OPTIONS = [
  { value: 'available', label: 'Sponsor support available' },
  { value: 'case_by_case', label: 'Case-by-case sponsorship' },
  { value: 'not_available', label: 'No sponsorship support' },
  { value: 'not_stated', label: 'Visa policy not stated' },
];
const BENEFIT_OPTIONS = [
  { value: 'listed', label: 'Benefits listed' },
  { value: 'limited', label: 'Some support details' },
  { value: 'not_listed', label: 'Benefits not listed' },
];
const EMPLOYER_TYPES = ['hospital system', 'health system', 'hospital', 'specialty practice', 'telehealth platform', 'staffing agency'];
const START_URGENCY_OPTIONS = [
  { value: 'immediate', label: 'Immediate start' },
  { value: 'within_2_weeks', label: 'Within 2 weeks' },
  { value: 'within_month', label: 'Within 30 days' },
  { value: 'flexible', label: 'Flexible start' },
];
const READINESS_OPTIONS = [
  { value: 'ready_now', label: 'Ready now' },
  { value: 'needs_review', label: 'Needs review' },
  { value: 'requirements_missing', label: 'Requirements missing' },
];

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
const REQUEST_TIMEOUT_MS = 10_000;

function parseRemoteFilter(value: string | null): boolean {
  return value === '1' || value === 'true';
}

function formatOrganizationLabel(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatPayModel(value: ApiOpportunity['payModel']): string {
  switch (value) {
    case 'salary':
      return 'Salary';
    case 'hourly':
      return 'Hourly';
    case 'locums':
      return 'Locums';
    case 'shift':
      return 'Per shift';
    default:
      return 'Pay model unstated';
  }
}

function formatVisaStatus(value: ApiOpportunity['visaSponsorshipStatus']): string {
  switch (value) {
    case 'available':
      return 'Sponsor support';
    case 'case_by_case':
      return 'Case-by-case sponsor';
    case 'not_available':
      return 'No sponsor support';
    default:
      return 'Visa policy unstated';
  }
}

function formatBenefitsStatus(value: ApiOpportunity['benefitsAvailability']): string {
  switch (value) {
    case 'listed':
      return 'Benefits listed';
    case 'limited':
      return 'Some support listed';
    default:
      return 'Benefits not listed';
  }
}

function formatFreshness(value: ApiOpportunity['freshness']): string {
  switch (value?.listingStatus) {
    case 'fresh':
      return 'Fresh';
    case 'aging':
      return 'Aging';
    case 'stale':
      return 'Stale';
    default:
      return 'Unknown freshness';
  }
}

function formatReadinessStatus(value: ApiOpportunity['comparison']): string | null {
  switch (value?.status) {
    case 'ready_now':
      return 'Ready now';
    case 'needs_review':
      return 'Needs review';
    case 'requirements_missing':
      return 'Requirements missing';
    default:
      return null;
  }
}

/* ── Component ───────────────────────────────────────────────── */

export default function ExploreClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isClinician, isLoaded, isSignedIn } = useRoleContext();
  const [specialty, setSpecialty] = useState(() => searchParams.get('specialty') ?? '');
  const [state, setState] = useState(() => searchParams.get('state') ?? '');
  const [hiringType, setHiringType] = useState(() => searchParams.get('hiringType') ?? '');
  const [organizationSlug, setOrganizationSlug] = useState(() => searchParams.get('organizationSlug') ?? '');
  const [remoteOnly, setRemoteOnly] = useState(() => parseRemoteFilter(searchParams.get('remote')));
  const [payModel, setPayModel] = useState(() => searchParams.get('payModel') ?? '');
  const [payMin, setPayMin] = useState(() => searchParams.get('payMin') ?? '');
  const [payMax, setPayMax] = useState(() => searchParams.get('payMax') ?? '');
  const [visaSponsorship, setVisaSponsorship] = useState(() => searchParams.get('visaSponsorship') ?? '');
  const [benefits, setBenefits] = useState(() => searchParams.get('benefits') ?? '');
  const [employerType, setEmployerType] = useState(() => searchParams.get('employerType') ?? '');
  const [startUrgency, setStartUrgency] = useState(() => searchParams.get('startUrgency') ?? '');
  const [readinessStatus, setReadinessStatus] = useState(() => searchParams.get('readinessStatus') ?? '');
  const [missingRequirement, setMissingRequirement] = useState(() => searchParams.get('missingRequirement') ?? '');
  const [showFilters, setShowFilters] = useState(false);

  const [opportunities, setOpportunities] = useState<ApiOpportunity[]>([]);
  const [applications, setApplications] = useState<MobileApplication[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [applyTarget, setApplyTarget] = useState<ApiOpportunity | null>(null);
  const [surfaceControl, setSurfaceControl] = useState<SurfaceControl | null>(null);
  const comparisonFiltersAvailable = Boolean(searchParams.get('npi')) || (isLoaded && isSignedIn && isClinician);

  const fetchOpportunities = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (specialty) params.set('specialty', specialty);
      if (state) params.set('state', state);
      if (hiringType) params.set('hiringType', hiringType);
      if (organizationSlug) params.set('organizationSlug', organizationSlug);
      if (payModel) params.set('payModel', payModel);
      if (payMin) params.set('payMin', payMin);
      if (payMax) params.set('payMax', payMax);
      if (visaSponsorship) params.set('visaSponsorship', visaSponsorship);
      if (benefits) params.set('benefits', benefits);
      if (employerType) params.set('employerType', employerType);
      if (startUrgency) params.set('startUrgency', startUrgency);
      if (comparisonFiltersAvailable && readinessStatus) params.set('readinessStatus', readinessStatus);
      if (comparisonFiltersAvailable && missingRequirement) params.set('missingRequirement', missingRequirement);
      if (searchParams.get('npi')) params.set('npi', searchParams.get('npi') ?? '');
      if (remoteOnly) params.set('remote', '1');
      params.set('limit', '40');

      const res = await fetch(`/api/opportunities?${params}`, {
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (res.ok) {
        const data = await res.json() as {
          opportunities: ApiOpportunity[];
          total: number;
          control?: SurfaceControl | null;
        };
        let opps = data.opportunities ?? [];

        if (remoteOnly) opps = opps.filter(o => o.remote);

        setOpportunities(opps);
        setTotal(remoteOnly ? opps.length : data.total ?? opps.length);
        setSurfaceControl(data.control ?? null);
      } else {
        setOpportunities([]);
        setTotal(0);
        setSurfaceControl(null);
      }
    } catch {
      setOpportunities([]);
      setTotal(0);
      setSurfaceControl(null);
    }
    setLoading(false);
  }, [benefits, comparisonFiltersAvailable, employerType, hiringType, missingRequirement, organizationSlug, payMax, payMin, payModel, readinessStatus, remoteOnly, searchParams, specialty, startUrgency, state, visaSponsorship]);

  useEffect(() => { void fetchOpportunities(); }, [fetchOpportunities]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn || !isClinician) {
      setApplications([]);
      return;
    }

    let cancelled = false;

    void fetch('/api/clinician/applications', {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Unable to load clinician applications.');
        }

        const payload = await response.json() as unknown;
        if (!cancelled) {
          setApplications(normalizeClinicianApplications(payload));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setApplications([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isClinician, isLoaded, isSignedIn]);

  useEffect(() => {
    const nextSpecialty = searchParams.get('specialty') ?? '';
    const nextState = searchParams.get('state') ?? '';
    const nextHiringType = searchParams.get('hiringType') ?? '';
    const nextOrganizationSlug = searchParams.get('organizationSlug') ?? '';
    const nextRemoteOnly = parseRemoteFilter(searchParams.get('remote'));
    const nextPayModel = searchParams.get('payModel') ?? '';
    const nextPayMin = searchParams.get('payMin') ?? '';
    const nextPayMax = searchParams.get('payMax') ?? '';
    const nextVisaSponsorship = searchParams.get('visaSponsorship') ?? '';
    const nextBenefits = searchParams.get('benefits') ?? '';
    const nextEmployerType = searchParams.get('employerType') ?? '';
    const nextStartUrgency = searchParams.get('startUrgency') ?? '';
    const nextReadinessStatus = searchParams.get('readinessStatus') ?? '';
    const nextMissingRequirement = searchParams.get('missingRequirement') ?? '';

    setSpecialty((current) => (current === nextSpecialty ? current : nextSpecialty));
    setState((current) => (current === nextState ? current : nextState));
    setHiringType((current) => (current === nextHiringType ? current : nextHiringType));
    setOrganizationSlug((current) => (current === nextOrganizationSlug ? current : nextOrganizationSlug));
    setRemoteOnly((current) => (current === nextRemoteOnly ? current : nextRemoteOnly));
    setPayModel((current) => (current === nextPayModel ? current : nextPayModel));
    setPayMin((current) => (current === nextPayMin ? current : nextPayMin));
    setPayMax((current) => (current === nextPayMax ? current : nextPayMax));
    setVisaSponsorship((current) => (current === nextVisaSponsorship ? current : nextVisaSponsorship));
    setBenefits((current) => (current === nextBenefits ? current : nextBenefits));
    setEmployerType((current) => (current === nextEmployerType ? current : nextEmployerType));
    setStartUrgency((current) => (current === nextStartUrgency ? current : nextStartUrgency));
    setReadinessStatus((current) => (current === nextReadinessStatus ? current : nextReadinessStatus));
    setMissingRequirement((current) => (current === nextMissingRequirement ? current : nextMissingRequirement));
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());

    if (specialty) {
      params.set('specialty', specialty);
    } else {
      params.delete('specialty');
    }

    if (state) {
      params.set('state', state);
    } else {
      params.delete('state');
    }

    if (hiringType) {
      params.set('hiringType', hiringType);
    } else {
      params.delete('hiringType');
    }

    if (organizationSlug) {
      params.set('organizationSlug', organizationSlug);
    } else {
      params.delete('organizationSlug');
    }

    if (payModel) {
      params.set('payModel', payModel);
    } else {
      params.delete('payModel');
    }

    if (payMin) {
      params.set('payMin', payMin);
    } else {
      params.delete('payMin');
    }

    if (payMax) {
      params.set('payMax', payMax);
    } else {
      params.delete('payMax');
    }

    if (visaSponsorship) {
      params.set('visaSponsorship', visaSponsorship);
    } else {
      params.delete('visaSponsorship');
    }

    if (benefits) {
      params.set('benefits', benefits);
    } else {
      params.delete('benefits');
    }

    if (employerType) {
      params.set('employerType', employerType);
    } else {
      params.delete('employerType');
    }

    if (startUrgency) {
      params.set('startUrgency', startUrgency);
    } else {
      params.delete('startUrgency');
    }

    if (comparisonFiltersAvailable && readinessStatus) {
      params.set('readinessStatus', readinessStatus);
    } else {
      params.delete('readinessStatus');
    }

    if (comparisonFiltersAvailable && missingRequirement) {
      params.set('missingRequirement', missingRequirement);
    } else {
      params.delete('missingRequirement');
    }

    if (remoteOnly) {
      params.set('remote', '1');
    } else {
      params.delete('remote');
    }

    const nextQuery = params.toString();
    const currentQuery = searchParams.toString();

    if (nextQuery === currentQuery) {
      return;
    }

    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [benefits, comparisonFiltersAvailable, employerType, hiringType, missingRequirement, organizationSlug, pathname, payMax, payMin, payModel, readinessStatus, remoteOnly, router, searchParams, specialty, startUrgency, state, visaSponsorship]);

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

  const hasFilters = specialty || state || hiringType || organizationSlug || remoteOnly || payModel || payMin || payMax || visaSponsorship || benefits || employerType || startUrgency || readinessStatus || missingRequirement;
  const applicationsByOpportunityId = new Map(
    applications.map((application) => [application.opportunityId, application]),
  );

  function clearFilters() {
    setSpecialty('');
    setState('');
    setHiringType('');
    setOrganizationSlug('');
    setRemoteOnly(false);
    setPayModel('');
    setPayMin('');
    setPayMax('');
    setVisaSponsorship('');
    setBenefits('');
    setEmployerType('');
    setStartUrgency('');
    setReadinessStatus('');
    setMissingRequirement('');
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
            <select value={payModel} onChange={e => setPayModel(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/80 focus:outline-none focus:border-blue-500/50">
              <option value="">Any Pay Model</option>
              {PAY_MODELS.map((model) => <option key={model} value={model}>{formatPayModel(model as ApiOpportunity['payModel'])}</option>)}
            </select>
            <input
              value={payMin}
              onChange={e => setPayMin(e.target.value)}
              inputMode="numeric"
              placeholder="Pay min"
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/80 placeholder:text-white/35 focus:outline-none focus:border-blue-500/50"
            />
            <input
              value={payMax}
              onChange={e => setPayMax(e.target.value)}
              inputMode="numeric"
              placeholder="Pay max"
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/80 placeholder:text-white/35 focus:outline-none focus:border-blue-500/50"
            />
            <select value={visaSponsorship} onChange={e => setVisaSponsorship(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/80 focus:outline-none focus:border-blue-500/50">
              <option value="">Any Visa Policy</option>
              {VISA_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select value={benefits} onChange={e => setBenefits(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/80 focus:outline-none focus:border-blue-500/50">
              <option value="">Any Benefits Visibility</option>
              {BENEFIT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select value={employerType} onChange={e => setEmployerType(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/80 focus:outline-none focus:border-blue-500/50">
              <option value="">Any Employer Type</option>
              {EMPLOYER_TYPES.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <select value={startUrgency} onChange={e => setStartUrgency(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/80 focus:outline-none focus:border-blue-500/50">
              <option value="">Any Start Window</option>
              {START_URGENCY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer select-none">
              <input type="checkbox" checked={remoteOnly} onChange={e => setRemoteOnly(e.target.checked)} className="rounded" />
              Remote only
            </label>
            {comparisonFiltersAvailable ? (
              <>
                <select value={readinessStatus} onChange={e => setReadinessStatus(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/80 focus:outline-none focus:border-blue-500/50">
                  <option value="">Any Readiness Fit</option>
                  {READINESS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <input
                  value={missingRequirement}
                  onChange={e => setMissingRequirement(e.target.value)}
                  placeholder="Missing requirement"
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/80 placeholder:text-white/35 focus:outline-none focus:border-blue-500/50"
                />
              </>
            ) : null}
          </>
        )}

        {organizationSlug && (
          <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-xs font-medium text-cyan-100">
            Employer: {formatOrganizationLabel(organizationSlug)}
          </span>
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
      {surfaceControl ? (
        <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-amber-100">
          <p className="font-semibold">
            {surfaceControl.mode === 'degraded'
              ? 'Explore is running in degraded mode.'
              : surfaceControl.mode === 'hidden'
                ? 'Explore is temporarily hidden.'
                : 'Explore is temporarily disabled.'}
          </p>
          <p className="mt-1 text-amber-100/80">
            {surfaceControl.reason
              ?? (surfaceControl.mode === 'degraded'
                ? 'Browsing stays available, but operators have limited this surface while a launch issue is being stabilized.'
                : 'Operators have intentionally limited this surface while a launch issue is being mitigated.')}
          </p>
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-7 w-7 text-vt-neutral-800 animate-spin" />
        </div>
      ) : opportunities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 px-6 text-center border border-vt-neutral-800 bg-vt-surface-ops-raised/30 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-vt-neutral-800/50 mb-6 ring-1 ring-white/10 shadow-[inset_0_2px_10px_rgba(255,255,255,0.02)]">
            <Zap className="h-7 w-7 text-vt-neutral-400" />
          </div>
          <h3 className="text-white text-xl font-medium tracking-tight mb-2">No active matches found</h3>
          <p className="text-vt-neutral-300 text-sm max-w-md mb-8">
            The network is updated continuously. There are currently no roles matching this precise filter combination. Broaden your search to see more options.
          </p>
          <button 
            onClick={clearFilters}
            className="rounded-full vt-glass border border-vt-neutral-700 px-6 py-2.5 text-xs font-semibold uppercase tracking-widest text-vt-neutral-200 hover:text-white hover:border-vt-neutral-600 transition-all active:scale-[0.98]"
          >
            Clear Filter Stack
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {opportunities.map(opp => (
            <OpportunityCard
              key={opp.id}
              opp={opp}
              application={applicationsByOpportunityId.get(opp.id) ?? null}
              onApply={() => {
                setApplyTarget(opp);
                updateApplyParam(opp.id);
              }}
            />
          ))}
        </div>
      )}

      {/* Matching CTA */}
      <div className="mt-16 rounded-2xl border border-vt-success/20 bg-vt-success/5 p-8 text-center">
        <ShieldCheck className="mx-auto mb-3 h-6 w-6 text-vt-success" />
        <h3 className="heading-md text-white">Preview your fit in the live flow</h3>
        <p className="body-sm mx-auto mt-2 max-w-md text-vt-neutral-200">
          Start with your public NPI profile and VitalCV will show which live roles align with your current readiness state before you submit.
        </p>
        <Link href="/onboarding" className="mt-5 inline-flex items-center gap-2 rounded-full bg-vt-success px-6 py-3 text-sm font-semibold text-black hover:bg-vt-success/90 transition-transform active:scale-95">
          Preview my fit
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
          existingApplication={applicationsByOpportunityId.get(applyTarget.id) ?? null}
          onSubmitted={(application) => {
            setApplications((current) => upsertClinicianApplication(current, application));
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

function statusClasses(status: string): string {
  switch (applicationStatusTone(status)) {
    case 'emerald':
      return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300';
    case 'sky':
      return 'border-sky-500/20 bg-sky-500/10 text-sky-300';
    case 'rose':
      return 'border-rose-500/20 bg-rose-500/10 text-rose-300';
    case 'zinc':
      return 'border-white/10 bg-white/5 text-white/55';
    case 'amber':
    default:
      return 'border-amber-500/20 bg-amber-500/10 text-amber-200';
  }
}

function OpportunityCard({
  opp,
  application,
  onApply,
}: {
  opp: ApiOpportunity;
  application: MobileApplication | null;
  onApply: () => void;
}) {
  const levelColor = LEVEL_COLORS[opp.requirementLevel] ?? LEVEL_COLORS.L1;
  const levelLabel = LEVEL_LABELS[opp.requirementLevel] ?? 'Verification required';
  const readinessLabel = formatReadinessStatus(opp.comparison);

  function trackOpportunityView() {
    void trackClinicianEventOncePerSession(`explore-opportunity:${opp.id}`, 'clinician.opportunity_viewed', {
      opportunityId: opp.id,
      organizationName: opp.organizationName,
      title: opp.title,
      requirementLevel: opp.requirementLevel,
    });
  }

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-vt-neutral-800 bg-vt-surface-ops-raised/40 p-6 flex flex-col gap-5 transition-all duration-300 hover:border-vt-neutral-700 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)]">
      {/* Dynamic top gradient on hover */}
      <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-emerald-500/0 to-transparent group-hover:via-emerald-500/40 transition-all duration-500" />
      
      {/* Header — employer identity prominent */}
      <div className="flex items-start justify-between gap-3 relative z-10">
        <Link
          href={`/opportunities/${encodeURIComponent(opp.id)}`}
          onClick={trackOpportunityView}
          className="min-w-0 flex-1"
        >
          <h3 className="font-medium text-white leading-tight text-lg group-hover:text-emerald-400 transition-colors hover:text-emerald-300">{opp.title}</h3>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex items-center justify-center w-5 h-5 rounded bg-white/5 border border-white/10">
              <Building2 className="w-3 h-3 text-vt-neutral-300" />
            </div>
            <span className="text-sm font-medium text-vt-neutral-200">{opp.organizationName}</span>
          </div>
        </Link>
      {/* Urgency badge */}
      <div className="flex flex-col items-end gap-2 shrink-0">
        {application ? (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ring-1 ${statusClasses(application.status)}`}>
            {applicationStatusLabel(application.status)}
          </span>
        ) : (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ring-1 ${
            readinessLabel
              ? 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200'
              : 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]'
          }`}>
            {readinessLabel ? <FileCheck2 className="w-3 h-3" /> : <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
            {readinessLabel ?? 'Hiring Now'}
          </span>
        )}
      </div>
      </div>

      {/* Meta grid — key info at a glance */}
      <div className="grid grid-cols-2 gap-2.5 text-sm">
        <div className="flex items-center gap-2 text-vt-neutral-200">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-vt-neutral-400" />
          <span>{opp.remote ? `Remote — ${opp.state} licensed` : opp.state}</span>
        </div>
        <div className="flex items-center gap-2 text-vt-neutral-200">
          <DollarSign className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400/60" />
          <span className="font-medium">{opp.payRange ?? 'Pay not disclosed'}</span>
        </div>
        <div className="flex items-center gap-2 text-vt-neutral-200">
          <Users className="w-3.5 h-3.5 flex-shrink-0 text-vt-neutral-400" />
          <span>{formatPayModel(opp.payModel)} · {HIRING_TYPE_LABELS[opp.hiringType] ?? opp.hiringType}</span>
        </div>
        <div className="flex items-center gap-2 text-vt-neutral-200">
          <Clock className="w-3.5 h-3.5 flex-shrink-0 text-vt-neutral-400" />
          <span className="text-xs">{opp.startTimeline ?? formatFreshness(opp.freshness)}</span>
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
          <span className="text-[11px] font-semibold text-blue-400">
            {opp.freshness?.employerDataStatus === 'complete' ? 'High transparency' : 'Partial transparency'}
          </span>
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
        <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/50">
          {formatVisaStatus(opp.visaSponsorshipStatus)}
        </span>
        <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/50">
          {formatBenefitsStatus(opp.benefitsAvailability)}
        </span>
        <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/40">
          {opp.specialty}
        </span>
      </div>

      {opp.comparison ? (() => {
        const totalReqs = opp.comparison.satisfied.length + opp.comparison.missing.length + opp.comparison.unknown.length;
        const readinessScore = totalReqs > 0 ? Math.round((opp.comparison.satisfied.length / totalReqs) * 100) : 100;
        return (
          <>
            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 relative overflow-hidden mt-2">
              <div className="grid grid-cols-[80px_1fr] gap-y-2 text-sm relative z-10">
                <span className="text-white/40">Role</span>
                <span className="text-white font-medium">{opp.specialty}</span>
                
                <span className="text-white/40">Readiness</span>
                <span className={readinessScore >= 80 ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>{readinessScore}% match</span>
                
                <span className="text-white/40">Blockers</span>
                <span className={opp.comparison.missing.length > 0 ? "text-rose-400" : "text-white/70"}>
                  {opp.comparison.missing.length > 0 ? opp.comparison.missing[0]?.label : 'None'}
                </span>
                
                <span className="text-white/40">Time</span>
                <span className="text-white">{opp.comparison.estimatedGap}</span>
              </div>
            </div>
            
            <AdvisoryPanelUI 
              state="AVAILABLE" 
              variant="light" 
              summary={opp.comparison.shortestPath}
            />
          </>
        );
      })() : (
        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 mt-2 flex items-center justify-between">
           <div>
             <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 flex items-center gap-1.5">
               <ShieldCheck className="w-3 h-3" /> Readiness Engine
             </p>
             <p className="text-xs text-white/70 mt-1">Unlock your verified start timeline</p>
           </div>
           <Link href="/onboarding" className="text-xs font-semibold px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors shrink-0 ml-4">
              Calculate Fit
           </Link>
        </div>
      )}

      {/* CTAs */}
      <div className="mt-auto flex flex-col gap-3 border-t border-white/5 pt-4 sm:flex-row relative z-10">
        <button
          onClick={() => {
            trackOpportunityView();
            onApply();
          }}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all active:scale-[0.98] ${
            application
              ? 'border border-white/10 bg-white/5 text-white hover:bg-white/10'
              : 'bg-gradient-to-b from-vt-success to-emerald-600 text-black shadow-[0_2px_10px_rgba(16,185,129,0.2)] hover:shadow-[0_4px_15px_rgba(16,185,129,0.3)] hover:brightness-110'
          }`}
        >
          <Zap className="w-4 h-4" /> {application ? 'View application' : 'Apply with VitalCV'}
        </button>
        {opp.organizationSlug && (
          <Link
            href={`/employers/${opp.organizationSlug}`}
            className="flex items-center justify-center rounded-xl border border-vt-neutral-800 px-4 py-2.5 text-sm font-medium text-vt-neutral-200 transition-all hover:border-vt-neutral-700 hover:bg-vt-neutral-800/50 hover:text-white vt-glass"
          >
            View proof
          </Link>
        )}
      </div>
    </article>
  );
}
