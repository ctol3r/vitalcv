'use client';

import { commandSnap, controlStagger } from '@/animations/motionVariants';
import { cn } from '@/lib/utils';
import { systemVoice } from '@/lib/systemVoice';
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';
import * as React from 'react';
import { ConfidenceMeter } from './ConfidenceMeter';
import { ActionBar } from './ActionBar';

type SignalStatus = 'detected' | 'ready' | 'required' | 'resolved';

interface SignalCardProps {
  /** Signal status determines the label */
  status: SignalStatus;
  /** Main recommendation text */
  recommendation: string;
  /** Confidence percentage 0–100 */
  confidence: number;
  /** Primary action */
  primaryAction: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
  /** Optional secondary action */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** Optional entity/target name */
  entity?: string;
  /** Optional supporting context line */
  context?: string;
  className?: string;
}

const statusLabels: Record<SignalStatus, string> = {
  detected: systemVoice.signalDetected,
  ready: systemVoice.recommendationReady,
  required: systemVoice.actionRequired,
  resolved: systemVoice.signalResolved,
};

const statusColors: Record<SignalStatus, string> = {
  detected: 'text-[var(--control-accent)] bg-[var(--control-accent)]/10',
  ready: 'text-[var(--control-success)] bg-[var(--control-success)]/10',
  required: 'text-amber-400 bg-amber-500/10',
  resolved: 'text-[var(--control-text-muted)] bg-muted',
};

/**
 * SignalCard — The "decision block" pattern.
 *
 * Top:    Signal status pill
 * Middle: Recommendation text + ConfidenceMeter
 * Bottom: ActionBar (1 primary + 1 secondary)
 *
 * Uses commandSnap for instant appearance.
 */
export function SignalCard({
  status,
  recommendation,
  confidence,
  primaryAction,
  secondaryAction,
  entity,
  context,
  className,
}: SignalCardProps) {
  return (
    <motion.div
      variants={commandSnap}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={cn(
        'rounded-lg border p-4',
        'border-[var(--control-border)] bg-[var(--control-surface-raised)]',
        'control-surface',
        className
      )}
    >
      <motion.div variants={controlStagger} initial="hidden" animate="visible">
        {/* Status pill */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5',
              'text-[10px] font-semibold uppercase tracking-[0.1em]',
              statusColors[status]
            )}
          >
            <Activity className="w-3 h-3" />
            {statusLabels[status]}
          </span>
          <ConfidenceMeter value={confidence} size="sm" />
        </div>

        {/* Recommendation */}
        <div className="space-y-1">
          {entity && (
            <p className="text-[11px] font-medium text-[var(--control-text-subtle)] uppercase tracking-wider">
              {entity}
            </p>
          )}
          <p className="text-sm font-medium text-[var(--control-text)] leading-snug">
            {recommendation}
          </p>
          {context && (
            <p className="text-xs text-[var(--control-text-muted)] leading-relaxed">
              {context}
            </p>
          )}
        </div>

        {/* Actions */}
        <ActionBar
          primary={primaryAction}
          secondary={secondaryAction}
        />
      </motion.div>
    </motion.div>
  );
}
