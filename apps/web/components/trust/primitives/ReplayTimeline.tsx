import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Chain-linked replay strip · head ← prev hashes · RFC 3161 anchored.
 *
 * Source: Trust Primitives.html §02 · Replay Chronology Topology.html.
 * Arrow direction is fixed: head is leftmost; reading is right-to-left
 * in time but left-to-right in causality. A gap renders as a dashed
 * empty token — never elided. Never animate. Never recolor to indicate
 * freshness.
 */

export interface ReplayNode {
  /** Truncated hash, e.g. "7a2c…b8d3". */
  hash: string;
  /** Optional caption (e.g. "head", "#11 σ defer"). */
  caption?: string;
  /** Renders as a dashed empty gap token. */
  gap?: boolean;
}

export interface ReplayTimelineProps {
  /** Nodes in head-first order: [head, prev, prev-1, ...]. */
  nodes: readonly ReplayNode[];
  /** light = holder memory; inverted = signed plane. */
  tone?: 'light' | 'inverted';
  /** When true, surfaces the "pending re-anchor" sub-caption. */
  pending?: boolean;
  className?: string;
}

const TONE_FRAME: Record<'light' | 'inverted', string> = {
  light: 'bg-white text-slate-900 border-slate-300',
  inverted: 'bg-slate-950 text-slate-100 border-slate-700',
};

export function ReplayTimeline({
  nodes,
  tone = 'light',
  pending = false,
  className,
}: ReplayTimelineProps) {
  if (nodes.length === 0) {
    return null;
  }
  return (
    <section
      data-slot="replay-timeline"
      data-tone={tone}
      data-pending={pending ? 'true' : undefined}
      className={cn(
        'rounded-2xl border p-4 font-mono text-xs',
        TONE_FRAME[tone],
        className,
      )}
    >
      <div className="mb-2 flex items-center justify-between uppercase tracking-wider opacity-70">
        <span>Replay lineage · chain-linked</span>
        <span>
          {pending ? 'pending re-anchor' : `${nodes.length} receipts`}
        </span>
      </div>
      <ol className="flex flex-wrap items-center gap-2">
        {nodes.map((node, index) => (
          <React.Fragment key={`${node.hash}:${index}`}>
            <li
              data-head={index === 0 ? 'true' : undefined}
              data-gap={node.gap ? 'true' : undefined}
              className={cn(
                'inline-flex flex-col items-start border px-2 py-1',
                node.gap
                  ? 'border-dashed border-slate-400 opacity-70'
                  : index === 0
                    ? tone === 'inverted'
                      ? 'border-slate-100 bg-slate-100 text-slate-950'
                      : 'border-slate-900 bg-slate-900 text-slate-50'
                    : 'border-current',
              )}
            >
              <span>{node.gap ? '— gap —' : node.hash}</span>
              {node.caption ? (
                <span className="text-[10px] opacity-70">{node.caption}</span>
              ) : null}
            </li>
            {index < nodes.length - 1 ? (
              <span aria-hidden="true" className="opacity-60">
                ←
              </span>
            ) : null}
          </React.Fragment>
        ))}
      </ol>
    </section>
  );
}
