'use client';

/**
 * NetworkPage — Wave 128: Trust Network Overview
 *
 * Displays the global trust network graph and network-wide metrics.
 */

import { GlobalTrustMap } from '@/components/network/GlobalTrustMap';
import NetworkTelemetryIntelligence from '@/components/telemetry/NetworkTelemetryIntelligence';
import { motion } from 'framer-motion';

export default function NetworkPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <main className="mx-auto max-w-7xl px-6 py-10 space-y-8">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-2xl font-bold tracking-tight">Trust Network</h1>
          <p className="mt-2 text-sm text-zinc-400 max-w-2xl">
            Live view of the credential verification network — issuers, verifiers, and trust
            relationships across healthcare organizations.
          </p>
        </motion.div>

        {/* Global Trust Map */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden"
        >
          <GlobalTrustMap />
        </motion.div>

        {/* Network Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <NetworkTelemetryIntelligence windowDays={30} />
        </motion.div>
      </main>
    </div>
  );
}
