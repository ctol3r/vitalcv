'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, Info } from 'lucide-react'

interface LineageNode {
  id: string
  type: 'source' | 'transformation' | 'current'
  label: string
  metadata?: Record<string, unknown>
  timestamp?: string
}

interface LineageEdge {
  from: string
  to: string
  transformationId?: string
  operationType: 'CREATE' | 'UPDATE' | 'DELETE'
}

interface LineageGraph {
  nodes: LineageNode[]
  edges: LineageEdge[]
}

interface LineageViewerProps {
  recordId: string
}

const MOCK_LINEAGE: LineageGraph = {
  nodes: [
    {
      id: 'source-1',
      type: 'source',
      label: 'NPPES Registry',
      metadata: { system: 'nppes', recordType: 'provider' },
      timestamp: '2025-01-01T00:00:00Z',
    },
    {
      id: 'source-2',
      type: 'source',
      label: 'State Board License',
      metadata: { system: 'state-board', recordType: 'license' },
      timestamp: '2025-01-02T00:00:00Z',
    },
    {
      id: 'transformation-1',
      type: 'transformation',
      label: 'AI Link Inference',
      metadata: { transformationId: 'ai-link-inference', version: '1.0.0' },
      timestamp: '2025-01-03T00:00:00Z',
    },
    {
      id: 'transformation-2',
      type: 'transformation',
      label: 'Credential Verification',
      metadata: { transformationId: 'credential-verification', version: '2.1.0' },
      timestamp: '2025-01-04T00:00:00Z',
    },
    {
      id: 'current',
      type: 'current',
      label: 'Current Record State',
      metadata: { status: 'active', lastUpdated: '2025-01-05T00:00:00Z' },
      timestamp: '2025-01-05T00:00:00Z',
    },
  ],
  edges: [
    { from: 'source-1', to: 'transformation-1', operationType: 'CREATE' },
    { from: 'source-2', to: 'transformation-1', operationType: 'CREATE' },
    { from: 'transformation-1', to: 'transformation-2', operationType: 'UPDATE' },
    { from: 'transformation-2', to: 'current', operationType: 'UPDATE' },
  ],
}

export function RecordLineageViewer({ recordId }: LineageViewerProps) {
  const [lineage, setLineage] = useState<LineageGraph | null>(null)
  const [selectedNode, setSelectedNode] = useState<LineageNode | null>(null)
  const [direction, setDirection] = useState<'forward' | 'backward'>('backward')
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())

  useEffect(() => {
    // In production, fetch lineage from API
    // For now, use mock data
    setLineage(MOCK_LINEAGE)
  }, [recordId])

  const toggleNodeExpansion = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId)
    } else {
      newExpanded.add(nodeId)
    }
    setExpandedNodes(newExpanded)
  }

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'source':
        return 'bg-blue-100 border-blue-300 text-blue-900'
      case 'transformation':
        return 'bg-yellow-100 border-yellow-300 text-yellow-900'
      case 'current':
        return 'bg-green-100 border-green-300 text-green-900'
      default:
        return 'bg-gray-100 border-gray-300'
    }
  }

  const getOperationBadgeVariant = (operation: string) => {
    switch (operation) {
      case 'CREATE':
        return 'default'
      case 'UPDATE':
        return 'secondary'
      case 'DELETE':
        return 'destructive'
      default:
        return 'default'
    }
  }

  if (!lineage) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Loading lineage...</p>
      </div>
    )
  }

  // Filter nodes based on direction
  const filteredNodes = direction === 'backward'
    ? lineage.nodes.filter(n => n.type === 'source' || n.type === 'transformation' || n.type === 'current')
    : lineage.nodes.filter(n => n.type === 'current' || n.type === 'transformation')

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant={direction === 'backward' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDirection('backward')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Backward Trace
          </Button>
          <Button
            variant={direction === 'forward' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDirection('forward')}
          >
            Forward Trace
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>

      {/* Lineage Graph Visualization */}
      <div className="relative border rounded-lg p-8 bg-gray-50 min-h-[400px]">
        <div className="flex flex-col gap-8">
          {filteredNodes.map((node, index) => {
            const isExpanded = expandedNodes.has(node.id)
            const outgoingEdges = lineage.edges.filter((e) => e.from === node.id)
            const incomingEdges = lineage.edges.filter((e) => e.to === node.id)

            return (
              <div key={node.id} className="flex items-start gap-4">
                {/* Node */}
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={() => setSelectedNode(node)}
                    className={cn(
                      'px-4 py-2 rounded-lg border-2 font-medium transition-all hover:shadow-md',
                      getNodeColor(node.type)
                    )}
                  >
                    {node.label}
                  </button>
                  {node.timestamp && (
                    <span className="text-xs text-muted-foreground">
                      {new Date(node.timestamp).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {/* Expandable Details */}
                {isExpanded && (
                  <Card className="flex-1">
                    <CardHeader>
                      <CardTitle className="text-sm">{node.label}</CardTitle>
                      <CardDescription>Node Details</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {node.metadata && (
                        <div className="space-y-1">
                          {Object.entries(node.metadata).map(([key, value]) => (
                            <div key={key} className="text-sm">
                              <span className="font-medium">{key}:</span>{' '}
                              <span className="text-muted-foreground">
                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {outgoingEdges.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm font-medium mb-2">Outgoing Transformations:</p>
                          {outgoingEdges.map((edge) => (
                            <Badge
                              key={`${edge.from}-${edge.to}`}
                              variant={getOperationBadgeVariant(edge.operationType)}
                              className="mr-2"
                            >
                              {edge.operationType}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Expand/Collapse Button */}
                {node.metadata && Object.keys(node.metadata).length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleNodeExpansion(node.id)}
                    className="mt-1"
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                )}

                {/* Arrow */}
                {index < filteredNodes.length - 1 && (
                  <div className="flex items-center mt-4">
                    <ArrowRight className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Node Details Dialog */}
      <Dialog open={!!selectedNode} onOpenChange={() => setSelectedNode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedNode?.label}</DialogTitle>
            <DialogDescription>Detailed information about this lineage node</DialogDescription>
          </DialogHeader>
          {selectedNode && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">Type:</p>
                <Badge>{selectedNode.type}</Badge>
              </div>
              {selectedNode.metadata && (
                <div>
                  <p className="text-sm font-medium mb-2">Metadata:</p>
                  <pre className="bg-muted p-4 rounded-lg text-xs overflow-auto">
                    {JSON.stringify(selectedNode.metadata, null, 2)}
                  </pre>
                </div>
              )}
              {selectedNode.timestamp && (
                <div>
                  <p className="text-sm font-medium">Timestamp:</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(selectedNode.timestamp).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

