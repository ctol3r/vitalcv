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
  subject?: string;
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

// Demo data for when API is unavailable
const DEMO_ROWS: WalletCredentialRow[] = [
  {
    credential: {
      credentialId: 'demo-001-0000-0000-0000',
      issuer: 'did:vitalcv:issuer:ca-medical-board',
      subject: '1003000126',
      claims: { licenseNumber: 'CA-8821', state: 'CA', specialty: 'Internal Medicine', npi: '1003000126' },
      status: 'ACTIVE',
      issuedAt: '2024-01-15T00:00:00Z',
      expiresAt: new Date(Date.now() + 25 * 86_400_000).toISOString(),
      schemaVersion: '1.0',
    },
    daysUntilExpiry: 25,
    expiryWarning: 'warning',
  },
  {
    credential: {
      credentialId: 'demo-002-0000-0000-0000',
      issuer: 'did:vitalcv:issuer:abim',
      subject: '1003000126',
      claims: { certificationId: 'ABIM-4422', specialty: 'Internal Medicine', boardName: 'ABIM' },
      status: 'ACTIVE',
      issuedAt: '2023-06-01T00:00:00Z',
      expiresAt: new Date(Date.now() + 400 * 86_400_000).toISOString(),
      schemaVersion: '1.0',
    },
    daysUntilExpiry: 400,
    expiryWarning: 'none',
  },
  {
    credential: {
      credentialId: 'demo-003-0000-0000-0000',
      issuer: 'did:vitalcv:issuer:dea',
      subject: '1003000126',
      claims: { deaNumber: 'BD1234567', schedules: 'II-V', state: 'CA' },
      status: 'REVOKED',
      issuedAt: '2022-03-01T00:00:00Z',
      schemaVersion: '1.0',
    },
    daysUntilExpiry: null,
    expiryWarning: 'none',
  },
];

// ── Component ─────────────────────────────────────────────────────────

export function CredentialWallet({
  subject = '1003000126',
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
    try {
      const r = await fetch(`${base}/api/credentials/wallet/${encodeURIComponent(subject)}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json() as WalletResponse;
      setData(json);
      setLastUpdated(new Date());
      setError(null);
    } catch {
      // Fall back to demo data in dev/preview
      if (!data) {
        setData({
          subject,
          credentials: DEMO_ROWS,
          summary: { subject, total: 3, active: 2, expiring: 1, expired: 0, revoked: 1 },
        });
      }
      setError(null); // Suppress error when demo data available
    } finally {
      setLoading(false);
    }
  }, [base, subject, data]);

  useEffect(() => {
    void fetchWallet();
    const iv = setInterval(() => void fetchWallet(), pollIntervalMs);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollIntervalMs, subject]);

  const handleRemove = useCallback(async (credentialId: string) => {
    setRemoving((prev) => new Set(prev).add(credentialId));
    try {
      await fetch(`${base}/api/credentials/${credentialId}`, { method: 'DELETE' });
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
          onClick={() => void fetchWallet()}
          disabled={loading}
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

      {/* Credential list */}
      <div className="divide-y divide-infra-border/60">
        {loading && credentials.length === 0 && (
          <div className="space-y-2 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        )}

        {!loading && credentials.length === 0 && (
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
                        onClick={() => void handleRemove(credential.credentialId)}
                        disabled={isRemoving}
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
