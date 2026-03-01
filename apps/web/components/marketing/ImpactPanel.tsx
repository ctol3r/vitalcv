'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, Timer } from 'lucide-react';

function formatCurrency(value: number) {
  return `$${Math.round(value).toLocaleString()}`;
}

export function ImpactPanel() {
  const [daysSaved, setDaysSaved] = useState(0);
  const [revenueRecovered, setRevenueRecovered] = useState(0);
  const [enteredView, setEnteredView] = useState(false);
  const hasAnimated = useRef(false);

  const runCounter = (target: number, setValue: (value: number) => void, decimals = 0) => {
    const start = performance.now();
    const duration = 1800;

    const step = (time: number) => {
      const ratio = Math.min(1, (time - start) / duration);
      const eased = 1 - Math.pow(1 - ratio, 3);
      const value = eased * target;

      setValue(Number(value.toFixed(decimals)));
      if (ratio < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  };

  useEffect(() => {
    if (!enteredView || hasAnimated.current) {
      return;
    }

    hasAnimated.current = true;
    runCounter(87.5, setDaysSaved, 1);
    runCounter(525000, setRevenueRecovered, 0);
  }, [enteredView]);

  return (
    <section
      id="security"
      className="relative px-6 py-24"
      role="region"
      aria-label="Impact and ROI metrics"
    >
      <motion.div
        className="mx-auto max-w-6xl"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        onViewportEnter={() => setEnteredView(true)}
        viewport={{ amount: 0.35, once: true }}
      >
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.33em] text-[var(--trust-green)]">Impact and ROI</p>
          <h2 className="mt-4 text-4xl font-semibold tracking-tight font-fraunces text-[var(--warm-charcoal)]">
            Measurable enterprise impact from day one
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base text-[var(--warm-charcoal)]/70">
            Replace static assumptions with measurable throughput: lower onboarding lead-time and lower revenue leakage.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
          <motion.div
            className="rounded-3xl border border-white/35 bg-white/80 backdrop-blur-md p-8"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex rounded-full bg-[var(--trust-green)]/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--trust-green)]">
              Average Days Saved
            </div>
            <div className="mt-4 text-[4rem] font-semibold text-[var(--trust-green)] tabular-nums tracking-tight">
              {daysSaved.toFixed(1)}
              <span className="ml-2 text-lg text-[var(--warm-charcoal)]/70">Days</span>
            </div>
            <p className="text-sm text-[var(--warm-charcoal)]/70">Average onboarding reduction across verification workflows.</p>
            <div className="mt-6 flex items-center gap-2 text-sm text-[var(--trust-green)]">
              <Timer className="h-4 w-4" />
              Directly impacts first-pay cycles
            </div>
          </motion.div>

          <motion.div
            className="rounded-3xl border border-white/35 bg-white/80 backdrop-blur-md p-8"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex rounded-full bg-[var(--trust-green)]/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--trust-green)]">
              Revenue Recovered
            </div>
            <div className="mt-4 text-[4rem] font-semibold text-[var(--trust-green)] tabular-nums tracking-tight">
              {formatCurrency(revenueRecovered)}
            </div>
            <p className="text-sm text-[var(--warm-charcoal)]/70">per clinician</p>
            <p className="mt-4 text-xs text-[var(--warm-charcoal)]/55">Subtext: Assumes $6k/day</p>
            <div className="mt-6 flex items-center gap-2 text-sm text-[var(--trust-green)]">
              <DollarSign className="h-4 w-4" />
              87.5 days saved at $6k/day
            </div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
