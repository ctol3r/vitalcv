'use client';

import React, { useEffect, useRef, useState } from 'react';

import { AnimatedMetricValue, MetricSourceTag } from '@/components/motion/EvidenceMetric';

/**
 * TimeToStartComparison — the deck's Interview-to-Start Velocity moment, in
 * Calm Wave, reframed to stay honest.
 *
 * NUM-1.4 repair: the earlier version drew a second timeline bar at an
 * arbitrary 34% width for "starting from a VitalCV head start". Even labeled
 * illustrative, a bar next to a day-count bar reads as a measured
 * time-to-start result — and no such result exists yet. That bar is REMOVED.
 *
 * What renders instead:
 *  - the INDUSTRY queue keeps its animated bar and its cited 90–120 day range
 *    (an industry benchmark, and now an animated evidence metric);
 *  - the VitalCV row is an EVIDENCE-COVERAGE indicator — the live system fact
 *    that 3 of 4 readiness dimensions are source-backed before review begins,
 *    with the fourth explicitly access-gated. Coverage, not a timeline; no
 *    day count, no implied SLA.
 */

/** The four readiness dimensions and their real, current lane state. */
const COVERAGE_SEGMENTS = [
  { label: 'Identity', state: 'live' },
  { label: 'Exclusions', state: 'live' },
  { label: 'Enrollment', state: 'live' },
  { label: 'Licensure', state: 'gated' },
] as const;

export function TimeToStartComparison() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotionPreference = () => {
      const prefersReduced = mediaQuery.matches;
      setPrefersReducedMotion(prefersReduced);
      if (prefersReduced) setIsVisible(true);
    };
    updateMotionPreference();
    mediaQuery.addEventListener('change', updateMotionPreference);
    return () => mediaQuery.removeEventListener('change', updateMotionPreference);
  }, []);

  useEffect(() => {
    const element = sectionRef.current;
    if (!element || prefersReducedMotion) return;
    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setIsVisible(true);
        observer.disconnect();
      },
      { threshold: 0.3 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [prefersReducedMotion]);

  return (
    <section
      ref={sectionRef}
      data-home-time-to-start=""
      className="mz pt-14"
      aria-labelledby="time-to-start-comparison-heading"
    >
      <p className="mz-eyebrow">Interview-to-start velocity</p>
      <h2 id="time-to-start-comparison-heading" className="mz-h1 mt-3 max-w-[18ch]">
        The queue is the cost. The head start is the fix.
      </h2>

      <div className="mt-8 space-y-8">
        {/* Industry benchmark: the queue, as a timeline */}
        <div className="grid gap-3 md:grid-cols-[minmax(0,230px)_minmax(0,1fr)] md:items-center">
          <div className="space-y-1">
            <p className="text-[14px] font-semibold text-[var(--vt-text-primary)]">The industry queue</p>
            <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--vt-text-secondary)]">
              <AnimatedMetricValue value="90–120" /> days, interview → start
            </p>
            <MetricSourceTag sourceClass="industry-benchmark" />
          </div>
          <div
            aria-label="The industry interview-to-start queue runs about 90 to 120 days."
            className="relative h-6 w-full overflow-hidden rounded-full border border-[var(--vt-border-subtle)] bg-[var(--vt-surface-subtle)]"
          >
            <div
              className="h-full rounded-full"
              style={{
                backgroundColor: 'var(--vt-text-muted)',
                width: isVisible ? '100%' : '0%',
                transition: prefersReducedMotion ? 'none' : 'width 1.2s ease-out',
              }}
            />
          </div>
        </div>

        {/* Live system fact: evidence coverage, deliberately NOT a timeline */}
        <div
          data-time-to-start-coverage=""
          className="grid gap-3 md:grid-cols-[minmax(0,230px)_minmax(0,1fr)] md:items-center"
        >
          <div className="space-y-1">
            <p className="text-[14px] font-semibold text-[var(--vt-text-primary)]">
              Starting from a VitalCV head start
            </p>
            <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--vt-text-secondary)]">
              <AnimatedMetricValue value="3" /> of <AnimatedMetricValue value="4" /> readiness
              dimensions source-backed
            </p>
            <MetricSourceTag sourceClass="live-system-fact" />
          </div>
          <div
            role="img"
            aria-label="Three of four readiness dimensions — identity, exclusions, and enrollment — are source-backed before review begins; state licensure remains access-gated. Evidence coverage, not a timeline."
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
          >
            {COVERAGE_SEGMENTS.map((seg, i) => (
              <div
                key={seg.label}
                data-coverage-segment={seg.state}
                className="rounded-[8px] border px-3 py-2"
                style={{
                  borderColor:
                    seg.state === 'live'
                      ? 'color-mix(in oklab, var(--vt-accent-emerald) 45%, var(--vt-border))'
                      : 'color-mix(in oklab, var(--vt-state-stale, #a2670b) 45%, var(--vt-border))',
                  background:
                    seg.state === 'live'
                      ? 'color-mix(in oklab, var(--vt-accent-emerald) 9%, var(--vt-surface))'
                      : 'repeating-linear-gradient(-45deg, color-mix(in oklab, var(--vt-state-stale, #a2670b) 7%, var(--vt-surface)), color-mix(in oklab, var(--vt-state-stale, #a2670b) 7%, var(--vt-surface)) 6px, var(--vt-surface) 6px, var(--vt-surface) 12px)',
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible ? 'none' : 'translateY(6px)',
                  transition: prefersReducedMotion
                    ? 'none'
                    : `opacity 480ms ease ${i * 110}ms, transform 480ms ease ${i * 110}ms`,
                }}
              >
                <p className="text-[12px] font-semibold text-[var(--vt-text-primary)]">{seg.label}</p>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--vt-text-muted)]">
                  {seg.state === 'live' ? 'Source-backed' : 'Access required'}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-5 max-w-3xl text-[12px] leading-relaxed text-[var(--vt-text-muted)]">
        The queue figure is an industry benchmark. The head-start row shows current evidence
        coverage — which readiness dimensions are already source-backed before review begins —
        not a timeline. No pilot time-to-start outcome is claimed until a real pilot produces one.
      </p>
    </section>
  );
}

export default TimeToStartComparison;
