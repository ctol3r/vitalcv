'use client';

/**
 * DegradedContinuityView.tsx
 *
 * Shows only the degraded portions of the credential timeline.
 * Empty state = success signal (green).
 * Non-empty: each degraded node with ownership attribution.
 */

import { cn } from '@/lib/utils';
import type { ChronologyNode } from './ChronologyRail';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DegradedContinuityViewProps {
  nodes: ChronologyNode[];
  /** If true, shows only nodes where status is degraded/stale/unavailable */
  filterDegraded?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DEGRADED_STATUSES = new Set(['stale', 'unavailable', 'adverse', 'access_required', 'review_required']);

function isDegraded(status: string): boolean {
  return DEGRADED_STATUSES.has(status);
}

function ownershipFor(node: ChronologyNode): { label: string; cls: string } {
  // Infer ownership from status
  if (node.status === 'stale') {
    return { label: 'INFRASTRUCTURE', cls: 'text-gray-500' }; // VitalCV refresh cycle
  }
  if (node.status === 'unavailable') {
    return { label: 'ISSUER', cls: 'text-amber-600' }; // External source
  }
  if (node.status === 'adverse') {
    return { label: 'SYSTEM', cls: 'text-red-600' }; // Adverse finding
  }
  return { label: 'SYSTEM', cls: 'text-gray-500' };
}

function ownershipDetail(node: ChronologyNode): string {
  if (node.status === 'stale') return 'VitalCV refresh cycle';
  if (node.status === 'unavailable') return 'External source';
  if (node.status === 'adverse') return 'Adverse finding in source data';
  return '';
}

function statusLabel(s: string): string {
  return s.toUpperCase().replace(/_/g, ' ');
}

function statusCls(s: string): string {
  switch (s) {
    case 'stale':       return 'text-amber-600';
    case 'unavailable': return 'text-gray-400';
    case 'adverse':     return 'text-red-600';
    default:            return 'text-gray-500';
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DegradedContinuityView({
  nodes,
  filterDegraded = true,
}: DegradedContinuityViewProps) {
  const degraded = filterDegraded ? nodes.filter((n) => isDegraded(n.status)) : nodes;

  return (
    <div>
      {/* Header */}
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400 mb-1">
        Degraded Continuity
      </div>

      <div className="border-t border-gray-200 mb-0" />

      {degraded.length === 0 ? (
        <div className="py-2">
          <span className="text-xs text-green-700">✓ No degraded transitions. All checks current.</span>
        </div>
      ) : (
        <div>
          {degraded.map((node, idx) => {
            const ownership = ownershipFor(node);
            const ownerDetail = ownershipDetail(node);
            return (
              <div
                key={node.nodeId}
                className={cn(
                  'py-2 min-h-[32px]',
                  idx < degraded.length - 1 && 'border-b border-gray-100'
                )}
              >
                {/* Primary line */}
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="font-mono text-[10px] text-gray-400">{node.ts.slice(0, 10)}</span>
                  <span className={cn('text-[10px] font-semibold uppercase tracking-wide', statusCls(node.status))}>
                    {statusLabel(node.status)}
                  </span>
                  <span className="text-xs text-gray-700">→ {node.label.toLowerCase()}</span>
                </div>

                {/* Detail */}
                {node.detail && (
                  <div className="mt-0.5 text-[10px] font-mono text-gray-400">"{node.detail}"</div>
                )}

                {/* Ownership */}
                <div className="mt-0.5 flex gap-x-2 items-baseline">
                  <span className={cn('text-[9px] font-mono uppercase font-semibold', ownership.cls)}>
                    OWNER: {ownership.label}
                  </span>
                  {ownerDetail && (
                    <span className="text-[9px] font-mono text-gray-300">({ownerDetail})</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="border-t border-gray-200 mt-0" />
    </div>
  );
}
