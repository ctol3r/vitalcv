'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';

interface ComparisonRow {
  label: string;
  valueLabel: string;
  width: string;
  fill: string;
  ariaLabel: string;
}

const COMPARISON_ROWS: ComparisonRow[] = [
  {
    label: 'Without VitalCV',
    valueLabel: '~90 days average',
    width: '100%',
    fill: 'var(--vt-text-muted)',
    ariaLabel: 'Without VitalCV, the average time to start is about 90 days.',
  },
  {
    label: 'With VitalCV',
    valueLabel: '~45-60 days',
    width: '55%',
    fill: 'var(--vt-accent)',
    ariaLabel: 'With VitalCV, the average time to start is about 45 to 60 days.',
  },
] as const;

export function TimeToStartComparison() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotionPreference = () => {
      const prefersReduced = mediaQuery.matches;
      setPrefersReducedMotion(prefersReduced);
      if (prefersReduced) {
        setIsVisible(true);
      }
    };

    updateMotionPreference();
    mediaQuery.addEventListener('change', updateMotionPreference);

    return () => {
      mediaQuery.removeEventListener('change', updateMotionPreference);
    };
  }, []);

  useEffect(() => {
    const element = sectionRef.current;
    if (!element || prefersReducedMotion) {
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) {
          return;
        }

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
      className="border-b border-[var(--vt-border-subtle)] bg-[var(--vt-surface)] px-4 py-10 sm:px-6 sm:py-12"
      aria-labelledby="time-to-start-comparison-heading"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 max-w-3xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--vt-text-muted)]">
            Time to Start
          </p>
          <h2
            id="time-to-start-comparison-heading"
            className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
          >
            The clearest proof point on the page is time back.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--vt-text-secondary)] sm:text-base">
            Credentialing delays hold revenue and clinical capacity offline. VitalCV compresses
            the path from interview to start by making source-backed readiness reusable.
          </p>
        </div>

        <div
          role="img"
          aria-label="Average time-to-start comparison showing about 90 days without VitalCV versus about 45 to 60 days with VitalCV."
          className="space-y-5"
        >
          {COMPARISON_ROWS.map((row) => (
            <div
              key={row.label}
              className="grid gap-3 md:grid-cols-[minmax(0,180px)_minmax(0,1fr)] md:items-center"
            >
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">{row.label}</p>
                <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-secondary)]">
                  {row.valueLabel}
                </p>
              </div>

              <div
                aria-label={row.ariaLabel}
                className="relative h-5 w-full overflow-hidden rounded-full border border-[var(--vt-border-subtle)] bg-[var(--vt-surface-subtle)] sm:h-6"
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

        <div className="mt-6">
          <Badge
            variant="outline"
            className="border-[var(--vt-accent)]/25 bg-[var(--vt-accent)]/10 px-3 py-1.5 text-sm font-semibold text-[var(--vt-text-primary)]"
          >
            Save ~30-45 days · ~$25,000–$60,000 in lost revenue
          </Badge>
          <p className="mt-2 text-xs leading-5 text-[var(--vt-text-muted)]">
            Estimated based on MGMA median locum rates and industry credentialing benchmarks.
          </p>
        </div>
      </div>
    </section>
  );
}
