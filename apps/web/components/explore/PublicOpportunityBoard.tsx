'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  MapPin,
  Search,
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { OpportunitySummary } from '@/lib/launch/marketplace';

type Sort = 'recent' | 'oldest' | 'pay_high' | 'pay_low';

type OpportunityPayload = {
  opportunities?: OpportunitySummary[];
  total?: number;
};

const HIRING_TYPES: Record<string, string> = {
  perm: 'Permanent',
  locums: 'Locums',
  telehealth: 'Telehealth',
  contract: 'Contract',
  per_diem: 'Per diem',
};

const COMMON_SPECIALTIES = [
  'Internal Medicine',
  'Family Medicine',
  'Emergency Medicine',
  'Psychiatry',
  'Cardiology',
  'Pediatrics',
];

function distinct(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))]
    .sort((left, right) => left.localeCompare(right));
}

function formatPay(opportunity: OpportunitySummary): string {
  if (opportunity.payRange) return opportunity.payRange;
  if (opportunity.payRangeMin != null && opportunity.payRangeMax != null) {
    const unit = opportunity.payUnit === 'hour' ? '/hr' : opportunity.payUnit === 'shift' ? '/shift' : '/yr';
    return `$${opportunity.payRangeMin.toLocaleString()}–$${opportunity.payRangeMax.toLocaleString()}${unit}`;
  }
  return 'Compensation not stated';
}

function formatLocation(opportunity: OpportunitySummary): string {
  return opportunity.remote ? `Remote · ${opportunity.state}` : opportunity.state;
}

