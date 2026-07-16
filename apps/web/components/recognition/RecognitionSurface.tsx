'use client';

/**
 * Recognition surface — /holder/recognition.
 *
 * The clinician-facing answer to "What does my recognition mean?". Renders the
 * full employer acceptance record (canonical Recognition → Acceptance → Start
 * path, middle step) from the public acceptance-history read, plus a plain
 * explanation of what an acceptance is and is not. Honest states throughout:
 * lookup failures are system states, empty records say exactly that, and no
 * entry is ever synthesized.
 */

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Award, ChevronRight, Loader2, ShieldCheck } from 'lucide-react';
import { ClinicianSupportCard } from '@/components/mobile/ClinicianSupportCard';
import ProductLoopRail from '@/components/holder/ProductLoopRail';
import { ShareRecognitionPanel } from '@/components/recognition/ShareRecognitionPanel';
import {
  acceptanceScopeLabel,
  fetchAcceptanceRecognition,
  formatAcceptedAt,
  type AcceptanceRecognitionResult,
} from '@/lib/recognition/acceptance-recognition';

type Phase =
  | { state: 'loading' }
  | { state: 'no_npi' }
  | { state: 'profile_error' }
  | (AcceptanceRecognitionResult & { npi?: string });

export function RecognitionSurface() {
  const [phase, setPhase] = useState<Phase>({ state: 'loading' });

  const load = useCallback(async () => {
    setPhase({ state: 'loading' });
    try {
      const res = await fetch('/api/me/workspaces');
      if (!res.ok) {
        setPhase({ state: 'profile_error' });
        return;
      }
      const data = await res.json() as { personProfile?: { npi?: string | null } | null };
      const npi = data.personProfile?.npi ?? null;
      if (!npi) {
        setPhase({ state: 'no_npi' });
        return;
      }
      setPhase({ ...(await fetchAcceptanceRecognition(npi)), npi });
    } catch {
      setPhase({ state: 'profile_error' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const npi = 'npi' in phase ? phase.npi : undefined;

  return (
    <div className="vcv-doc min-h-screen">
      {/* Top bar — signed-artifact register (D57 dark op-bar) */}
      <div className="vcv-register text-xs px-6 py-2 flex items-center justify-between">
        <Link href="/holder" className="vcv-mono inline-flex items-center gap-1.5 transition-opacity hover:opacity-80">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to your readiness
        </Link>
        <span className="vcv-eyebrow">Recognition</span>
        <span className="vcv-mono text-[10px] opacity-70">{npi ? `NPI ${npi}` : '…'}</span>
      </div>

      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
        {/* Product loop — Profile → Readiness → Recognition → Share → Opportunity */}
        <ProductLoopRail variant="doc" activeStage="recognition" npi={npi} />

        <header className="space-y-2">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5" style={{ color: 'var(--accent)' }} aria-hidden />
            <p className="vcv-eyebrow">Recognition</p>
          </div>
          <h1 className="vcv-title text-3xl">Your recognition record</h1>
          <p className="text-sm leading-6 vcv-muted">
            Recognition is the career asset you earn: an employer&apos;s recorded decision to accept
            your source-backed evidence as a head start. Each entry is captured with an audit event
            at the moment it was made — yours to keep and prove.
          </p>
        </header>

        {/* Earn · Prove · Reuse — why Recognition matters, in every state */}
        <div data-recognition-value="" className="grid gap-2.5 sm:grid-cols-3">
          {[
            { label: 'Earn it', text: 'An employer reviews your source-backed evidence and accepts it as a head start.' },
            { label: 'Prove it', text: 'A timestamped, source-backed decision you can share with the next team.' },
            { label: 'Reuse it', text: 'It stays on your career record and travels with you to the next move.' },
          ].map((item, idx) => (
            <div key={item.label} className="vcv-panel-inset p-4">
              <p className="vcv-eyebrow mb-1">
                {idx + 1} · {item.label}
              </p>
              <p className="text-sm leading-6 vcv-muted">{item.text}</p>
            </div>
          ))}
        </div>

        {phase.state === 'loading' && (
          <div className="vcv-panel flex items-center gap-2 p-5 text-sm vcv-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading your acceptance record…
          </div>
        )}

        {phase.state === 'profile_error' && (
          <div
            className="vcv-panel space-y-3 p-5"
            style={{ borderColor: 'color-mix(in oklch, var(--state-blocked) 30%, transparent)' }}
          >
            <p className="text-sm font-medium" style={{ color: 'var(--ink-strong)' }}>Couldn&apos;t load your profile</p>
            <p className="text-sm leading-6 vcv-muted">
              This is a system state — not a finding about your record. Try again shortly.
            </p>
            <button
              onClick={() => { void load(); }}
              className="text-sm transition"
              style={{ border: 'var(--hairline)', borderRadius: 'var(--r-3)', padding: '6px 16px', color: 'var(--ink-mute)' }}
            >
              Try again
            </button>
          </div>
        )}

        {phase.state === 'no_npi' && (
          <div className="vcv-panel space-y-3 p-5">
            <p className="text-sm font-medium" style={{ color: 'var(--ink-strong)' }}>Set up your readiness first</p>
            <p className="text-sm leading-6 vcv-muted">
              Recognition builds on your NPI-anchored evidence. Verify your NPI to activate your
              clinician profile, and acceptances will be recorded here.
            </p>
            <Link
              href="/onboarding"
              className="vcv-link inline-flex items-center gap-1 text-sm font-medium"
            >
              Verify my NPI <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        )}

        {phase.state === 'unavailable' && (
          <div
            className="vcv-panel space-y-3 p-5"
            style={{ borderColor: 'color-mix(in oklch, var(--state-blocked) 30%, transparent)' }}
          >
            <p className="text-sm font-medium" style={{ color: 'var(--ink-strong)' }}>
              Recognition status is temporarily unavailable
            </p>
            <p className="text-sm leading-6 vcv-muted">
              This is a system state — not a finding about your record. Try again shortly.
            </p>
            <button
              onClick={() => { void load(); }}
              className="text-sm transition"
              style={{ border: 'var(--hairline)', borderRadius: 'var(--r-3)', padding: '6px 16px', color: 'var(--ink-mute)' }}
            >
              Try again
            </button>
          </div>
        )}

        {phase.state === 'none_recorded' && (
          <div className="vcv-panel space-y-3 p-5">
            <p className="text-base font-semibold" style={{ color: 'var(--ink-strong)' }}>
              No employer acceptances recorded yet
            </p>
            <p className="text-sm leading-6 vcv-muted">
              When an employer reviews your evidence and accepts it as a head start, the
              acceptance is recorded here and stays part of your career record. Keeping your
              readiness current is what makes that decision easy.
            </p>
            <Link
              href="/holder/readiness"
              className="vcv-link inline-flex items-center gap-1 text-sm font-medium"
            >
              Review your readiness <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        )}

        {phase.state === 'recognized' && (
          <>
            <section
              aria-label="Acceptance summary"
              className="vcv-panel p-5"
              style={{ background: 'var(--state-verified-wash)', borderColor: 'color-mix(in oklch, var(--state-verified) 30%, transparent)' }}
            >
              <p className="text-lg font-semibold" style={{ color: 'var(--ink-strong)' }}>
                {phase.recognition.summary.headline}
              </p>
              {phase.recognition.summary.trustCopy && (
                <p className="mt-2 text-sm leading-6 vcv-muted">
                  {phase.recognition.summary.trustCopy}
                </p>
              )}
            </section>

            <section aria-label="Acceptance history" className="space-y-3">
              <h2 className="vcv-eyebrow">
                Recorded acceptances
              </h2>
              {phase.recognition.history.map((entry, index) => (
                <div
                  key={entry.acceptanceId ?? `${entry.acceptedAt}-${index}`}
                  className="vcv-panel p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold" style={{ color: 'var(--ink-strong)' }}>{entry.orgLabel}</p>
                    <span
                      className="text-xs"
                      style={{ border: 'var(--hairline)', borderRadius: 'var(--r-2)', padding: '2px 8px', color: 'var(--ink-mute)' }}
                    >
                      {acceptanceScopeLabel(entry.acceptanceScope)}
                    </span>
                  </div>
                  {formatAcceptedAt(entry.acceptedAt) && (
                    <p className="mt-1 text-xs vcv-subtle">
                      Accepted {formatAcceptedAt(entry.acceptedAt)}
                    </p>
                  )}
                  {entry.acceptanceReason && (
                    <p className="mt-2 text-sm leading-6 vcv-muted">{entry.acceptanceReason}</p>
                  )}
                </div>
              ))}
            </section>
          </>
        )}

        {'npi' in phase && phase.npi && (
          <ShareRecognitionPanel npi={phase.npi} />
        )}

        <section
          aria-label="What recognition means"
          className="vcv-panel-inset space-y-3 p-5"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" style={{ color: 'var(--accent)' }} aria-hidden />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--ink-strong)' }}>What an acceptance means</h2>
          </div>
          <ul className="space-y-2 text-sm leading-6 vcv-muted">
            <li>
              An employer reviewed your source-backed evidence and accepted it as a head start —
              a decision recorded with an audit event at the moment it was made.
            </li>
            <li>
              Each acceptance is scoped to the accepting organization. It gives that team a
              recorded starting point; it does not replace another organization&apos;s own review.
            </li>
            <li>
              Recognition, then acceptance, then start is the canonical sequence. Your record here
              is that middle step, and it stays anchored to the source checks behind it.
            </li>
          </ul>
          <Link
            href="/holder/applications"
            className="vcv-link inline-flex items-center gap-1 text-sm font-medium"
          >
            View your applications <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </section>

        <ClinicianSupportCard
          topic="recognition-record"
          detail="If an acceptance you expect is missing here, refresh once, then contact support with your NPI and the organization involved."
          primaryHref="/holder/readiness"
          primaryLabel="Review readiness"
        />
      </div>
    </div>
  );
}
