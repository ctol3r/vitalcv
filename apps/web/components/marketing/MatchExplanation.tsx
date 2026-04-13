'use client';

/**
 * MatchExplanation — visual breakdown of why a provider matches a role.
 * Shows weighted criteria with contribution bars and source labels.
 */

import { cn } from '@/lib/utils';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Award,
  CheckCircle2,
  MapPin,
  Shield,
  Stethoscope,
} from 'lucide-react';
import type { ReactNode } from 'react';

export interface MatchCriterion {
  label: string;
  detail: string;
  weight: number; // 0–100
  source: string;
  icon: ReactNode;
  met: boolean;
}

interface MatchExplanationProps {
  criteria: MatchCriterion[];
  overallScore: number;
  className?: string;
}

export function MatchExplanation({
  criteria,
  overallScore,
  className,
}: MatchExplanationProps) {
  const reducedMotion = useReducedMotion();

  return (
    <div
      className={cn(
        'rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] overflow-hidden',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-5 py-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--vt-text-primary)]">
            Match Explanation
          </h3>
          <p className="text-[10px] text-[var(--vt-text-muted)]">
            How this provider aligns with role requirements
          </p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold tabular-nums text-[var(--vt-text-primary)]">
            {overallScore}
          </span>
          <span className="text-[10px] block uppercase tracking-wider font-medium text-[var(--vt-text-muted)]">
            Score
          </span>
        </div>
      </div>

      {/* Criteria list */}
      <div className="divide-y divide-[var(--vt-border)]">
        {criteria.map((criterion, i) => (
          <CriterionRow
            key={criterion.label}
            criterion={criterion}
            index={i}
            animate={!reducedMotion}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-5 py-2.5">
        <p className="text-[10px] text-[var(--vt-text-muted)]">
          Scores reflect source-verified credential alignment. Weights are
          configurable per role.
        </p>
      </div>
    </div>
  );
}

function CriterionRow({
  criterion,
  index,
  animate,
}: {
  criterion: MatchCriterion;
  index: number;
  animate: boolean;
}) {
  return (
    <div className="flex items-start gap-3 px-5 py-3.5">
      {/* Icon */}
      <div
        className={cn(
          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-sm',
          criterion.met
            ? 'bg-[var(--vt-status-resolved)]/10 text-[var(--vt-status-resolved)]'
            : 'bg-[var(--vt-severity-high)]/10 text-[var(--vt-severity-high)]',
        )}
      >
        {criterion.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--vt-text-primary)]">
            {criterion.label}
          </span>
          {criterion.met && (
            <CheckCircle2 className="h-3 w-3 text-[var(--vt-status-resolved)]" />
          )}
        </div>
        <p className="text-[10px] text-[var(--vt-text-muted)] mt-0.5">
          {criterion.detail}
        </p>

        {/* Weight bar */}
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-sm bg-[var(--vt-surface-dim)] overflow-hidden">
            {animate ? (
              <motion.div
                className={cn(
                  'h-full rounded-sm',
                  criterion.met
                    ? 'bg-[var(--vt-status-resolved)]'
                    : 'bg-[var(--vt-severity-high)]/50',
                )}
                initial={{ width: 0 }}
                whileInView={{ width: `${criterion.weight}%` }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.6,
                  delay: index * 0.08,
                  ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
                }}
              />
            ) : (
              <div
                className={cn(
                  'h-full rounded-sm',
                  criterion.met
                    ? 'bg-[var(--vt-status-resolved)]'
                    : 'bg-[var(--vt-severity-high)]/50',
                )}
                style={{ width: `${criterion.weight}%` }}
              />
            )}
          </div>
          <span className="text-[10px] font-mono tabular-nums text-[var(--vt-text-muted)] w-8 text-right">
            {criterion.weight}%
          </span>
        </div>
      </div>

      {/* Source label */}
      <span className="shrink-0 text-[9px] font-mono font-bold uppercase tracking-widest text-[var(--vt-text-muted)]/60 mt-0.5">
        {criterion.source}
      </span>
    </div>
  );
}

/** Pre-built demo criteria for marketing pages */
export const DEMO_MATCH_CRITERIA: MatchCriterion[] = [
  {
    label: 'Active Medical License',
    detail: 'State medical license verified as active and unrestricted',
    weight: 30,
    source: 'FSMB',
    icon: <Shield className="h-3.5 w-3.5" />,
    met: true,
  },
  {
    label: 'Board Certification',
    detail: 'ABMS board certification in Internal Medicine',
    weight: 25,
    source: 'ABMS',
    icon: <Award className="h-3.5 w-3.5" />,
    met: true,
  },
  {
    label: 'Specialty Match',
    detail: 'Primary specialty aligns with role requirement',
    weight: 20,
    source: 'NPPES',
    icon: <Stethoscope className="h-3.5 w-3.5" />,
    met: true,
  },
  {
    label: 'Location Eligibility',
    detail: 'Licensed to practice in the required state',
    weight: 15,
    source: 'STATE',
    icon: <MapPin className="h-3.5 w-3.5" />,
    met: true,
  },
  {
    label: 'No Exclusions',
    detail: 'No OIG/LEIE exclusions or sanctions found',
    weight: 10,
    source: 'OIG',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    met: true,
  },
];
