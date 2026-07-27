'use client';

/**
 * CredentialWallet.tsx — Wave 104: Credential Wallet Expansion
 *
 * Full credential wallet view for the holder/passport page.
 * Features:
 * - Credential list with status badges
 * - Expiration warnings (critical/warning/expired)
 * - Remove credential action
 * - Summary stats (active, expiring, expired, revoked)
 * - Polling for live updates
 */

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getApiBase } from '@/lib/api';
import { walletDeletePath, walletFetchPath } from '@/lib/wallet/credential-wallet-paths';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileKey2,
  RefreshCw,
  Shield,
  ShieldAlert,
  Trash2,
  XCircle,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────

type CredentialStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'SUSPENDED';
type ExpiryWarning = 'none' | 'warning' | 'critical' | 'expired';

interface VerifiableCredential {
  credentialId: string;
  issuer: string;
  subject: string;
  claims: Record<string, unknown>;
  status: CredentialStatus;
  issuedAt: string;
  expiresAt?: string;
  schemaVersion: string;
}

interface WalletCredentialRow {
  credential: VerifiableCredential;
  daysUntilExpiry: number | null;
  expiryWarning: ExpiryWarning;
}

interface WalletSummary {
  subject: string;
  total: number;
  active: number;
  expiring: number;
  expired: number;
  revoked: number;
}

interface WalletResponse {
  subject: string;
  credentials: WalletCredentialRow[];
  summary: WalletSummary;
}

interface CredentialWalletProps {
  /** Required: this component must never guess whose wallet it is rendering. */
  subject: string;
  className?: string;
  pollIntervalMs?: number;
}

// ── Styling helpers ───────────────────────────────────────────────────

const STATUS_STYLE: Record<CredentialStatus, { badge: string; icon: typeof Shield }> = {
  ACTIVE: { badge: 'bg-emerald-100 text-emerald-700 border border-emerald-200', icon: CheckCircle2 },
  REVOKED: { badge: 'bg-red-100 text-red-700 border border-red-200', icon: XCircle },
  EXPIRED: { badge: 'bg-zinc-100 text-zinc-500 border border-zinc-200', icon: Clock },
  SUSPENDED: { badge: 'bg-amber-100 text-amber-700 border border-amber-200', icon: ShieldAlert },
};

const EXPIRY_STYLE: Record<ExpiryWarning, { bar: string; text: string; icon?: typeof AlertTriangle }> = {
  none: { bar: 'bg-emerald-400', text: 'text-emerald-600' },
  warning: { bar: 'bg-amber-400', text: 'text-amber-600', icon: AlertTriangle },
  critical: { bar: 'bg-red-400', text: 'text-red-600', icon: AlertTriangle },
  expired: { bar: 'bg-zinc-300', text: 'text-zinc-500', icon: Clock },
};

// This wallet renders on an authenticated clinician's own workspace. It shows
// credentials the API returns for them and nothing else — there is no demo or
// placeholder fallback, because a substituted credential here reads as the
// clinician's own. When the API is unavailable, say so instead.

// ── Component ─────────────────────────────────────────────────────────

