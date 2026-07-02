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

  return (
    <div className="min-h-screen bg-zinc-950 text-foreground">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
        <Link
          href="/holder"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to your readiness
        </Link>

        <header className="space-y-2">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-emerald-400" aria-hidden />
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Recognition</p>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Your recognition record</h1>
          <p className="text-sm leading-6 text-zinc-400">
            Employer acceptances recorded against your source-backed evidence. Each entry is an
            employer decision captured with an audit event at the moment it was made.
          </p>
        </header>

        {phase.state === 'loading' && (
          <div className="flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading your acceptance record…
          </div>
        )}

        {phase.state === 'profile_error' && (
          <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
            <p className="text-sm font-medium text-zinc-200">Couldn&apos;t load your profile</p>
            <p className="text-sm leading-6 text-zinc-400">
              This is a system state — not a finding about your record. Try again shortly.
            </p>
            <button
              onClick={() => { void load(); }}
              className="rounded-lg border border-zinc-700 px-4 py-1.5 text-sm text-zinc-300 transition hover:text-white"
            >
              Try again
            </button>
          </div>
        )}

        {phase.state === 'no_npi' && (
          <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
            <p className="text-sm font-medium text-zinc-200">Set up your readiness first</p>
            <p className="text-sm leading-6 text-zinc-400">
              Recognition builds on your NPI-anchored evidence. Verify your NPI to activate your
              clinician profile, and acceptances will be recorded here.
            </p>
            <Link
              href="/get-ready"
              className="inline-flex items-center gap-1 text-sm font-medium text-emerald-400 transition hover:text-emerald-300"
            >
              Verify my NPI <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        )}

        {phase.state === 'unavailable' && (
          <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
            <p className="text-sm font-medium text-zinc-200">
              Recognition status is temporarily unavailable
            </p>
            <p className="text-sm leading-6 text-zinc-400">
              This is a system state — not a finding about your record. Try again shortly.
            </p>
            <button
              onClick={() => { void load(); }}
              className="rounded-lg border border-zinc-700 px-4 py-1.5 text-sm text-zinc-300 transition hover:text-white"
            >
              Try again
            </button>
          </div>
        )}

        {phase.state === 'none_recorded' && (
          <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
            <p className="text-base font-semibold text-zinc-100">
              No employer acceptances recorded yet
            </p>
            <p className="text-sm leading-6 text-zinc-400">
              When an employer reviews your evidence and accepts it as a head start, the
              acceptance is recorded here and stays part of your career record. Keeping your
              readiness current is what makes that decision easy.
            </p>
            <Link
              href="/holder/readiness"
              className="inline-flex items-center gap-1 text-sm font-medium text-emerald-400 transition hover:text-emerald-300"
            >
              Review your readiness <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        )}

        {phase.state === 'recognized' && (
          <>
            <section
              aria-label="Acceptance summary"
              className="rounded-2xl border border-emerald-900/60 bg-emerald-950/20 p-5"
            >
              <p className="text-lg font-semibold text-zinc-100">
                {phase.recognition.summary.headline}
              </p>
              {phase.recognition.summary.trustCopy && (
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  {phase.recognition.summary.trustCopy}
                </p>
              )}
            </section>

            <section aria-label="Acceptance history" className="space-y-3">
              <h2 className="text-xs uppercase tracking-wider text-zinc-500">
                Recorded acceptances
              </h2>
              {phase.recognition.history.map((entry, index) => (
                <div
                  key={entry.acceptanceId ?? `${entry.acceptedAt}-${index}`}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-zinc-100">{entry.orgLabel}</p>
                    <span className="rounded-full border border-zinc-700 px-2.5 py-0.5 text-xs text-zinc-400">
                      {acceptanceScopeLabel(entry.acceptanceScope)}
                    </span>
                  </div>
                  {formatAcceptedAt(entry.acceptedAt) && (
                    <p className="mt-1 text-xs text-zinc-500">
                      Accepted {formatAcceptedAt(entry.acceptedAt)}
                    </p>
                  )}
                  {entry.acceptanceReason && (
                    <p className="mt-2 text-sm leading-6 text-zinc-400">{entry.acceptanceReason}</p>
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
          className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5"
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" aria-hidden />
            <h2 className="text-sm font-semibold text-zinc-200">What an acceptance means</h2>
          </div>
          <ul className="space-y-2 text-sm leading-6 text-zinc-400">
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
            className="inline-flex items-center gap-1 text-sm font-medium text-emerald-400 transition hover:text-emerald-300"
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
