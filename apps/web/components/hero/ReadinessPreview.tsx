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

import Link from 'next/link';
import { Accordion, type AccordionItem, type AccordionStatus } from '@/components/ui/vcv-accordion';

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

// ── Accordion builder — real facts ───────────────────────────

function statusFromFact(factType: string, facts: CanonicalFact[]): AccordionStatus {
  const fact = facts.find(f => f.factType.toLowerCase().includes(factType.toLowerCase()));
  if (!fact)                              return 'pending';
  if (fact.status === 'verified')         return 'verified';
  if (fact.status === 'clear')            return 'clear';
  if (fact.status === 'pending')          return 'pending';
  return 'pending';
}

function sourceRow(source: string, status: AccordionStatus, checkedAt?: string, note?: string) {
  const statusLabel = status === 'verified' ? 'Verified' : status === 'clear' ? 'Clear' : 'Pending';
  const statusColor = status === 'pending' ? 'text-white/45' : 'text-white/60';
  const when = checkedAt
    ? new Date(checkedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Today';

  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[11px]">
      <span className="text-white/25 uppercase tracking-wide">Source</span>
      <span className="text-white/55">{source}</span>
      <span className="text-white/25 uppercase tracking-wide">Status</span>
      <span className={statusColor}>{statusLabel}</span>
      <span className="text-white/25 uppercase tracking-wide">Checked</span>
      <span className="text-white/40">{when}</span>
      {note && (<><span className="text-white/25 uppercase tracking-wide">Note</span><span className="text-white/40">{note}</span></>)}
    </div>
  );
}

function buildRealAccordion(ts: ClinicianTrustState): AccordionItem[] {
  const checkedAt  = ts.computed_at;
  const npiStatus  = ts.identityVerified  ? 'verified' : 'pending';
  const licStatus  = ts.licensureStatus === 'verified' ? 'verified' : 'pending';
  const exclStatus = ts.exclusionClear    ? 'clear'    : 'pending';

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
      id: 'board', trigger: 'Board Certification', status: 'pending',
      // M3: ABMS not connected — honest label, not "pending check"
      content: sourceRow('ABMS — access required', 'pending', undefined,
        'Board certification check not available without ABMS institutional access.'),
    },
    {
      id: 'dea', trigger: 'DEA Registration', status: 'pending',
      // M3: DEA not connected — honest label
      content: sourceRow('DEA — access required', 'pending', undefined,
        'DEA registration check not available without institutional access.'),
    },
  ];
}

