'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { GeoClusterSummary } from '@/lib/intelligence/map-contracts';

function badgeTone(state: GeoClusterSummary['momentumState'] | GeoClusterSummary['shortageSeverity']) {
  switch (state) {
    case 'rising':
      return 'vital-map-badge vital-map-badge--rising';
    case 'cooling':
      return 'vital-map-badge vital-map-badge--cooling';
    case 'declining':
    case 'critical':
      return 'vital-map-badge vital-map-badge--critical';
    case 'high':
      return 'vital-map-badge vital-map-badge--high';
    case 'moderate':
      return 'vital-map-badge vital-map-badge--moderate';
    case 'low':
      return 'vital-map-badge vital-map-badge--low';
    case 'none':
    case 'unknown':
    case 'stable':
    default:
      return 'vital-map-badge vital-map-badge--neutral';
  }
}

export function GeoNodeTooltip({
  anchor,
  cluster,
}: {
  anchor: { x: number; y: number } | null;
  cluster: GeoClusterSummary | null;
}) {
  if (!anchor || !cluster) {
    return null;
  }

  const left = Math.min(anchor.x + 18, window.innerWidth - 304);
  const top = Math.max(20, anchor.y - 88);

  return (
    <AnimatePresence>
      <motion.div
        key={cluster.id}
        initial={{ opacity: 0, y: 6, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 4, scale: 0.985 }}
        transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
        className="vital-map-panel pointer-events-none fixed z-50 w-[18rem] rounded-2xl px-4 py-3"
        style={{ left, top }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[12px] font-semibold text-[var(--vital-map-text-strong)]">
              {cluster.label}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--vital-map-text-muted)]">
              Top institutions
            </p>
          </div>
          <span className="text-[10px] font-mono text-[var(--vital-map-text-subtle)]">
            {cluster.geography}
          </span>
        </div>

        <div className="mt-2 space-y-1">
          {cluster.topInstitutions.slice(0, 3).map((institution) => (
            <p key={institution} className="truncate text-[11px] text-[var(--vital-map-text)]">
              {institution}
            </p>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-[var(--vital-map-border)] pt-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--vital-map-text-muted)]">Provider count</p>
            <p className="mt-1 font-mono text-[13px] font-semibold text-[var(--vital-map-text-strong)]">
              {cluster.providerCount.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--vital-map-text-muted)]">Top specialty</p>
            <p className="mt-1 text-[13px] font-semibold text-[var(--vital-map-text-strong)]">
              {cluster.topSpecialty}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <span className={badgeTone(cluster.momentumState)}>
            Momentum · {cluster.momentumState}
          </span>
          <span className={badgeTone(cluster.shortageSeverity)}>
            Shortage · {cluster.shortageSeverity}
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
