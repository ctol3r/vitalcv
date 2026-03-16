'use client';

/**
 * GraphTooltip.tsx — DOM tooltip overlay for the graph canvas
 *
 * Positioned absolutely over the canvas at the hovered node's screen
 * coordinates. Shows node type, label, trust tier, degree, and key facts.
 * Uses Framer Motion for fade/scale entry.
 */

import { motion, AnimatePresence } from 'framer-motion';
import type { GraphNode, GraphEdge } from './types';
import { getNodeColor, getEdgeColor, type NodeType, type EdgeType } from './types';

interface Props {
  node:     GraphNode | null;
  edges:    GraphEdge[];
  screenX:  number;
  screenY:  number;
  canvasW:  number;
  canvasH:  number;
}

const NODE_TYPE_LABELS: Partial<Record<NodeType, string>> = {
  clinician:    'Clinician',
  organization: 'Organization',
  institution:  'Institution',
  credential:   'Credential',
  license:      'License',
  decision:     'Decision Capsule',
  exclusion:    'Exclusion',
  enrollment:   'Enrollment',
  claim:        'Evidence Claim',
  artifact:     'Artifact',
  source:       'Data Source',
  specialty:    'Specialty',
  publication:  'Publication',
  trial:        'Clinical Trial',
  document:     'Document',
  note:         'Note',
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function TierBadge({ tier }: { tier?: string }) {
  if (!tier) return null;
  const styles: Record<string, string> = {
    GOLD:   'bg-amber-900/40 text-amber-400 border border-amber-700/30',
    SILVER: 'bg-slate-700/40 text-slate-300 border border-slate-600/30',
    BRONZE: 'bg-orange-900/40 text-orange-400 border border-orange-700/30',
  };
  return (
    <span className={`gf-badge ${styles[tier] ?? 'bg-slate-800 text-slate-400'}`}>
      {tier}
    </span>
  );
}

function BandBadge({ band }: { band?: string }) {
  if (!band) return null;
  const styles: Record<string, string> = {
    L3: 'text-emerald-400',
    L2: 'text-cyan-400',
    L1: 'text-amber-400',
    L0: 'text-red-400',
  };
  return (
    <span className={`font-mono text-[10px] font-bold ${styles[band] ?? 'text-slate-400'}`}>
      {band}
    </span>
  );
}

export default function GraphTooltip({ node, edges, screenX, screenY, canvasW, canvasH }: Props) {
  // Adjust position to keep tooltip on screen
  const TOOLTIP_W = 220;
  const preview = node ? asRecord(asRecord(node.metadata).signalPreview) : {};
  const previewTrust = asRecord(preview.trust);
  const previewInfluence = asRecord(preview.influence);
  const previewPressure = asRecord(preview.workforcePressure);
  const previewMomentum = asRecord(preview.institutionMomentum);
  const previewWarnings = Array.isArray(preview.earlyWarnings) ? preview.earlyWarnings : [];
  const hasPreview = Object.keys(preview).length > 0;
  const TOOLTIP_H = hasPreview ? 240 : 160;
  const OFFSET = 14;

  const x = screenX + OFFSET + TOOLTIP_W > canvasW
    ? screenX - TOOLTIP_W - OFFSET
    : screenX + OFFSET;
  const y = screenY + TOOLTIP_H > canvasH
    ? screenY - TOOLTIP_H
    : screenY;

  // Connected edges summary
  const connectedEdges = node
    ? edges.filter(e => e.visible && (e.source === node.id || e.target === node.id))
    : [];
  const edgeTypeCounts = new Map<string, number>();
  for (const e of connectedEdges) {
    edgeTypeCounts.set(e.type, (edgeTypeCounts.get(e.type) ?? 0) + 1);
  }
  const topEdgeTypes = [...edgeTypeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const nodeColor = node ? getNodeColor(node.type as NodeType) : '#475569';
  const typeLabel = node ? (NODE_TYPE_LABELS[node.type as NodeType] ?? node.type) : '';

  return (
    <AnimatePresence>
      {node && (
        <motion.div
          key={node.id}
          initial={{ opacity: 0, scale: 0.94, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94 }}
          transition={{ duration: 0.12, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            left: x,
            top: y,
            zIndex: 60,
            width: TOOLTIP_W,
            pointerEvents: 'none',
            fontFamily: "'Nunito Sans', Inter, system-ui, sans-serif",
          }}
          className="gf-panel select-none"
        >
          {/* Type + color indicator */}
          <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-white/5">
            <span
              style={{ background: nodeColor }}
              className="w-2.5 h-2.5 rounded-full shrink-0 shadow-[0_0_6px_2px_currentColor] opacity-80"
            />
            <span className="text-[9px] uppercase tracking-widest font-bold"
              style={{ color: nodeColor }}>
              {typeLabel}
            </span>
          </div>

          {/* Label */}
          <div className="px-3 py-2">
            <div className="text-[12px] font-semibold text-slate-100 leading-tight line-clamp-2">
              {node.label}
            </div>
            {node.title && node.title !== node.label && (
              <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{node.title}</div>
            )}
          </div>

          {/* Stats row */}
          <div className="px-3 pb-2 flex items-center gap-3">
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-bold text-slate-300 font-mono">{node.degree}</span>
              <span className="text-[8px] text-slate-600 uppercase tracking-wide">degree</span>
            </div>
            {node.inDegree !== undefined && (
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-cyan-400 font-mono">{node.inDegree}</span>
                <span className="text-[8px] text-slate-600 uppercase tracking-wide">in</span>
              </div>
            )}
            {node.outDegree !== undefined && (
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-violet-400 font-mono">{node.outDegree}</span>
                <span className="text-[8px] text-slate-600 uppercase tracking-wide">out</span>
              </div>
            )}
            <div className="ml-auto flex items-center gap-1.5">
              <TierBadge tier={node.trustTier} />
              <BandBadge band={node.trustBand} />
            </div>
          </div>

          {hasPreview && (
            <div className="px-3 pb-3 border-t border-white/5 pt-2 space-y-1.5">
              {previewTrust && (
                <div className="flex items-center justify-between gap-2 text-[9px] text-slate-400">
                  <span className="uppercase tracking-wide text-slate-500">trust</span>
                  <span className="text-slate-200">
                    {asNumber(previewTrust.score) ?? 'N/A'} · {asString(previewTrust.tier) ?? 'Insufficient signal'}
                  </span>
                </div>
              )}
              {previewInfluence && (
                <div className="flex items-center justify-between gap-2 text-[9px] text-slate-400">
                  <span className="uppercase tracking-wide text-slate-500">influence</span>
                  <span className="text-slate-200">
                    {asNumber(previewInfluence.score) ?? 'N/A'} · {asString(previewInfluence.tier) ?? 'Insufficient signal'}
                  </span>
                </div>
              )}
              {previewPressure && (
                <div className="flex items-center justify-between gap-2 text-[9px] text-slate-400">
                  <span className="uppercase tracking-wide text-slate-500">pressure</span>
                  <span className="text-slate-200">
                    {asString(previewPressure.state) ?? 'Insufficient signal'}
                  </span>
                </div>
              )}
              {previewMomentum && (
                <div className="flex items-center justify-between gap-2 text-[9px] text-slate-400">
                  <span className="uppercase tracking-wide text-slate-500">momentum</span>
                  <span className="text-slate-200">
                    {asString(previewMomentum.state) ?? 'Insufficient signal'}
                  </span>
                </div>
              )}
              {previewWarnings.length > 0 && (
                <div className="flex items-center justify-between gap-2 text-[9px] text-slate-400">
                  <span className="uppercase tracking-wide text-slate-500">warnings</span>
                  <span className="text-amber-300">{previewWarnings.length}</span>
                </div>
              )}
              {asString(preview.summary) && (
                <p className="pt-1 text-[9px] leading-relaxed text-slate-500 line-clamp-3">{asString(preview.summary)}</p>
              )}
            </div>
          )}

          {/* Top edge types */}
          {topEdgeTypes.length > 0 && (
            <div className="px-3 pb-3 border-t border-white/5 pt-2 space-y-1">
              {topEdgeTypes.map(([type, count]) => (
                <div key={type} className="flex items-center gap-2">
                  <span
                    style={{ background: getEdgeColor(type as EdgeType) }}
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                  />
                  <span className="text-[9px] text-slate-500 flex-1 truncate">{type.replace(/_/g, ' ')}</span>
                  <span className="text-[9px] font-mono text-slate-600">{count}</span>
                </div>
              ))}
            </div>
          )}

          {/* Tags */}
          {node.tags?.length > 0 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1 border-t border-white/5 pt-2">
              {node.tags.slice(0, 4).map(tag => (
                <span key={tag} className="text-[8px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded-sm">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
