'use client';

/**
 * ReadinessPreview — preview card shown after NPI ingestion.
 *
 * Data priority:
 *   1. realState (ClinicianTrustState from /api/trust-state/:npi)
 *      → name, specialty, exclusion status, gaps, readiness from real artifacts
 *   2. Demo fallback (when isDemo=true or backend unreachable)
 *      → hardcoded profiles keyed by NPI; clearly labelled as demo
 *
 * Non-negotiables:
 *   - "Verified" only appears when identityVerified=true from real claim
 *   - "Clear" on exclusion only when exclusionClear=true from real artifact
 *   - Gaps are surfaced directly from trustStateEngine output
 *   - Demo fallback is always labelled — never presented as verified truth
 *   - Source names and checked timestamps shown where available
 */

import { cn } from '@/lib/utils';
import { Accordion, type AccordionItem } from '@/components/ui/vcv-accordion';
import {
  getTrustStatusBadgeClassName,
  getTrustStatusLabel,
  resolveTrustUiStatus,
  type TrustUiStatus,
} from '@/lib/trust/status-language';

// ── Real trust-state shape (matches trustStateEngine output) ─

export interface CanonicalFact {
  factType:   string;
  source:     string;
  status:     string;
  verifiedAt?: string;
  expiresAt?:  string;
  details?:    string;
}

export interface ClinicianTrustState {
  npi:               string;
  identityVerified:  boolean;
  licensureStatus:   'verified' | 'pending' | 'expired' | 'unknown';
  exclusionClear:    boolean;
  exclusionStatus?:  'CLEAR' | 'EXCLUDED' | 'UNKNOWN';
  credentialCount:   number;
  readiness_level:   'L0' | 'L1' | 'L2' | 'L3';
  readiness_status:  string;
  readiness_score:   number;
  gap_summary:       string[];
  methodology_version: string;
  computed_at:       string;
  facts:             CanonicalFact[];
  gaps:              string[];
}

// ── Demo fallback profiles ────────────────────────────────────

interface DemoProfile {
  name:           string;
  specialty:      string;
  readyFor:       string[];
  missing:        string[];
  estimatedStart: string;
}

const DEMO_PROFILES: Record<string, DemoProfile> = {
  '1234567890': { name: 'Sarah Chen, MD',      specialty: 'Internal Medicine',  readyFor: ['Outpatient', 'Telehealth', 'Inpatient consult'], missing: ['DEA (CA)'],                       estimatedStart: '7–14 days'  },
  '9876543210': { name: 'Marcus Williams, DO', specialty: 'Emergency Medicine', readyFor: ['Outpatient', 'Urgent care'],                       missing: ['Board cert renewal', 'DEA (TX)'], estimatedStart: '21–30 days' },
  '1111111111': { name: 'Priya Nair, MD',      specialty: 'Hospitalist',        readyFor: ['Inpatient', 'Telehealth', 'Outpatient'],            missing: [],                                estimatedStart: 'Ready now'  },
};

const DEMO_FALLBACK: DemoProfile = {
  name: 'John Smith, MD', specialty: 'Emergency Medicine',
  readyFor: ['Outpatient', 'Telehealth'], missing: ['DEA (CA)'], estimatedStart: '14–28 days',
};

type ReadinessTone = 'clear' | 'pending' | 'blocked';

const READINESS_TONE_STYLES: Record<ReadinessTone, { badge: string; panel: string }> = {
  clear: {
    badge: 'border-sky-500/25 bg-sky-500/10 text-sky-200',
    panel: 'border-sky-500/15 bg-sky-500/[0.05]',
  },
  pending: {
    badge: 'border-amber-500/25 bg-amber-500/10 text-amber-200',
    panel: 'border-amber-500/15 bg-amber-500/[0.05]',
  },
  blocked: {
    badge: 'border-rose-500/25 bg-rose-500/10 text-rose-200',
    panel: 'border-rose-500/15 bg-rose-500/[0.06]',
  },
};

const READINESS_TONE_LABELS: Record<ReadinessTone, string> = {
  clear: 'Clear',
  pending: 'Pending',
  blocked: 'Blocked',
};

