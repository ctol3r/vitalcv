'use client';

import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';

/* ── Simulated ledger events ───────────────────────────────── */

// M1 — Only sources that are actually live: NPPES, OIG/LEIE, Nursys (gated).
// NPDB, DEA, SAM.gov, Merkle blockchain not integrated — do not add them back.
// IDs here are audit event UUIDs (truncated), not blockchain hashes.
const LEDGER_EVENTS = [
  { hash: 'evt:7f3a…9b', event: 'CA Medical License Verified', accent: 'text-[var(--vt-status-resolved)]' },
  { hash: 'evt:4be2…1d', event: 'Start Attestation Signed', accent: 'text-[var(--vt-status-new)]' },
  { hash: 'evt:2d8f…c4', event: 'OIG/LEIE Exclusion Check Passed', accent: 'text-[var(--vt-status-resolved)]' },
  { hash: 'evt:88a1…d9', event: 'TX-TMB License Verified', accent: 'text-[var(--vt-status-resolved)]' },
  { hash: 'evt:b120…8a', event: 'NY-SED License Verified', accent: 'text-[var(--vt-status-resolved)]' },
  { hash: 'evt:6d4e…f1', event: 'Continuous Monitor: No Changes', accent: 'text-[var(--vt-severity-high)]' },
  { hash: 'evt:a9c2…55', event: 'FL-DOH License Verified', accent: 'text-[var(--vt-status-resolved)]' },
  { hash: 'evt:e573…01', event: 'Nursys: License Standing Confirmed', accent: 'text-[var(--vt-status-resolved)]' },
  { hash: 'evt:3fc9…2e', event: 'NPPES Identity Verified', accent: 'text-[var(--vt-status-new)]' },
  { hash: 'evt:c41b…7e', event: 'Employer Acceptance Audited', accent: 'text-[var(--vt-status-new)]' },
] as const;

/* Duplicate for seamless loop */
const ITEMS = [...LEDGER_EVENTS, ...LEDGER_EVENTS];

export function LedgerTicker() {
  return (
    <section className="relative overflow-hidden border-y border-[var(--vt-border)] bg-[var(--vt-surface)] py-4">
      {/* Fade edges */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[var(--vt-bg)] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[var(--vt-bg)] to-transparent" />

      <motion.div
        className="flex w-max gap-8"
        animate={{ x: ['0%', '-50%'] }}
        transition={{
          x: {
            duration: 45,
            repeat: Infinity,
            ease: 'linear',
          },
        }}
      >
        {ITEMS.map((item, i) => (
          <div
            key={`${item.hash}-${i}`}
            className="flex shrink-0 items-center gap-3"
          >
            <Shield className="h-3 w-3 text-[var(--vt-text-muted)]/30" />
            <span className="font-mono text-[10px] text-[var(--vt-text-muted)]">
              [{item.hash}]
            </span>
            <span className={`text-xs font-medium ${item.accent} opacity-70`}>
              {item.event}
            </span>
          </div>
        ))}
      </motion.div>
    </section>
  );
}
