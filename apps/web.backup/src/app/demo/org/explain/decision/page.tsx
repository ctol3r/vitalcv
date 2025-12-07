'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, ArrowRight, ChevronDown, ChevronRight, FileText, GitBranch, Play, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface ExplanationNode {
  id: string
  type: string
  label: string
  timestamp: string
  data: Record<string, unknown>
}

interface ExplanationEdge {
  id: string
  source: string
  target: string
  type: string
  label?: string
}

interface ExplanationGraph {
  id: string
  createdAt: string
  rootNodeId: string
  nodes: ExplanationNode[]
  edges: ExplanationEdge[]
}

interface DecisionNarrative {
  id: string
  title: string
  createdAt: string
  executiveSummary: string
  sections: Array<{
    type: string
    title: string
    content: string
    nodeIds: string[]
    policyReferences?: string[]
  }>
  fullText: string
}

export default function DecisionExplorerPage() {
  const searchParams = useSearchParams()
  const decisionId = searchParams.get('id')

  const [graph, setGraph] = useState<ExplanationGraph | null>(null)
  const [narrative, setNarrative] = useState<DecisionNarrative | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    if (!decisionId) {
      setError('No decision ID provided')
      setLoading(false)
      return
    }

    loadDecisionExplanation(decisionId)
  }, [decisionId])

  async function loadDecisionExplanation(id: string) {
    setLoading(true)
    setError(null)
    try {
      // In a real implementation, this would fetch from an API endpoint
      // For now, using mock data structure
      const response = await fetch(`/api/demo/org/explain/decision?id=${id}`)
      if (!response.ok) {
        throw new Error(`Failed to load decision explanation (${response.status})`)
      }
      const data = await response.json()
      setGraph(data.graph)
      setNarrative(data.narrative)
      if (data.graph?.rootNodeId) {
        setSelectedNodeId(data.graph.rootNodeId)
        setExpandedNodes(new Set([data.graph.rootNodeId]))
      }
    } catch (err: any) {
      setError(err.message ?? 'Unable to load decision explanation')
    } finally {
      setLoading(false)
    }
  }

  function toggleNodeExpansion(nodeId: string) {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId)
    } else {
      newExpanded.add(nodeId)
    }
    setExpandedNodes(newExpanded)
  }

  function getNodeTypeColor(type: string): string {
    switch (type) {
      case 'supervisor_decision':
        return 'bg-blue-100 text-blue-800'
      case 'signal_collection':
        return 'bg-green-100 text-green-800'
      case 'rule_evaluation':
        return 'bg-yellow-100 text-yellow-800'
      case 'module_invocation':
        return 'bg-purple-100 text-purple-800'
      case 'kernel_execution':
        return 'bg-orange-100 text-orange-800'
      case 'outcome':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  function getNodeChildren(nodeId: string): ExplanationNode[] {
    if (!graph) return []
    const childIds = graph.edges
      .filter((e) => e.source === nodeId)
      .map((e) => e.target)
    return graph.nodes.filter((n) => childIds.includes(n.id))
  }

  function renderNodeTree(nodeId: string, depth: number = 0): JSX.Element | null {
    if (!graph) return null

    const node = graph.nodes.find((n) => n.id === nodeId)
    if (!node) return null

    const children = getNodeChildren(nodeId)
    const isExpanded = expandedNodes.has(nodeId)
    const isSelected = selectedNodeId === nodeId

    return (
      <div key={nodeId} className="mb-2">
        <div
          className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-50 ${
            isSelected ? 'bg-blue-50 border border-blue-200' : ''
          }`}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
          onClick={() => setSelectedNodeId(nodeId)}
        >
          {children.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleNodeExpansion(nodeId)
              }}
              className="p-1 hover:bg-gray-200 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          )}
          {children.length === 0 && <div className="w-6" />}
          <Badge className={getNodeTypeColor(node.type)}>{node.type}</Badge>
          <span className="flex-1 font-medium">{node.label}</span>
          <span className="text-xs text-gray-500">
            {new Date(node.timestamp).toLocaleTimeString()}
          </span>
        </div>
        {isExpanded && children.length > 0 && (
          <div className="ml-4 border-l-2 border-gray-200">
            {children.map((child) => renderNodeTree(child.id, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  function getStepNodes(): ExplanationNode[] {
    if (!graph) return []

    // Build execution path from root to selected node
    const path: ExplanationNode[] = []
    const visited = new Set<string>()

    function buildPath(nodeId: string) {
      if (visited.has(nodeId)) return
      visited.add(nodeId)

      const node = graph.nodes.find((n) => n.id === nodeId)
      if (node) {
        path.push(node)

        const children = getNodeChildren(nodeId)
        if (children.length > 0) {
          buildPath(children[0].id) // Follow first child
        }
      }
    }

    if (graph.rootNodeId) {
      buildPath(graph.rootNodeId)
    }

    return path
  }

  const stepNodes = getStepNodes()

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600">{error}</p>
            <Button onClick={() => decisionId && loadDecisionExplanation(decisionId)} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!graph || !narrative) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>No Data</CardTitle>
          </CardHeader>
          <CardContent>
            <p>No explanation data available for this decision.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const selectedNode = graph.nodes.find((n) => n.id === selectedNodeId)
  const selectedEdges = graph.edges.filter(
    (e) => e.source === selectedNodeId || e.target === selectedNodeId
  )

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Decision Explorer</h1>
          <p className="text-gray-600 mt-1">
            Interactive view of decision reasoning and execution flow
          </p>
        </div>
        <Button onClick={() => decisionId && loadDecisionExplanation(decisionId)}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="graph" className="space-y-4">
        <TabsList>
          <TabsTrigger value="graph">Graph View</TabsTrigger>
          <TabsTrigger value="narrative">Narrative</TabsTrigger>
          <TabsTrigger value="step-through">Step Through</TabsTrigger>
        </TabsList>

        <TabsContent value="graph" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Decision Tree</CardTitle>
                <CardDescription>Click nodes to explore</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-[600px] overflow-y-auto">
                  {graph.rootNodeId && renderNodeTree(graph.rootNodeId)}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>
                  {selectedNode ? selectedNode.label : 'Select a Node'}
                </CardTitle>
                <CardDescription>
                  {selectedNode && `Type: ${selectedNode.type}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedNode && (
                  <>
                    <div>
                      <h3 className="font-semibold mb-2">Details</h3>
                      <div className="bg-gray-50 p-4 rounded">
                        <pre className="text-sm overflow-x-auto">
                          {JSON.stringify(selectedNode.data, null, 2)}
                        </pre>
                      </div>
                    </div>

                    {selectedEdges.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-2">Connections</h3>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Type</TableHead>
                              <TableHead>From</TableHead>
                              <TableHead>To</TableHead>
                              <TableHead>Label</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedEdges.map((edge) => {
                              const sourceNode = graph.nodes.find((n) => n.id === edge.source)
                              const targetNode = graph.nodes.find((n) => n.id === edge.target)
                              return (
                                <TableRow key={edge.id}>
                                  <TableCell>
                                    <Badge variant="outline">{edge.type}</Badge>
                                  </TableCell>
                                  <TableCell>{sourceNode?.label || edge.source}</TableCell>
                                  <TableCell>{targetNode?.label || edge.target}</TableCell>
                                  <TableCell>{edge.label || '-'}</TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="narrative" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{narrative.title}</CardTitle>
              <CardDescription>
                Created: {new Date(narrative.createdAt).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold text-lg mb-2">Executive Summary</h3>
                <p className="text-gray-700">{narrative.executiveSummary}</p>
              </div>

              {narrative.sections.map((section, idx) => (
                <div key={idx} className="border-l-4 border-blue-500 pl-4">
                  <h3 className="font-semibold text-lg mb-2">{section.title}</h3>
                  <div className="text-gray-700 whitespace-pre-wrap">{section.content}</div>
                  {section.policyReferences && section.policyReferences.length > 0 && (
                    <div className="mt-2">
                      <span className="text-sm font-semibold">Policy References: </span>
                      {section.policyReferences.map((ref, i) => (
                        <Badge key={i} variant="outline" className="mr-2">
                          {ref}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="step-through" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Step Through Reasoning</CardTitle>
              <CardDescription>
                Step {currentStep + 1} of {stepNodes.length}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {stepNodes.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <Button
                      onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                      disabled={currentStep === 0}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Previous
                    </Button>
                    <Button
                      onClick={() =>
                        setCurrentStep(Math.min(stepNodes.length - 1, currentStep + 1))
                      }
                      disabled={currentStep === stepNodes.length - 1}
                    >
                      Next
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>

                  <div className="border rounded-lg p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Badge className={getNodeTypeColor(stepNodes[currentStep].type)}>
                        {stepNodes[currentStep].type}
                      </Badge>
                      <h3 className="text-xl font-semibold">
                        {stepNodes[currentStep].label}
                      </h3>
                    </div>
                    <div className="text-sm text-gray-600 mb-4">
                      {new Date(stepNodes[currentStep].timestamp).toLocaleString()}
                    </div>
                    <div className="bg-gray-50 p-4 rounded">
                      <pre className="text-sm overflow-x-auto">
                        {JSON.stringify(stepNodes[currentStep].data, null, 2)}
                      </pre>
                    </div>
                  </div>

                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {stepNodes.map((node, idx) => (
                      <button
                        key={node.id}
                        onClick={() => setCurrentStep(idx)}
                        className={`px-4 py-2 rounded text-sm whitespace-nowrap ${
                          idx === currentStep
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 hover:bg-gray-200'
                        }`}
                      >
                        Step {idx + 1}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

