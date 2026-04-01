'use client';

/**
 * /demo — Single clean demo flow
 *
 * Flow:
 *   Step 1: Enter NPI → See readiness  (LiveTrustConsole)
 *   Step 2: Continue to Passport       (/passport?npi=)
 *   Step 3: Share with Employer        (/interview?entityId=)
 *   Step 4: Employer reviews           (/review/:entityId)
 *
 * CTA chain enforced here. No alternate paths.
 */

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { LiveTrustConsole } from '@/components/hero/LiveTrustConsole';

const DEFAULT_DEMO_NPI = '1003000126';

const STEPS = [
  { n: 1, label: 'Enter NPI',             sub: 'Pull your real readiness snapshot from NPPES and OIG' },
  { n: 2, label: 'Review your passport',  sub: 'See source-backed credentials, blockers, and trust score' },
  { n: 3, label: 'Share with employer',   sub: 'Generate a review link for a hiring decision' },
  { n: 4, label: 'Employer reviews',      sub: 'Employer sees readiness, accepts or requests refresh' },
] as const;

function StepRail({ active }: { active: 1 | 2 | 3 | 4 }) {
  return (
    <div className="flex items-start gap-0 overflow-x-auto pb-1 scrollbar-none">
      {STEPS.map((step, i) => {
        const done    = step.n < active;
        const current = step.n === active;
        return (
          <div key={step.n} className="flex items-center gap-0 min-w-0">
            {/* Step node */}
            <div className="flex flex-col items-center min-w-[72px] max-w-[100px] px-1">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold border transition-colors
                  ${done    ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-300'   : ''}
                  ${current ? 'border-white/40 bg-white/10 text-white'                     : ''}
                  ${!done && !current ? 'border-white/12 bg-transparent text-white/25'     : ''}`}
              >
                {done ? '✓' : step.n}
              </div>
              <p className={`mt-1 text-center text-[10px] leading-tight
                ${current ? 'text-white/80 font-medium' : done ? 'text-white/40' : 'text-white/20'}`}>
                {step.label}
              </p>
            </div>
            {/* Connector */}
            {i < STEPS.length - 1 && (
              <div className={`h-px w-6 shrink-0 mx-0.5 mt-[-16px] transition-colors
                ${step.n < active ? 'bg-emerald-500/40' : 'bg-white/10'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function DemoContent() {
  const searchParams = useSearchParams();
  const npiParam = searchParams.get('npi');

  return (
    <div className="min-h-screen bg-background text-white">
      <div className="mx-auto max-w-3xl px-4 pt-8 pb-4 sm:pt-12 space-y-5">

        {/* Header */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
            VitalCV · Demo
          </p>
          <h1 className="mt-1 text-lg font-semibold text-white/90">
            Clinician credentialing walkthrough
          </h1>
          <p className="mt-1 text-sm text-white/45">
            A real NPI lookup through the full hiring decision loop.
          </p>
        </div>

        {/* Step rail — always step 1 on load */}
        <StepRail active={1} />

        {/* Step 1 instruction */}
        <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">
            Step 1 of 4 — Enter NPI
          </p>
          <p className="mt-1 text-sm text-white/60 leading-relaxed">
            Enter any valid 10-digit NPI below. Try{' '}
            <code className="text-white/55">{DEFAULT_DEMO_NPI}</code> — a real registered
            provider. VitalCV pulls a live readiness snapshot with no synthetic data.
          </p>
          <div className="mt-3 space-y-1">
            <p className="text-[10px] text-white/25 uppercase tracking-widest">What happens next</p>
            <p className="text-xs text-white/40">
              → Click <span className="text-white/65 font-medium">Continue</span> to open your passport
            </p>
            <p className="text-xs text-white/40">
              → Click <span className="text-white/65 font-medium">Share with employer</span> to generate a review link
            </p>
            <p className="text-xs text-white/40">
              → Employer lands on <code className="text-white/50">/review/:entityId</code> and decides
            </p>
          </div>
          {npiParam && (
            <p className="mt-2 text-[10px] text-white/30">
              Pre-filled NPI: <code className="text-white/45">{npiParam}</code>
            </p>
          )}
        </div>

      </div>

      {/* LiveTrustConsole — NPI input + readiness + Continue CTA */}
      <LiveTrustConsole />
    </div>
  );
}

export default function DemoPage() {
  return (
    <Suspense>
      <DemoContent />
    </Suspense>
  );
}
