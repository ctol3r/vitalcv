'use client';

/**
 * ProviderDirectoryPanel.tsx — Wave 161: Provider Directory Distribution
 *
 * Export panel for /mission-ops showing:
 *   - Live directory stats (total, verified, trust score distribution)
 *   - FHIR R4 Bundle export button (streams to download)
 *   - CSV download button (streams to download)
 *   - Snapshot history fetched from GET /api/directory/snapshots
 *   - Configurable filters (minTrustScore, limit)
 */

import { getApiBase } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  FileText,
  History,
  RefreshCw,
  Shield,
  Users,
} from 'lucide-react';
import { useCallback, useState } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface DirectoryEntry {
  npi: string;
  fullName: string;
  specialties: string[];
  credentialCount: number;
  activeCredentials: number;
  primaryIssuer: string | null;
  credentialHealth: 'VERIFIED' | 'EXPIRED' | 'REVOKED' | 'PENDING';
  lastVerifiedAt: string | null;
  trustScore: number;
}

interface DirectorySummary {
  totalProviders: number;
  verifiedProviders: number;
  exportedAt: string;
  entries: DirectoryEntry[];
}

interface DirectorySnapshot {
  id: string;
  hash: string;
  providerCount: number;
  verifiedCount: number;
  publishedAt: string;
  publishedBy: string;
}

type ExportFormat = 'fhir' | 'csv';
type LoadState = 'idle' | 'loading' | 'done' | 'error';

// ── Helpers ────────────────────────────────────────────────────────────────────

