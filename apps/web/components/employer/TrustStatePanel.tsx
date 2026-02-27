'use client';

import { Badge } from '@/components/ui/badge';
import { CRSRing } from '@/components/ui/crs-ring';
import { GlassCard, GlassCardContent } from '@/components/ui/glass-card';
import { TrustBandIndicator } from '@/components/ui/trust-band-indicator';
import type { TrustBand } from '@/components/trust-state/types';
import { Checkbox } from '@/components/ui/checkbox';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  History,
  Lock,
  XCircle,
} from 'lucide-react';
import type { TrustStateStatus } from './verifier-types';
import { mapBlockingReason } from './verifier-types';

const START_READY_CLARIFICATION =
  'PSV complete. Employer acceptance and start attestation still required.';

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */

const swapVariants: Variants = {
  enter: { opacity: 0, y: -8, scale: 0.97 },
  center: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: 'easeOut' } },
  exit: { opacity: 0, y: 8, scale: 0.97, transition: { duration: 0.2 } },
};

const revokedCardVariants: Variants = {
  enter: { opacity: 0, scale: 0.96 },
  center: { opacity: 1, scale: 1, transition: { duration: 0.35, ease: 'easeOut' } },
  exit: { opacity: 0, scale: 0.96, transition: { duration: 0.2 } },
};

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface TrustStatePanelProps {
  status: TrustStateStatus;
  simulateDecay: boolean;
  onSimulateDecayChange: (v: boolean) => void;
  trustExplanation: string;
  trustSummary: Record<string, unknown>;
  previousTrustBand?: TrustBand;
  /** When true, overlays the revocation state on all sub-panels */
  isRevoked?: boolean;
}

/* ------------------------------------------------------------------ */
/*  TrustStatePanel — CRS + blocking + agent explanation               */
/* ------------------------------------------------------------------ */

