'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Award, Building2, FileCheck, Scale, Shield, ShieldCheck, ShieldAlert, Stethoscope, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getApiBase } from '@/lib/api';
import type { GraphNode, NodeType } from './TrustGraphPrimary';
import { DEMO_EDGES, DEMO_NODES } from './TrustGraphPrimary';

// ── Issuer Trust Badge (Wave 95) ──────────────────────────────────────

type TrustLevel = 'AUTHORITATIVE' | 'TRUSTED' | 'PROVISIONAL' | 'UNTRUSTED';

const TRUST_LEVEL_STYLES: Record<TrustLevel, { label: string; className: string }> = {
  AUTHORITATIVE: { label: 'Authoritative', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  TRUSTED: { label: 'Trusted', className: 'bg-blue-100 text-blue-700 border border-blue-200' },
  PROVISIONAL: { label: 'Provisional', className: 'bg-amber-100 text-amber-700 border border-amber-200' },
  UNTRUSTED: { label: 'Untrusted', className: 'bg-red-100 text-red-700 border border-red-200' },
};

interface IssuerTrustInfo {
  issuerId: string;
  issuerName: string;
  trustLevel: TrustLevel;
  status: string;
  registeredAt: string;
}

function IssuerTrustBadge({ issuerId }: { issuerId: string }) {
  const [info, setInfo] = useState<IssuerTrustInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const base = getApiBase();
    fetch(`${base}/api/registry/${encodeURIComponent(issuerId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setInfo(d?.issuer ?? null))
      .catch(() => setInfo(null))
      .finally(() => setLoading(false));
  }, [issuerId]);

  if (loading) return <div className="h-4 w-24 bg-muted animate-pulse rounded" />;
  if (!info) return null;

  const style = TRUST_LEVEL_STYLES[info.trustLevel] ?? TRUST_LEVEL_STYLES.PROVISIONAL;
  const TrustIcon = info.trustLevel === 'AUTHORITATIVE' || info.trustLevel === 'TRUSTED' ? ShieldCheck : ShieldAlert;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <Shield className="h-3 w-3" />
        Issuer Trust
      </h3>
      <div className="rounded-xl border border-infra-border bg-infra-surface p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Trust Level</span>
          <span className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${style.className}`}>
            <TrustIcon className="h-3 w-3" />
            {style.label}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Registry Status</span>
          <span className={`text-xs font-bold ${info.status === 'ACTIVE' ? 'text-emerald-600' : 'text-red-600'}`}>
            {info.status}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Registered</span>
          <span className="text-xs font-mono text-foreground">
            {new Date(info.registeredAt).toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );
}

const TYPE_ICONS: Record<NodeType, typeof Shield> = {
  clinician: Stethoscope,
  issuer: Building2,
  credential: FileCheck,
  decision: Scale,
  employer: Award,
};

const TYPE_COLORS: Record<NodeType, string> = {
  clinician: 'text-amber-600 bg-amber-50',
  issuer: 'text-blue-600 bg-blue-50',
  credential: 'text-emerald-600 bg-emerald-50',
  decision: 'text-violet-600 bg-violet-50',
  employer: 'text-red-600 bg-red-50',
};

interface KnowledgePanelProps {
  node: GraphNode | null;
  onClose: () => void;
  nodes?: GraphNode[];
  edges?: typeof DEMO_EDGES;
}

export function KnowledgePanel({
  node,
  onClose,
  nodes = DEMO_NODES,
  edges = DEMO_EDGES,
}: KnowledgePanelProps) {
  if (!node) return null;

  // Find related nodes via edges
  const connectedEdges = edges.filter(
    (e) => e.source === node.id || e.target === node.id,
  );
  const connectedNodeIds = new Set(
    connectedEdges.flatMap((e) => [e.source, e.target]).filter((id) => id !== node.id),
  );
  const connectedNodes = nodes.filter((n) => connectedNodeIds.has(n.id));

  // Group connected by type
  const grouped: Partial<Record<NodeType, GraphNode[]>> = {};
  for (const cn of connectedNodes) {
    (grouped[cn.type] ??= []).push(cn);
  }

  const Icon = TYPE_ICONS[node.type];
  const colorClass = TYPE_COLORS[node.type];

  return (
    <AnimatePresence>
      {node && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/5"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.aside
            key="panel"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-white/70 backdrop-blur-xl border-l border-border shadow-[0_8px_32px_rgba(0,0,0,0.1)] overflow-y-auto dark:bg-black/40 dark:border-border dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
          >
            {/* Header */}
            <div className="sticky top-0 bg-muted backdrop-blur-md border-b border-infra-border/50 px-6 py-4 flex items-start justify-between dark:bg-black/40">
              <div className="flex items-center gap-3">
                <div className={`rounded-xl p-2.5 ${colorClass}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {node.type}
                  </p>
                  <h2 className="text-lg font-bold text-foreground">{node.label}</h2>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 hover:bg-secondary transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-6">
              {/* Status */}
              {node.status && (
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-infra-green animate-pulse" />
                  <span className="text-sm font-medium text-foreground">{node.status}</span>
                </div>
              )}

              {/* Issuer Trust (Wave 95) */}
              {node.type === 'issuer' && node.meta?.issuerId && (
                <IssuerTrustBadge issuerId={node.meta.issuerId as string} />
              )}

              {/* Metadata */}
              {node.meta && Object.keys(node.meta).length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Properties
                  </h3>
                  <div className="rounded-xl border border-infra-border bg-infra-surface p-3 space-y-2">
                    {Object.entries(node.meta).map(([key, value]) => (
                      <div key={key} className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground font-mono">{key}</span>
                        <span className="text-sm font-semibold font-mono">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Connected nodes by type */}
              {Object.entries(grouped).map(([type, groupNodes]) => {
                const GroupIcon = TYPE_ICONS[type as NodeType];
                const groupColor = TYPE_COLORS[type as NodeType];
                return (
                  <div key={type} className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <GroupIcon className="h-3 w-3" />
                      Related {type}s
                    </h3>
                    <div className="space-y-1.5">
                      {groupNodes!.map((cn) => {
                        const edge = connectedEdges.find(
                          (e) => e.source === cn.id || e.target === cn.id,
                        );
                        return (
                          <div
                            key={cn.id}
                            className="flex items-center justify-between rounded-xl border border-border bg-card backdrop-blur-sm px-3 py-2.5 shadow-sm dark:bg-black/30 dark:border-border transition-colors hover:bg-white/70 dark:hover:bg-black/50"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className={`rounded-lg p-1.5 ${groupColor}`}>
                                <GroupIcon className="h-3.5 w-3.5" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">{cn.label}</p>
                                {edge && (
                                  <p className="text-[10px] text-muted-foreground">{edge.label}</p>
                                )}
                              </div>
                            </div>
                            {cn.meta?.status && (
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-infra-green-muted text-infra-green">
                                {cn.meta.status}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Edge relationships */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Connections ({connectedEdges.length})
                </h3>
                <div className="space-y-1">
                  {connectedEdges.map((edge, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-xs text-muted-foreground font-mono"
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          edge.type === 'verification'
                            ? 'bg-infra-blue'
                            : edge.type === 'revocation'
                              ? 'bg-infra-red'
                              : 'bg-infra-green'
                        }`}
                      />
                      <span>
                        {edge.source} → {edge.target}
                      </span>
                      <span className="text-muted-foreground/50">({edge.label})</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
