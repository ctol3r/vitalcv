'use client'

import { useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, ChevronRight, Clock, FileText, Target, TrendingUp, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type PrivilegeNode = {
  id: string
  label: string
  depth: number
  category: 'privilege' | 'procedure' | 'certification'
  status: 'active' | 'pending' | 'eligible' | 'not-eligible'
  procedureCount?: number
  lastPerformed?: string
  readinessScore?: number
  requirements?: string[]
}

export type PathwayEdge = {
  from: string
  to: string
  type: 'prerequisite' | 'recommended' | 'blocking'
  weight?: number
}

export type PathwayOverlayProps = {
  nodes: PrivilegeNode[]
  edges: PathwayEdge[]
  clinicianName?: string
  onClose?: () => void
  onNodeClick?: (nodeId: string) => void
}

type NodePosition = {
  x: number
  y: number
  node: PrivilegeNode
}

const DEPTH_SPACING = 200
const NODE_SPACING = 120
const NODE_SIZE = 80

export function PathwayOverlay({ nodes, edges, clinicianName, onClose, onNodeClick }: PathwayOverlayProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)

  const positionedNodes = useMemo(() => {
    const maxDepth = Math.max(...nodes.map((n) => n.depth), 0)
    const positions: NodePosition[] = []
    const nodesByDepth: Record<number, PrivilegeNode[]> = {}

    nodes.forEach((node) => {
      if (!nodesByDepth[node.depth]) {
        nodesByDepth[node.depth] = []
      }
      nodesByDepth[node.depth].push(node)
    })

    Object.keys(nodesByDepth)
      .map(Number)
      .sort((a, b) => a - b)
      .forEach((depth) => {
        const depthNodes = nodesByDepth[depth]
        const startY = (window.innerHeight || 600) / 2 - ((depthNodes.length - 1) * NODE_SPACING) / 2

        depthNodes.forEach((node, index) => {
          positions.push({
            x: 100 + depth * DEPTH_SPACING,
            y: startY + index * NODE_SPACING,
            node,
          })
        })
      })

    return positions
  }, [nodes])

  const selectedNodeData = useMemo(() => {
    if (!selectedNode) return null
    return nodes.find((n) => n.id === selectedNode)
  }, [selectedNode, nodes])

  const connectedEdges = useMemo(() => {
    if (!selectedNode && !hoveredNode) return edges
    const focusId = selectedNode || hoveredNode
    return edges.filter((e) => e.from === focusId || e.to === focusId)
  }, [edges, selectedNode, hoveredNode])

  const handleNodeClick = (nodeId: string) => {
    setSelectedNode(selectedNode === nodeId ? null : nodeId)
    onNodeClick?.(nodeId)
  }

  const getNodeColor = (node: PrivilegeNode) => {
    switch (node.status) {
      case 'active':
        return 'bg-emerald-500 border-emerald-600'
      case 'pending':
        return 'bg-amber-500 border-amber-600'
      case 'eligible':
        return 'bg-blue-500 border-blue-600'
      case 'not-eligible':
        return 'bg-gray-400 border-gray-500'
      default:
        return 'bg-gray-300 border-gray-400'
    }
  }

  const getNodeIcon = (node: PrivilegeNode) => {
    switch (node.category) {
      case 'privilege':
        return <Target className="h-5 w-5" />
      case 'procedure':
        return <FileText className="h-5 w-5" />
      case 'certification':
        return <CheckCircle2 className="h-5 w-5" />
      default:
        return <AlertCircle className="h-5 w-5" />
    }
  }

  const getEdgeColor = (edge: PathwayEdge) => {
    switch (edge.type) {
      case 'prerequisite':
        return 'stroke-blue-600'
      case 'recommended':
        return 'stroke-emerald-600'
      case 'blocking':
        return 'stroke-rose-600'
      default:
        return 'stroke-gray-400'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <Card
        className="relative w-[95vw] h-[90vh] max-w-7xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="flex flex-row items-center justify-between border-b">
          <div>
            <CardTitle>Competency Pathway</CardTitle>
            <CardDescription>
              {clinicianName ? `Privilege depth and procedure logs for ${clinicianName}` : 'Visual DAG of privilege depth, procedure logs, and readiness to expand privilege set'}
            </CardDescription>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close overlay">
              <X className="h-4 w-4" />
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-6">
          <div className="relative w-full h-full">
            <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${Math.max(...positionedNodes.map((p) => p.x)) + 200} ${Math.max(...positionedNodes.map((p) => p.y)) + 100}`}>
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="10"
                  refX="9"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3, 0 6" fill="currentColor" />
                </marker>
              </defs>
              {connectedEdges.map((edge) => {
                const fromPos = positionedNodes.find((p) => p.node.id === edge.from)
                const toPos = positionedNodes.find((p) => p.node.id === edge.to)
                if (!fromPos || !toPos) return null

                const x1 = fromPos.x + NODE_SIZE / 2
                const y1 = fromPos.y + NODE_SIZE / 2
                const x2 = toPos.x + NODE_SIZE / 2
                const y2 = toPos.y + NODE_SIZE / 2

                return (
                  <line
                    key={`${edge.from}-${edge.to}`}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    strokeWidth={edge.weight ? 2 + edge.weight : 2}
                    className={getEdgeColor(edge)}
                    markerEnd="url(#arrowhead)"
                    opacity={selectedNode || hoveredNode ? 1 : 0.3}
                  />
                )
              })}
            </svg>

            <div className="relative w-full h-full">
              {positionedNodes.map((pos) => {
                const isSelected = selectedNode === pos.node.id
                const isHovered = hoveredNode === pos.node.id
                const isConnected = selectedNode && connectedEdges.some((e) => e.from === pos.node.id || e.to === pos.node.id)

                return (
                  <div
                    key={pos.node.id}
                    className={cn(
                      'absolute flex flex-col items-center justify-center cursor-pointer transition-all',
                      isSelected && 'z-10 scale-110',
                      isHovered && !isSelected && 'z-5 scale-105',
                    )}
                    style={{
                      left: `${pos.x}px`,
                      top: `${pos.y}px`,
                      width: `${NODE_SIZE}px`,
                      height: `${NODE_SIZE}px`,
                    }}
                    onClick={() => handleNodeClick(pos.node.id)}
                    onMouseEnter={() => setHoveredNode(pos.node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                  >
                    <div
                      className={cn(
                        'w-full h-full rounded-full border-2 flex flex-col items-center justify-center text-white shadow-lg',
                        getNodeColor(pos.node),
                        isSelected && 'ring-4 ring-primary ring-offset-2',
                        isHovered && !isSelected && 'ring-2 ring-primary/50',
                        !selectedNode && !hoveredNode && 'opacity-100',
                        selectedNode && !isSelected && !isConnected && 'opacity-30',
                      )}
                    >
                      {getNodeIcon(pos.node)}
                      <span className="text-xs font-semibold mt-1 text-center px-1 truncate w-full">
                        {pos.node.label}
                      </span>
                    </div>
                    {pos.node.readinessScore !== undefined && (
                      <Badge
                        variant="secondary"
                        className="mt-1 text-xs"
                      >
                        {pos.node.readinessScore}% ready
                      </Badge>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>

        {selectedNodeData && (
          <div className="border-t p-4 bg-muted/30">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg">{selectedNodeData.label}</h3>
                  <Badge
                    variant={
                      selectedNodeData.status === 'active'
                        ? 'default'
                        : selectedNodeData.status === 'eligible'
                        ? 'secondary'
                        : selectedNodeData.status === 'pending'
                        ? 'outline'
                        : 'secondary'
                    }
                  >
                    {selectedNodeData.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Depth: {selectedNodeData.depth} • Category: {selectedNodeData.category}
                </p>
                {selectedNodeData.procedureCount !== undefined && (
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedNodeData.procedureCount} procedures logged</span>
                  </div>
                )}
                {selectedNodeData.lastPerformed && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>Last performed: {new Date(selectedNodeData.lastPerformed).toLocaleDateString()}</span>
                  </div>
                )}
                {selectedNodeData.readinessScore !== undefined && (
                  <div className="flex items-center gap-2 text-sm">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span>Readiness: {selectedNodeData.readinessScore}%</span>
                  </div>
                )}
                {selectedNodeData.requirements && selectedNodeData.requirements.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Requirements</p>
                    <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                      {selectedNodeData.requirements.map((req, idx) => (
                        <li key={idx}>{req}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedNode(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <div className="border-t p-4 bg-muted/30">
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-emerald-500 border-2 border-emerald-600" />
              <span>Active</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-amber-500 border-2 border-amber-600" />
              <span>Pending</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-blue-600" />
              <span>Eligible</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-gray-400 border-2 border-gray-500" />
              <span>Not Eligible</span>
            </div>
            <div className="ml-4 flex items-center gap-2">
              <div className="w-8 h-0.5 bg-blue-600" />
              <span>Prerequisite</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-emerald-600" />
              <span>Recommended</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-rose-600" />
              <span>Blocking</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

