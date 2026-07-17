'use client';

import * as React from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Bookmark,
  Building2,
  Check,
  Clock3,
  ExternalLink,
  MapPin,
  RotateCcw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Users,
} from 'lucide-react';
import ApplyModal from '@/components/explore/ApplyModal';
import { useClinicianMobile } from '@/components/mobile/ClinicianMobileProvider';
import { ClinicianStatusBanner } from '@/components/mobile/ClinicianStatusBanner';
import { useOpportunityActions } from '@/components/matcha/useOpportunityActions';
import type { OpportunityStatus } from '@/lib/matcha/opportunityActions';
import type { MobileMatchBand, MobileOpportunityCard } from '@/lib/mobile/dashboard';
import { trackClinicianEventOncePerSession } from '@/lib/mobile/analytics';

type SwipeDirection = 'left' | 'right' | null;

const SWIPE_THRESHOLD = 110;

function formatAge(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return 'Updated recently';
  const days = Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
  if (days === 0) return 'Updated today';
  if (days === 1) return 'Updated yesterday';
  return `Updated ${days} days ago`;
}

function matchTone(band: MobileMatchBand | undefined) {
  switch (band) {
    case 'CLEAR':
      return { label: 'Clear to apply', className: 'border-emerald-300/30 bg-emerald-300/12 text-emerald-100' };
    case 'NEAR_CLEAR':
      return { label: 'Nearly ready', className: 'border-sky-300/30 bg-sky-300/12 text-sky-100' };
    case 'PARTIAL':
      return { label: 'Partial fit', className: 'border-amber-300/30 bg-amber-300/12 text-amber-100' };
    case 'INELIGIBLE':
      return { label: 'Needs review', className: 'border-white/15 bg-white/8 text-white/70' };
    default:
      return { label: 'Live role', className: 'border-white/15 bg-white/8 text-white/70' };
  }
}

function actionForDirection(direction: Exclude<SwipeDirection, null>): OpportunityStatus {
  return direction === 'right' ? 'connected' : 'declined';
}