function buildConfirmedItems(ts: ClinicianTrustState): string[] {
  return [
    ts.identityVerified ? 'Identity verified' : null,
    ts.exclusionClear ? 'OIG clear' : null,
    ts.licensureStatus === 'verified' ? 'Licensure confirmed' : null,
  ].filter((item): item is string => item !== null);
}

function resolveLiveReadinessTone(ts: ClinicianTrustState, gaps: string[]): ReadinessTone {
  if (
    ts.exclusionStatus === 'EXCLUDED'
    || ts.licensureStatus === 'expired'
    || /blocked/i.test(ts.readiness_status)
  ) {
    return 'blocked';
  }

  if (gaps.length === 0 && ts.identityVerified && ts.exclusionClear) {
    return 'clear';
  }

  return 'pending';
}

function resolveDemoReadinessTone(demo: DemoProfile): ReadinessTone {
  return demo.missing.length === 0 ? 'clear' : 'pending';
}

// ── Accordion builder — real facts ───────────────────────────

function sourceRow(source: string, status: TrustUiStatus, checkedAt?: string, note?: string) {
  const when = checkedAt
    ? new Date(checkedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Not checked';

  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[11px]">
      <span className="text-white/25 uppercase tracking-wide">Source</span>
      <span className="text-white/55">{source}</span>
      <span className="text-white/25 uppercase tracking-wide">Status</span>
      <span>
        <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]', getTrustStatusBadgeClassName(status))}>
          {getTrustStatusLabel(status)}
        </span>
      </span>
      <span className="text-white/25 uppercase tracking-wide">Checked</span>
      <span className="text-white/40">{when}</span>
      {note && (<><span className="text-white/25 uppercase tracking-wide">Note</span><span className="text-white/40">{note}</span></>)}
    </div>
  );
}

function buildRealAccordion(ts: ClinicianTrustState): AccordionItem[] {
  const checkedAt  = ts.computed_at;
  const npiStatus  = resolveTrustUiStatus({ state: 'live', kind: 'verification', satisfied: ts.identityVerified });
  const licStatus  = ts.licensureStatus === 'verified' ? 'verified' : 'access_required';
  const exclStatus = resolveTrustUiStatus({ state: 'live', kind: 'clearance', satisfied: ts.exclusionClear });

  // M3: Source honesty — only list sources that are actually connected in this run.
  // NPDB, SAM.gov are not integrated (require institutional subscription).
  // ABMS board cert and DEA are not connected (require institutional access).
  // Showing them would imply they were checked — that is trust theater.
  return [
    {
      id: 'identity', trigger: 'Identity', status: npiStatus,
      content: sourceRow('CMS NPPES · NPI Registry', npiStatus, checkedAt),
    },
    {
      id: 'exclusion', trigger: 'Exclusion (OIG)', status: exclStatus,
      content: sourceRow('OIG / LEIE', exclStatus, checkedAt,
        exclStatus !== 'clear'
          ? 'NPDB and SAM.gov require institutional access — not checked in this run'
          : undefined,
      ),
    },
    {
      id: 'licensure', trigger: 'Licensure', status: licStatus,
      content: sourceRow(
        licStatus === 'verified' ? 'State Board (Nursys / FSMB)' : 'State Board — access required',
        licStatus, checkedAt,
        licStatus !== 'verified'
          ? 'License verification requires institutional source access (Nursys / FSMB). Not yet configured.'
          : undefined,
      ),
    },
    {
      id: 'board', trigger: 'Board Certification', status: 'access_required',
      // M3: ABMS not connected — honest label, not "pending check"
      content: sourceRow('ABMS — access required', 'access_required', undefined,
        'Board certification check not available without ABMS institutional access.'),
    },
    {
      id: 'dea', trigger: 'DEA Registration', status: 'access_required',
      // M3: DEA not connected — honest label
      content: sourceRow('DEA — access required', 'access_required', undefined,
        'DEA registration check not available without institutional access.'),
    },
  ];
}

