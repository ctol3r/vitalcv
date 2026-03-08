'use client';

/**
 * NetworkPage — Wave 179: Responsive Grid Infrastructure
 *
 * Layout: 12-column responsive grid (Wave 179)
 *   - Mobile: full-width stacked
 *   - lg+: map full-width, then 2-col (telemetry 8/12 + explorer 4/12)
 *
 * Token integration: bg-ops-gradient, vt-* surface/neutral tokens
 * Typography: heading-lg, body-sm (Wave 178)
 */

import { GlobalTrustMap } from '@/components/network/GlobalTrustMap';
import NetworkTelemetryIntelligence from '@/components/telemetry/NetworkTelemetryIntelligence';
import TrustGraphExplorer from '@/components/network/TrustGraphExplorer';
import { Grid, GridCol } from '@/components/layout/Grid';
import { motion } from 'framer-motion';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay, ease: [0.2, 0.8, 0.2, 1] as const },
});

export default function NetworkPage() {
  return (
    <div className="min-h-screen bg-ops-gradient text-white surface-operator">
      <main className="mx-auto max-w-7xl px-6 py-10 space-y-8">

        {/* ── Hero ────────────────────────────────────────────── */}
        <motion.div {...fadeUp(0)}>
          <h1 className="heading-lg text-white">Trust Network</h1>
          <p className="body-sm mt-2 text-vt-neutral-200 max-w-2xl">
            Live view of the credential verification network — issuers, verifiers, and trust
            relationships across healthcare organizations.
          </p>
        </motion.div>

        {/* ── 12-col Grid: full map row ────────────────────────── */}
        <Grid cols={1} gap="lg">
          <GridCol span="full">
            <motion.div {...fadeUp(0.1)}
              className="rounded-2xl border border-vt-neutral-800 bg-vt-surface-ops-base overflow-hidden"
            >
              <GlobalTrustMap />
            </motion.div>
          </GridCol>
        </Grid>

        {/* ── 12-col Grid: telemetry (8) + explorer (4) on lg+ ─── */}
        <Grid cols={1} lg={12} gap="lg">
          {/* Telemetry panel — 8/12 on lg, full on mobile */}
          <GridCol span="full" lg={8}>
            <motion.div {...fadeUp(0.2)}>
              <NetworkTelemetryIntelligence windowDays={30} />
            </motion.div>
          </GridCol>

          {/* Trust Graph Explorer — 4/12 on lg, full on mobile */}
          <GridCol span="full" lg={4}>
            <motion.div {...fadeUp(0.3)}>
              <TrustGraphExplorer />
            </motion.div>
          </GridCol>
        </Grid>

      </main>
    </div>
  );
}