export function ClinicianSwipeBoard({ opportunities }: { opportunities: readonly MobileOpportunityCard[] }) {
  const { data, applySubmitted, selectOpportunity } = useClinicianMobile();
  const { loaded, bucketOf, setStatus, counts } = useOpportunityActions();
  const reducedMotion = useReducedMotion();
  const [queueIds, setQueueIds] = React.useState<string[]>(() => opportunities.map((opportunity) => opportunity.id));
  const [direction, setDirection] = React.useState<SwipeDirection>(null);
  const [activeOpportunityId, setActiveOpportunityId] = React.useState<string | null>(null);
  const [showAll, setShowAll] = React.useState(false);
  const [hasStarted, setHasStarted] = React.useState(false);
  const [decisionMessage, setDecisionMessage] = React.useState('');
  const [lastDecision, setLastDecision] = React.useState<{ id: string; title: string; status: OpportunityStatus } | null>(null);
  const [isAdvancing, setIsAdvancing] = React.useState(false);

  const ordered = React.useMemo(() => {
    if (!loaded || showAll) return [...opportunities];
    return [...opportunities].sort((a, b) => {
      const aBucket = bucketOf(a.id);
      const bBucket = bucketOf(b.id);
      if (aBucket === 'new' && bBucket !== 'new') return -1;
      if (aBucket !== 'new' && bBucket === 'new') return 1;
      return 0;
    });
  }, [bucketOf, loaded, opportunities, showAll]);

  React.useEffect(() => {
    const initialQueue = showAll
      ? ordered.map((opportunity) => opportunity.id)
      : ordered.filter((opportunity) => bucketOf(opportunity.id) === 'new').map((opportunity) => opportunity.id);
    setQueueIds(initialQueue);
    setDirection(null);
    setHasStarted(false);
  }, [loaded, opportunities, showAll]);

  const visible = queueIds
    .map((id) => opportunities.find((opportunity) => opportunity.id === id) ?? null)
    .filter((opportunity): opportunity is MobileOpportunityCard => Boolean(opportunity));
  const current = visible[0] ?? null;
  const next = visible[1] ?? null;
  const countsByBucket = counts(opportunities.map((opportunity) => opportunity.id));
  const finished = visible.length === 0;
  const reviewedCount = showAll ? opportunities.length - visible.length : opportunities.length - countsByBucket.new;
  const activeOpportunity = opportunities.find((opportunity) => opportunity.id === activeOpportunityId) ?? null;
  const existingApplication = activeOpportunity
    ? data.activeApplications.find((application) => application.opportunityId === activeOpportunity.id) ?? null
    : null;

  React.useEffect(() => {
    if (!current || hasStarted) return;
    setHasStarted(true);
    void trackClinicianEventOncePerSession(`opportunity-board:${current.id}`, 'clinician.opportunity_viewed', {
      npi: data.workspace?.personProfile?.npi ?? null,
      opportunityId: current.id,
      organizationId: current.organizationId,
      requirementLevel: current.requirementLevel,
    });
  }, [current, data.workspace?.personProfile?.npi, hasStarted]);

  const advance = React.useCallback((swipeDirection: Exclude<SwipeDirection, null>) => {
    if (!current || isAdvancing) return;
    setIsAdvancing(true);
    setDirection(swipeDirection);
    const status = actionForDirection(swipeDirection);
    setStatus(current.id, status);
    setQueueIds((ids) => ids.filter((id) => id !== current.id));
    setDecisionMessage(`${swipeDirection === 'right' ? 'Yes' : 'No'}: ${current.title} at ${current.organizationName}`);
    setLastDecision({ id: current.id, title: current.title, status });
    window.setTimeout(() => {
      setDirection(null);
      setHasStarted(false);
      setIsAdvancing(false);
    }, reducedMotion ? 0 : 260);
  }, [current, isAdvancing, reducedMotion, setStatus]);

  const saveForLater = React.useCallback(() => {
    if (!current || isAdvancing) return;
    setIsAdvancing(true);
    setStatus(current.id, 'saved');
    setQueueIds((ids) => ids.filter((id) => id !== current.id));
    setDecisionMessage(`Maybe later: ${current.title} at ${current.organizationName}`);
    setLastDecision({ id: current.id, title: current.title, status: 'saved' });
    setHasStarted(false);
    window.setTimeout(() => setIsAdvancing(false), reducedMotion ? 0 : 180);
  }, [current, isAdvancing, reducedMotion, setStatus]);

  const onDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (Math.abs(info.offset.x) < SWIPE_THRESHOLD) return;
    advance(info.offset.x > 0 ? 'right' : 'left');
  };

  const reset = () => {
    const initialQueue = showAll
      ? opportunities.map((opportunity) => opportunity.id)
      : opportunities.filter((opportunity) => bucketOf(opportunity.id) === 'new').map((opportunity) => opportunity.id);
    setQueueIds(initialQueue);
    setDirection(null);
    setHasStarted(false);
    setDecisionMessage('');
    setLastDecision(null);
  };

  const undoLast = () => {
    if (!lastDecision) return;
    setStatus(lastDecision.id, lastDecision.status);
    setQueueIds((ids) => [lastDecision.id, ...ids.filter((id) => id !== lastDecision.id)]);
    setDecisionMessage(`${lastDecision.title} returned to your review queue.`);
    setLastDecision(null);
  };

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#101716] px-4 py-5 text-white shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:px-8 sm:py-8" aria-labelledby="swipe-board-title">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_8%,rgba(54,211,153,0.13),transparent_35%),radial-gradient(circle_at_15%_100%,rgba(56,189,248,0.09),transparent_32%)]" />
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-100">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              MATCHA board
            </div>
            <h2 id="swipe-board-title" className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Find your next right move.</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/60">Swipe through roles matched to your evidence. Yes connects, no removes, and maybe later keeps the role in your saved queue.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/55" aria-label="Board counts">
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5"><strong className="text-white">{countsByBucket.new}</strong> new</span>
            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5"><strong className="text-white">{countsByBucket.saved}</strong> later</span>
          </div>
        </div>

        {opportunities.length === 0 ? (
          <div className="relative mt-8">
            <ClinicianStatusBanner tone="info" title="No matching roles available right now" detail="When a live role fits your readiness profile, it will appear here." actionHref="/holder/readiness" actionLabel="View readiness" />
          </div>
        ) : finished || !current ? (
          <div className="relative mt-8 rounded-[28px] border border-white/10 bg-white/[0.05] px-6 py-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-100"><Check className="h-7 w-7" aria-hidden="true" /></div>
            <h3 className="mt-5 text-xl font-semibold">You’re caught up.</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/60">You’ve reviewed every role in this queue. Bring saved roles back into view or refresh for new matches.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={reset} className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-slate-950 transition hover:bg-white/90"><RotateCcw className="h-4 w-4" aria-hidden="true" /> Review again</button>
              <button type="button" onClick={() => { setShowAll(true); reset(); }} className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.05] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.1]"><Bookmark className="h-4 w-4" aria-hidden="true" /> View saved roles</button>
            </div>
          </div>
        ) : (
          <>
            <div className="relative mx-auto mt-8 min-h-[500px] max-w-2xl" aria-live="polite">
              {next ? <div className="absolute inset-x-3 top-3 h-[480px] rounded-[28px] border border-white/10 bg-white/[0.04] sm:inset-x-6" aria-hidden="true" /> : null}
              <AnimatePresence initial={false} custom={direction}>
                <motion.div
                  key={current.id}
                  custom={direction}
                  initial={reducedMotion ? false : { opacity: 0, y: 42, scale: 0.96 }}
                  animate={{ opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 }}
                  exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: direction === 'right' ? 520 : -520, rotate: direction === 'right' ? 12 : -12, transition: { duration: 0.28, ease: 'easeOut' } }}
                  transition={{ duration: reducedMotion ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
                  drag={reducedMotion ? false : 'x'}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.75}
                  onDragEnd={onDragEnd}
                  tabIndex={0}
                  style={{ touchAction: 'pan-y' }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') setActiveOpportunityId(current.id);
                    if (activeOpportunityId) return;
                    if (event.key === 'ArrowRight') { event.preventDefault(); advance('right'); }
                    if (event.key === 'ArrowLeft') { event.preventDefault(); advance('left'); }
                    if (event.key === 'ArrowDown' || event.key.toLowerCase() === 's') { event.preventDefault(); saveForLater(); }
                  }}
                  className="relative flex min-h-[480px] cursor-grab flex-col rounded-[28px] border border-white/15 bg-[#f8faf8] p-5 text-slate-950 shadow-[0_24px_60px_rgba(0,0,0,0.3)] outline-none ring-emerald-300/60 focus-visible:ring-4 active:cursor-grabbing sm:p-7"
                  role="group"
                  aria-roledescription="job opportunity"
                  aria-keyshortcuts="ArrowLeft ArrowRight ArrowDown S"
                  aria-label={`${current.title} at ${current.organizationName}. Drag right for yes, left for no.`}
                >
                  <SwipeCard opportunity={current} onOpen={() => setActiveOpportunityId(current.id)} />
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="sr-only" role="status" aria-live="polite">{decisionMessage}</div>

            <div className="mx-auto mt-5 flex max-w-2xl flex-wrap items-center justify-center gap-3" aria-label="Swipe decisions">
              <button type="button" disabled={isAdvancing} onClick={() => advance('left')} className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-rose-200/25 bg-rose-300/10 px-5 text-sm font-semibold text-rose-100 transition hover:bg-rose-300/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200 disabled:cursor-not-allowed disabled:opacity-50"><ThumbsDown className="h-4 w-4" aria-hidden="true" /> No</button>
              <button type="button" disabled={isAdvancing} onClick={saveForLater} className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-amber-200/25 bg-amber-300/10 px-5 text-sm font-semibold text-amber-100 transition hover:bg-amber-300/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-50"><Bookmark className="h-4 w-4" aria-hidden="true" /> Maybe later</button>
              <button type="button" disabled={isAdvancing} onClick={() => advance('right')} className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-emerald-300 px-5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"><ThumbsUp className="h-4 w-4" aria-hidden="true" /> Yes</button>
            </div>
            {lastDecision ? <div className="mt-3 text-center"><button type="button" onClick={undoLast} className="text-xs font-semibold text-white/65 underline underline-offset-4 transition hover:text-white">Undo {lastDecision.status === 'saved' ? 'Maybe later' : lastDecision.status === 'connected' ? 'Yes' : 'No'}</button></div> : null}
            <p className="mt-4 text-center text-xs text-white/45">Drag the card, use the buttons, or press ← no · ↓ maybe later · → yes</p>
            <div className="mx-auto mt-5 h-1.5 max-w-2xl overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={Math.max(opportunities.length, 1)} aria-valuenow={reviewedCount} aria-label="Roles reviewed">
              <div className="h-full rounded-full bg-emerald-300 transition-[width] duration-500" style={{ width: `${Math.min(100, (reviewedCount / Math.max(opportunities.length, 1)) * 100)}%` }} />
            </div>
          </>
        )}

        <div className="relative mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-xs text-white/45">
          <span>{showAll ? 'Showing all roles' : 'Showing new roles first'}</span>
          <button type="button" onClick={() => { setShowAll((value) => !value); reset(); }} className="font-semibold text-white/75 underline-offset-4 hover:text-white hover:underline">{showAll ? 'Show new only' : 'Review saved roles'}</button>
        </div>
      </div>

      {activeOpportunity ? (
        <ApplyModal
          opportunity={{ id: activeOpportunity.id, title: activeOpportunity.title, specialty: activeOpportunity.specialty, hiringType: activeOpportunity.hiringType, state: activeOpportunity.state, organizationName: activeOpportunity.organizationName }}
          existingApplication={existingApplication}
          onSubmitted={(application) => applySubmitted(application)}
          onClose={() => { setActiveOpportunityId(null); selectOpportunity(null); }}
        />
      ) : null}
    </section>
  );
}

