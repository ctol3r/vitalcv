'use client';

import React, { useEffect, useRef, useState } from 'react';

/**
 * TimeToStartComparison — the deck's Interview-to-Start Velocity bar, in Calm
 * Wave, reframed to stay honest.
 *
 * The long bar is the INDUSTRY interview-to-start queue (a cited, real problem
 * number). VitalCV's bar is NOT an achieved SLA — it represents the reusable,
 * source-backed head start a clinician carries in, so the employer begins from
 * a verified state instead of a fresh verification queue. Labeled illustrative;
 * no day-count outcome is claimed for VitalCV until a pilot produces one.
 */
interface Row {
  label: string;
  valueLabel: string;
  width: string;
  fill: string;
  ariaLabel: string;
}

const ROWS: Row[] = [
  {
    label: 'The industry queue',
    valueLabel: '90–120 days, interview → start',
    width: '100%',
    fill: 'var(--vt-text-muted)',
    ariaLabel: 'The industry interview-to-start queue runs about 90 to 120 days.',
  },
  {
    label: 'Starting from a VitalCV head start',
    valueLabel: 'source-backed proof already in hand',
    width: '34%',
    fill: 'var(--vt-accent)',
    ariaLabel:
      'With a VitalCV head start the employer begins from source-backed proof already in hand — illustrative, not a guaranteed timeline.',
  },
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

      <div role="img" aria-label="Industry interview-to-start queue versus starting from a source-backed VitalCV head start." className="mt-8 space-y-6">
        {ROWS.map((row) => (
          <div key={row.label} className="grid gap-3 md:grid-cols-[minmax(0,230px)_minmax(0,1fr)] md:items-center">
            <div className="space-y-1">
              <p className="text-[14px] font-semibold text-[var(--vt-text-primary)]">{row.label}</p>
              <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--vt-text-secondary)]">{row.valueLabel}</p>
            </div>
            <div
              aria-label={row.ariaLabel}
              className="relative h-6 w-full overflow-hidden rounded-full border border-[var(--vt-border-subtle)] bg-[var(--vt-surface-subtle)]"
            >
              <div
                className="h-full rounded-full"
                style={{
                  backgroundColor: row.fill,
                  width: isVisible ? row.width : '0%',
                  transition: prefersReducedMotion ? 'none' : 'width 1.2s ease-out',
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-5 max-w-3xl text-[12px] leading-relaxed text-[var(--vt-text-muted)]">
        Illustrative. The queue figure is an industry benchmark; the head-start bar shows how much
        proof is already source-backed before review begins, not a guaranteed timeline. No pilot
        time-to-start outcome is claimed until a real pilot produces one.
      </p>
    </section>
  );
}

export default TimeToStartComparison;
