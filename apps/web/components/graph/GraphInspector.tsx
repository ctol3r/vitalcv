'use client';

import { useMemo, useState, type ReactNode } from 'react';
import type { GraphEdge, GraphNode } from '@/components/graph-system/types';
import {
  buildNodeDetailModel,
  type NodeNeighborSummary,
} from '@/components/graph-system/nodeDetailModel';
import { formatGraphNodeType } from '@/components/graph/state/graphDisplayState';
import { Drawer } from '@/components/ui/Drawer';
import { useVirtualList } from '@/ui/hooks/useVirtualList';

interface GraphInspectorProps {
  open: boolean;
  node: GraphNode | null;
  edges: GraphEdge[];
  neighbors: NodeNeighborSummary[];
  onClose: () => void;
  onFocusNode: (nodeId: string) => void;
  onAcceptSuggestion: (suggestionId: string) => void;
  onRejectSuggestion: (suggestionId: string) => void;
}

function VirtualizedInspectorList<Item>({
  items,
  emptyState,
  getKey,
  itemHeight = 86,
  maxHeight = 320,
  renderItem,
}: {
  items: Item[];
  emptyState: string;
  getKey: (item: Item) => string;
  itemHeight?: number;
  maxHeight?: number;
  renderItem: (item: Item) => ReactNode;
}) {
  const virtualization = useVirtualList({
    itemCount: items.length,
    itemHeight,
    viewportHeight: maxHeight,
  });

  if (items.length === 0) {
    return <div className="vital-empty-state mt-3">{emptyState}</div>;
  }

  if (items.length <= 10) {
    return (
      <div className="mt-3 vital-inspector-list">
        {items.map((item) => (
          <div key={getKey(item)}>{renderItem(item)}</div>
        ))}
      </div>
    );
  }

  return (
    <div
      className="vital-virtual-list mt-3"
      onScroll={virtualization.onScroll}
      style={{ maxHeight }}
    >
      <div
        className="vital-virtual-list__inner"
        style={{ height: virtualization.totalHeight }}
      >
        <div style={{ transform: `translateY(${virtualization.offsetTop}px)` }}>
          {items
            .slice(virtualization.startIndex, virtualization.endIndex)
            .map((item) => (
              <div key={getKey(item)}>{renderItem(item)}</div>
            ))}
        </div>
      </div>
    </div>
  );
}

// ── Tab system ─────────────────────────────────────────────────────────────────

type TabId = 'overview' | 'relationships' | 'evidence';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'relationships', label: 'Relationships' },
  { id: 'evidence', label: 'Evidence' },
];

// ── Metadata table ─────────────────────────────────────────────────────────────