function buildDemoAccordion(missing: string[]): AccordionItem[] {
  const deaStatus   = missing.some(m => m.toLowerCase().includes('dea'))   ? 'access_required' : 'access_required';
  const boardStatus = missing.some(m => m.toLowerCase().includes('board')) ? 'access_required' : 'access_required';

  // M3: Demo accordion also uses honest source names.
  // ABMS, DEA, NPDB, SAM.gov are not integrated — do not show them as checked.
  return [
    {
      id: 'identity', trigger: 'Identity', status: 'demo',
      content: sourceRow('CMS NPPES · NPI Registry', 'demo', undefined,
        'Preview only — live identity checks run after a real lookup.'),
    },
    {
      id: 'exclusion', trigger: 'Exclusion (OIG)', status: 'demo',
      // M3: removed NPDB and SAM.gov — not checked
      content: sourceRow('OIG / LEIE', 'demo', undefined,
        'Preview only — NPDB and SAM.gov require separate institutional access'),
    },
    {
      id: 'licensure', trigger: 'Licensure', status: 'demo',
      content: sourceRow('State Board (Nursys / FSMB)', 'demo', undefined,
        'Preview only — live licensure checks depend on source access.'),
    },
    {
      id: 'board', trigger: 'Board Certification', status: boardStatus,
      // M3: ABMS not connected — demo shows honest pending state
      content: sourceRow('ABMS — access required', boardStatus, undefined,
        'Not checked in demo — requires ABMS institutional access'),
    },
    {
      id: 'dea', trigger: 'DEA Registration', status: deaStatus,
      // M3: DEA not connected
      content: sourceRow('DEA — access required', deaStatus, undefined,
        'Not checked in demo — requires institutional access'),
    },
  ];
}

// ── Component ─────────────────────────────────────────────────

interface Props {
  npi:        string;
  realState:  ClinicianTrustState | null;
  isDemo:     boolean;
  visible:    boolean;
  onContinue: () => void;
}