export function CredentialWallet({
  subject,
  className = '',
  pollIntervalMs = 60_000,
}: CredentialWalletProps) {
  const [data, setData] = useState<WalletResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Set<string>>(new Set());
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const base = getApiBase();

  const fetchWallet = useCallback(async () => {
    if (!subject) {
      setData(null);
      setError('A clinician NPI is required to load the credential wallet.');
      setLoading(false);
      return;
    }

    try {
      const r = await fetch(walletFetchPath(base, subject));
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json() as WalletResponse;
      setData(json);
      setLastUpdated(new Date());
      setError(null);
    } catch {
      // Never substitute stand-in credentials here — an unreachable wallet is
      // reported as unreachable. Credentials already fetched for this subject
      // are the clinician's own, so they stay on screen and are marked stale
      // rather than being replaced or silently refreshed.
      setError('Credential wallet is unavailable right now.');
    } finally {
      setLoading(false);
    }
  }, [base, subject]);

  useEffect(() => {
    void fetchWallet();
    const iv = setInterval(() => void fetchWallet(), pollIntervalMs);
    return () => clearInterval(iv);
  }, [fetchWallet, pollIntervalMs]);

  const handleRemove = useCallback(async (credentialId: string) => {
    setRemoving((prev) => new Set(prev).add(credentialId));
    try {
      await fetch(walletDeletePath(base, credentialId), { method: 'DELETE' });
      setData((prev) =>
        prev
          ? {
              ...prev,
              credentials: prev.credentials.filter((r) => r.credential.credentialId !== credentialId),
              summary: { ...prev.summary, total: prev.summary.total - 1 },
            }
          : prev,
      );
    } finally {
      setRemoving((prev) => {
        const next = new Set(prev);
        next.delete(credentialId);
        return next;
      });
    }
  }, [base]);

  const credentials = data?.credentials ?? [];
  const summary = data?.summary;

  return (
    <div className={`rounded-2xl border border-infra-border bg-white overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-infra-border bg-infra-surface">
        <div className="flex items-center gap-2">
          <FileKey2 className="h-5 w-5 text-infra-blue" />
          <h2 className="font-bold text-foreground">Credential Wallet</h2>
          {summary && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {summary.total} total
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => void fetchWallet()}
          disabled={loading}
          aria-label="Refresh credential wallet"
          aria-busy={loading}
          className="rounded p-1.5 hover:bg-secondary transition-colors disabled:opacity-40"
          title="Refresh wallet"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Summary bar */}
      {summary && (
        <div className="grid grid-cols-4 divide-x divide-infra-border border-b border-infra-border text-center">
          {[
            { label: 'Active', value: summary.active, color: 'text-emerald-600' },
            { label: 'Expiring', value: summary.expiring, color: 'text-amber-600' },
            { label: 'Expired', value: summary.expired, color: 'text-zinc-500' },
            { label: 'Revoked', value: summary.revoked, color: 'text-red-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="px-3 py-2">
              <p className={`text-base font-bold ${color}`}>{value}</p>
              <p className="text-[10px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Refresh failed, but real credentials from an earlier load are still shown */}
      {error && credentials.length > 0 && (
        <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-5 py-3">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-600" />
          <p className="text-xs leading-5 text-amber-800">
            Could not refresh
            {lastUpdated ? ` — showing your wallet as of ${lastUpdated.toLocaleTimeString()}` : ''}
            . This view may be out of date.
          </p>
        </div>
      )}

      {/* Credential list */}
      <div className="divide-y divide-infra-border/60">
        {loading && credentials.length === 0 && !error && (
          <div className="space-y-2 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        )}

        {!loading && error && credentials.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-sm font-semibold text-foreground">Credential wallet unavailable</p>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
                {error} Nothing is shown here until it can be reached again.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void fetchWallet()}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-infra-border px-3 text-xs font-semibold text-foreground transition-colors hover:bg-secondary"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        )}

        {!loading && !error && credentials.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12">
            <FileKey2 className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No credentials in wallet</p>
          </div>
        )}

        <AnimatePresence>
          {credentials.map(({ credential, daysUntilExpiry, expiryWarning }) => {
            const ss = STATUS_STYLE[credential.status] ?? STATUS_STYLE.ACTIVE;
            const es = EXPIRY_STYLE[expiryWarning];
            const StatusIcon = ss.icon;
            const isRemoving = removing.has(credential.credentialId);
            const issuerLabel = credential.issuer.split(':').pop() ?? credential.issuer;
            const claimCount = Object.keys(credential.claims).filter((k) => !k.startsWith('_')).length;

            return (
              <motion.div
                key={credential.credentialId}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="px-5 py-4 flex items-start gap-4 hover:bg-infra-surface/60 transition-colors"
              >
                {/* Icon */}
                <div className={`rounded-xl p-2 mt-0.5 flex-shrink-0 ${ss.badge}`}>
                  <StatusIcon className="h-4 w-4" />
                </div>

                {/* Body */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  {/* Top row */}
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {String(credential.claims.licenseNumber ?? credential.claims.certificationId ?? credential.claims.deaNumber ?? credential.credentialId.slice(0, 12))}
                    </p>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${ss.badge}`}>
                        {credential.status}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleRemove(credential.credentialId)}
                        disabled={isRemoving}
                        aria-label={`Remove ${issuerLabel} credential from wallet`}
                        aria-busy={isRemoving}
                        className="rounded p-1 hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-40"
                        title="Remove from wallet"
                      >
                        {isRemoving
                          ? <RefreshCw className="h-3 w-3 animate-spin" />
                          : <Trash2 className="h-3 w-3" />
                        }
                      </button>
                    </div>
                  </div>

                  {/* Issuer + claims */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Shield className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{issuerLabel}</span>
                    <span className="text-zinc-300">·</span>
                    <span>{claimCount} claims</span>
                  </div>

                  {/* Expiry indicator */}
                  {daysUntilExpiry !== null && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1 rounded-full bg-zinc-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${es.bar}`}
                          style={{ width: `${Math.max(2, Math.min(100, (daysUntilExpiry / 365) * 100))}%` }}
                        />
                      </div>
                      <span className={`text-[10px] font-medium flex items-center gap-0.5 flex-shrink-0 ${es.text}`}>
                        {es.icon && <es.icon className="h-2.5 w-2.5" />}
                        {expiryWarning === 'expired'
                          ? 'Expired'
                          : `${daysUntilExpiry}d`
                        }
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Footer */}
      {lastUpdated && (
        <div className="px-5 py-2 border-t border-infra-border text-[9px] text-muted-foreground">
          Updated {lastUpdated.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