export function TrustStatePanel({
  status,
  simulateDecay,
  onSimulateDecayChange,
  trustExplanation,
  trustSummary,
  previousTrustBand,
  isRevoked = false,
}: TrustStatePanelProps) {
  const liveBand = (status.crs?.band ?? 'RED') as TrustBand;
  // When revoked, force the ring to RED / 0
  const displayBand: TrustBand = isRevoked ? 'RED' : liveBand;
  const displayScore = isRevoked ? 0 : (status.crs?.score ?? 0);

  return (
    <div className="space-y-4">
      {/* ── Agent Explanation + CRS Ring ─────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-4">

        {/* System Explanation */}
        <GlassCard
          interactive
          className={isRevoked
            ? 'bg-red-50/80 border border-red-200'
            : 'bg-foreground/[0.03]'}
        >
          <GlassCardContent>
            <AnimatePresence mode="wait" initial={false}>
              {isRevoked ? (
                <motion.div
                  key="revoked-explanation"
                  variants={swapVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <motion.div
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                      className="h-2 w-2 rounded-full bg-red-600"
                    />
                    <p className="text-xs font-medium uppercase tracking-wider text-red-700">
                      Urgent — Revocation Alert
                    </p>
                  </div>
                  <p className="text-base leading-relaxed font-semibold text-red-900">
                    &ldquo;CA Medical Board webhook received. This clinician&rsquo;s
                    license has been suspended. Cryptographic proof invalidated.
                    Do not schedule.&rdquo;
                  </p>
                  <div className="mt-4 flex gap-4 text-xs font-mono border-t border-red-200 pt-3">
                    <span className="text-red-700">BAND: <span className="font-bold">RED</span></span>
                    <span className="text-red-700">READY: <span className="font-bold">FALSE</span></span>
                    <span className="text-red-700">BLOCKER: <span className="font-bold">LICENSE_REVOKED</span></span>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="live-explanation"
                  variants={swapVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-2 w-2 rounded-full bg-[var(--accent)] animate-[badge-pulse_2s_ease-in-out_infinite]" />
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      System Explanation
                    </p>
                  </div>
                  <p className="text-base leading-relaxed font-medium">
                    &ldquo;{trustExplanation}&rdquo;
                  </p>
                  <div className="mt-4 flex gap-4 text-xs font-mono text-muted-foreground border-t border-border/30 pt-3">
                    <span>
                      BAND:{' '}
                      <span className={trustSummary.band === 'GREEN' ? 'text-[var(--trust-green)]' : 'text-destructive'}>
                        {String(trustSummary.band)}
                      </span>
                    </span>
                    <span>
                      READY:{' '}
                      <span className={trustSummary.start_ready ? 'text-[var(--trust-green)]' : 'text-destructive'}>
                        {String(trustSummary.start_ready).toUpperCase()}
                      </span>
                    </span>
                    {typeof trustSummary.key_blocker === 'string' && trustSummary.key_blocker && (
                      <span>
                        BLOCKER: <span className="text-destructive">{trustSummary.key_blocker}</span>
                      </span>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </GlassCardContent>
        </GlassCard>

        {/* CRS Ring */}
        <GlassCard
          interactive
          weight="heavy"
          className={`flex flex-col items-center justify-center py-4 ${
            isRevoked ? 'bg-red-50/60 border border-red-200' : ''
          }`}
        >
          <GlassCardContent className="flex flex-col items-center gap-2">
            {/* Wrap ring in motion.div for the "drop-to-zero" shake */}
            <motion.div
              animate={isRevoked ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
              transition={isRevoked ? { duration: 0.45, ease: 'easeInOut' } : {}}
            >
              <CRSRing
                band={displayBand}
                percentage={displayScore}
                size={120}
                previousBand={isRevoked ? liveBand : previousTrustBand}
              />
            </motion.div>
            <TrustBandIndicator
              band={displayBand}
              size="sm"
              previousBand={isRevoked ? liveBand : previousTrustBand}
            />
            {!isRevoked && (
              <div className="flex items-center gap-1.5 mt-1">
                <Checkbox
                  id="decay-toggle"
                  checked={simulateDecay}
                  onCheckedChange={(checked) => onSimulateDecayChange(checked as boolean)}
                  className="h-3 w-3"
                />
                <label
                  htmlFor="decay-toggle"
                  className="text-[10px] uppercase font-medium tracking-wider text-muted-foreground cursor-pointer select-none"
                >
                  Simulate Decay
                </label>
              </div>
            )}
          </GlassCardContent>
        </GlassCard>
      </div>

      {/* ── Start Ready + Blocking Reasons + Dispute Evidence ──────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Start Ready ↔ Suspended badge */}
        <AnimatePresence mode="wait" initial={false}>
          {isRevoked ? (
            <motion.div
              key="suspended-card"
              variants={revokedCardVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              <GlassCard
                interactive
                className="border-l-4 border-l-red-600 bg-red-50/70 border-red-200 h-full"
              >
                <GlassCardContent className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-red-700">
                    Scheduling Status
                  </p>
                  <div className="flex items-center gap-2 text-red-700 font-bold text-lg leading-tight">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    Suspended: Do Not Schedule
                  </div>
                  <div className="flex items-center gap-1.5 text-red-600/80">
                    <History className="h-3 w-3" />
                    <span className="text-xs font-medium uppercase tracking-wider">
                      State Board Alert
                    </span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Badge className="text-[10px] h-5 px-1.5 bg-red-100 text-red-700 border-red-200">
                      Revoked
                    </Badge>
                    <Badge className="text-[10px] h-5 px-1.5 bg-red-100 text-red-700 border-red-200">
                      Webhook Verified
                    </Badge>
                  </div>
                  <p className="text-xs text-red-700/70">
                    CA Medical Board suspension received. Requires legal review before reinstatement.
                  </p>
                </GlassCardContent>
              </GlassCard>
            </motion.div>
          ) : (
            <motion.div
              key="start-ready-card"
              variants={revokedCardVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              <GlassCard
                interactive
                className={`border-l-4 h-full ${
                  status.start_ready ? 'border-l-[var(--trust-green)]' : 'border-l-destructive'
                }`}
              >
                <GlassCardContent className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Start Ready
                  </p>
                  {status.start_ready ? (
                    <div className="flex items-center gap-2 text-[var(--trust-green)] font-bold text-2xl">
                      <CheckCircle2 className="h-6 w-6" />
                      YES
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-destructive font-bold text-2xl">
                      <XCircle className="h-6 w-6" />
                      NO
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <History className="h-3 w-3" />
                    <span className="text-xs font-medium uppercase tracking-wider">
                      Audit-backed
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                      Idempotent
                    </Badge>
                    <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                      Concurrency-safe
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {START_READY_CLARIFICATION}
                  </p>
                </GlassCardContent>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Blocking Reasons */}
        <AnimatePresence mode="wait" initial={false}>
          {isRevoked ? (
            <motion.div
              key="revoked-blocking"
              variants={revokedCardVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              <GlassCard
                interactive
                className="border-l-4 border-l-red-600 bg-red-50/70 border-red-200 h-full"
              >
                <GlassCardContent className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-red-700 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Blocking Reasons
                  </p>
                  <ul className="space-y-1.5">
                    <li className="text-sm text-red-700 font-medium flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-600 flex-shrink-0" />
                      State Board Revocation: CA Medical Board
                    </li>
                    <li className="text-sm text-red-700 font-medium flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-600 flex-shrink-0" />
                      Cryptographic proof invalidated
                    </li>
                    <li className="text-sm text-red-700 font-medium flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-600 flex-shrink-0" />
                      All active credential bundles suspended
                    </li>
                  </ul>
                </GlassCardContent>
              </GlassCard>
            </motion.div>
          ) : (
            <motion.div
              key="live-blocking"
              variants={revokedCardVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              <GlassCard
                interactive
                className={`border-l-4 h-full ${
                  status.blocking_reasons?.length > 0 && !status.start_ready
                    ? 'border-l-destructive'
                    : 'border-l-[var(--trust-green)]'
                }`}
              >
                <GlassCardContent className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    {status.blocking_reasons?.length > 0 && !status.start_ready ? (
                      <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 text-[var(--trust-green)]" />
                    )}
                    {status.blocking_reasons?.length > 0 && !status.start_ready
                      ? 'Blocking Reasons'
                      : 'System Check'}
                  </p>
                  {status.blocking_reasons?.length > 0 && !status.start_ready ? (
                    <ul className="space-y-1.5">
                      {status.blocking_reasons.map((reason) => (
                        <li
                          key={reason}
                          className="text-sm text-destructive font-medium flex items-center gap-1.5"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-destructive flex-shrink-0" />
                          {mapBlockingReason(reason)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-[var(--trust-green)] font-medium">
                      No blocking signals detected.
                    </p>
                  )}
                </GlassCardContent>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dispute Evidence — shows chain-of-custody note when revoked */}
        <GlassCard
          interactive
          className={`border-l-4 h-full ${
            isRevoked
              ? 'border-l-red-400 bg-red-50/40 border-red-200'
              : 'border-l-muted-foreground/20'
          }`}
        >
          <GlassCardContent className="space-y-2">
            <p className={`text-xs font-medium uppercase tracking-wider flex items-center gap-1.5 ${
              isRevoked ? 'text-red-700' : 'text-muted-foreground'
            }`}>
              <Lock className="h-3 w-3" />
              {isRevoked ? 'Chain of Custody' : 'Dispute Evidence'}
            </p>
            <AnimatePresence mode="wait" initial={false}>
              {isRevoked ? (
                <motion.ul
                  key="revoked-evidence"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: 0.3 } }}
                  exit={{ opacity: 0 }}
                  className="space-y-2"
                >
                  {[
                    'Webhook timestamp recorded',
                    'Revocation hash anchored',
                    'Prior credential bundle sealed',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-red-700">
                      <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </motion.ul>
              ) : (
                <motion.ul
                  key="live-evidence"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: { duration: 0.3 } }}
                  exit={{ opacity: 0 }}
                  className="space-y-2"
                >
                  {[
                    'Employer signature present',
                    'Hash anchor matches payload',
                    'Event order enforced',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[var(--trust-green)] shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </GlassCardContent>
        </GlassCard>
      </div>
    </div>
  );
}
