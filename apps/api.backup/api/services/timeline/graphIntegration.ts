import type { TimelineEvent } from './types'
import type { CredentialGraph, GraphEdge, GraphNode } from '../graph/credential/types'

export interface TimelineGraphProjection {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export function projectTimelineToGraph(events: TimelineEvent[]): TimelineGraphProjection {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []

  const ordered = [...events].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

  ordered.forEach((event, index) => {
    const nodeId = `timeline:${event.id}`
    nodes.push({
      id: nodeId,
      type: 'timeline_event',
      label: event.title,
      status: event.status,
      metadata: {
        phase: event.phase,
        type: event.type,
        timestamp: event.timestamp.toISOString(),
        source: event.source,
        summary: event.summary,
      },
    })

    if (index > 0) {
      const prev = ordered[index - 1]
      edges.push({
        id: `timeline:${prev.id}->${event.id}`,
        source: `timeline:${prev.id}`,
        target: nodeId,
        type: 'chronology',
        active: true,
        metadata: {
          gapHours: (event.timestamp.getTime() - prev.timestamp.getTime()) / (1000 * 60 * 60),
        },
      })
    }
  })

  return { nodes, edges }
}

export function mergeTimelineProjection(
  graph: CredentialGraph,
  projection: TimelineGraphProjection,
  clinicianNodeId: string,
): CredentialGraph {
  const seenNodeIds = new Set(graph.nodes.map((node) => node.id))
  const mergedNodes = [...graph.nodes]
  const mergedEdges = [...graph.edges]

  projection.nodes.forEach((node) => {
    if (!seenNodeIds.has(node.id)) {
      mergedNodes.push(node)
      seenNodeIds.add(node.id)
    }
  })

  mergedEdges.push(...projection.edges)

  if (projection.nodes.length) {
    mergedEdges.push({
      id: `timeline-anchor:${clinicianNodeId}`,
      source: clinicianNodeId,
      target: projection.nodes[0].id,
      type: 'chronology',
      active: true,
      metadata: { anchor: true },
    })
  }

  return {
    ...graph,
    nodes: mergedNodes,
    edges: mergedEdges,
  }
}
