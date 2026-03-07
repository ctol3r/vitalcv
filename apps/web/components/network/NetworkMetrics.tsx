'use client';

/**
 * NetworkMetrics.tsx — Wave 89: Trust Network Metrics Panel
 *
 * Displays verification throughput, network nodes,
 * artifacts generated, and system latency.
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { SystemTelemetry, type TelemetryData } from '@/components/system/SystemTelemetry';
import { getApiBase } from '@/lib/api';

interface NetworkMetricsProps {
  className?: string;
}

export function NetworkMetrics({ className = '' }: NetworkMetricsProps) {
  const [data, setData] = useState<TelemetryData | null>(null);
  const [loading, setLoading] = useState(true);

  const base = getApiBase();

  useEffect(() => {
    fetch(`${base}/api/system/telemetry`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [base]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={className}
    >
      <h3 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-3 font-mono">
        Network Telemetry
      </h3>
      <SystemTelemetry data={data} loading={loading} />
    </motion.div>
  );
}

export default NetworkMetrics;
