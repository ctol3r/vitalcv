'use client';

/**
 * TrustGraphXRay — Clinician evidence provenance explorer.
 *
 * Renders a lightweight DOM-based tree of the clinician's Context Core
 * from TrustGraph. Designed as an isolated, exportable component — not
 * wired into any page yet. Conditionally render when needed.
 *
 * Visual doctrine:
 *   - Warm off-white nodes: #E4E3E0
 *   - Near-black ink: #141414
 *   - No gradients, no shadows, no physics animations
 *   - Light-first, sb-card / sb-data-row utility classes on wrapper
 *
 * Props:
 *   npi        — 10-digit NPI; used to derive the entity URI
 *   collection — TrustGraph collection to query (default: "default")
 *   className  — additional CSS classes on the outer wrapper
 */

import React, { useCallback, useState } from 'react';
import { useGraphSubgraph } from '@trustgraph/react-state';

// Inline the Subgraph shape — avoids reaching into dist internals
interface SubgraphNode {
  id: string;
  label: string;
  group: number;
}
interface SubgraphLink {
  id: string;
  source: string;
  target: string;
  label: string;
  value: number;
}
interface Subgraph {
  nodes: SubgraphNode[];
  links: SubgraphLink[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NPI_URI_PREFIX = 'https://vitalcv.com/npi/';
const PALETTE = {
  nodeBg:      '#E4E3E0',
  nodeText:    '#141414',
  edgeText:    '#6B6968',
  border:      '#D1D0CD',
  focusBorder: '#141414',
  loadingBg:   '#F5F4F1',
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TrustGraphXRayProps {
  /** 10-digit NPI string for the clinician being explored */
  npi: string;
  /** TrustGraph collection to query. Defaults to "default". */
  collection?: string;
  /** Additional CSS classes applied to the outer sb-card wrapper */
  className?: string;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LoadingState() {
  return (
    <div
      role="status"
      aria-label="Loading evidence graph"
      style={{
        backgroundColor: PALETTE.loadingBg,
        borderRadius: 6,
        padding: '24px 16px',
        textAlign: 'center',
      }}
    >
      <p style={{ color: PALETTE.edgeText, fontSize: 13, margin: 0 }}>
        Loading evidence graph…
      </p>
    </div>
  );
}

function UnavailableState({ message }: { message?: string }) {
  return (
    <div
      role="status"
      aria-label="Evidence graph unavailable"
      style={{
        backgroundColor: PALETTE.loadingBg,
        borderRadius: 6,
        padding: '24px 16px',
        textAlign: 'center',
      }}
    >
      <p style={{ color: PALETTE.edgeText, fontSize: 13, margin: 0 }}>
        {message ?? 'Evidence graph unavailable. TrustGraph may not be configured.'}
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      role="status"
      aria-label="No evidence found"
      style={{
        backgroundColor: PALETTE.loadingBg,
        borderRadius: 6,
        padding: '24px 16px',
        textAlign: 'center',
      }}
    >
      <p style={{ color: PALETTE.edgeText, fontSize: 13, margin: 0 }}>
        No evidence nodes found for this NPI.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GraphNode — single evidence node pill
// ---------------------------------------------------------------------------

interface GraphNodeProps {
  id: string;
  label: string;
  isFocused: boolean;
  onFocus: (id: string) => void;
}

function GraphNode({ id, label, isFocused, onFocus }: GraphNodeProps) {
  const shortLabel = label.length > 60 ? label.slice(0, 57) + '…' : label;

  return (
    <button
      type="button"
      onClick={() => onFocus(id)}
      aria-pressed={isFocused}
      title={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        backgroundColor: PALETTE.nodeBg,
        color: PALETTE.nodeText,
        border: `1.5px solid ${isFocused ? PALETTE.focusBorder : PALETTE.border}`,
        borderRadius: 4,
        fontSize: 12,
        fontFamily: 'inherit',
        fontWeight: isFocused ? 600 : 400,
        cursor: 'pointer',
        transition: 'border-color 120ms ease, font-weight 120ms ease',
        textAlign: 'left',
        maxWidth: 280,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {shortLabel}
    </button>
  );
}

// ---------------------------------------------------------------------------
// EdgeRow — single relationship row in the detail panel
// ---------------------------------------------------------------------------

interface EdgeRowProps {
  label: string;
  targetLabel: string;
}

function EdgeRow({ label, targetLabel }: EdgeRowProps) {
  return (
    <div
      className="sb-data-row"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '6px 0',
        borderBottom: `1px solid ${PALETTE.border}`,
        fontSize: 12,
        color: PALETTE.nodeText,
      }}
    >
      <span style={{ color: PALETTE.edgeText, flexShrink: 0, minWidth: 120 }}>
        {label}
      </span>
      <span style={{ wordBreak: 'break-all' }}>
        {targetLabel}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NodeDetail — detail panel for focused node
// ---------------------------------------------------------------------------

interface NodeDetailProps {
  nodeId: string;
  nodeLabel: string;
  edges: SubgraphLink[];
  nodes: SubgraphNode[];
}

function NodeDetail({ nodeId, nodeLabel, edges, nodes }: NodeDetailProps) {
  const nodeMap = new Map(nodes.map((n: SubgraphNode) => [n.id, n.label]));
  const outgoing = edges.filter((e: SubgraphLink) => e.source === nodeId);
  const incoming = edges.filter((e: SubgraphLink) => e.target === nodeId);

  return (
    <div
      style={{
        marginTop: 16,
        padding: '12px 16px',
        backgroundColor: PALETTE.nodeBg,
        border: `1px solid ${PALETTE.border}`,
        borderRadius: 4,
      }}
    >
      <p
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: PALETTE.edgeText,
          margin: '0 0 8px',
        }}
      >
        Evidence node
      </p>
      <p
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: PALETTE.nodeText,
          margin: '0 0 12px',
          wordBreak: 'break-all',
        }}
      >
        {nodeLabel}
      </p>

      {outgoing.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <p style={{ fontSize: 11, color: PALETTE.edgeText, margin: '0 0 4px' }}>
            Outgoing relationships ({outgoing.length})
          </p>
          {outgoing.map((e: SubgraphLink) => (
            <EdgeRow
              key={e.id}
              label={e.label}
              targetLabel={nodeMap.get(e.target) ?? e.target}
            />
          ))}
        </div>
      )}

      {incoming.length > 0 && (
        <div>
          <p style={{ fontSize: 11, color: PALETTE.edgeText, margin: '8px 0 4px' }}>
            Incoming relationships ({incoming.length})
          </p>
          {incoming.map((e: SubgraphLink) => (
            <EdgeRow
              key={e.id}
              label={e.label}
              targetLabel={nodeMap.get(e.source) ?? e.source}
            />
          ))}
        </div>
      )}

      {outgoing.length === 0 && incoming.length === 0 && (
        <p style={{ fontSize: 12, color: PALETTE.edgeText, margin: 0 }}>
          No relationships found for this node.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TrustGraphXRay — main export
// ---------------------------------------------------------------------------

export function TrustGraphXRay({
  npi,
  collection = 'default',
  className,
}: TrustGraphXRayProps) {
  const entityUri = `${NPI_URI_PREFIX}${npi}`;
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);

  const handleFocus = useCallback((id: string) => {
    setFocusedNodeId((prev) => (prev === id ? null : id));
  }, []);

  // Attempt to use the hook. If the TrustGraph provider is not available
  // (no NEXT_PUBLIC_TRUSTGRAPH_USER set), the hook will return isError=true
  // and we render the unavailable state gracefully.
  let graphState: ReturnType<typeof useGraphSubgraph> | null = null;
  let hookError: unknown = null;

  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    graphState = useGraphSubgraph({ entityUri, collection });
  } catch (err) {
    hookError = err;
  }

  const focusedNode = focusedNodeId
    ? graphState?.view?.nodes.find((n) => n.id === focusedNodeId) ?? null
    : null;

  return (
    <div
      className={`sb-card ${className ?? ''}`.trim()}
      style={{
        backgroundColor: '#FFFFFF',
        border: `1px solid ${PALETTE.border}`,
        borderRadius: 8,
        padding: '20px 20px 24px',
        fontFamily: 'inherit',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <p
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: PALETTE.edgeText,
            margin: '0 0 4px',
          }}
        >
          Evidence X-Ray
        </p>
        <p
          style={{
            fontSize: 13,
            color: PALETTE.nodeText,
            margin: 0,
          }}
        >
          Provenance graph for NPI {npi}
        </p>
      </div>

      {/* Body */}
      {hookError || (!graphState) ? (
        <UnavailableState />
      ) : graphState.isLoading ? (
        <LoadingState />
      ) : graphState.isError ? (
        <UnavailableState message="Could not load evidence graph. The TrustGraph service may be unavailable." />
      ) : !graphState.view?.nodes?.length ? (
        <EmptyState />
      ) : (
        <>
          {/* Node list */}
          <div
            role="list"
            aria-label="Evidence nodes"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            {graphState.view.nodes.map((node) => (
              <div key={node.id} role="listitem">
                <GraphNode
                  id={node.id}
                  label={node.label}
                  isFocused={focusedNodeId === node.id}
                  onFocus={handleFocus}
                />
              </div>
            ))}
          </div>

          {/* Edge count summary */}
          <p
            style={{
              fontSize: 11,
              color: PALETTE.edgeText,
              margin: '12px 0 0',
            }}
          >
            {graphState.view.nodes.length} node{graphState.view.nodes.length !== 1 ? 's' : ''}
            {' · '}
            {graphState.view.links.length} relationship{graphState.view.links.length !== 1 ? 's' : ''}
          </p>

          {/* Detail panel */}
          {focusedNode && (
            <NodeDetail
              nodeId={focusedNode.id}
              nodeLabel={focusedNode.label}
              edges={graphState.view.links}
              nodes={graphState.view.nodes}
            />
          )}
        </>
      )}
    </div>
  );
}