function formatFreshness(opportunity: OpportunitySummary): { label: string; detail: string; tone: string } {
  switch (opportunity.freshness?.listingStatus) {
    case 'fresh':
      return { label: 'Recently updated', detail: 'The listing is current in VitalCV’s available source data.', tone: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    case 'aging':
      return { label: 'Update aging', detail: 'The listing has not been refreshed recently.', tone: 'text-amber-800 bg-amber-50 border-amber-200' };
    case 'stale':
      return { label: 'Potentially stale', detail: 'Confirm the role is still open before investing time in an application.', tone: 'text-amber-800 bg-amber-50 border-amber-200' };
    default:
      return { label: 'Freshness unknown', detail: 'The current source does not provide a reliable listing-update signal.', tone: 'text-muted-foreground bg-muted border-border' };
  }
}

function formatDate(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function buildSignInHref(opportunity: OpportunitySummary): string {
  const returnTo = `/explore?opportunity=${encodeURIComponent(opportunity.id)}`;
  return `/sign-in?redirect_url=${encodeURIComponent(returnTo)}`;
}

export function PublicOpportunityBoard() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [specialty, setSpecialty] = useState(searchParams.get('specialty') ?? '');
  const [state, setState] = useState(searchParams.get('state') ?? '');
  const [hiringType, setHiringType] = useState(searchParams.get('hiringType') ?? '');
  const [remote, setRemote] = useState(searchParams.get('remote') === '1');
  const [sort, setSort] = useState<Sort>((searchParams.get('sort') as Sort) ?? 'recent');
  const [opportunities, setOpportunities] = useState<OpportunitySummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(searchParams.get('opportunity'));

  const request = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (specialty) params.set('specialty', specialty);
    if (state) params.set('state', state);
    if (hiringType) params.set('hiringType', hiringType);
    if (remote) params.set('remote', '1');
    if (sort !== 'recent') params.set('sort', sort);
    params.set('limit', '50');
    return params;
  }, [hiringType, query, remote, sort, specialty, state]);

  const fetchOpportunities = useCallback(async (signal: AbortSignal) => {
    setLoading(true);
    setFailed(false);
    try {
      const response = await fetch(`/api/opportunities?${request.toString()}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal,
      });
      if (!response.ok) throw new Error('Opportunity feed unavailable');
      const payload = await response.json() as OpportunityPayload;
      setOpportunities(payload.opportunities ?? []);
      setTotal(payload.total ?? payload.opportunities?.length ?? 0);
    } catch (error) {
      if ((error as { name?: string }).name !== 'AbortError') {
        setOpportunities([]);
        setTotal(0);
        setFailed(true);
      }
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => void fetchOpportunities(controller.signal), query ? 220 : 0);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [fetchOpportunities, query]);

  useEffect(() => {
    const publicQuery = new URLSearchParams(request);
    publicQuery.delete('limit');
    const next = publicQuery.toString();
    const target = `/explore${next ? `?${next}` : ''}`;
    window.history.replaceState(null, '', target);
  }, [request]);

  const specialties = useMemo(
    () => distinct([...COMMON_SPECIALTIES, ...opportunities.map((opportunity) => opportunity.specialty)]),
    [opportunities],
  );
  const states = useMemo(() => distinct(opportunities.map((opportunity) => opportunity.state)), [opportunities]);
  const activeFilterCount = [specialty, state, hiringType, remote ? 'remote' : ''].filter(Boolean).length;

  function clearFilters() {
    setQuery('');
    setSpecialty('');
    setState('');
    setHiringType('');
    setRemote(false);
    setSort('recent');
  }

  return (
    <main className="bg-background text-foreground">
      <section className="border-b bg-[linear-gradient(135deg,rgba(11,92,72,0.12),transparent_48%),linear-gradient(180deg,var(--background),var(--muted)/35)]">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
          <div className="max-w-3xl">
            <div className="mb-5 flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">
              <Sparkles className="size-4" aria-hidden="true" />
              Clinical opportunities, with the signal left visible
            </div>
            <h1 className="font-serif text-4xl tracking-tight sm:text-6xl">Find a role worth preparing for.</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
              Search current clinical opportunities. VitalCV shows the stated requirements, source coverage, and freshness we have—instead of turning unknowns into certainty.
            </p>
          </div>

          <div className="mt-9 rounded-2xl border bg-card p-3 shadow-sm">
            <label className="sr-only" htmlFor="opportunity-search">Search clinical roles</label>
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="opportunity-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Specialty, role, employer, or keyword"
                  className="h-12 pl-11 text-base"
                />
              </div>
              <Button type="button" variant="outline" className="h-12" onClick={() => setShowFilters((visible) => !visible)} aria-expanded={showFilters}>
                <SlidersHorizontal className="size-4" aria-hidden="true" />
                Filters{activeFilterCount ? ` · ${activeFilterCount}` : ''}
              </Button>
              <label className="sr-only" htmlFor="opportunity-sort">Sort opportunities</label>
              <select id="opportunity-sort" value={sort} onChange={(event) => setSort(event.target.value as Sort)} className="h-12 rounded-lg border bg-background px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="recent">Most recently updated</option>
                <option value="oldest">Oldest listed</option>
                <option value="pay_high">Highest stated pay</option>
                <option value="pay_low">Lowest stated pay</option>
              </select>
            </div>

            {showFilters && (
              <div className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="grid gap-1.5 text-sm font-medium">Specialty
                  <select value={specialty} onChange={(event) => setSpecialty(event.target.value)} className="h-10 rounded-lg border bg-background px-3 font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <option value="">All specialties</option>
                    {specialties.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm font-medium">State
                  <select value={state} onChange={(event) => setState(event.target.value)} className="h-10 rounded-lg border bg-background px-3 font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <option value="">All states</option>
                    {states.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm font-medium">Engagement
                  <select value={hiringType} onChange={(event) => setHiringType(event.target.value)} className="h-10 rounded-lg border bg-background px-3 font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <option value="">All engagement types</option>
                    {Object.entries(HIRING_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="flex items-end gap-3 rounded-lg border px-3 py-2 text-sm font-medium">
                  <input type="checkbox" checked={remote} onChange={(event) => setRemote(event.target.checked)} className="size-4 accent-emerald-700" />
                  Remote friendly
                </label>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {loading ? 'Updating opportunities…' : `${total} ${total === 1 ? 'opportunity' : 'opportunities'} found`}
          </p>
          {(query || activeFilterCount || sort !== 'recent') && (
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
              <X className="size-4" aria-hidden="true" /> Clear search and filters
            </Button>
          )}
        </div>

        {failed ? (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="flex gap-3 pt-6 text-amber-950"><CircleAlert className="mt-0.5 size-5 shrink-0" /> The opportunity feed is temporarily unavailable. Please try again.</CardContent>
          </Card>
        ) : loading ? (
          <div className="grid gap-4" aria-label="Loading opportunities">
            {[0, 1, 2].map((index) => <div key={index} className="h-52 animate-pulse rounded-2xl border bg-muted/50" />)}
          </div>
        ) : opportunities.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Stethoscope className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
              <h2 className="mt-4 text-xl font-semibold">No roles match this search.</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Try a broader specialty or clear a filter. We show only currently active opportunities in VitalCV’s source data.</p>
              <Button type="button" variant="outline" className="mt-5" onClick={clearFilters}>Clear filters</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {opportunities.map((opportunity) => {
              const freshness = formatFreshness(opportunity);
              const expanded = expandedId === opportunity.id;
              const requirements = opportunity.credentialRequirements ?? [];
              return (
                <Card key={opportunity.id} interactive className="overflow-hidden">
                  <CardHeader className="gap-3 sm:flex sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="mb-3 flex flex-wrap gap-2">
                        <Badge variant="secondary">{opportunity.specialty}</Badge>
                        <Badge variant="outline">{HIRING_TYPES[opportunity.hiringType] ?? opportunity.hiringType}</Badge>
                        {opportunity.remote && <Badge variant="trust-green">Remote</Badge>}
                      </div>
                      <CardTitle className="text-xl sm:text-2xl">{opportunity.title}</CardTitle>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5"><Building2 className="size-4" aria-hidden="true" />{opportunity.organizationName}</span>
                        <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" aria-hidden="true" />{formatLocation(opportunity)}</span>
                      </div>
                    </div>
                    <div className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${freshness.tone}`} title={freshness.detail}>
                      <Clock3 className="size-3.5" aria-hidden="true" />{freshness.label}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {opportunity.description && <p className="max-w-4xl leading-7 text-muted-foreground">{opportunity.description}</p>}
                    <dl className="grid gap-3 border-y py-4 text-sm sm:grid-cols-3">
                      <div><dt className="text-muted-foreground">Compensation</dt><dd className="mt-1 font-medium">{formatPay(opportunity)}</dd></div>
                      <div><dt className="text-muted-foreground">Start timeline</dt><dd className="mt-1 font-medium">{opportunity.startTimeline ?? 'Not stated'}</dd></div>
                      <div><dt className="text-muted-foreground">Source coverage</dt><dd className="mt-1 font-medium">{opportunity.freshness ? `${opportunity.freshness.completenessScore}% available` : 'Not stated'}</dd></div>
                    </dl>

                    {expanded && (
                      <div className="grid gap-5 rounded-xl bg-muted/45 p-4 lg:grid-cols-[1.15fr_0.85fr]">
                        <div>
                          <h3 className="font-semibold">Listed requirements</h3>
                          {requirements.length ? (
                            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                              {requirements.map((requirement) => <li key={`${opportunity.id}-${requirement.label}`} className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" /><span><strong className="font-medium text-foreground">{requirement.label}</strong>{requirement.priority === 'preferred' ? ' · Preferred' : ' · Required'}{requirement.note ? ` · ${requirement.note}` : ''}</span></li>)}
                            </ul>
                          ) : <p className="mt-2 text-sm text-muted-foreground">The employer has not listed structured requirements for this role.</p>}
                        </div>
                        <div>
                          <h3 className="font-semibold">What VitalCV knows</h3>
                          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                            <li><strong className="font-medium text-foreground">Source:</strong> {opportunity.source?.label ?? 'Not stated'}</li>
                            <li><strong className="font-medium text-foreground">Last updated:</strong> {formatDate(opportunity.source?.updatedAt ?? opportunity.updatedAt) ?? 'Not stated'}</li>
                            <li><strong className="font-medium text-foreground">Visa:</strong> {opportunity.transparency?.sponsorshipSupport ?? 'Not stated'}</li>
                          </ul>
                        </div>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="flex flex-wrap justify-between gap-3 border-t">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setExpandedId(expanded ? null : opportunity.id)} aria-expanded={expanded}>
                      {expanded ? 'Hide details' : 'View requirements'} <ChevronDown className={`size-4 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                    </Button>
                    <Button asChild size="sm"><Link href={buildSignInHref(opportunity)}>Sign in to compare and apply <ArrowUpRight className="size-4" aria-hidden="true" /></Link></Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}

        <aside className="mt-10 rounded-2xl border bg-muted/35 p-5 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">A useful match is more than a title and location.</p>
          <p className="mt-1 leading-6">After you sign in, MATCHA can compare a role’s stated requirements against your current evidence. That comparison is personal, explainable, and never shown as a public claim.</p>
        </aside>
      </section>
    </main>
  );
}
