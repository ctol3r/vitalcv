'use client';

/**
 * TrustGraphXRay — Clinician credential provenance explorer.
 *
 * Progressive disclosure: collapsed by default behind an "Explore evidence"
 * trigger. Renders a directed DOM-based graph of the clinician's Context Core.
 *
 * Data flow:
 *   1. If `graphData` prop is provided, use it directly (controlled mode).
 *   2. Otherwise fetch via `useGraphSubgraph` from @trustgraph/react-state.
 *   3. If TrustGraph is not configured, fall back to MOCK_GRAPH_DATA for
 *      development visibility (clearly flagged with a [DEV] banner).
 *
 * Visual doctrine:
 *   - Warm off-white nodes: #E4E3E0 / near-black ink: #141414
 *   - No gradients, no shadows, no physics animations
 *   - Light-first; sb-card / sb-data-row utility classes on wrappers
 *   - Transitions: ≤150ms, purposeful only
 *
 * Integration:
 *   - NOT wired into any page yet. Import and render conditionally.
 *   - Safe to render without TrustGraph configured (graceful degradation).
 *
 * @example
 * <TrustGraphXRay npi="1234567890" />
 * <TrustGraphXRay npi="1234567890" graphData={mySubgraph} />
 */

import React, { useCallback, useState } from 'react';
import { useGraphSubgraph } from '@trustgraph/react-state';

// ---------------------------------------------------------------------------
// Subgraph types (inlined to avoid importing from dist internals)
// ---------------------------------------------------------------------------

export interface XRayNode {
  id: string;
  label: string;
  group?: number;
}

export interface XRayLink {
  id: string;
  source: string;
  target: string;
  label: string;
  value?: number;
}

export interface XRayGraphData {
  nodes: XRayNode[];
  links: XRayLink[];
}

// ---------------------------------------------------------------------------
// Semantic mock data — TEMPORARY, for component development only
// Replace with real TrustGraph data once the Context Core is wired.
// ---------------------------------------------------------------------------

/** @dev REMOVE or gate behind process.env.NODE_ENV !== 'production' before GA */
export const MOCK_GRAPH_DATA: XRayGraphData = {
  nodes: [
    { id: 'npi:root',     label: 'Clinician NPI',           group: 0 },
    { id: 'src:nppes',    label: 'NPPES Registry',           group: 1 },
    { id: 'src:oig',      label: 'OIG Exclusion List',       group: 1 },
    { id: 'src:pecos',    label: 'CMS PECOS',                group: 1 },
    { id: 'src:statebrd', label: 'State Medical Board',      group: 1 },
    { id: 'claim:identity', label: 'NPI Identity Confirmed', group: 2 },
    { id: 'claim:active', label: 'Active License (CA)',      group: 2 },
    { id: 'claim:clear',  label: 'OIG Clearance Confirmed',  group: 2 },
    { id: 'claim:enrollment', label: 'Enrollment Context',   group: 2 },
  ],
  links: [
    { id: 'e1', source: 'npi:root',    target: 'src:nppes',    label: 'RESOLVED_IN'    },
    { id: 'e2', source: 'npi:root',    target: 'src:oig',      label: 'CHECKED_AGAINST' },
    { id: 'e3', source: 'npi:root',    target: 'src:pecos',    label: 'CHECKED_AGAINST' },
    { id: 'e4', source: 'npi:root',    target: 'src:statebrd', label: 'CHECKED_AGAINST' },
    { id: 'e5', source: 'src:nppes',   target: 'claim:identity', label: 'SUPPORTS_IDENTITY' },
    { id: 'e6', source: 'src:statebrd', target: 'claim:active', label: 'SUPPORTS'       },
    { id: 'e7', source: 'src:oig',     target: 'claim:clear',  label: 'SUPPORTS'       },
    { id: 'e8', source: 'src:pecos',   target: 'claim:enrollment', label: 'CONTEXT_FOR' },
  ],
};

// ---------------------------------------------------------------------------
// Palette + constants
// ---------------------------------------------------------------------------

const NPI_URI_PREFIX = 'https://vitalcv.com/npi/';

