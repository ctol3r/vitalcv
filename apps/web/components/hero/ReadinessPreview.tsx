'use client';

/**
 * ReadinessPreview — inline preview card shown after NPI loading phase.
 *
 * Color rule: green is used ONLY on the CTA button.
 * All status indicators use white at varying opacity — ✔ = white/60, ✖ = white/25.
 * No nested boxes, no decorative pulses, consistent py-4 rhythm throughout.
 */

import { Accordion, type AccordionItem, type AccordionStatus } from '@/components/ui/vcv-accordion';

interface PreviewProfile {
  name:           string;
  credential:     string;
  specialty:      string;
  readyFor:       string[];
  missing:        string[];
  estimatedStart: string;
}

const PROFILES: Record<string, PreviewProfile> = {
  '1234567890': {
    name:           'Sarah Chen, MD',
    credential:     'MD',
    specialty:      'Internal Medicine',
    readyFor:       ['Outpatient', 'Telehealth', 'Inpatient consult'],
    missing:        ['DEA (CA)'],
    estimatedStart: '7–14 days',
  },
  '9876543210': {
    name:           'Marcus Williams, DO',
    credential:     'DO',
    specialty:      'Emergency Medicine',
    readyFor:       ['Outpatient', 'Urgent care'],
    missing:        ['Board cert renewal', 'DEA (TX)'],
    estimatedStart: '21–30 days',
  },
  '1111111111': {
    name:           'Priya Nair, MD',
    credential:     'MD',
    specialty:      'Hospitalist',
    readyFor:       ['Inpatient', 'Telehealth', 'Outpatient', 'Locum tenens'],
    missing:        [],
    estimatedStart: 'Ready now',
  },
};

const FALLBACK: PreviewProfile = {
  name:           'John Smith, MD',
  credential:     'MD',
  specialty:      'Emergency Medicine',
  readyFor:       ['Outpatient', 'Telehealth'],
  missing:        ['DEA (CA)'],
  estimatedStart: '14–28 days',
};

// ── Accordion ─────────────────────────────────────────────────

function statusFor(label: string, missing: string[]): AccordionStatus {
  return missing.some(m => m.toLowerCase().includes(label.toLowerCase()))
    ? 'pending'
    : 'verified';
}

function sourceRow(source: string, status: AccordionStatus, note?: string) {
  const statusLabel =
    status === 'verified' ? 'Verified'
    : status === 'clear'  ? 'Clear'
    : status === 'pending' ? 'Pending'
    : 'Action required';

  const statusColor = status === 'pending' || status === 'action'
    ? 'text-white/50'
    : 'text-white/60';

  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[11px]">
      <span className="text-white/25 uppercase tracking-wide">Source</span>
      <span className="text-white/55">{source}</span>
      <span className="text-white/25 uppercase tracking-wide">Status</span>
      <span className={statusColor}>{statusLabel}</span>
      <span className="text-white/25 uppercase tracking-wide">Checked</span>
      <span className="text-white/40">Today</span>
      {note && (
        <>
          <span className="text-white/25 uppercase tracking-wide">Note</span>
          <span className="text-white/45">{note}</span>
        </>
      )}
    </div>
  );
}

function buildAccordionItems(profile: PreviewProfile): AccordionItem[] {
  const deaStatus   = statusFor('DEA',   profile.missing);
  const boardStatus = statusFor('Board', profile.missing);
  const deaNote     = deaStatus   === 'pending' ? profile.missing.find(m => m.toLowerCase().includes('dea'))   : undefined;
  const boardNote   = boardStatus === 'pending' ? profile.missing.find(m => m.toLowerCase().includes('board')) : undefined;

  return [
    { id: 'identity',  trigger: 'Identity',           status: 'verified',                             content: sourceRow('NPPES · CMS NPI Registry',                    'verified')             },
    { id: 'licensure', trigger: 'Licensure',           status: statusFor('License', profile.missing),  content: sourceRow('State Medical Board',                         statusFor('License', profile.missing)) },
    { id: 'board',     trigger: 'Board Certification', status: boardStatus,                            content: sourceRow('ABMS',                                        boardStatus, boardNote) },
    { id: 'dea',       trigger: 'DEA Registration',    status: deaStatus,                              content: sourceRow('Drug Enforcement Administration',             deaStatus,  deaNote)   },
    { id: 'sanctions', trigger: 'Sanctions',           status: 'clear',                                content: sourceRow('NPDB · OIG/LEIE · SAM.gov',                   'clear')               },
  ];
}

// ── Component ─────────────────────────────────────────────────

interface Props {
  npi:        string;
  visible:    boolean;
  onContinue: () => void;
}

export function ReadinessPreview({ npi, visible, onContinue }: Props) {
  const profile      = PROFILES[npi] ?? FALLBACK;
  const accordionItems = buildAccordionItems(profile);

  return (
    <div
      className="mt-4 transition-all duration-500"
      style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(6px)' }}
      aria-live="polite"
    >
      <div className="rounded-2xl border border-white/8 bg-white/4 overflow-hidden">

        {/* Header */}
        <div className="px-5 py-4 border-b border-white/6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
              Profile found
            </span>
          </div>
          <span className="text-[10px] text-white/20 font-mono">NPI {npi || '—'}</span>
        </div>

        {/* Name + specialty */}
        <div className="px-5 py-4 border-b border-white/6">
          <p className="text-base font-bold text-white leading-tight">{profile.name}</p>
          <p className="text-xs text-white/40 mt-0.5">{profile.specialty}</p>
        </div>

        {/* Ready / Missing */}
        <div className="px-5 py-4 border-b border-white/6 grid grid-cols-2 gap-x-6">

          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/25 mb-3">Ready for</p>
            <div className="space-y-2">
              {profile.readyFor.map(item => (
                <div key={item} className="flex items-center gap-2">
                  <span className="text-white/55 text-xs leading-none">✔</span>
                  <span className="text-xs text-white/65">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/25 mb-3">Missing</p>
            {profile.missing.length === 0 ? (
              <div className="flex items-center gap-2">
                <span className="text-white/55 text-xs leading-none">✔</span>
                <span className="text-xs text-white/40">Nothing</span>
              </div>
            ) : (
              <div className="space-y-2">
                {profile.missing.map(item => (
                  <div key={item} className="flex items-center gap-2">
                    <span className="text-white/25 text-xs leading-none">✖</span>
                    <span className="text-xs text-white/55">{item}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Estimated start — simple row, no nested box */}
        <div className="px-5 py-4 border-b border-white/6 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/25">
            Estimated start
          </span>
          <span className="text-sm font-semibold text-white">
            {profile.estimatedStart}
          </span>
        </div>

        {/* Evidence accordion */}
        <div className="px-5 py-4 border-b border-white/6">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/20 mb-2">
            Source verification
          </p>
          <Accordion items={accordionItems} />
        </div>

        {/* CTA — only green element */}
        <div className="px-5 py-4">
          <button
            type="button"
            onClick={onContinue}
            className="w-full rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 px-5 py-3.5 font-semibold text-white text-sm transition-all active:scale-[0.98]"
          >
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
