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
import { useUser } from '@clerk/nextjs';
import { useClinicianMobile } from '@/components/mobile/ClinicianMobileProvider';
import { fetchAcceptanceRecognition } from '@/lib/recognition/acceptance-recognition';
import {
  buildCareerCompass,
  type CompassInput,
  type CompassMetric,
  type CompassTone,
} from '@/lib/matcha/careerCompass';

const CLEARED_BANDS = new Set(['CLEAR', 'NEAR_CLEAR']);

// Calm truth-token colors (resolve under `.mz`): source-green for strong,
// indigo accent for progress, amber watch for attention, muted ink for absent.
const METRIC_COLOR: Record<CompassTone, string> = {
  strong: 'var(--ok)',
  progress: 'var(--accent)',
  attention: 'var(--watch)',
  empty: 'var(--ink-400)',
  unavailable: 'var(--ink-400)',
};

function greetingFor(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function CareerCompass() {
  const { data } = useClinicianMobile();
  const { user } = useUser();
  const npi = data.workspace?.personProfile?.npi ?? null;
  // Workspace profile first, then the Clerk account name — the profile is
  // empty pre-onboarding, which greeted every new user as 'there'.
  const firstName = data.workspace?.personProfile?.firstName || user?.firstName || null;

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
    // The signed-in centerpiece as a calm-glass moment: `mz` makes the Calm Wave
    // tokens resolve wherever this mounts; indigo accent details via var(--accent).
    <section className="mz mz-glass p-5 sm:p-6">
      <p className="mz-eyebrow">
        <Compass className="h-3 w-3" aria-hidden />
        Career Compass
      </p>
      <h2 className="mz-h1 mt-4">
        {greeting}
        {firstName ? (
          <>
            , <span className="mz-accent">{firstName}</span>
          </>
        ) : null}
        .
      </h2>

      {/* Four honest metrics */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {compass.metrics.map((m) => (
          <MetricCell key={m.key} metric={m} />
        ))}
      </div>

      {/* The one next action */}
      <div className="mz-glass-inset mt-5 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <p
            className="mz-mono flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: 'var(--ink-400)' }}
          >
            <Sparkles className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} aria-hidden />
            What should I do next?
          </p>
          <ConfidenceChip confidence={action.confidence} />
        </div>

        <h2 className="mz-h2 mt-3">{action.title}</h2>
        <p className="mz-body mt-2">{action.why}</p>

        <ul className="mt-4 space-y-1.5">
          {action.impact.map((line) => (
            <li key={line} className="mz-body flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: 'var(--ok)' }} aria-hidden />
              {line}
            </li>
          ))}
        </ul>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href={action.href} className="mz-btn min-h-11 justify-center">
            {action.ctaLabel}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <p className="mz-small" style={{ color: 'var(--ink-400)' }}>
            {action.confidenceReason}
          </p>
        </div>
      </div>

      <p className="mz-small mt-4 leading-relaxed" style={{ color: 'var(--ink-400)' }}>
        {compass.note}
      </p>
    </section>
  );
}

function MetricCell({ metric }: { metric: CompassMetric }) {
  return (
    <div className="mz-glass-inset px-3 py-3">
      <p className="mz-mono text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--ink-400)' }}>
        {metric.label}
      </p>
      <p className="mt-1.5 text-xl font-semibold leading-none" style={{ color: METRIC_COLOR[metric.tone] }}>
        {metric.value}
      </p>
      <p className="mt-1 text-[11px]" style={{ color: 'var(--ink-500)' }}>
        {metric.sub}
      </p>
    </div>
  );
}

function ConfidenceChip({ confidence }: { confidence: 'High' | 'Building' }) {
  const strong = confidence === 'High';
  // Confidence tracks data coverage — mapped onto the calm truth-chip system:
  // ok wash for High coverage, neutral unknown while it is still building.
  return (
    <span className={`mz-chip ${strong ? 'mz-chip-ok' : 'mz-chip-unknown'}`}>
      <span className="mz-gl" />
      Confidence: {confidence}
    </span>
  );
}
