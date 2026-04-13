'use client';

/**
 * CountUpStat — animated number that counts up from 0 when scrolled into view.
 * Supports prefix/suffix (e.g. "$", "M", "%", "days").
 */

import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

interface CountUpStatProps {
  /** Target number to count up to */
  value: number;
  /** Text before the number (e.g. "$", "~") */
  prefix?: string;
  /** Text after the number (e.g. "M", "%", "days") */
  suffix?: string;
  /** Duration in ms */
  duration?: number;
  /** Decimal places to show */
  decimals?: number;
  /** Label below the number */
  label?: string;
  className?: string;
  valueClassName?: string;
  labelClassName?: string;
}

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export function CountUpStat({
  value,
  prefix = '',
  suffix = '',
  duration = 1600,
  decimals = 0,
  label,
  className,
  valueClassName,
  labelClassName,
}: CountUpStatProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [displayValue, setDisplayValue] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const element = ref.current;
    if (!element || hasAnimated) return;

    if (reducedMotion) {
      setDisplayValue(value);
      setHasAnimated(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;

        observer.disconnect();
        setHasAnimated(true);

        const start = performance.now();

        function tick(now: number) {
          const elapsed = now - start;
          const progress = Math.min(elapsed / duration, 1);
          const eased = easeOutExpo(progress);
          setDisplayValue(eased * value);

          if (progress < 1) {
            requestAnimationFrame(tick);
          } else {
            setDisplayValue(value);
          }
        }

        requestAnimationFrame(tick);
      },
      { threshold: 0.3 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [value, duration, hasAnimated, reducedMotion]);

  const formatted = displayValue.toFixed(decimals);

  return (
    <div ref={ref} className={cn('text-center', className)}>
      <div
        className={cn(
          'text-3xl sm:text-4xl font-bold tabular-nums tracking-tight text-[var(--vt-text-primary)]',
          valueClassName,
        )}
      >
        {prefix}
        {formatted}
        {suffix && (
          <span className="text-lg font-medium text-[var(--vt-text-muted)] ml-1">
            {suffix}
          </span>
        )}
      </div>
      {label && (
        <p
          className={cn(
            'mt-1.5 text-xs text-[var(--vt-text-muted)] leading-relaxed',
            labelClassName,
          )}
        >
          {label}
        </p>
      )}
    </div>
  );
}

export type { CountUpStatProps };
