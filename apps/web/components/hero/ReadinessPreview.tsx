'use client';

/**
 * ReadinessPreview — inline preview card shown after NPI loading phase.
 *
 * Hardcoded/mock data keyed by NPI. Fallback profile for unknown NPIs.
 * Fades in via CSS transition — no animation library needed.
 * "Continue with VitalCV" CTA is the only exit; it carries the NPI forward.
 */

import Link from 'next/link';

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

interface Props {
  npi:     string;
  visible: boolean;        // parent controls fade-in timing
  onContinue: () => void;  // parent handles the actual redirect
}

export function ReadinessPreview({ npi, visible, onContinue }: Props) {
  const profile = PROFILES[npi] ?? FALLBACK;
  const allClear = profile.missing.length === 0;

  return (
    <div
      className="mt-4 transition-all duration-500"
      style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(6px)' }}
      aria-live="polite"
    >
      <div className="rounded-2xl border border-white/10 bg-white/4 overflow-hidden">

        {/* Header bar */}
        <div className="px-5 py-3 border-b border-white/6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full ${allClear ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
              {allClear ? 'Fully verified' : 'Profile found'}
            </span>
          </div>
          <span className="text-[10px] text-white/20 font-mono">NPI {npi || '—'}</span>
        </div>

        {/* Name + specialty */}
        <div className="px-5 pt-4 pb-3">
          <p className="text-base font-bold text-white leading-tight">{profile.name}</p>
          <p className="text-xs text-white/40 mt-0.5">{profile.specialty}</p>
        </div>

        {/* Ready / Missing columns */}
        <div className="px-5 pb-4 grid grid-cols-2 gap-x-6 gap-y-1">

          {/* READY FOR */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/25 mb-2">Ready for</p>
            <div className="space-y-1.5">
              {profile.readyFor.map(item => (
                <div key={item} className="flex items-center gap-2">
                  <span className="text-emerald-400 text-xs leading-none">✔</span>
                  <span className="text-xs text-white/65">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* MISSING */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/25 mb-2">Missing</p>
            {profile.missing.length === 0 ? (
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 text-xs leading-none">✔</span>
                <span className="text-xs text-white/40">Nothing</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                {profile.missing.map(item => (
                  <div key={item} className="flex items-center gap-2">
                    <span className="text-amber-400 text-xs leading-none">✖</span>
                    <span className="text-xs text-white/65">{item}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Estimated start */}
        <div className="mx-5 mb-4 rounded-lg border border-white/6 bg-white/3 px-4 py-2.5 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">Estimated start</span>
          <span className={`text-sm font-bold ${allClear ? 'text-emerald-400' : 'text-white'}`}>
            {profile.estimatedStart}
          </span>
        </div>

        {/* CTA */}
        <div className="px-5 pb-5">
          <button
            type="button"
            onClick={onContinue}
            className="w-full rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 px-5 py-3.5 font-semibold text-white text-sm shadow-[0_0_28px_rgba(16,185,129,0.18)] transition-all active:scale-[0.98]"
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
