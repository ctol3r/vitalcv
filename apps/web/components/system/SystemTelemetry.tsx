'use client';

/**
 * SystemTelemetry.tsx — Wave 86: System Telemetry Panel
 *
 * Displays verification throughput, artifact count,
 * decision capsules generated, and network nodes.
 */

import { motion } from 'framer-motion';

// ── Types ─────────────────────────────────────────────────────────────

export interface TelemetryData {
  clinicians: number;
  issuers: number;
  credentials: number;
  decisions: number;
  verificationsToday: number;
  artifactsGenerated: number;
  averageLatency: number;
}

interface SystemTelemetryProps {
  data: TelemetryData | null;
  loading?: boolean;
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────

const METRICS: Array<{ key: keyof TelemetryData; label: string; color: string; format?: (v: number) => string }> = [
  { key: 'verificationsToday', label: 'Verifications', color: 'text-emerald-400' },
  { key: 'artifactsGenerated', label: 'Artifacts', color: 'text-blue-400' },
  { key: 'decisions', label: 'Decisions', color: 'text-orange-400' },
  { key: 'credentials', label: 'Credentials', color: 'text-amber-400' },
  { key: 'clinicians', label: 'Clinicians', color: 'text-violet-400' },
  { key: 'issuers', label: 'Issuers', color: 'text-cyan-400' },
  { key: 'averageLatency', label: 'Avg Latency', color: 'text-pink-400', format: (v) => `${v}ms` },
];

export function SystemTelemetry({ data, loading, className = '' }: SystemTelemetryProps) {
  if (loading || !data) {
    return (
      <div className={`grid grid-cols-2 gap-2 ${className}`}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-white/[0.03] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-2 gap-2 ${className}`}>
      {METRICS.map((m, i) => (
        <motion.div
          key={m.key}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, duration: 0.2 }}
          className="bg-white/[0.03] rounded-lg p-3 text-center"
        >
          <p className={`text-xl font-bold ${m.color}`}>
            {m.format ? m.format(data[m.key]) : data[m.key].toLocaleString()}
          </p>
          <p className="text-[9px] text-zinc-500 mt-0.5">{m.label}</p>
        </motion.div>
      ))}
    </div>
  );
}

export default SystemTelemetry;
