'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import CountUp from 'react-countup';
import { Activity, CheckCircle2, FileStack, ShieldCheck } from 'lucide-react';
import { apiRoute } from '@/lib/api';

interface PublicMetrics {
  status: string;
  uptime: string;
  bundlesGenerated: number;
  verificationsPerformed: number;
  generated_at: string;
}

const POLL_INTERVAL_MS = 15_000;

export function SystemStatus() {
  const [metrics, setMetrics] = useState<PublicMetrics | null>(null);
  const prevMetrics = useRef<PublicMetrics | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { amount: 0.2 });

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch(apiRoute('/metrics/public'));
      if (!res.ok) return;
      const data: PublicMetrics = await res.json();
      prevMetrics.current = metrics;
      setMetrics(data);
    } catch {
      // Keep last-known values on failure
    }
  }, [metrics]);

  useEffect(() => {
    if (!inView) return;

    fetchMetrics();
    const id = setInterval(fetchMetrics, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [inView, fetchMetrics]);

  const bundles = metrics?.bundlesGenerated ?? 0;
  const verifications = metrics?.verificationsPerformed ?? 0;
  const prevBundles = prevMetrics.current?.bundlesGenerated ?? 0;
  const prevVerifications = prevMetrics.current?.verificationsPerformed ?? 0;
  const loaded = metrics !== null;

  return (
    <section
      ref={sectionRef}
      className="relative px-6 py-16"
      role="region"
      aria-label="Platform system status"
    >
      <motion.div
        className="mx-auto max-w-6xl"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ amount: 0.3, once: true }}
      >
        <div className="text-center">
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-40 text-[var(--vt-text-primary)]">
            System Status
          </p>
          <h2 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--vt-text-primary)]">
            Platform health, live
          </h2>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Status */}
          <motion.div
            className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] p-6"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-widest opacity-40 text-[var(--vt-text-primary)]">
              <Activity className="h-3.5 w-3.5" />
              Status
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-sm bg-[var(--vt-status-resolved)] opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-sm bg-[var(--vt-status-resolved)]" />
              </span>
              <span className="text-lg font-semibold text-[var(--vt-status-resolved)]">
                {loaded ? metrics.status : '--'}
              </span>
            </div>
          </motion.div>

          {/* Uptime */}
          <motion.div
            className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] p-6"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
            viewport={{ once: true }}
          >
            <div className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-widest opacity-40 text-[var(--vt-text-primary)]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Uptime
            </div>
            <div className="mt-3 text-3xl font-semibold tabular-nums text-[var(--vt-text-primary)]">
              {loaded ? metrics.uptime : '--'}
            </div>
          </motion.div>

          {/* Bundles Generated */}
          <motion.div
            className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] p-6"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            viewport={{ once: true }}
          >
            <div className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-widest opacity-40 text-[var(--vt-text-primary)]">
              <FileStack className="h-3.5 w-3.5" />
              Bundles Generated
            </div>
            <div className="mt-3 text-3xl font-semibold tabular-nums text-[var(--vt-text-primary)]">
              {loaded ? (
                <CountUp
                  start={prevBundles}
                  end={bundles}
                  duration={1.2}
                  separator=","
                  preserveValue
                />
              ) : (
                '--'
              )}
            </div>
          </motion.div>

          {/* Verifications Performed */}
          <motion.div
            className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] p-6"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            viewport={{ once: true }}
          >
            <div className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-widest opacity-40 text-[var(--vt-text-primary)]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Verifications
            </div>
            <div className="mt-3 text-3xl font-semibold tabular-nums text-[var(--vt-text-primary)]">
              {loaded ? (
                <CountUp
                  start={prevVerifications}
                  end={verifications}
                  duration={1.2}
                  separator=","
                  preserveValue
                />
              ) : (
                '--'
              )}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
