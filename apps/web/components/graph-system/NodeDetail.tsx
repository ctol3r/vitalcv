'use client';

/**
 * NodeDetail.tsx — Right-side node inspector panel
 *
 * Shows when a node is selected:
 *   - Node title, type, metadata
 *   - Connected nodes with edge breakdown
 *   - AI suggested links with accept/reject
 *   - Link to underlying record
 */

import type { GraphNode, GraphEdge } from './types';

interface Props {
  node: GraphNode;
  edges: GraphEdge[];
  neighbors: { id: string; label: string; type: string; degree: number }[];
  aiSuggestions: { id: string; targetNodeId: string; targetLabel: string; confidence: number; explanation: string; edgeType: string }[];
  onClose: () => void;
  onFocusNode: (id: string) => void;
  onAcceptSuggestion: (id: string) => void;
  onRejectSuggestion: (id: string) => void;
}

const TYPE_ICONS: Record<string, string> = {
  clinician: '👤', organization: '🏢', institution: '🏛', specialty: '🎯',
  program: '📋', publication: '📄', trial: '🧪', claim: '✓', artifact: '📦',
  receipt: '🧾', source: '🔗', credential: '🏅', license: '📜', decision: '⚖️',
  exclusion: '🚫', enrollment: '📇', note: '📝', document: '📄', tag: '🏷',
  attachment: '📎', group: '📁',
};

export default function NodeDetail({
  node, edges, neighbors, aiSuggestions,
  onClose, onFocusNode, onAcceptSuggestion, onRejectSuggestion,
}: Props) {
  const edgesByType: Record<string, number> = {};
  for (const e of edges) {
    edgesByType[e.type] = (edgesByType[e.type] ?? 0) + 1;
  }

  return (
    <div className="fixed right-4 top-20 z-50 w-80 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-xl bg-slate-900/95 border border-slate-700/50 backdrop-blur-sm shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg">{TYPE_ICONS[node.type] ?? '●'}</span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white truncate">{node.label}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">{node.type}</div>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-white text-sm shrink-0">✕</button>
      </div>

      {/* Badges */}
      <div className="px-4 py-2 border-b border-slate-800 flex flex-wrap gap-1">
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
          {node.degree} connections
        </span>
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
          {node.inDegree}↓ {node.outDegree}↑
        </span>
        {node.trustTier && (
          <span className={`text-[9px] px-1.5 py-0.5 rounded ${
            node.trustTier === 'GOLD' ? 'bg-amber-900/40 text-amber-400'
              : node.trustTier === 'SILVER' ? 'bg-slate-600/40 text-slate-300'
              : 'bg-orange-900/40 text-orange-400'
          }`}>
            {node.trustTier}
          </span>
        )}
        {node.trustBand && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-400">
            {node.trustBand}
          </span>
        )}
        <span className={`text-[9px] px-1.5 py-0.5 rounded ${
          node.layer === 'trust' ? 'bg-blue-900/40 text-blue-400'
            : node.layer === 'knowledge' ? 'bg-violet-900/40 text-violet-400'
            : 'bg-slate-800 text-slate-400'
        }`}>
          {node.layer}
        </span>
      </div>

      {/* Metadata */}
      {Object.keys(node.metadata).length > 0 && (
        <div className="px-4 py-2 border-b border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Metadata</div>
          <div className="space-y-0.5">
            {Object.entries(node.metadata).slice(0, 8).map(([k, v]) => (
              <div key={k} className="flex justify-between text-[10px]">
                <span className="text-slate-500">{k}</span>
                <span className="text-slate-300 font-mono truncate ml-2 max-w-[60%] text-right">
                  {typeof v === 'object' ? JSON.stringify(v).slice(0, 30) : String(v).slice(0, 30)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {node.tags.length > 0 && (
        <div className="px-4 py-2 border-b border-slate-800">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Tags</div>
          <div className="flex flex-wrap gap-1">
            {node.tags.map(tag => (
              <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-violet-900/30 text-violet-400">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Edge breakdown */}
      <div className="px-4 py-2 border-b border-slate-800">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Edges by Type</div>
        <div className="space-y-0.5">
          {Object.entries(edgesByType).sort(([,a], [,b]) => b - a).map(([type, count]) => (
            <div key={type} className="flex justify-between text-[10px]">
              <span className="text-slate-400">{type.replace(/_/g, ' ')}</span>
              <span className="text-slate-300 font-mono">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Connected nodes */}
      <div className="px-4 py-2 border-b border-slate-800">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
          Connected ({neighbors.length})
        </div>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {neighbors.slice(0, 20).map(n => (
            <button
              key={n.id}
              onClick={() => onFocusNode(n.id)}
              className="w-full flex items-center gap-1.5 text-left hover:bg-slate-800/50 rounded px-1 py-0.5 transition-colors"
            >
              <span className="text-[10px]">{TYPE_ICONS[n.type] ?? '●'}</span>
              <span className="text-[10px] text-slate-300 truncate flex-1">{n.label}</span>
              <span className="text-[9px] text-slate-600 font-mono">{n.degree}</span>
            </button>
          ))}
        </div>
      </div>

      {/* AI Suggestions */}
      {aiSuggestions.length > 0 && (
        <div className="px-4 py-2">
          <div className="text-[10px] text-amber-400 uppercase tracking-wider mb-1">
            AI Suggested Links ({aiSuggestions.length})
          </div>
          <div className="space-y-2">
            {aiSuggestions.map(s => (
              <div key={s.id} className="rounded-lg bg-slate-800/50 border border-amber-900/30 p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-slate-300 truncate">{s.targetLabel}</span>
                  <span className="text-[9px] text-amber-400 font-mono">{Math.round(s.confidence * 100)}%</span>
                </div>
                <div className="text-[9px] text-slate-500 mb-1.5">{s.explanation}</div>
                <div className="flex gap-1">
                  <button
                    onClick={() => onAcceptSuggestion(s.id)}
                    className="flex-1 text-[9px] py-0.5 rounded bg-emerald-900/30 text-emerald-400 border border-emerald-800/50 hover:bg-emerald-800/40"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => onRejectSuggestion(s.id)}
                    className="flex-1 text-[9px] py-0.5 rounded bg-red-900/30 text-red-400 border border-red-800/50 hover:bg-red-800/40"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
