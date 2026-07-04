'use client';

/**
 * Career Compass (Wave 4, Part 1) — the signed-in centerpiece.
 *
 * "Where you are, and the one thing to do next." A thin renderer over the pure
 * truth model in lib/matcha/careerCompass.ts: it maps the clinician's REAL
 * account signals (source-backed readiness, recorded employer acceptances, live
 * MATCHA matches, profile completeness, open readiness items) into four honest
 * metrics and a single deterministic next-best action with real-count impact,
 * a why tied to evidence, and a confidence that reflects data coverage. No demo
 * data: absent signals render explicit empty states, never fabricated numbers.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Compass, Sparkles } from 'lucide-react';
import { useClinicianMobile } from '@/components/mobile/ClinicianMobileProvider';
import { fetchAcceptanceRecognition } from '@/lib/recognition/acceptance-recognition';
import {
  buildCareerCompass,
  type CompassInput,
  type CompassMetric,
  type CompassTone,
} from '@/lib/matcha/careerCompass';

const CLEARED_BANDS = new Set(['CLEAR', 'NEAR_CLEAR']);

const METRIC_COLOR: Record<CompassTone, string> = {
  strong: 'text-emerald-300',
  progress: 'text-sky-300',
  attention: 'text-amber-300',
  empty: 'text-white/40',
  unavailable: 'text-white/40',
};

function greetingFor(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function CareerCompass() {
  const { data } = useClinicianMobile();
  const npi = data.workspace?.personProfile?.npi ?? null;
  const firstName = data.workspace?.personProfile?.firstName || 'there';

  const [recognition, setRecognition] = useState<CompassInput['recognition']>({ state: 'unavailable' });
  const [greeting, setGreeting] = useState('Hello');

  // Time-of-day greeting is computed client-side (Date is a display concern,
  // kept out of the pure model).
  useEffect(() => {
    setGreeting(greetingFor(new Date().getHours()));
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!npi) {
      setRecognition({ state: 'none_recorded' });
      return;
    }
    void (async () => {
      const result = await fetchAcceptanceRecognition(npi);
      if (cancelled) return;
      if (result.state === 'recognized') {
        setRecognition({ state: 'recognized', count: result.recognition.history.length });
      } else {
        setRecognition({ state: result.state });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [npi]);

  const compass = useMemo(() => {
    const readiness = data.trustState
      ? { score: data.trustState.readinessScore, level: data.trustState.readinessLevel }
      : null;
    const clearedToApply = data.availableOpportunities.filter(
      (opp) => opp.match && CLEARED_BANDS.has(opp.match.band),
    ).length;
    const recommendedAction = data.recommendedAction
      ? {
          title: data.recommendedAction.title,
          description: data.recommendedAction.description,
          href: data.recommendedAction.href,
          ctaLabel: data.recommendedAction.ctaLabel,
        }
      : null;

    return buildCareerCompass({
      readiness,
      recognition,
      opportunities: { total: data.availableOpportunities.length, clearedToApply },
      profileScore: data.profileCompleteness?.score ?? null,
      blockers: data.blockers.map((b) => ({
        title: b.title,
        detail: b.detail,
        href: b.href,
        nextActionLabel: b.nextActionLabel,
      })),
      recommendedAction,
    });
  }, [data, recognition]);

  const { action } = compass;

  return (
    <section className="rounded-[28px] border border-white/10 bg-gradient-to-b from-teal-400/[0.06] to-white/[0.02] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)] sm:p-6">
      <div className="flex items-center gap-2 text-teal-200/80">
        <Compass className="h-4 w-4" aria-hidden />
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em]">MATCHA Career Compass</p>
      </div>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        {greeting}, {firstName}.
      </h1>

      {/* Four honest metrics */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {compass.metrics.map((m) => (
          <MetricCell key={m.key} metric={m} />
        ))}
      </div>

      {/* The one next action */}
      <div className="mt-5 rounded-[22px] border border-white/10 bg-black/30 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
            <Sparkles className="h-3.5 w-3.5 text-teal-300" aria-hidden />
            What should I do next?
          </p>
          <ConfidenceChip confidence={action.confidence} />
        </div>

        <h2 className="mt-3 text-xl font-semibold text-white">{action.title}</h2>
        <p className="mt-2 text-sm leading-6 text-white/65">{action.why}</p>

        <ul className="mt-4 space-y-1.5">
          {action.impact.map((line) => (
            <li key={line} className="flex items-start gap-2 text-sm text-white/75">
              <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-teal-300" aria-hidden />
              {line}
            </li>
          ))}
        </ul>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href={action.href}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-teal-300 px-5 text-sm font-semibold text-teal-950 transition hover:bg-teal-200"
          >
            {action.ctaLabel}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <p className="text-xs text-white/40">{action.confidenceReason}</p>
        </div>
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-white/40">{compass.note}</p>
    </section>
  );
}

function MetricCell({ metric }: { metric: CompassMetric }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">{metric.label}</p>
      <p className={`mt-1.5 text-xl font-semibold leading-none ${METRIC_COLOR[metric.tone]}`}>{metric.value}</p>
      <p className="mt-1 text-[11px] text-white/45">{metric.sub}</p>
    </div>
  );
}

function ConfidenceChip({ confidence }: { confidence: 'High' | 'Building' }) {
  const strong = confidence === 'High';
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${
        strong
          ? 'border-teal-300/30 bg-teal-300/10 text-teal-200'
          : 'border-white/15 bg-white/5 text-white/55'
      }`}
    >
      Confidence: {confidence}
    </span>
  );
}
