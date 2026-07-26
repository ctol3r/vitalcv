'use client';

/**
 * EvidenceMetric primitives (NUM-1.1) — numbers as evidence, not vanity
 * counters.
 *
 * `AnimatedMetricValue` animates a metric's digits ONCE when it first enters
 * the viewport, under a strict truth/accessibility contract (deep-audit Wave 1
 * design contract):
 *
 *  - SSR / no-JS / `prefers-reduced-motion`: the final string renders
 *    immediately — the animation is an enhancement layered on top;
 *  - the animated output is `aria-hidden`; a stable, visually-hidden final
 *    string sits beside it for assistive tech (announced exactly once);
 *  - digit runs animate inside the FINAL grammar: ranges animate both bounds
 *    (`90–120` counts 90 and 120 in place), affixes stay (`5+`), leading
 *    zeros keep their width (`03` counts `00→03`);
 *  - an all-zero value (`0`, `00`) never fake-counts: it plays a brief ink
 *    reveal instead — zero is a statement, not a progression;
 *  - plays once per page view; re-scrolling never restarts it;
 *  - `font-variant-numeric: tabular-nums` so digits never jitter layout.
 *
 * `MetricSourceTag` is the visible source-class affordance: every animated
 * metric names whether it is an industry benchmark, a live system fact, a
 * pilot metric, or illustrative structure. Provenance is part of the number.
 */

import * as React from 'react';

export type MetricSourceClass =
  | 'industry-benchmark'
  | 'live-system-fact'
  | 'pilot-metric'
  | 'illustrative-structure';

export const METRIC_SOURCE_LABEL: Record<MetricSourceClass, string> = {
  'industry-benchmark': 'Industry benchmark',
  'live-system-fact': 'Live system fact',
  'pilot-metric': 'Pilot metric',
  'illustrative-structure': 'Illustrative structure',
};

/* ── pure tokenizer (unit-tested) ────────────────────────────────────────── */

export interface MetricToken {
  /** literal text (separators, affixes) or a digit run */
  text: string;
  /** digit runs animate; literals render as-is */
  isDigits: boolean;
}

/** Split a final metric string into digit runs + literal affixes/separators. */
export function tokenizeMetric(value: string): MetricToken[] {
  const tokens: MetricToken[] = [];
  const re = /(\d+)|(\D+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value)) !== null) {
    tokens.push({ text: m[0], isDigits: Boolean(m[1]) });
  }
  return tokens;
}

/** True when every digit run in the value is all zeros (reveal, not count). */
export function isZeroMetric(value: string): boolean {
  const runs = tokenizeMetric(value).filter((t) => t.isDigits);
  return runs.length > 0 && runs.every((t) => Number(t.text) === 0);
}

/** Format an in-flight count preserving the final run's leading-zero width. */
export function formatCountFrame(finalRun: string, progress: number): string {
  const target = Number(finalRun);
  const eased = 1 - Math.pow(1 - Math.min(1, Math.max(0, progress)), 3);
  const current = Math.round(target * eased);
  const text = String(current);
  // `03` keeps its leading-zero width for every frame (00 → 01 → … → 03).
  return finalRun.length > 1 && finalRun.startsWith('0')
    ? text.padStart(finalRun.length, '0')
    : text;
}

/* ── component ───────────────────────────────────────────────────────────── */

export interface AnimatedMetricValueProps {
  /** The FINAL string, in its exact public grammar (`90–120`, `5+`, `03`, `0`). */
  value: string;
  /** Animation duration in ms. */
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function AnimatedMetricValue({
  value,
  duration = 1100,
  className,
  style,
}: AnimatedMetricValueProps) {
  const tokens = React.useMemo(() => tokenizeMetric(value), [value]);
  const zero = React.useMemo(() => isZeroMetric(value), [value]);
  const hostRef = React.useRef<HTMLSpanElement>(null);
  const playedRef = React.useRef(false);
  // display text starts at the FINAL value (SSR/no-JS contract); the counter
  // only rewinds after mount, when it is already certain it can play forward.
  const [display, setDisplay] = React.useState<string[]>(tokens.map((t) => t.text));
  const [revealed, setRevealed] = React.useState(false);
  /** zero-mode only: JS confirmed running, dimmed, waiting for its reveal. */
  const [primed, setPrimed] = React.useState(false);

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host || playedRef.current) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof IntersectionObserver === 'undefined') {
      setRevealed(true);
      return; // final text is already showing — nothing to animate
    }

    // Priming happens ONLY here, with JS confirmed running — SSR/no-JS never
    // leaves the final string. Zero metrics dim slightly (ink reveal); digit
    // metrics rewind to their origin frame so entry plays a clean count-up.
    let raf = 0;
    if (zero) {
      setPrimed(true);
    } else {
      setDisplay(tokens.map((t) => (t.isDigits ? formatCountFrame(t.text, 0) : t.text)));
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting) || playedRef.current) return;
        playedRef.current = true; // once per page view — never replays
        io.disconnect();

        if (zero) {
          setRevealed(true); // CSS ink reveal; no fake 0→0 counter
          return;
        }

        const start = performance.now();
        const step = (now: number) => {
          const p = Math.min(1, (now - start) / duration);
          setDisplay(
            tokens.map((t) => (t.isDigits ? formatCountFrame(t.text, p) : t.text)),
          );
          if (p < 1) raf = requestAnimationFrame(step);
          else setRevealed(true);
        };
        raf = requestAnimationFrame(step);
      },
      { threshold: 0.4 },
    );
    io.observe(host);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [tokens, zero, duration]);

  return (
    <span
      ref={hostRef}
      data-evidence-metric=""
      data-metric-played={revealed ? 'true' : undefined}
      className={className}
      style={{ fontVariantNumeric: 'tabular-nums', ...style }}
    >
      {/* animated layer — decoration only */}
      <span
        aria-hidden="true"
        data-metric-animated=""
        className={zero ? `metric-zero${primed && !revealed ? ' is-primed' : ''}` : undefined}
      >
        {display.join('')}
      </span>
      {/* the stable accessible value */}
      <span className="sr-only" data-metric-final="">
        {value}
      </span>
    </span>
  );
}

/* ── source-class affordance ─────────────────────────────────────────────── */

export function MetricSourceTag({
  sourceClass,
  className,
}: {
  sourceClass: MetricSourceClass;
  className?: string;
}) {
  return (
    <span
      data-metric-source={sourceClass}
      className={`inline-flex items-center gap-1 rounded-full border border-[var(--vt-border-subtle)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--vt-text-muted)]${className ? ` ${className}` : ''}`}
    >
      <span
        aria-hidden="true"
        className="h-1 w-1 rounded-full"
        style={{
          background:
            sourceClass === 'live-system-fact'
              ? 'var(--vt-accent-emerald)'
              : sourceClass === 'pilot-metric'
                ? 'var(--accent)'
                : 'var(--vt-text-muted)',
        }}
      />
      {METRIC_SOURCE_LABEL[sourceClass]}
    </span>
  );
}

export default AnimatedMetricValue;
