'use client';

import { Badge } from '@/components/ui/badge';
import { CRSRing } from '@/components/ui/crs-ring';
import { GlassCard, GlassCardContent } from '@/components/ui/glass-card';
import { TrustBandIndicator } from '@/components/ui/trust-band-indicator';
import type { TrustBand } from '@/components/trust-state/types';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertCircle,
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
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface TrustStatePanelProps {
  status: TrustStateStatus;
  simulateDecay: boolean;
  onSimulateDecayChange: (v: boolean) => void;
  trustExplanation: string;
  trustSummary: Record<string, unknown>;
  previousTrustBand?: TrustBand;
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
}: TrustStatePanelProps) {
  const band = (status.crs?.band ?? 'RED') as TrustBand;

  return (
    <div className="space-y-4">
      {/* Agent Explanation + CRS Ring */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-4">
        {/* System Explanation */}
        <GlassCard interactive className="bg-foreground/[0.03]">
          <GlassCardContent>
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
                <span
                  className={
                    trustSummary.band === 'GREEN'
                      ? 'text-[var(--trust-green)]'
                      : 'text-destructive'
                  }
                >
                  {String(trustSummary.band)}
                </span>
              </span>
              <span>
                READY:{' '}
                <span
                  className={
                    trustSummary.start_ready
                      ? 'text-[var(--trust-green)]'
                      : 'text-destructive'
                  }
                >
                  {String(trustSummary.start_ready).toUpperCase()}
                </span>
              </span>
              {typeof trustSummary.key_blocker === 'string' && trustSummary.key_blocker && (
                <span>
                  BLOCKER:{' '}
                  <span className="text-destructive">
                    {trustSummary.key_blocker}
                  </span>
                </span>
              )}
            </div>
          </GlassCardContent>
        </GlassCard>

        {/* CRS Ring */}
        <GlassCard interactive weight="heavy" className="flex flex-col items-center justify-center py-4">
          <GlassCardContent className="flex flex-col items-center gap-2">
            <CRSRing
              band={band}
              percentage={status.crs?.score ?? 0}
              size={120}
              previousBand={previousTrustBand}
            />
            <TrustBandIndicator band={band} size="sm" previousBand={previousTrustBand} />
            <div className="flex items-center gap-1.5 mt-1">
              <Checkbox
                id="decay-toggle"
                checked={simulateDecay}
                onCheckedChange={(checked) =>
                  onSimulateDecayChange(checked as boolean)
                }
                className="h-3 w-3"
              />
              <label
                htmlFor="decay-toggle"
                className="text-[10px] uppercase font-medium tracking-wider text-muted-foreground cursor-pointer select-none"
              >
                Simulate Decay
              </label>
            </div>
          </GlassCardContent>
        </GlassCard>
      </div>

      {/* Start Ready + Blocking Reasons + Dispute Evidence */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Start Ready */}
        <GlassCard
          interactive
          className={`border-l-4 ${
            status.start_ready
              ? 'border-l-[var(--trust-green)]'
              : 'border-l-destructive'
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

        {/* Blocking Reasons */}
        <GlassCard
          interactive
          className={`border-l-4 ${
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

        {/* Dispute Evidence */}
        <GlassCard interactive className="border-l-4 border-l-muted-foreground/20">
          <GlassCardContent className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Lock className="h-3 w-3" />
              Dispute Evidence
            </p>
            <ul className="space-y-2">
              {[
                'Employer signature present',
                'Hash anchor matches payload',
                'Event order enforced',
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-xs"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-[var(--trust-green)] shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </GlassCardContent>
        </GlassCard>
      </div>
    </div>
  );
}
