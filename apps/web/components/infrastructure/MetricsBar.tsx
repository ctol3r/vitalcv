'use client';

/**
 * MetricsBar.tsx — Wave 64: Animated Homepage Metrics
 *
 * Displays key platform stats with counting animations.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';

// ── Types ─────────────────────────────────────────────────────────────────

interface MetricConfig {
  label: string;
  target: number;
  suffix?: string;
  prefix?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────

const METRICS: MetricConfig[] = [
  { label: 'Verifications Processed', target: 12847 },
  { label: 'Avg Verification Time', target: 2.3, suffix: 's' },
  { label: 'Primary Sources Connected', target: 47 },
  { label: 'Network Uptime', target: 99.97, suffix: '%' },
];

// ── Animated Counter ──────────────────────────────────────────────────────

function AnimatedCounter({ target, suffix, prefix }: { target: number; suffix?: string; prefix?: string }) {
  const [value, setValue] = useState(0);
  const frameRef = useRef(0);

  useEffect(() => {
    const duration = 1500;
    const start = Date.now();
    function animate() {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    }
    animate();
    return () => cancelAnimationFrame(frameRef.current);
  }, [target]);

  const display = target % 1 === 0 ? Math.round(value).toLocaleString() : value.toFixed(target < 10 ? 1 : 2);

  return (
    <span className="text-2xl font-bold text-zinc-100 tabular-nums">
      {prefix}{display}{suffix}
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────

export function MetricsBar({ className = '' }: { className?: string }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const onIntersect = useCallback((entries: IntersectionObserverEntry[]) => {
    if (entries[0]?.isIntersecting) setVisible(true);
  }, []);

  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(onIntersect, { threshold: 0.3 });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [onIntersect]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={visible ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
      className={`glass rounded-xl p-6 ${className}`}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {METRICS.map((m) => (
          <div key={m.label} className="text-center">
            {visible ? (
              <AnimatedCounter target={m.target} suffix={m.suffix} prefix={m.prefix} />
            ) : (
              <span className="text-2xl font-bold text-zinc-700">—</span>
            )}
            <p className="text-[10px] text-zinc-500 mt-1">{m.label}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export default MetricsBar;
