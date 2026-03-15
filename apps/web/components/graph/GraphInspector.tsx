'use client';

import {
  Button,
  Card,
  Drawer,
  Tab,
  Tabs,
  Tag,
} from '@blueprintjs/core';
import { Cell, Column, Table2 } from '@blueprintjs/table';
import { X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { GraphEdge, GraphNode } from '@/components/graph-system/types';
import {
  buildNodeDetailModel,
  type NodeNeighborSummary,
} from '@/components/graph-system/nodeDetailModel';
import { formatGraphNodeType } from '@/components/graph/state/graphDisplayState';

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
  const [selectedTabId, setSelectedTabId] = useState('overview');

  const model = useMemo(() => {
    if (!node) {
      return null;
    }

    return buildNodeDetailModel(node, edges, neighbors);
  }, [edges, neighbors, node]);

  const metadataRows = useMemo(() => {
    if (!node) {
      return [];
    }

    return Object.entries(node.metadata ?? {}).slice(0, 8);
  }, [node]);

  if (!node || !model) {
    return null;
  }

  return (
    <Drawer
      className="vital-graph-drawer"
      hasBackdrop={false}
      isCloseButtonShown={false}
      isOpen={open}
      onClose={onClose}
      position="right"
      size="38rem"
    >
      <div className="flex h-full flex-col gap-4 p-4">
        <Card className="vital-panel vital-panel--dense">
          <div className="vital-panel__header">
            <div>
              <p className="vital-panel__eyebrow">Inspector</p>
              <h2 className="vital-panel__title">{node.title || node.label}</h2>
            </div>
            <Button
              className="vital-action-button"
              icon={<X className="h-3.5 w-3.5" />}
              minimal
              onClick={onClose}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Tag minimal className="vital-status-pill">{formatGraphNodeType(node.type)}</Tag>
            <Tag minimal className="vital-status-pill">{node.trustTier ?? 'Unassigned tier'}</Tag>
            <Tag minimal className="vital-status-pill">
              {node.confidence ? `${Math.round(node.confidence * 100)}% confidence` : 'No confidence score'}
            </Tag>
          </div>
          <p className="vital-panel__copy">
            {neighbors.length} connected neighbors across {edges.length} visible relationships.
          </p>
        </Card>

        <Tabs
          id="graph-inspector-tabs"
          onChange={(tabId) => setSelectedTabId(String(tabId))}
          selectedTabId={selectedTabId}
        >
          <Tab
            id="overview"
            title="Overview"
            panel={
              <div className="vital-graph-tabs">
                <Card className="vital-panel vital-panel--dense">
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
                </Card>

                <Card className="vital-panel vital-panel--dense">
                  <div className="vital-panel__header">
                    <div>
                      <p className="vital-panel__eyebrow">Claims</p>
                      <h3 className="vital-panel__title">Verification narrative</h3>
                    </div>
                  </div>
                  <div className="mt-3 vital-inspector-list">
                    {model.claims.slice(0, 6).map((claim) => (
                      <div key={claim.id} className="vital-inspector-item">
                        <div className="vital-inspector-item__meta">
                          <span className="vital-inspector-item__label">{claim.label}</span>
                          <span className="vital-inspector-item__detail">{claim.summary}</span>
                        </div>
                        <Tag minimal className="vital-status-pill">{claim.value}</Tag>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="vital-panel vital-panel--dense">
                  <div className="vital-panel__header">
                    <div>
                      <p className="vital-panel__eyebrow">Metadata</p>
                      <h3 className="vital-panel__title">Node payload</h3>
                    </div>
                  </div>
                  {metadataRows.length > 0 ? (
                    <div className="mt-3 h-[220px] overflow-hidden rounded-xl border border-[var(--vital-ops-border-subtle)]">
                      <Table2 numRows={metadataRows.length} enableGhostCells={false}>
                        <Column
                          name="Field"
                          cellRenderer={(rowIndex) => (
                            <Cell>{metadataRows[rowIndex]?.[0] ?? ''}</Cell>
                          )}
                        />
                        <Column
                          name="Value"
                          cellRenderer={(rowIndex) => (
                            <Cell>{String(metadataRows[rowIndex]?.[1] ?? '')}</Cell>
                          )}
                        />
                      </Table2>
                    </div>
                  ) : (
                    <div className="vital-empty-state mt-3">No metadata captured on this node.</div>
                  )}
                </Card>
              </div>
            }
          />
          <Tab
            id="relationships"
            title="Relationships"
            panel={
              <div className="vital-graph-tabs">
                <Card className="vital-panel vital-panel--dense">
                  <div className="vital-panel__header">
                    <div>
                      <p className="vital-panel__eyebrow">Relationships</p>
                      <h3 className="vital-panel__title">Connected entities</h3>
                    </div>
                  </div>
                  {model.relationships.length > 0 ? (
                    <div className="mt-3 h-[280px] overflow-hidden rounded-xl border border-[var(--vital-ops-border-subtle)]">
                      <Table2 numRows={model.relationships.length} enableGhostCells={false}>
                        <Column
                          name="Neighbor"
                          cellRenderer={(rowIndex) => {
                            const relationship = model.relationships[rowIndex];
                            return (
                              <Cell>
                                <Button
                                  minimal
                                  className="vital-action-button"
                                  onClick={() => onFocusNode(relationship.neighborId)}
                                  text={relationship.label}
                                />
                              </Cell>
                            );
                          }}
                        />
                        <Column
                          name="Direction"
                          cellRenderer={(rowIndex) => (
                            <Cell>{model.relationships[rowIndex]?.direction ?? ''}</Cell>
                          )}
                        />
                        <Column
                          name="Confidence"
                          cellRenderer={(rowIndex) => (
                            <Cell>
                              {Math.round((model.relationships[rowIndex]?.confidence ?? 0) * 100)}%
                            </Cell>
                          )}
                        />
                      </Table2>
                    </div>
                  ) : (
                    <div className="vital-empty-state mt-3">No visible relationships in the current graph slice.</div>
                  )}
                </Card>
              </div>
            }
          />
          <Tab
            id="evidence"
            title="Evidence"
            panel={
              <div className="vital-graph-tabs">
                <Card className="vital-panel vital-panel--dense">
                  <div className="vital-panel__header">
                    <div>
                      <p className="vital-panel__eyebrow">Evidence stack</p>
                      <h3 className="vital-panel__title">Receipts and artifacts</h3>
                    </div>
                  </div>
                  <div className="mt-3 vital-inspector-list">
                    {model.evidenceStack.map((entry) => (
                      <div key={entry.id} className="vital-inspector-item">
                        <div className="vital-inspector-item__meta">
                          <span className="vital-inspector-item__label">{entry.title}</span>
                          <span className="vital-inspector-item__detail">{entry.summary}</span>
                        </div>
                        <Tag minimal className="vital-status-pill">{entry.kind}</Tag>
                      </div>
                    ))}
                  </div>
                </Card>

                {model.pendingSuggestions.length > 0 ? (
                  <Card className="vital-panel vital-panel--dense">
                    <div className="vital-panel__header">
                      <div>
                        <p className="vital-panel__eyebrow">Pending AI links</p>
                        <h3 className="vital-panel__title">Review suggestions</h3>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-col gap-3">
                      {model.pendingSuggestions.map((suggestion) => (
                        <div key={suggestion.id} className="vital-inspector-item">
                          <div className="vital-inspector-item__meta">
                            <span className="vital-inspector-item__label">{suggestion.targetLabel}</span>
                            <span className="vital-inspector-item__detail">{suggestion.explanation}</span>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              className="vital-action-button"
                              onClick={() => onAcceptSuggestion(suggestion.id)}
                              text="Accept"
                            />
                            <Button
                              className="vital-action-button"
                              onClick={() => onRejectSuggestion(suggestion.id)}
                              text="Reject"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                ) : null}
              </div>
            }
          />
        </Tabs>
      </div>
    </Drawer>
  );
}
