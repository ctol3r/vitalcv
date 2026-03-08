'use client';

/**
 * NodeInspector.tsx — Wave 165: Trust Graph Explorer
 *
 * Right-panel node detail view showing:
 *   - Trust score + band
 *   - Issuer metadata
 *   - Credential relationships
 *   - Revocation history
 *
 * Props: accepts a TrustNode object selected from TrustGraphExplorer.
 */

import { motion, AnimatePresence } from 'framer-motion';
import {
  Award,
  Building,
  CheckCircle,
  Clock,
  FileKey2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  TrendingUp,
  User,
  X,
  XCircle,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

export type NodeKind = 'issuer' | 'clinician' | 'payer' | 'credential';

export interface TrustNode {
  id: string;
  kind: NodeKind;
  name: string;
  trustScore?: number;
  trustLevel?: string;
  status?: string;
  credentialCount?: number;
  activeCredentials?: number;
  revokedCredentials?: number;
  issuerId?: string;
  issuerName?: string;
  lastActivity?: string;
  haipCompliant?: boolean;
  metadata?: Record<string, string | number | boolean | null>;
}

interface NodeInspectorProps {
  node: TrustNode | null;
  onClose: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function trustScoreColor(score?: number): string {
  if (score === undefined) return 'text-zinc-500';
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-blue-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-red-400';
}

function trustScoreBg(score?: number): string {
  if (score === undefined) return 'bg-zinc-800';
  if (score >= 80) return 'bg-emerald-500/10 border-emerald-500/20';
  if (score >= 60) return 'bg-blue-500/10 border-blue-500/20';
  if (score >= 40) return 'bg-amber-500/10 border-amber-500/20';
  return 'bg-red-500/10 border-red-500/20';
}

function TrustScoreMeter({ score }: { score?: number }) {
  const pct = score ?? 0;
  const color = pct >= 80 ? '#10b981' : pct >= 60 ? '#60a5fa' : pct >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-zinc-500 uppercase tracking-wider font-mono">Trust Score</span>
        <span className={`font-bold font-mono ${trustScoreColor(score)}`}>{score ?? '—'}/100</span>
      </div>
      <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

function kindIcon(kind: NodeKind): React.ElementType {
  switch (kind) {
    case 'issuer':     return Building;
    case 'clinician':  return User;
    case 'payer':      return Shield;
    case 'credential': return FileKey2;
  }
}

function kindLabel(kind: NodeKind): string {
  switch (kind) {
    case 'issuer':     return 'Credential Issuer';
    case 'clinician':  return 'Clinician';
    case 'payer':      return 'Payer / Network';
    case 'credential': return 'Credential';
  }
}

function statusBadge(status?: string) {
  if (!status) return null;
  const s = status.toUpperCase();
  const map: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
    ACTIVE:   { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    HEALTHY:  { icon: ShieldCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    DEGRADED: { icon: ShieldAlert, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
    REVOKED:  { icon: ShieldX, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
    CRITICAL: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  };
  const cfg = map[s] ?? { icon: Shield, color: 'text-zinc-400', bg: 'bg-zinc-500/10 border-zinc-500/20' };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-medium ${cfg.color} ${cfg.bg}`}>
      <Icon className="h-2.5 w-2.5" /> {s}
    </span>
  );
}

function relativeTime(ts?: string): string {
  if (!ts) return 'never';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return new Date(ts).toLocaleDateString();
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function NodeInspector({ node, onClose }: NodeInspectorProps) {
  const Icon = node ? kindIcon(node.kind) : Shield;

  return (
    <AnimatePresence>
      {node && (
        <motion.div
          key={node.id}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
          className="w-80 shrink-0 rounded-2xl border border-zinc-800 bg-zinc-900/60 flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-start justify-between p-4 border-b border-zinc-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="shrink-0 w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                <Icon className="h-4 w-4 text-zinc-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-zinc-200 truncate">{node.name}</p>
                <p className="text-[10px] text-zinc-600">{kindLabel(node.kind)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 p-1 text-zinc-600 hover:text-zinc-300 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* Status + Trust Level */}
            <div className="flex items-center gap-2 flex-wrap">
              {statusBadge(node.status)}
              {node.trustLevel && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-medium text-blue-400 bg-blue-500/10 border-blue-500/20">
                  <Award className="h-2.5 w-2.5" /> {node.trustLevel}
                </span>
              )}
              {node.haipCompliant && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-medium text-violet-400 bg-violet-500/10 border-violet-500/20">
                  <ShieldCheck className="h-2.5 w-2.5" /> HAIP
                </span>
              )}
            </div>

            {/* Trust Score Meter */}
            {node.trustScore !== undefined && (
              <div className={`rounded-xl border p-3 ${trustScoreBg(node.trustScore)}`}>
                <TrustScoreMeter score={node.trustScore} />
              </div>
            )}

            {/* Credential Relationships */}
            {(node.credentialCount !== undefined || node.activeCredentials !== undefined) && (
              <div className="space-y-2">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Credential Relationships</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Total',   value: node.credentialCount,   color: 'text-zinc-300' },
                    { label: 'Active',  value: node.activeCredentials, color: 'text-emerald-400' },
                    { label: 'Revoked', value: node.revokedCredentials, color: 'text-red-400' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-lg bg-zinc-800/60 p-2.5 text-center">
                      <p className={`text-lg font-bold font-mono ${color}`}>{value ?? '—'}</p>
                      <p className="text-[9px] text-zinc-600 uppercase tracking-wider">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Issuer Metadata */}
            {node.issuerName && (
              <div className="space-y-2">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Issuer Metadata</p>
                <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 divide-y divide-zinc-700/30">
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-[11px] text-zinc-500">Issuer</span>
                    <span className="text-[11px] text-zinc-300 font-medium truncate max-w-[140px]">{node.issuerName}</span>
                  </div>
                  {node.issuerId && (
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-[11px] text-zinc-500">ID</span>
                      <span className="text-[10px] font-mono text-zinc-500 truncate max-w-[140px]">{node.issuerId.slice(0, 16)}…</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Extra metadata */}
            {node.metadata && Object.keys(node.metadata).length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Properties</p>
                <div className="rounded-xl bg-zinc-800/40 border border-zinc-700/30 divide-y divide-zinc-700/30">
                  {Object.entries(node.metadata).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between px-3 py-2">
                      <span className="text-[11px] text-zinc-500 capitalize">{k.replace(/_/g, ' ')}</span>
                      <span className="text-[11px] text-zinc-300 truncate max-w-[140px]">{String(v ?? '—')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Last Activity */}
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
              <Clock className="h-3 w-3" />
              <span>Last activity: {relativeTime(node.lastActivity)}</span>
            </div>

            {/* Revocation note */}
            {(node.revokedCredentials ?? 0) > 0 && (
              <div className="flex items-start gap-2 rounded-lg bg-red-500/5 border border-red-500/20 px-3 py-2">
                <ShieldX className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-red-400">
                  {node.revokedCredentials} credential{node.revokedCredentials !== 1 ? 's' : ''} revoked — verify with issuer before accepting.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-zinc-800">
            <a
              href={node.kind === 'clinician' ? `/p/${node.id}` : undefined}
              className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                node.kind === 'clinician'
                  ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20'
                  : 'bg-zinc-800/50 border border-zinc-700/30 text-zinc-500 cursor-default'
              }`}
            >
              <TrendingUp className="h-3 w-3" />
              {node.kind === 'clinician' ? 'View Passport' : 'Node Details'}
            </a>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