function MetadataTable({ rows }: { rows: [string, unknown][] }) {
  if (rows.length === 0) {
    return <div className="vital-empty-state mt-3">No metadata captured on this node.</div>;
  }
  return (
    <div className="mt-3 max-h-[220px] overflow-auto rounded-lg border border-[var(--vital-ops-border-subtle)]">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-[var(--vital-ops-border-subtle)]">
            <th className="px-3 py-1.5 text-left text-[var(--vital-ops-text-muted)] font-medium">Field</th>
            <th className="px-3 py-1.5 text-left text-[var(--vital-ops-text-muted)] font-medium">Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([key, value]) => (
            <tr key={key} className="border-b border-[var(--vital-ops-border-subtle)] last:border-0">
              <td className="px-3 py-1.5 text-[var(--vital-ops-text-secondary)] font-mono">{key}</td>
              <td className="px-3 py-1.5 text-[var(--vital-ops-text-primary)] break-all">{String(value ?? '')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Relationship table ─────────────────────────────────────────────────────────

function RelationshipTable({
  relationships,
  onFocusNode,
}: {
  relationships: ReturnType<typeof buildNodeDetailModel>['relationships'];
  onFocusNode: (id: string) => void;
}) {
  if (relationships.length === 0) {
    return <div className="vital-empty-state mt-3">No visible relationships in the current graph slice.</div>;
  }
  return (
    <div className="mt-3 max-h-[280px] overflow-auto rounded-lg border border-[var(--vital-ops-border-subtle)]">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-[var(--vital-ops-border-subtle)]">
            <th className="px-3 py-1.5 text-left text-[var(--vital-ops-text-muted)] font-medium">Neighbor</th>
            <th className="px-3 py-1.5 text-left text-[var(--vital-ops-text-muted)] font-medium">Direction</th>
            <th className="px-3 py-1.5 text-left text-[var(--vital-ops-text-muted)] font-medium">Confidence</th>
          </tr>
        </thead>
        <tbody>
          {relationships.map((rel) => (
            <tr key={rel.neighborId} className="border-b border-[var(--vital-ops-border-subtle)] last:border-0 hover:bg-[var(--vital-ops-hover)] transition-colors">
              <td className="px-3 py-1.5">
                <button
                  type="button"
                  className="text-[var(--vital-ops-accent-cyan)] hover:underline cursor-pointer bg-transparent border-none text-[12px]"
                  onClick={() => onFocusNode(rel.neighborId)}
                >
                  {rel.label}
                </button>
              </td>
              <td className="px-3 py-1.5 text-[var(--vital-ops-text-secondary)]">{rel.direction}</td>
              <td className="px-3 py-1.5 text-[var(--vital-ops-text-primary)] font-mono">{Math.round(rel.confidence * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function GraphInspector({
  open,
  node,
  edges,
  neighbors,
  onClose,
  onFocusNode,
  onAcceptSuggestion,
  onRejectSuggestion,
}: GraphInspectorProps) {
  const [selectedTab, setSelectedTab] = useState<TabId>('overview');

  const model = useMemo(() => {
    if (!node) return null;
    return buildNodeDetailModel(node, edges, neighbors);
  }, [edges, neighbors, node]);

  const metadataRows = useMemo(() => {
    if (!node) return [];
    return Object.entries(node.metadata ?? {}).slice(0, 8) as [string, unknown][];
  }, [node]);

  if (!node || !model) return null;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      overlay={false}
      title={(
        <div className="flex items-center gap-3">
          <div>
            <p className="vital-panel__eyebrow">Inspector</p>
            <h2 className="vital-panel__title">{node.title || node.label}</h2>
          </div>
          <span className="vital-status-pill">{formatGraphNodeType(node.type)}</span>
        </div>
      )}
      width="lg"
    >
      <div className="flex h-full flex-col gap-4 p-4">
        {/* Header card */}
        <div className="vital-panel vital-panel--dense">
          <div className="vital-panel__header">
            <div>
              <p className="vital-panel__eyebrow">Inspector</p>
              <h2 className="vital-panel__title">{node.title || node.label}</h2>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="vital-status-pill">{formatGraphNodeType(node.type)}</span>
            <span className="vital-status-pill">{node.trustTier ?? 'Unassigned tier'}</span>
            <span className="vital-status-pill">
              {node.confidence ? `${Math.round(node.confidence * 100)}% confidence` : 'No confidence score'}
            </span>
          </div>
          <p className="vital-panel__copy">
            {neighbors.length} connected neighbors across {edges.length} visible relationships.
          </p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-[var(--vital-ops-border-subtle)]">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`px-3 py-1.5 text-[12px] font-medium transition-colors border-b-2 ${
                selectedTab === tab.id
                  ? 'border-[var(--vital-ops-accent-cyan)] text-[var(--vital-ops-text-primary)]'
                  : 'border-transparent text-[var(--vital-ops-text-muted)] hover:text-[var(--vital-ops-text-secondary)]'
              }`}
              onClick={() => setSelectedTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {selectedTab === 'overview' && (
          <div className="flex flex-col gap-4">
            <div className="vital-panel vital-panel--dense">
              <div className="vital-kpi-grid">
                <div className="vital-kpi">
                  <span className="vital-kpi__label">Claims</span>
                  <span className="vital-kpi__value">{model.claims.length}</span>
                </div>
                <div className="vital-kpi">
                  <span className="vital-kpi__label">Receipts</span>
                  <span className="vital-kpi__value">{model.receipts.length}</span>
                </div>
                <div className="vital-kpi">
                  <span className="vital-kpi__label">Artifacts</span>
                  <span className="vital-kpi__value">{model.artifacts.length}</span>
                </div>
              </div>
            </div>

            <div className="vital-panel vital-panel--dense">
              <div className="vital-panel__header">
                <div>
                  <p className="vital-panel__eyebrow">Claims</p>
                  <h3 className="vital-panel__title">Verification narrative</h3>
                </div>
              </div>
              <VirtualizedInspectorList
                emptyState="No claims attached to this node."
                getKey={(claim) => claim.id}
                itemHeight={78}
                items={model.claims}
                maxHeight={300}
                renderItem={(claim) => (
                  <div className="vital-inspector-item">
                    <div className="vital-inspector-item__meta">
                      <span className="vital-inspector-item__label">{claim.label}</span>
                      <span className="vital-inspector-item__detail line-clamp-2">{claim.summary}</span>
                    </div>
                    <span className="vital-status-pill">{claim.value}</span>
                  </div>
                )}
              />
            </div>

            <div className="vital-panel vital-panel--dense">
              <div className="vital-panel__header">
                <div>
                  <p className="vital-panel__eyebrow">Metadata</p>
                  <h3 className="vital-panel__title">Node payload</h3>
                </div>
              </div>
              <MetadataTable rows={metadataRows} />
            </div>
          </div>
        )}

        {selectedTab === 'relationships' && (
          <div className="vital-panel vital-panel--dense">
            <div className="vital-panel__header">
              <div>
                <p className="vital-panel__eyebrow">Relationships</p>
                <h3 className="vital-panel__title">Connected entities</h3>
              </div>
            </div>
            <RelationshipTable relationships={model.relationships} onFocusNode={onFocusNode} />
          </div>
        )}

        {selectedTab === 'evidence' && (
          <div className="flex flex-col gap-4">
            <div className="vital-panel vital-panel--dense">
              <div className="vital-panel__header">
                <div>
                  <p className="vital-panel__eyebrow">Evidence stack</p>
                  <h3 className="vital-panel__title">Receipts and artifacts</h3>
                </div>
              </div>
              <VirtualizedInspectorList
                emptyState="No receipts or artifacts in the current graph slice."
                getKey={(entry) => entry.id}
                itemHeight={86}
                items={model.evidenceStack}
                maxHeight={320}
                renderItem={(entry) => (
                  <div className="vital-inspector-item">
                    <div className="vital-inspector-item__meta">
                      <span className="vital-inspector-item__label">{entry.title}</span>
                      <span className="vital-inspector-item__detail line-clamp-2">{entry.summary}</span>
                    </div>
                    <span className="vital-status-pill">{entry.kind}</span>
                  </div>
                )}
              />
            </div>

            {model.pendingSuggestions.length > 0 && (
              <div className="vital-panel vital-panel--dense">
                <div className="vital-panel__header">
                  <div>
                    <p className="vital-panel__eyebrow">Pending AI links</p>
                    <h3 className="vital-panel__title">Review suggestions</h3>
                  </div>
                </div>
                <VirtualizedInspectorList
                  emptyState="No pending AI link suggestions."
                  getKey={(suggestion) => suggestion.id}
                  itemHeight={94}
                  items={model.pendingSuggestions}
                  maxHeight={280}
                  renderItem={(suggestion) => (
                    <div className="vital-inspector-item">
                      <div className="vital-inspector-item__meta">
                        <span className="vital-inspector-item__label">{suggestion.targetLabel}</span>
                        <span className="vital-inspector-item__detail line-clamp-2">{suggestion.explanation}</span>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" className="vital-action-button" onClick={() => onAcceptSuggestion(suggestion.id)}>Accept</button>
                        <button type="button" className="vital-action-button" onClick={() => onRejectSuggestion(suggestion.id)}>Reject</button>
                      </div>
                    </div>
                  )}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </Drawer>
  );
}