function healthBadge(health: DirectoryEntry['credentialHealth']) {
  const map = {
    VERIFIED: { color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', label: 'Verified' },
    EXPIRED:  { color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', label: 'Expired' },
    REVOKED:  { color: 'text-red-400 bg-red-500/10 border-red-500/20', label: 'Revoked' },
    PENDING:  { color: 'text-slate-400 bg-slate-500/10 border-slate-500/20', label: 'Pending' },
  }[health] ?? { color: 'text-slate-400 bg-slate-500/10 border-slate-500/20', label: health };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${map.color}`}>
      {map.label}
    </span>
  );
}

function shortHash(hash: string): string {
  return hash.length > 12 ? `${hash.slice(0, 8)}…${hash.slice(-4)}` : hash;
}

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Snapshot History Panel ────────────────────────────────────────────────────

function SnapshotHistoryPanel({ base }: { base: string }) {
  const [open, setOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<DirectorySnapshot[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSnapshots = useCallback(async () => {
    if (!open) {
      // Opening: fetch snapshots
      setOpen(true);
      if (snapshots !== null) return; // already loaded
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${base}/api/directory/snapshots`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as DirectorySnapshot[];
        setSnapshots(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load snapshots');
      } finally {
        setLoading(false);
      }
    } else {
      setOpen(false);
    }
  }, [open, snapshots, base]);

  const publishSnapshot = useCallback(async () => {
    try {
      const res = await fetch(`${base}/api/directory/publish`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as DirectorySnapshot;
      setSnapshots((prev) => prev ? [data, ...prev] : [data]);
    } catch {
      // silently fail — operator action
    }
  }, [base]);

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/40 overflow-hidden">
      <button
        type="button"
        onClick={loadSnapshots}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-zinc-800/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-zinc-500" />
          <span className="text-sm font-medium text-zinc-300">Snapshot History</span>
          {snapshots && (
            <span className="text-[10px] font-mono text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
              {snapshots.length}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-zinc-600" /> : <ChevronDown className="h-4 w-4 text-zinc-600" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-zinc-800"
          >
            <div className="p-4 space-y-3">
              {/* Publish new snapshot */}
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-zinc-500">
                  Point-in-time snapshots with integrity hashes for federation distribution.
                </p>
                <button
                  type="button"
                  onClick={publishSnapshot}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium hover:bg-indigo-500/20 transition-colors shrink-0 ml-3"
                >
                  <Shield className="h-3 w-3" />
                  Publish Now
                </button>
              </div>

              {loading && (
                <div className="space-y-2 animate-pulse">
                  {[...Array(3)].map((_, i) => <div key={i} className="h-10 rounded-lg bg-zinc-800/40" />)}
                </div>
              )}

              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20">
                  {error}
                </p>
              )}

              {snapshots && snapshots.length === 0 && (
                <p className="text-xs text-zinc-600 text-center py-2">
                  No snapshots published yet — click &quot;Publish Now&quot; to create one.
                </p>
              )}

              {snapshots && snapshots.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {snapshots.map((snap) => (
                    <div
                      key={snap.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-zinc-800/30 border border-zinc-700/30"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-zinc-400 truncate">{shortHash(snap.hash)}</span>
                          <span className="text-[9px] text-zinc-600">by {snap.publishedBy}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-[10px] text-zinc-500">
                          <span className="flex items-center gap-1">
                            <Users className="h-2.5 w-2.5" />
                            {snap.providerCount} providers
                          </span>
                          <span className="flex items-center gap-1">
                            <CheckCircle className="h-2.5 w-2.5 text-emerald-500" />
                            {snap.verifiedCount} verified
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 text-[9px] text-zinc-600 font-mono">
                        <Clock className="h-2.5 w-2.5" />
                        {relativeTime(snap.publishedAt)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ProviderDirectoryPanel() {
  const [summary, setSummary] = useState<DirectorySummary | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [exportState, setExportState] = useState<Record<ExportFormat, LoadState>>({ fhir: 'idle', csv: 'idle' });
  const [minTrustScore, setMinTrustScore] = useState(0);
  const [limit, setLimit] = useState(200);

  const base = getApiBase();

  const loadDirectory = useCallback(async () => {
    setLoadState('loading');
    try {
      const res = await fetch(`${base}/api/directory?limit=${limit}&minTrustScore=${minTrustScore}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as DirectorySummary;
      setSummary(data);
      setLoadState('done');
    } catch {
      setLoadState('error');
    }
  }, [base, limit, minTrustScore]);

  const handleExport = useCallback(async (format: ExportFormat) => {
    setExportState((s) => ({ ...s, [format]: 'loading' }));
    try {
      const url = `${base}/api/directory/${format}?limit=${limit}&minTrustScore=${minTrustScore}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();
      const ext = format === 'fhir' ? 'json' : 'csv';
      const filename = `vitalcv-directory-${Date.now()}.${ext}`;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);

      setExportState((s) => ({ ...s, [format]: 'done' }));
      setTimeout(() => setExportState((s) => ({ ...s, [format]: 'idle' })), 3000);
    } catch {
      setExportState((s) => ({ ...s, [format]: 'error' }));
      setTimeout(() => setExportState((s) => ({ ...s, [format]: 'idle' })), 3000);
    }
  }, [base, limit, minTrustScore]);

  const healthCounts = summary ? {
    verified: summary.entries.filter((e) => e.credentialHealth === 'VERIFIED').length,
    expired:  summary.entries.filter((e) => e.credentialHealth === 'EXPIRED').length,
    revoked:  summary.entries.filter((e) => e.credentialHealth === 'REVOKED').length,
    pending:  summary.entries.filter((e) => e.credentialHealth === 'PENDING').length,
  } : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
      className="rounded-2xl border border-infra-border bg-infra-surface overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-infra-border">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_6px_#818cf8]" />
          <span className="text-sm font-semibold text-infra-text">Provider Directory</span>
          <span className="text-xs text-infra-muted ml-1">Wave 161</span>
        </div>
        <div className="flex items-center gap-2">
          {summary && (
            <span className="text-xs text-infra-muted">
              {summary.totalProviders} providers · {new Date(summary.exportedAt).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={loadDirectory}
            disabled={loadState === 'loading'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium hover:bg-indigo-500/20 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${loadState === 'loading' ? 'animate-spin' : ''}`} />
            {loadState === 'loading' ? 'Loading…' : 'Load Directory'}
          </button>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs text-infra-muted">Min Trust Score</label>
            <input
              type="number"
              min={0}
              max={100}
              value={minTrustScore}
              onChange={(e) => setMinTrustScore(Number(e.target.value))}
              className="w-16 px-2 py-1 rounded-lg bg-infra-bg border border-infra-border text-xs text-infra-text text-center focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-infra-muted">Limit</label>
            <input
              type="number"
              min={1}
              max={1000}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-20 px-2 py-1 rounded-lg bg-infra-bg border border-infra-border text-xs text-infra-text text-center focus:outline-none focus:border-indigo-500/50"
            />
          </div>
        </div>

        {/* Health stats */}
        {summary && healthCounts && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total', value: summary.totalProviders, icon: Users, color: 'text-infra-text' },
              { label: 'Verified', value: healthCounts.verified, icon: CheckCircle, color: 'text-emerald-400' },
              { label: 'Expired', value: healthCounts.expired, icon: AlertTriangle, color: 'text-amber-400' },
              { label: 'Revoked', value: healthCounts.revoked, icon: AlertTriangle, color: 'text-red-400' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="flex items-center gap-3 p-3 rounded-xl bg-infra-bg border border-infra-border">
                <Icon className={`h-4 w-4 ${color} shrink-0`} />
                <div>
                  <div className={`text-lg font-bold ${color}`}>{value}</div>
                  <div className="text-xs text-infra-muted">{label}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Export buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => handleExport('fhir')}
            disabled={exportState.fhir === 'loading'}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium hover:bg-blue-500/20 transition-colors disabled:opacity-50"
          >
            <FileText className="h-4 w-4" />
            {exportState.fhir === 'loading' ? 'Exporting…' : exportState.fhir === 'done' ? '✓ FHIR R4 Downloaded' : 'Export FHIR R4 Bundle'}
          </button>
          <button
            onClick={() => handleExport('csv')}
            disabled={exportState.csv === 'loading'}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {exportState.csv === 'loading' ? 'Exporting…' : exportState.csv === 'done' ? '✓ CSV Downloaded' : 'Export CSV'}
          </button>
        </div>

        {/* Snapshot history (collapsible, fetches real data) */}
        <SnapshotHistoryPanel base={base} />

        {/* Preview table */}
        {summary && summary.entries.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-infra-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-infra-border bg-infra-bg">
                  {['NPI', 'Name', 'Specialties', 'Active Creds', 'Primary Issuer', 'Health', 'Trust Score'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-infra-muted font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.entries.slice(0, 20).map((e) => (
                  <tr key={e.npi} className="border-b border-infra-border/50 hover:bg-infra-bg/50 transition-colors">
                    <td className="px-3 py-2 text-infra-muted font-mono">{e.npi}</td>
                    <td className="px-3 py-2 text-infra-text font-medium">{e.fullName}</td>
                    <td className="px-3 py-2 text-infra-muted">{e.specialties.join(', ') || '—'}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={e.activeCredentials > 0 ? 'text-emerald-400 font-semibold' : 'text-infra-muted'}>
                        {e.activeCredentials}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-infra-muted truncate max-w-[140px]">{e.primaryIssuer ?? '—'}</td>
                    <td className="px-3 py-2">{healthBadge(e.credentialHealth)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 h-1.5 rounded-full bg-infra-border overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${e.trustScore}%`,
                              backgroundColor: e.trustScore >= 80 ? '#10b981' : e.trustScore >= 50 ? '#f59e0b' : '#ef4444',
                            }}
                          />
                        </div>
                        <span className="text-infra-muted">{e.trustScore}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {summary.entries.length > 20 && (
              <div className="px-3 py-2 text-xs text-infra-muted border-t border-infra-border">
                Showing 20 of {summary.entries.length} providers
              </div>
            )}
          </div>
        )}

        {loadState === 'error' && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            Failed to load directory — check API connection
          </div>
        )}

        {loadState === 'idle' && !summary && (
          <div className="text-xs text-infra-muted text-center py-4">
            Click &quot;Load Directory&quot; to fetch provider data
          </div>
        )}
      </div>
    </motion.div>
  );
}