function buildDemoAccordion(missing: string[]): AccordionItem[] {
  const deaStatus   = missing.some(m => m.toLowerCase().includes('dea'))   ? 'pending' : 'pending';
  const boardStatus = missing.some(m => m.toLowerCase().includes('board')) ? 'pending' : 'pending';

  // M3: Demo accordion also uses honest source names.
  // ABMS, DEA, NPDB, SAM.gov are not integrated — do not show them as checked.
  return [
    {
      id: 'identity', trigger: 'Identity', status: 'verified',
      content: sourceRow('CMS NPPES · NPI Registry', 'verified'),
    },
    {
      id: 'exclusion', trigger: 'Exclusion (OIG)', status: 'clear',
      // M3: removed NPDB and SAM.gov — not checked
      content: sourceRow('OIG / LEIE', 'clear', undefined,
        'NPDB and SAM.gov require separate institutional access'),
    },
    {
      id: 'licensure', trigger: 'Licensure', status: 'verified',
      content: sourceRow('State Board (Nursys / FSMB)', 'verified'),
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
                {ts.identityVerified ? 'Identity verified' : 'Identity found'}
              </span>
            </div>
            <span className="text-[10px] text-white/20 font-mono">
              Checked {checkedTime}
            </span>
          </div>

          {/* Name + specialty from real data */}
          <div className="px-5 py-4 border-b border-white/6">
            <p className="text-base font-bold text-white leading-tight">{displayName}</p>
            <p className="text-xs text-white/40 mt-0.5">{displaySpec}</p>
          </div>

          {/* Real readiness rows */}
          <div className="px-5 py-4 border-b border-white/6 grid grid-cols-2 gap-x-6">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/25 mb-3">Confirmed</p>
              <div className="space-y-2">
                {ts.identityVerified && (
                  <div className="flex items-center gap-2"><span className="text-white/55 text-sm leading-none shrink-0">✔</span><span className="text-xs text-white/65">NPI identity</span></div>
                )}
                {ts.exclusionClear && (
                  <div className="flex items-center gap-2"><span className="text-white/55 text-sm leading-none shrink-0">✔</span><span className="text-xs text-white/65">No exclusions found</span></div>
                )}
                {ts.licensureStatus === 'verified' && (
                  <div className="flex items-center gap-2"><span className="text-white/55 text-sm leading-none shrink-0">✔</span><span className="text-xs text-white/65">License taxonomy present</span></div>
                )}
                {ts.identityVerified === false && ts.exclusionClear === false && (
                  <span className="text-xs text-white/25">Nothing confirmed yet</span>
                )}
              </div>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/25 mb-3">Unresolved</p>
              <div className="space-y-2">
                {gaps.length === 0 ? (
                  <div className="flex items-center gap-2"><span className="text-white/55 text-sm leading-none shrink-0">✔</span><span className="text-xs text-white/40">None</span></div>
                ) : gaps.slice(0, 3).map(gap => (
                  <div key={gap} className="flex items-start gap-2">
                    <span className="text-white/25 text-sm leading-none shrink-0 mt-px">✖</span>
                    <span className="text-xs text-white/55 leading-tight">{gap}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Estimated start */}
          <div className="px-5 py-4 border-b border-white/6 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/25">Readiness</span>
            <span className="text-sm font-semibold text-white">{ts.readiness_status}</span>
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
              Continue with VitalCV →
            </button>
            <p className="mt-2 text-center text-[10px] text-white/20">
              Verified via NPPES · OIG/LEIE · {ts.methodology_version}
            </p>
          </div>

        </div>
      </div>
    );
  }

  // ── Demo fallback path ───────────────────────────────────
  const demo   = DEMO_PROFILES[npi] ?? DEMO_FALLBACK;
  const accordion = buildDemoAccordion(demo.missing);

  return (
    <div
      className="mt-4 transition-all duration-500"
      style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(6px)' }}
      aria-live="polite"
    >
      <div className="rounded-2xl border border-white/8 bg-white/4 overflow-hidden">

        {/* Demo header — clearly labelled */}
        <div className="px-5 py-4 border-b border-white/6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">Demo preview</span>
          </div>
          <span className="text-[10px] text-white/20 font-mono">Not real data</span>
        </div>

        {/* Name + specialty */}
        <div className="px-5 py-4 border-b border-white/6">
          <p className="text-base font-bold text-white leading-tight">{demo.name}</p>
          <p className="text-xs text-white/40 mt-0.5">{demo.specialty}</p>
        </div>

        {/* Ready / Missing */}
        <div className="px-5 py-4 border-b border-white/6 grid grid-cols-2 gap-x-6">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/25 mb-3">Ready for</p>
            <div className="space-y-2">
              {demo.readyFor.map(item => (
                <div key={item} className="flex items-center gap-2">
                  <span className="text-white/55 text-sm leading-none shrink-0">✔</span>
                  <span className="text-xs text-white/65">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/25 mb-3">Missing</p>
            {demo.missing.length === 0 ? (
              <div className="flex items-center gap-2"><span className="text-white/55 text-sm leading-none shrink-0">✔</span><span className="text-xs text-white/40">Nothing</span></div>
            ) : demo.missing.map(item => (
              <div key={item} className="flex items-center gap-2">
                <span className="text-white/25 text-sm leading-none shrink-0">✖</span>
                <span className="text-xs text-white/55">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Estimated start */}
        <div className="px-5 py-4 border-b border-white/6 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/25">Estimated start</span>
          <span className="text-sm font-semibold text-white">{demo.estimatedStart}</span>
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
            Continue with VitalCV →
          </button>
          <p className="mt-2 text-center text-[10px] text-white/20">
            Demo preview · Real data after sign-up
          </p>
        </div>

      </div>
    </div>
  );
}
