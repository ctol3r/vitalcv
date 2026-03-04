'use client';

import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';

/* ── Simulated ledger events ───────────────────────────────── */

const LEDGER_EVENTS = [
  { hash: '0x7f3a…9bc1', event: 'CA Medical License Verified', accent: 'text-emerald-500' },
  { hash: '0x4be2…11d0', event: 'Start Attestation Anchored', accent: 'text-cyan-500' },
  { hash: '0x9a17…f3c8', event: 'NPDB Check Cleared', accent: 'text-emerald-500' },
  { hash: '0xc41b…7ea9', event: 'DEA Registration Confirmed', accent: 'text-emerald-500' },
  { hash: '0x2d8f…c4a2', event: 'Board Certification Verified', accent: 'text-cyan-500' },
  { hash: '0xe573…0b17', event: 'OIG/LEIE Exclusion Check Passed', accent: 'text-emerald-500' },
  { hash: '0x88a1…d9f5', event: 'TX-TMB License Verified', accent: 'text-emerald-500' },
  { hash: '0x3fc9…2e84', event: 'Merkle Root Published', accent: 'text-violet-500' },
  { hash: '0xb120…8a33', event: 'NY-SED License Verified', accent: 'text-emerald-500' },
  { hash: '0x6d4e…f107', event: 'Continuous Monitor: No Changes', accent: 'text-amber-500' },
  { hash: '0xa9c2…55be', event: 'FL-DOH License Verified', accent: 'text-emerald-500' },
  { hash: '0x15d7…cb90', event: 'SAM Exclusion Check Passed', accent: 'text-emerald-500' },
] as const;

/* Duplicate for seamless loop */
const ITEMS = [...LEDGER_EVENTS, ...LEDGER_EVENTS];

export function LedgerTicker() {
  return (
    <section className="relative overflow-hidden border-y border-infra-border bg-infra-surface/60 backdrop-blur-sm py-4">
      {/* Fade edges */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-infra-surface to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-infra-surface to-transparent" />

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
            <Shield className="h-3 w-3 text-muted-foreground/30" />
            <span className="font-mono text-[11px] text-muted-foreground/40">
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
