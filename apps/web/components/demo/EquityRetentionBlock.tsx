import * as React from 'react';

import { cn } from '@/lib/utils';
import { RESEARCH_SIGNALS, MARKET_BENCHMARK_LABELS } from '@/app/demo/_marketData';

/**
 * EquityRetentionBlock — research-signal block surfacing the equity +
 * retention dimension of credentialing friction.
 *
 * TRUTH POSTURE: every figure is rendered as a RESEARCH SIGNAL, not
 * a VitalCV-owned measured outcome. The closing line explicitly
 * narrows VitalCV's role: it addresses one structural source of
 * repeat administrative burden, not the entire diversity-attrition
 * problem.
 */

const SIGNAL_KEYS = [
  'femalePhysicianAttritionHazard',
  'femaleMedianExitAge',
  'blackSurgicalResidentAttrition',
  'ruralInternationalBornPhysicianShare',
  'psychiatryAdminBurden',
  'primaryCareExitRate',
] as const;

export interface EquityRetentionBlockProps {
  className?: string;
}

export function EquityRetentionBlock({ className }: EquityRetentionBlockProps) {
  return (
    <section
      className={cn(
        'rounded-md border border-border bg-card p-6 sm:p-8',
        className,
      )}
      aria-labelledby="equity-heading"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {MARKET_BENCHMARK_LABELS.researchSignal} · equity &amp; retention
      </p>
      <h3
        id="equity-heading"
        className="mt-2 text-base font-semibold leading-snug text-foreground sm:text-lg"
      >
        Credentialing delays are a force multiplier for burnout.
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Streamlining trust is not just about speed — it is about retaining
        clinicians who already carry the highest administrative and
        structural burden.
      </p>

      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {SIGNAL_KEYS.map((k) => {
          const s = RESEARCH_SIGNALS[k];
          return (
            <li
              key={k}
              className="rounded-md border border-border bg-background p-4"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {s.label}
              </p>
              <p className="mt-2 font-mono text-sm font-semibold text-foreground">
                {s.value}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {s.context}
              </p>
              <p className="mt-2 text-[10px] italic text-muted-foreground">
                {s.cite}
              </p>
            </li>
          );
        })}
      </ul>

      <p className="mt-6 rounded-md border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">Truth guard:</span>{' '}
        VitalCV does not by itself solve diversity attrition. VitalCV
        addresses one structural source of repeat administrative burden —
        the credentialing-evidence loop — so the time clinicians spend
        re-proving the same facts to the next reviewer goes down.
      </p>
    </section>
  );
}

export default EquityRetentionBlock;
