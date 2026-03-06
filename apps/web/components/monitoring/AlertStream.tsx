'use client';

/**
 * AlertStream.tsx — Wave 86: Real-Time Alert Display
 *
 * Shows expiring licenses, revocation alerts, and issuer trust degradation.
 */

import { motion } from 'framer-motion';

// ── Types ─────────────────────────────────────────────────────────────

export interface MonitoringAlert {
  id: string;
  type: 'license_expiring' | 'credential_expired' | 'credential_revoked' | 'issuer_degradation';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  npi: string;
  title: string;
  description: string;
  daysRemaining?: number;
  detectedAt: string;
}

interface AlertStreamProps {
  alerts: MonitoringAlert[];
  loading?: boolean;
  className?: string;
}

// ── Styling ───────────────────────────────────────────────────────────

const SEVERITY_STYLE: Record<string, { border: string; bg: string; dot: string; text: string }> = {
  CRITICAL: { border: 'border-red-500/30', bg: 'bg-red-500/[0.06]', dot: 'bg-red-400', text: 'text-red-300' },
  WARNING: { border: 'border-amber-500/30', bg: 'bg-amber-500/[0.06]', dot: 'bg-amber-400', text: 'text-amber-300' },
  INFO: { border: 'border-zinc-700', bg: 'bg-white/[0.02]', dot: 'bg-zinc-500', text: 'text-zinc-400' },
};

const TYPE_ICON: Record<string, string> = {
  license_expiring: '⏱',
  credential_expired: '✕',
  credential_revoked: '⚡',
  issuer_degradation: '▼',
};

// ── Component ─────────────────────────────────────────────────────────

export function AlertStream({ alerts, loading, className = '' }: AlertStreamProps) {
  if (loading) {
    return (
      <div className={`space-y-2 ${className}`}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-white/[0.03] animate-pulse" />
        ))}
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className={`flex items-center justify-center py-8 ${className}`}>
        <div className="text-center">
          <span className="text-2xl opacity-20 block mb-2">✓</span>
          <p className="text-xs text-zinc-600">No active alerts</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-1 ${className}`}>
      {alerts.map((alert, i) => {
        const style = SEVERITY_STYLE[alert.severity] ?? SEVERITY_STYLE.INFO;
        return (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05, duration: 0.2 }}
            className={`px-3 py-2.5 rounded-lg border ${style.border} ${style.bg}`}
          >
            <div className="flex items-start gap-2">
              <span className="text-sm mt-0.5">{TYPE_ICON[alert.type] ?? '●'}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-[11px] font-medium ${style.text}`}>{alert.title}</p>
                <p className="text-[9px] text-zinc-500 mt-0.5">{alert.description}</p>
                {alert.daysRemaining !== undefined && (
                  <p className="text-[9px] text-zinc-600 mt-0.5 font-mono">{alert.daysRemaining}d remaining</p>
                )}
              </div>
              <span className={`h-2 w-2 rounded-full ${style.dot} ${alert.severity === 'CRITICAL' ? 'animate-pulse' : ''} mt-1 flex-shrink-0`} />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export default AlertStream;