export function ReadinessPreview({ npi, realState, isDemo, visible, onContinue }: Props) {

  // ── Real-data path ───────────────────────────────────────
  if (realState && !isDemo) {
    const ts            = realState;
    const accordionItems = buildRealAccordion(ts);
    const checkedTime   = new Date(ts.computed_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    // Extract name from facts
    const identityFact = ts.facts.find(f => f.factType === 'PERSONAL_IDENTITY' || f.factType === 'NPI_IDENTITY');
    const displayName  = identityFact?.details ?? `NPI ${ts.npi}`;

    // Specialty from facts
    const specFact    = ts.facts.find(f => f.factType === 'SPECIALTY');
    const displaySpec = specFact?.details ?? 'Provider';

    // Readable gaps
    const gaps = ts.gap_summary.length > 0 ? ts.gap_summary : ts.gaps;
    const confirmedItems = buildConfirmedItems(ts);
    const readinessTone = resolveLiveReadinessTone(ts, gaps);

    return (
      <div
        className="mt-4 transition-all duration-500"
        style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(6px)' }}
        aria-live="polite"
      >
        <div className="rounded-2xl border border-white/8 bg-white/4 overflow-hidden">

          {/* Header — real provenance */}
          <div className="px-5 py-4 border-b border-white/6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
                {ts.identityVerified ? 'Identity verified' : 'Identity record found'}
              </span>
            </div>
            <span className="text-[10px] text-white/20 font-mono">
              Checked {checkedTime}
            </span>
          </div>

          {/* Name + specialty from real data */}
          <div className="px-5 py-4 border-b border-white/6">
            <p className="text-lg font-bold text-white leading-tight">{displayName}</p>
            <p className="text-sm text-white/40 mt-0.5">{displaySpec}</p>
            <div className={cn('mt-4 rounded-xl border px-4 py-3', READINESS_TONE_STYLES[readinessTone].panel)}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">Readiness</p>
                  <p className="mt-2 text-sm font-semibold text-white">{ts.readiness_status}</p>
                  <p className="mt-1 text-[11px] text-white/45">{ts.readiness_score}/100 · {ts.readiness_level}</p>
                </div>
                <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]', READINESS_TONE_STYLES[readinessTone].badge)}>
                  {READINESS_TONE_LABELS[readinessTone]}
                </span>
              </div>
            </div>
          </div>

          {/* Blockers + confirmed state */}
          <div className="px-5 py-4 border-b border-white/6">
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/25 mb-3">
              {gaps.length === 0 ? 'Current blockers' : 'What still needs attention'}
            </p>
            <div className="space-y-2">
              {gaps.length === 0 ? (
                <div className="flex items-center gap-2">
                  <span className="text-white/55 text-sm leading-none shrink-0">✔</span>
                  <span className="text-xs text-white/45">No blockers surfaced in this run.</span>
                </div>
              ) : gaps.slice(0, 3).map(gap => (
                <div key={gap} className="flex items-start gap-2">
                  <span className="text-white/25 text-sm leading-none shrink-0 mt-px">✖</span>
                  <span className="text-xs text-white/55 leading-tight">{gap}</span>
                </div>
              ))}
            </div>
            {confirmedItems.length > 0 && (
              <>
                <p className="mt-4 text-[9px] font-bold uppercase tracking-[0.18em] text-white/25">Confirmed in this run</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {confirmedItems.map(item => (
                    <span key={item} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/60">
                      {item}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Source accordion — real provenance */}
          <div className="px-5 py-4 border-b border-white/6">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/20 mb-2">Source verification</p>
            <Accordion items={accordionItems} />
          </div>

          {/* CTA */}
          <div className="px-5 py-4">
            <button type="button" onClick={onContinue}
              className="w-full rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 px-5 py-3.5 font-semibold text-white text-sm transition-all active:scale-[0.98]">
              Continue to your passport →
            </button>
            <p className="mt-2 text-center text-[10px] text-white/20">
              Snapshot built from connected sources · {ts.methodology_version}
            </p>
          </div>

        </div>
      </div>
    );
  }

  // ── Demo fallback path ───────────────────────────────────
  const demo   = DEMO_PROFILES[npi] ?? DEMO_FALLBACK;
  const accordion = buildDemoAccordion(demo.missing);
  const readinessTone = resolveDemoReadinessTone(demo);

  return (
    <div
      className="mt-4 transition-all duration-500"
      style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(6px)' }}
      aria-live="polite"
    >
      <div className="rounded-2xl border border-white/8 bg-white/4 overflow-hidden">

        {/* Demo banner — clearly labelled */}
        <div className="border-b border-amber-500/20 bg-amber-500/10 px-5 py-3">
          <p className="text-[11px] font-semibold text-amber-100">Example — sign in for real data</p>
        </div>

        {/* Name + specialty */}
        <div className="px-5 py-4 border-b border-white/6">
          <p className="text-lg font-bold text-white leading-tight">{demo.name}</p>
          <p className="text-sm text-white/40 mt-0.5">{demo.specialty}</p>
          <div className={cn('mt-4 rounded-xl border px-4 py-3', READINESS_TONE_STYLES[readinessTone].panel)}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">Readiness</p>
                <p className="mt-2 text-sm font-semibold text-white">Estimated start: {demo.estimatedStart}</p>
                <p className="mt-1 text-[11px] text-white/45">Example preview only</p>
              </div>
              <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]', READINESS_TONE_STYLES[readinessTone].badge)}>
                {READINESS_TONE_LABELS[readinessTone]}
              </span>
            </div>
          </div>
        </div>

        {/* Ready / Missing */}
        <div className="px-5 py-4 border-b border-white/6">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/25 mb-3">
            {demo.missing.length === 0 ? 'Current blockers' : 'What this example is missing'}
          </p>
          <div className="space-y-2">
            {demo.missing.length === 0 ? (
              <div className="flex items-center gap-2">
                <span className="text-white/55 text-sm leading-none shrink-0">✔</span>
                <span className="text-xs text-white/45">No blockers in this example.</span>
              </div>
            ) : demo.missing.slice(0, 3).map(item => (
              <div key={item} className="flex items-center gap-2">
                <span className="text-white/25 text-sm leading-none shrink-0">✖</span>
                <span className="text-xs text-white/55">{item}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[9px] font-bold uppercase tracking-[0.18em] text-white/25">Ready in this example</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {demo.readyFor.map(item => (
              <span key={item} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/60">
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* Source accordion */}
        <div className="px-5 py-4 border-b border-white/6">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/20 mb-2">Source verification</p>
          <Accordion items={accordion} />
        </div>

        {/* CTA */}
        <div className="px-5 py-4">
          <button type="button" onClick={onContinue}
            className="w-full rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 px-5 py-3.5 font-semibold text-white text-sm transition-all active:scale-[0.98]">
            Continue to your passport →
          </button>
          <p className="mt-2 text-center text-[10px] text-white/20">
            Demo preview only · live data appears after a real source run
          </p>
        </div>

      </div>
    </div>
  );
}
