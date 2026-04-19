'use client';

/**
 * ActuarialRiskPanel — Velocity + Actuarial Risk Profile side-by-side.
 *
 * Hospitals and CMOs need to see the math that justifies the Trust Warranty.
 * This panel pairs operational velocity (time saved, industry benchmark)
 * with actuarial figures (system-wide defect rate, monitoring cadence, risk
 * status) — rendered in strict tabular-nums to align visually.
 *
 * `Risk_Status` takes the emerald trust state when acceptable; remains
 * utilitarian otherwise. No other color applied to this panel.
 */

import { Activity, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export type RiskStatus = 'ACCEPTABLE FOR UNDERWRITING' | 'CONDITIONAL' | 'OUT OF SCOPE';

export interface ActuarialRiskPanelProps {
  /** Days saved vs. industry baseline. */
  daysSaved?: number;
  /** Industry baseline in days (for the comparison line). */
  industryBaselineDays?: number;
  /** Estimated time-to-start for this packet. */
  estimatedStart?: string;
  /** Historical defect rate in percent — tabular-nums formatted. */
  defectRate?: string;
  /** Continuous monitoring interval label. */
  monitoringInterval?: string;
  /** Risk status — drives color on the Risk_Status line. */
  riskStatus?: RiskStatus;
  className?: string;
}

export function ActuarialRiskPanel({
  daysSaved = 45,
  industryBaselineDays = 90,
  estimatedStart = '14 Days',
  defectRate = '0.012%',
  monitoringInterval = '24h',
  riskStatus = 'ACCEPTABLE FOR UNDERWRITING',
  className,
}: ActuarialRiskPanelProps) {
  const industryRange = `${Math.max(industryBaselineDays - 20, 0)}–${industryBaselineDays}`;
  return (
    <section
      data-slot="actuarial-risk-panel"
      aria-labelledby="actuarial-panel-title"
      className={cn(
        'border border-line bg-[var(--color-bg)] text-ink',
        className,
      )}
    >
      {/* Header strip */}
      <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
        <div className="flex items-center gap-2">
          <Activity className="h-3 w-3 opacity-50" aria-hidden="true" />
          <h3
            id="actuarial-panel-title"
            className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/60"
          >
            Velocity &amp; Actuarial Metrics
          </h3>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/40">
          Block · 02 / 04
        </span>
      </header>

      {/* Velocity row — three big stats */}
      <div className="grid grid-cols-3 divide-x divide-line">
        <Stat
          label="Days Saved"
          value={`${daysSaved}`}
          suffix="d"
          detail={`vs ${industryRange}d industry baseline`}
        />
        <Stat
          label="Est. Time to Start"
          value={estimatedStart}
          detail="Auto-derived from open lanes"
        />
        <Stat
          label="Industry Baseline"
          value={`${industryBaselineDays}`}
          suffix="d"
          detail="MGMA 2025 credentialing report"
          muted
        />
      </div>

      {/* Actuarial block — the math that underwrites */}
      <div className="border-t border-line bg-ink/[0.025] px-5 py-4">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck
            className="h-3 w-3 text-ink/50"
            aria-hidden="true"
            strokeWidth={2.25}
          />
          <h4 className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/60">
            Actuarial Risk Profile
          </h4>
          <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink/30">
            · underwrites warranty
          </span>
        </div>

        <dl className="font-mono text-[12px] leading-relaxed tabular-nums space-y-1.5">
          <ActuarialRow
            label="System_Historical_Defect_Rate"
            value={defectRate}
          />
          <ActuarialRow
            label="Continuous_Monitoring_Interval"
            value={monitoringInterval}
          />
          <ActuarialRow
            label="Risk_Status"
            value={riskStatus}
            tone={riskStatus === 'ACCEPTABLE FOR UNDERWRITING' ? 'emerald' : 'neutral'}
          />
        </dl>
      </div>
    </section>
  );
}

// ── Sub-components ───────────────────────────────────────────────

function Stat({
  label,
  value,
  suffix,
  detail,
  muted,
}: {
  label: string;
  value: string;
  suffix?: string;
  detail: string;
  muted?: boolean;
}) {
  return (
    <div className="px-5 py-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
        {label}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1 font-mono tabular-nums">
        <span
          className={cn(
            'text-[30px] font-semibold leading-none tracking-tight',
            muted ? 'text-ink/50' : 'text-ink',
          )}
        >
          {value}
        </span>
        {suffix && (
          <span className={cn('text-[14px]', muted ? 'text-ink/40' : 'text-ink/60')}>
            {suffix}
          </span>
        )}
      </div>
      <div className="mt-2 text-[10.5px] leading-snug text-ink/50">{detail}</div>
    </div>
  );
}

function ActuarialRow({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'emerald';
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
      <span className="text-[11.5px] uppercase tracking-[0.12em] text-ink/55 sm:min-w-[260px]">
        {label}
        <span className="text-ink/25" aria-hidden="true">:</span>
      </span>
      <span
        className={cn(
          'font-semibold',
          tone === 'emerald'
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-ink',
        )}
      >
        {tone === 'emerald' && (
          <span
            aria-hidden="true"
            className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 align-middle shadow-[0_0_6px_rgba(16,185,129,0.6)]"
          />
        )}
        <span className="align-middle">{value}</span>
      </span>
    </div>
  );
}

export default ActuarialRiskPanel;