function SwipeCard({ opportunity, onOpen }: { opportunity: MobileOpportunityCard; onOpen: () => void }) {
  const match = matchTone(opportunity.match?.band);
  const visibleReasons = opportunity.match?.fitReasons.slice(0, 3) ?? [];
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500"><Building2 className="h-3.5 w-3.5" aria-hidden="true" /> {opportunity.organizationName}</p>
          <h3 className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{opportunity.title}</h3>
        </div>
        <span className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${match.className}`}>{match.label}</span>
      </div>
      <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600">
        <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-slate-400" aria-hidden="true" />{opportunity.remote ? 'Remote' : opportunity.state}</span>
        <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4 text-slate-400" aria-hidden="true" />{opportunity.specialty}</span>
        {opportunity.payRange ? <span className="inline-flex items-center gap-1.5 font-medium text-slate-800"><Banknote className="h-4 w-4 text-emerald-700" aria-hidden="true" />{opportunity.payRange}</span> : null}
      </div>
      {opportunity.description ? <p className="mt-5 line-clamp-3 text-sm leading-6 text-slate-600">{opportunity.description}</p> : null}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Why MATCHA surfaced this</p>
        {visibleReasons.length ? <ul className="mt-3 space-y-2">{visibleReasons.map((reason) => <li key={reason} className="flex items-start gap-2 text-sm leading-5 text-slate-700"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />{reason}</li>)}</ul> : <p className="mt-3 text-sm leading-5 text-slate-600">This role is being compared against your current evidence. Open the details to see requirements and next steps.</p>}
      </div>
      {opportunity.match?.blockers.length ? <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">Still to review</p><ul className="mt-2 space-y-1 text-sm text-amber-950">{opportunity.match.blockers.slice(0, 2).map((blocker) => <li key={blocker.label}>{blocker.label}</li>)}</ul></div> : null}
      <div className="mt-auto pt-6">
        <div className="flex items-center justify-between gap-3 text-xs text-slate-500"><span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" />{formatAge(opportunity.createdAt)}</span><span>{opportunity.hiringType.replaceAll('_', ' ')}</span></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={onOpen} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800">Review & apply <ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
          <Link href={`/opportunities/${encodeURIComponent(opportunity.id)}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50">Role details <ExternalLink className="h-4 w-4" aria-hidden="true" /></Link>
        </div>
      </div>
    </>
  );
}

export { actionForDirection };
