'use client';

/**
 * ChronologyRail.tsx
 *
 * Chain-linked vertical rail of credential check events.
 * Time flows top-to-bottom (most recent at top).
 * Hospital audit timeline energy: no rounded containers, no shadows, no animations.
 *
 * compact={true}: single-line per node — [ts] [label] [tier] [status]
 */

import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChronologyNode {
  nodeId: string;
  ts: string;            // ISO "YYYY-MM-DD HH:mm:ss UTC"
  label: string;         // e.g. "NPPES Identity" or "OIG Exclusions"
  status: string;        // "verified" | "stale" | "unavailable" | "adverse" | "not_checked"
  tier: 'T1' | 'T2' | 'T3' | 'T4';
  detail: string | null; // one-line operational prose
  receiptId: string | null;
  priorNodeId: string | null;
  signerKid: string | null;
}

export interface ChronologyRailProps {
  nodes: ChronologyNode[];
  /** If true, show connecting rail line. Default: true */
  showRail?: boolean;
  title?: string;
  /** Compact single-line mode. Default: false */
  compact?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusLabel(s: string): string {
  return s.toUpperCase().replace(/_/g, ' ');
}

function statusTextCls(s: string): string {
  switch (s) {
    case 'verified':     return 'text-green-700';
    case 'stale':        return 'text-amber-600';
    case 'unavailable':  return 'text-gray-400';
    case 'adverse':      return 'text-red-600';
    default:             return 'text-gray-400';
  }
}

function nodeDotCls(s: string, isFirst: boolean): string {
  const base = 'w-[8px] h-[8px] rounded-full border flex-shrink-0 mt-[4px]';
  if (isFirst) {
    switch (s) {
      case 'verified':    return cn(base, 'bg-green-500 border-green-500');
      case 'stale':       return cn(base, 'bg-amber-400 border-amber-400');
      case 'unavailable': return cn(base, 'bg-gray-200 border-gray-300');
      case 'adverse':     return cn(base, 'bg-red-500 border-red-500');
      default:            return cn(base, 'bg-gray-200 border-gray-300');
    }
  }
  // historical node: empty dot, border only
  switch (s) {
    case 'verified':    return cn(base, 'bg-white border-green-400');
    case 'stale':       return cn(base, 'bg-white border-amber-400');
    case 'unavailable': return cn(base, 'bg-white border-gray-300');
    case 'adverse':     return cn(base, 'bg-white border-red-400');
    default:            return cn(base, 'bg-white border-gray-300');
  }
}

function daysBetween(a: string, b: string): number {
  try {
    return Math.abs(
      Math.floor((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000)
    );
  } catch {
    return 0;
  }
}

// ─── Compact Node ─────────────────────────────────────────────────────────────

function CompactNode({
  node,
  isFirst,
}: {
  node: ChronologyNode;
  isFirst: boolean;
}) {
  return (
    <div className="flex items-center gap-3 max-h-[32px] overflow-hidden">
      {/* Dot */}
      <div className={nodeDotCls(node.status, isFirst)} />
      {/* Timestamp */}
      <span className="font-mono text-xs text-gray-500 tabular-nums w-[140px] shrink-0 truncate">
        {node.ts}
      </span>
      {/* Label — prose */}
      <span className="text-xs text-gray-700 truncate min-w-0 flex-1">
        {node.label}
      </span>
      {/* Tier badge */}
      <span className="font-mono text-[10px] border border-gray-200 px-1.5 py-0.5 text-gray-500 shrink-0">
        {node.tier}
      </span>
      {/* Status */}
      <span className={cn('font-mono text-[10px] uppercase text-gray-500 shrink-0', statusTextCls(node.status))}>
        {statusLabel(node.status)}
      </span>
    </div>
  );
}

// ─── Full Node ────────────────────────────────────────────────────────────────

function FullNode({
  node,
  isFirst,
  showRail,
  hasNext,
  gapDays,
}: {
  node: ChronologyNode;
  isFirst: boolean;
  showRail: boolean;
  hasNext: boolean;
  gapDays: number;
}) {
  const hasGap = gapDays > 7;
  const signerDisplay = node.signerKid
    ? node.signerKid.slice(0, 20) + (node.signerKid.length > 20 ? '…' : '')
    : null;

  return (
    <div>
      {/* Node row */}
      <div className="flex items-start gap-3 min-h-[32px]">
        {/* Dot column */}
        <div className="flex flex-col items-center" style={{ minWidth: 8 }}>
          <div className={nodeDotCls(node.status, isFirst)} />
        </div>

        {/* Content column */}
        <div className="flex-1 pb-2">
          {/* Primary line */}
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            {/* Timestamp — mono, tabular */}
            <span className="font-mono text-xs text-gray-500 tabular-nums w-[140px] shrink-0">
              {node.ts}
            </span>
            {/* Label — prose, not mono */}
            <span className="text-xs text-gray-700">
              {node.label}
            </span>
            {/* Tier badge */}
            <span className="text-[10px] font-mono border border-gray-200 px-1.5 py-0.5 text-gray-500">
              {node.tier}
            </span>
            {/* Status — mono uppercase */}
            <span className={cn('font-mono text-[10px] uppercase text-gray-500', statusTextCls(node.status))}>
              {statusLabel(node.status)}
            </span>
          </div>

          {/* Receipt / signer — machine truth */}
          {(node.receiptId || signerDisplay) && (
            <div className="mt-0.5 font-mono text-[10px] text-gray-400 flex flex-wrap gap-x-2">
              {node.receiptId && (
                <span>Receipt: {node.receiptId.slice(0, 14)}{node.receiptId.length > 14 ? '…' : ''}</span>
              )}
              {signerDisplay && (
                <span>Key: {signerDisplay}</span>
              )}
            </div>
          )}

          {/* Detail — prose context */}
          {node.detail && (
            <div className="mt-0.5 text-xs text-gray-500 pl-4">{node.detail}</div>
          )}

          {/* Genesis marker */}
          {!node.priorNodeId && !isFirst && (
            <div className="mt-0.5 text-[9px] font-mono text-gray-300 uppercase">(genesis)</div>
          )}
        </div>
      </div>

      {/* Connecting rail segment */}
      {showRail && (hasNext || hasGap) && (
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center" style={{ minWidth: 8 }}>
            {hasGap ? (
              <div className="border-l border-dashed border-gray-300" style={{ height: 24, marginLeft: 3.5 }} />
            ) : (
              <div className="border-l border-gray-200" style={{ height: 12, marginLeft: 3.5 }} />
            )}
          </div>
          {hasGap && (
            <div className="text-[9px] font-mono text-gray-300 pb-1 leading-none mt-1">
              [gap: {gapDays} day{gapDays !== 1 ? 's' : ''}]
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ChronologyRail({
  nodes,
  showRail = true,
  title = 'REPLAY CHRONOLOGY',
  compact = false,
}: ChronologyRailProps) {
  if (nodes.length === 0) {
    return (
      <div className="border-b border-gray-100 pb-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400 mb-2">
          {title}
        </div>
        <div className="text-xs font-mono text-gray-400">No nodes.</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400 mb-3">
        {title}
      </div>

      {/* Rail */}
      <div className="relative">
        {compact ? (
          // Compact mode: single line per node
          <div className="space-y-0">
            {nodes.map((node, idx) => (
              <CompactNode key={node.nodeId} node={node} isFirst={idx === 0} />
            ))}
          </div>
        ) : (
          // Full mode
          nodes.map((node, idx) => {
            const isFirst = idx === 0;
            const nextNode = nodes[idx + 1] ?? null;
            const gapDays = nextNode ? daysBetween(node.ts, nextNode.ts) : 0;

            return (
              <FullNode
                key={node.nodeId}
                node={node}
                isFirst={isFirst}
                showRail={showRail}
                hasNext={!!nextNode}
                gapDays={gapDays}
              />
            );
          })
        )}

        {/* Genesis tail — full mode only */}
        {!compact && nodes.length > 0 && !nodes[nodes.length - 1].priorNodeId && (
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center" style={{ minWidth: 8 }}>
              <div className="w-[8px] h-[8px] rounded-full bg-white border border-gray-300 flex-shrink-0" />
            </div>
            <div className="text-[9px] font-mono text-gray-300 mt-[4px]">(genesis)</div>
          </div>
        )}
      </div>
    </div>
  );
}
