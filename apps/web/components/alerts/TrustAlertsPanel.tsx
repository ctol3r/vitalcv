'use client';

/**
 * TrustAlertsPanel.tsx — Wave 97: Trust Alerts System
 *
 * Displays trust alerts with severity, affected credential,
 * recommended action, and one-click acknowledgement.
 */

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getApiBase } from '@/lib/api';
import {
  AlertTriangle,
  Bell,
  BellOff,
  CheckCircle2,
  Info,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────

type TrustAlertType =
  | 'credential_expiring'
  | 'credential_revoked'
  | 'issuer_trust_degradation'
  | 'verification_failure';

type TrustAlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface TrustAlert {
  alertId: string;
  type: TrustAlertType;
  severity: TrustAlertSeverity;
  title: string;
  description: string;
  credentialId?: string;
  issuerId?: string;
  subject?: string;
  recommendedAction: string;
  acknowledged: boolean;
  createdAt: string;
  acknowledgedAt?: string;
}

interface TrustAlertsPanelProps {
  className?: string;
  pollIntervalMs?: number;
  /** Only show unacknowledged by default */
  showAcknowledged?: boolean;
  /** Max alerts to display */
  limit?: number;
  /** Compact dark mode (for command center sidebar) */
  dark?: boolean;
}

// ── Styling ───────────────────────────────────────────────────────────

const SEVERITY: Record<TrustAlertSeverity, {
  border: string; bg: string; dot: string; badge: string; icon: typeof AlertTriangle;
}> = {
  CRITICAL: {
    border: 'border-red-200 dark:border-red-500/30',
    bg: 'bg-red-50 dark:bg-red-500/[0.06]',
    dot: 'bg-red-500',
    badge: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
    icon: XCircle,
  },
  WARNING: {
    border: 'border-amber-200 dark:border-amber-500/30',
    bg: 'bg-amber-50 dark:bg-amber-500/[0.06]',
    dot: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
    icon: AlertTriangle,
  },
  INFO: {
    border: 'border-zinc-200 dark:border-zinc-700',
    bg: 'bg-white dark:bg-white/[0.02]',
    dot: 'bg-zinc-400',
    badge: 'bg-zinc-100 text-zinc-600 dark:bg-white/[0.05] dark:text-zinc-400',
    icon: Info,
  },
};

const TYPE_ICON: Record<TrustAlertType, string> = {
  credential_expiring: '⏱',
  credential_revoked: '✕',
  issuer_trust_degradation: '⚠',
  verification_failure: '✗',
};

// ── Component ─────────────────────────────────────────────────────────

export function TrustAlertsPanel({
  className = '',
  pollIntervalMs = 30_000,
  showAcknowledged = false,
  limit = 20,
  dark = false,
}: TrustAlertsPanelProps) {
  const [alerts, setAlerts] = useState<TrustAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [acknowledging, setAcknowledging] = useState<Set<string>>(new Set());

  const base = getApiBase();

  const fetchAlerts = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        ...(showAcknowledged ? {} : { acknowledged: 'false' }),
      });
      const r = await fetch(`${base}/api/alerts?${params}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json() as { alerts: TrustAlert[] };
      setAlerts(data.alerts ?? []);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, [base, limit, showAcknowledged]);

  useEffect(() => {
    void fetchAlerts();
    const iv = setInterval(() => void fetchAlerts(), pollIntervalMs);
    return () => clearInterval(iv);
  }, [fetchAlerts, pollIntervalMs]);

  const handleAcknowledge = useCallback(async (alertId: string) => {
    setAcknowledging((prev) => new Set(prev).add(alertId));
    try {
      await fetch(`${base}/api/alerts/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId }),
      });
      setAlerts((prev) =>
        showAcknowledged
          ? prev.map((a) => a.alertId === alertId ? { ...a, acknowledged: true } : a)
          : prev.filter((a) => a.alertId !== alertId),
      );
    } finally {
      setAcknowledging((prev) => {
        const next = new Set(prev);
        next.delete(alertId);
        return next;
      });
    }
  }, [base, showAcknowledged]);

  const criticalCount = alerts.filter((a) => a.severity === 'CRITICAL' && !a.acknowledged).length;
  const headerClass = dark ? 'text-zinc-400' : 'text-muted-foreground';
  const panelClass = dark
    ? 'bg-zinc-900/50 border-zinc-800'
    : 'bg-white border-infra-border';

  return (
    <div className={`rounded-xl border overflow-hidden ${panelClass} ${className}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${dark ? 'border-zinc-800' : 'border-infra-border'}`}>
        <div className="flex items-center gap-2">
          {criticalCount > 0
            ? <Bell className="h-4 w-4 text-red-400 animate-pulse" />
            : <BellOff className={`h-4 w-4 ${headerClass}`} />
          }
          <span className={`text-xs font-bold uppercase tracking-wider ${dark ? 'text-zinc-300' : 'text-foreground'}`}>
            Trust Alerts
          </span>
          {criticalCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[9px] font-bold">
              {criticalCount} CRITICAL
            </span>
          )}
        </div>
        <button
          onClick={() => void fetchAlerts()}
          disabled={loading}
          className={`rounded p-1 hover:bg-white/[0.05] transition-colors disabled:opacity-40`}
          title="Refresh"
        >
          <RefreshCw className={`h-3 w-3 ${headerClass} ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Body */}
      <div className="overflow-y-auto max-h-[480px]">
        {loading && alerts.length === 0 && (
          <div className="space-y-2 p-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`h-16 rounded-lg animate-pulse ${dark ? 'bg-white/[0.03]' : 'bg-muted'}`} />
            ))}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 text-xs text-red-400">
            <ShieldAlert className="h-3.5 w-3.5 flex-shrink-0" />
            {error}
            <button onClick={() => void fetchAlerts()} className="underline ml-1">Retry</button>
          </div>
        )}

        {!loading && !error && alerts.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            <p className={`text-xs ${headerClass}`}>No active alerts</p>
          </div>
        )}

        <AnimatePresence>
          <div className="space-y-1 p-2">
            {alerts.map((alert) => {
              const s = SEVERITY[alert.severity];
              const SevIcon = s.icon;
              const isAcking = acknowledging.has(alert.alertId);

              return (
                <motion.div
                  key={alert.alertId}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`rounded-lg border p-3 space-y-1.5 ${s.border} ${s.bg} ${alert.acknowledged ? 'opacity-50' : ''}`}
                >
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-base leading-none flex-shrink-0">{TYPE_ICON[alert.type]}</span>
                      <span className={`text-xs font-bold truncate ${dark ? 'text-zinc-200' : 'text-foreground'}`}>
                        {alert.title}
                      </span>
                    </div>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 flex items-center gap-0.5 ${s.badge}`}>
                      <SevIcon className="h-2.5 w-2.5" />
                      {alert.severity}
                    </span>
                  </div>

                  {/* Description */}
                  <p className={`text-[11px] leading-relaxed ${dark ? 'text-zinc-400' : 'text-muted-foreground'}`}>
                    {alert.description}
                  </p>

                  {/* Affected credential / issuer */}
                  {(alert.credentialId ?? alert.issuerId ?? alert.subject) && (
                    <div className="flex flex-wrap gap-1.5">
                      {alert.subject && (
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${dark ? 'bg-white/[0.04] text-zinc-500' : 'bg-muted text-muted-foreground'}`}>
                          npi:{alert.subject}
                        </span>
                      )}
                      {alert.credentialId && (
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${dark ? 'bg-white/[0.04] text-zinc-500' : 'bg-muted text-muted-foreground'}`}>
                          cred:{alert.credentialId.slice(0, 8)}
                        </span>
                      )}
                      {alert.issuerId && (
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${dark ? 'bg-white/[0.04] text-zinc-500' : 'bg-muted text-muted-foreground'}`}>
                          {alert.issuerId.split(':').pop()}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Recommended action */}
                  <div className={`text-[10px] italic ${dark ? 'text-zinc-500' : 'text-muted-foreground'}`}>
                    ⟶ {alert.recommendedAction}
                  </div>

                  {/* Acknowledge button */}
                  {!alert.acknowledged && (
                    <button
                      onClick={() => void handleAcknowledge(alert.alertId)}
                      disabled={isAcking}
                      className={`text-[10px] font-medium flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                        dark
                          ? 'bg-white/[0.05] hover:bg-white/[0.08] text-zinc-400 hover:text-zinc-200'
                          : 'bg-muted hover:bg-secondary text-muted-foreground hover:text-foreground'
                      } disabled:opacity-50`}
                    >
                      {isAcking
                        ? <><RefreshCw className="h-2.5 w-2.5 animate-spin" />Acknowledging…</>
                        : <><CheckCircle2 className="h-2.5 w-2.5" />Acknowledge</>
                      }
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        </AnimatePresence>
      </div>

      {/* Footer */}
      {lastUpdated && (
        <div className={`px-4 py-2 border-t text-[9px] ${dark ? 'border-zinc-800 text-zinc-700' : 'border-infra-border text-muted-foreground'}`}>
          Updated {lastUpdated.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