const P = {
  nodeBg:      '#E4E3E0',
  nodeText:    '#141414',
  edgeText:    '#6B6968',
  border:      '#D1D0CD',
  focusBorder: '#141414',
  dimBg:       '#F5F4F1',
  devBanner:   '#FFF3CD',
  devText:     '#856404',
} as const;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TrustGraphXRayProps {
  /** 10-digit NPI. Used as the entity URI for TrustGraph queries. */
  npi: string;
  /**
   * Optional pre-fetched graph data. When provided, the component skips the
   * TrustGraph hook entirely (controlled/props-driven mode).
   */
  graphData?: XRayGraphData;
  /** TrustGraph collection to query. Defaults to "default". */
  collection?: string;
  /**
   * When true, show mock data if TrustGraph is unavailable.
   * Defaults to true in development, false in production.
   */
  showMockOnUnavailable?: boolean;
  /** Additional CSS classes on the outer sb-card wrapper. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Internal sub-components
// ---------------------------------------------------------------------------

function DevBanner() {
  return (
    <div
      role="note"
      aria-label="Development mock data notice"
      style={{
        backgroundColor: P.devBanner,
        color: P.devText,
        fontSize: 11,
        fontWeight: 600,
        padding: '4px 10px',
        borderRadius: 3,
        marginBottom: 12,
        letterSpacing: '0.04em',
      }}
    >
      [DEV] Showing mock data — TrustGraph not configured
    </div>
  );
}

function LoadingState() {
  return (
    <div
      role="status"
      aria-label="Loading evidence graph"
      style={{ backgroundColor: P.dimBg, borderRadius: 6, padding: '20px 16px', textAlign: 'center' }}
    >
      <p style={{ color: P.edgeText, fontSize: 13, margin: 0 }}>Loading evidence graph…</p>
    </div>
  );
}

function UnavailableState({ message }: { message?: string }) {
  return (
    <div
      role="status"
      aria-label="Evidence graph unavailable"
      style={{ backgroundColor: P.dimBg, borderRadius: 6, padding: '20px 16px', textAlign: 'center' }}
    >
      <p style={{ color: P.edgeText, fontSize: 13, margin: 0 }}>
        {message ?? 'Evidence graph unavailable. TrustGraph may not be configured.'}
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      role="status"
      aria-label="No evidence nodes found"
      style={{ backgroundColor: P.dimBg, borderRadius: 6, padding: '20px 16px', textAlign: 'center' }}
    >
      <p style={{ color: P.edgeText, fontSize: 13, margin: 0 }}>
        No evidence nodes found for this NPI.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GraphNode pill
// ---------------------------------------------------------------------------

interface GraphNodeProps {
  node: XRayNode;
  isFocused: boolean;
  onFocus: (id: string) => void;
}

function GraphNodePill({ node, isFocused, onFocus }: GraphNodeProps) {
  const shortLabel = node.label.length > 56 ? node.label.slice(0, 53) + '…' : node.label;
  return (
    <button
      type="button"
      onClick={() => onFocus(node.id)}
      aria-pressed={isFocused}
      title={node.label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '5px 11px',
        backgroundColor: P.nodeBg,
        color: P.nodeText,
        border: `1.5px solid ${isFocused ? P.focusBorder : P.border}`,
        borderRadius: 4,
        fontSize: 12,
        fontFamily: 'inherit',
        fontWeight: isFocused ? 600 : 400,
        cursor: 'pointer',
        transition: 'border-color 120ms ease',
        textAlign: 'left',
        maxWidth: 260,
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
// EdgeRow (relationship detail)
// ---------------------------------------------------------------------------

function EdgeRow({ label, peerLabel }: { label: string; peerLabel: string }) {
  return (
    <div
      className="sb-data-row"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '5px 0',
        borderBottom: `1px solid ${P.border}`,
        fontSize: 12,
        color: P.nodeText,
      }}
    >
      <span style={{ color: P.edgeText, flexShrink: 0, minWidth: 130, fontVariantNumeric: 'tabular-nums' }}>
        {label}
      </span>
      <span style={{ wordBreak: 'break-all' }}>{peerLabel}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NodeDetail panel (progressive disclosure — shown on node click)
// ---------------------------------------------------------------------------

interface NodeDetailProps {
  node: XRayNode;
  allNodes: XRayNode[];
  allLinks: XRayLink[];
  onClose: () => void;
}

function NodeDetail({ node, allNodes, allLinks, onClose }: NodeDetailProps) {
  const nodeMap = new Map(allNodes.map((n) => [n.id, n.label]));
  const outgoing = allLinks.filter((e) => e.source === node.id);
  const incoming = allLinks.filter((e) => e.target === node.id);

  return (
    <div
      style={{
        marginTop: 14,
        padding: '12px 14px',
        backgroundColor: P.nodeBg,
        border: `1px solid ${P.border}`,
        borderRadius: 4,
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: P.edgeText, margin: '0 0 3px' }}>
            Evidence node
          </p>
          <p style={{ fontSize: 13, fontWeight: 600, color: P.nodeText, margin: 0, wordBreak: 'break-all' }}>
            {node.label}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close node detail"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 16,
            color: P.edgeText,
            lineHeight: 1,
            padding: '0 0 0 8px',
            flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>

      {outgoing.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <p style={{ fontSize: 10, color: P.edgeText, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Outgoing ({outgoing.length})
          </p>
          {outgoing.map((e) => (
            <EdgeRow key={e.id} label={e.label} peerLabel={nodeMap.get(e.target) ?? e.target} />
          ))}
        </div>
      )}

      {incoming.length > 0 && (
        <div style={{ marginTop: outgoing.length > 0 ? 8 : 0 }}>
          <p style={{ fontSize: 10, color: P.edgeText, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Incoming ({incoming.length})
          </p>
          {incoming.map((e) => (
            <EdgeRow key={e.id} label={e.label} peerLabel={nodeMap.get(e.source) ?? e.source} />
          ))}
        </div>
      )}

      {outgoing.length === 0 && incoming.length === 0 && (
        <p style={{ fontSize: 12, color: P.edgeText, margin: 0 }}>No relationships for this node.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GraphCanvas — the node grid + detail panel
// ---------------------------------------------------------------------------

interface GraphCanvasProps {
  data: XRayGraphData;
  isMock?: boolean;
}

function GraphCanvas({ data, isMock }: GraphCanvasProps) {
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const handleFocus = useCallback((id: string) => {
    setFocusedId((prev) => (prev === id ? null : id));
  }, []);

  const focusedNode = focusedId ? data.nodes.find((n) => n.id === focusedId) ?? null : null;

  return (
    <>
      {isMock && <DevBanner />}

      {/* Node grid */}
      <div role="list" aria-label="Evidence nodes" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {data.nodes.map((node) => (
          <div key={node.id} role="listitem">
            <GraphNodePill
              node={node}
              isFocused={focusedId === node.id}
              onFocus={handleFocus}
            />
          </div>
        ))}
      </div>

      {/* Summary line */}
      <p style={{ fontSize: 11, color: P.edgeText, margin: '10px 0 0' }}>
        {data.nodes.length} node{data.nodes.length !== 1 ? 's' : ''}
        {' · '}
        {data.links.length} relationship{data.links.length !== 1 ? 's' : ''}
        {isMock ? ' · mock' : ''}
      </p>

      {/* Node detail (progressive disclosure) */}
      {focusedNode && (
        <NodeDetail
          node={focusedNode}
          allNodes={data.nodes}
          allLinks={data.links}
          onClose={() => setFocusedId(null)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// InnerContent — resolves data from hook or props, renders GraphCanvas
// ---------------------------------------------------------------------------

function InnerContent({
  npi,
  collection,
  graphData,
  showMockOnUnavailable,
}: {
  npi: string;
  collection: string;
  graphData?: XRayGraphData;
  showMockOnUnavailable: boolean;
}) {
  const entityUri = `${NPI_URI_PREFIX}${npi}`;
  const skip = Boolean(graphData);

  let hookResult: ReturnType<typeof useGraphSubgraph> | null = null;
  let hookError = false;

  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    hookResult = useGraphSubgraph({ entityUri: skip ? undefined : entityUri, collection });
  } catch {
    hookError = true;
  }

  // Controlled mode: caller supplies graph data directly
  if (graphData) {
    return <GraphCanvas data={graphData} />;
  }

  // Hook unavailable (provider not mounted / env not configured)
  if (hookError || !hookResult) {
    if (showMockOnUnavailable) {
      return <GraphCanvas data={MOCK_GRAPH_DATA} isMock />;
    }
    return <UnavailableState />;
  }

  if (hookResult.isLoading) return <LoadingState />;

  if (hookResult.isError) {
    if (showMockOnUnavailable) {
      return <GraphCanvas data={MOCK_GRAPH_DATA} isMock />;
    }
    return <UnavailableState message="Could not load evidence graph. TrustGraph may be unavailable." />;
  }

  const view = hookResult.view;
  if (!view?.nodes?.length) return <EmptyState />;

  // Normalise from Subgraph shape → XRayGraphData
  const data: XRayGraphData = {
    nodes: view.nodes.map((n) => ({ id: n.id, label: n.label, group: n.group })),
    links: view.links.map((l) => ({
      id: l.id,
      source: l.source,
      target: l.target,
      label: l.label,
      value: l.value,
    })),
  };

  return <GraphCanvas data={data} />;
}

// ---------------------------------------------------------------------------
// TrustGraphXRay — main export
// ---------------------------------------------------------------------------

export function TrustGraphXRay({
  npi,
  graphData,
  collection = 'default',
  showMockOnUnavailable,
  className,
}: TrustGraphXRayProps) {
  const isDev = process.env.NODE_ENV !== 'production';
  const useMock = showMockOnUnavailable ?? isDev;

  // Progressive disclosure: collapsed by default
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`sb-card ${className ?? ''}`.trim()}
      style={{
        backgroundColor: '#FFFFFF',
        border: `1px solid ${P.border}`,
        borderRadius: 8,
        fontFamily: 'inherit',
        overflow: 'hidden',
      }}
    >
      {/* Disclosure trigger — always visible */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="xray-body"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '14px 20px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
      >
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: P.edgeText, margin: '0 0 2px' }}>
            Evidence X-Ray
          </p>
          <p style={{ fontSize: 12, color: P.nodeText, margin: 0 }}>
            {expanded ? 'Hide provenance graph' : 'Explore credential provenance'}
          </p>
        </div>
        <span
          aria-hidden="true"
          style={{
            fontSize: 14,
            color: P.edgeText,
            transition: 'transform 150ms ease',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            display: 'inline-block',
          }}
        >
          ▾
        </span>
      </button>

      {/* Collapsible body */}
      {expanded && (
        <div
          id="xray-body"
          style={{ padding: '0 20px 20px', borderTop: `1px solid ${P.border}`, paddingTop: 14 }}
        >
          <InnerContent
            npi={npi}
            collection={collection}
            graphData={graphData}
            showMockOnUnavailable={useMock}
          />
        </div>
      )}
    </div>
  );
}
