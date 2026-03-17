'use client';

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import type { GraphEdge, GraphNode } from './types';
import {
  resolveEdgeStrength,
  resolveGraphZoomBand,
  type GraphViewportState,
} from './viewportModel';
import { LINK_CLASS_STYLES, resolveNodeColor } from '@/components/graph/graphPalette';
import { useGraphPhysics } from '@/components/graph/hooks/useGraphPhysics';
import { useTippyGraph } from '@/components/graph/hooks/useTippyGraph';
import { motionDurations } from '@/ui/animation/motion';
import { themeTypography } from '@/ui/theme/typography';
import {
  classifyEdgeType,
  type GraphPhysicsState,
  type GraphVisualState,
} from '@/components/graph/state/graphDisplayState';

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  physics: GraphPhysicsState;
  visuals: GraphVisualState;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  selectedEdgeId?: string | null;
  hoveredEdgeId?: string | null;
  highlightedNodeIds: Set<string>;
  highlightedEdgeIds: Set<string>;
  onSelectNode: (id: string | null) => void;
  onSelectEdge?: (id: string | null) => void;
  onHoverNode: (id: string | null) => void;
  onHoverEdge?: (id: string | null) => void;
  onDoubleClickNode: (id: string) => void;
  onDragNode: (id: string, x: number, y: number) => void;
  onPinNode: (id: string, x: number, y: number) => void;
  onViewportChange?: (viewport: GraphViewportState) => void;
  onHoverDetailChange?: (detail: GraphHoverDetail | null) => void;
  onEdgeHoverDetailChange?: (detail: GraphEdgeHoverDetail | null) => void;
  onLayoutSnapshotChange?: (snapshot: GraphLayoutSnapshot | null) => void;
  disableInternalTooltip?: boolean;
  width: number;
  height: number;
  layoutVersion?: number;
  layoutScopeKey?: string;
  nodeCap?: number;
  edgeCap?: number;
  miniMapThrottleMs?: number;
}

export interface GraphHoverDetail {
  node: GraphNode;
  screenX: number;
  screenY: number;
  relationshipCount: number;
}

export interface GraphEdgeHoverDetail {
  edge: GraphEdge;
  screenX: number;
  screenY: number;
  sourceNode: GraphNode | null;
  targetNode: GraphNode | null;
}

export interface GraphLayoutSnapshot {
  nodes: Array<{
    id: string;
    x: number;
    y: number;
    type: GraphNode['type'];
    highlighted: boolean;
  }>;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  viewport: GraphViewportState;
}

interface DragState {
  nodeId: string;
  offsetX: number;
  offsetY: number;
  moved: boolean;
}

interface CanvasMetrics {
  width: number;
  height: number;
  devicePixelRatio: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export default React.memo(function GraphCanvas({
  nodes: rawNodes,
  edges: rawEdges,
  physics,
  visuals,
  selectedNodeId,
  hoveredNodeId,
  selectedEdgeId = null,
  hoveredEdgeId = null,
  highlightedNodeIds,
  highlightedEdgeIds,
  onSelectNode,
  onSelectEdge,
  onHoverNode,
  onHoverEdge,
  onDoubleClickNode,
  onDragNode,
  onPinNode,
  onViewportChange,
  onHoverDetailChange,
  onEdgeHoverDetailChange,
  onLayoutSnapshotChange,
  disableInternalTooltip = false,
  width,
  height,
  layoutVersion = 0,
  layoutScopeKey,
  nodeCap = 500,
  edgeCap = 1000,
  miniMapThrottleMs = 140,
}: Props) {
  const nodes = useMemo(
    () => (rawNodes.length > nodeCap ? rawNodes.slice(0, nodeCap) : rawNodes),
    [nodeCap, rawNodes],
  );
  const edges = useMemo(() => {
    const subset = rawEdges.length > edgeCap ? rawEdges.slice(0, edgeCap) : rawEdges;
    const nodeIds = new Set(nodes.map((node) => node.id));
    return subset.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));
  }, [edgeCap, nodes, rawEdges]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  const cameraRef = useRef({ x: 0, y: 0, zoom: 1 });
  const canvasMetricsRef = useRef<CanvasMetrics>({
    width: 0,
    height: 0,
    devicePixelRatio: 1,
  });
  const highlightProgressRef = useRef(new Map<string, number>());
  const lastFrameTimeRef = useRef<number | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const panStartRef = useRef({ x: 0, y: 0, cameraX: 0, cameraY: 0 });
  const isPanningRef = useRef(false);
  const viewportRef = useRef<GraphViewportState>({
    x: 0,
    y: 0,
    zoom: 1,
    zoomBand: 'network',
  });
  const hoveredNodeRef = useRef<string | null>(null);
  const hoveredEdgeRef = useRef<string | null>(null);
  const interactionRef = useRef({
    selectedNodeId,
    hoveredNodeId,
    selectedEdgeId,
    hoveredEdgeId,
    highlightedNodeIds,
    highlightedEdgeIds,
  });
  const callbacksRef = useRef({
    onSelectNode,
    onSelectEdge,
    onHoverNode,
    onHoverEdge,
    onHoverDetailChange,
    onEdgeHoverDetailChange,
    onLayoutSnapshotChange,
  });
  const lastMiniMapEmitRef = useRef(0);

  const relationshipCountByNodeId = useMemo(() => {
    const counts = new Map<string, number>();

    for (const edge of edges) {
      counts.set(edge.source, (counts.get(edge.source) ?? 0) + 1);
      counts.set(edge.target, (counts.get(edge.target) ?? 0) + 1);
    }

    return counts;
  }, [edges]);

  const nodesById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  );

  useEffect(() => {
    interactionRef.current = {
      selectedNodeId,
      hoveredNodeId,
      selectedEdgeId,
      hoveredEdgeId,
      highlightedNodeIds,
      highlightedEdgeIds,
    };
  }, [
    highlightedEdgeIds,
    highlightedNodeIds,
    hoveredEdgeId,
    hoveredNodeId,
    selectedEdgeId,
    selectedNodeId,
  ]);

  useEffect(() => {
    callbacksRef.current = {
      onSelectNode,
      onSelectEdge,
      onHoverNode,
      onHoverEdge,
      onHoverDetailChange,
      onEdgeHoverDetailChange,
      onLayoutSnapshotChange,
    };
  }, [
    onEdgeHoverDetailChange,
    onHoverDetailChange,
    onHoverEdge,
    onHoverNode,
    onLayoutSnapshotChange,
    onSelectEdge,
    onSelectNode,
  ]);

  const { simNodesRef, tick, updateNodePosition } = useGraphPhysics({
    nodes,
    edges,
    width,
    height,
    physics,
    visuals,
    selectedNodeId,
    layoutVersion,
    layoutScopeKey,
  });

  const { showTooltip, hideTooltip } = useTippyGraph(canvasRef);

  const emitViewportChange = useCallback(() => {
    const nextViewport: GraphViewportState = {
      x: cameraRef.current.x,
      y: cameraRef.current.y,
      zoom: cameraRef.current.zoom,
      zoomBand: resolveGraphZoomBand(cameraRef.current.zoom),
    };

    const previousViewport = viewportRef.current;
    const hasMeaningfulChange = (
      previousViewport.zoomBand !== nextViewport.zoomBand ||
      Math.abs(previousViewport.zoom - nextViewport.zoom) > 0.01 ||
      Math.abs(previousViewport.x - nextViewport.x) > 8 ||
      Math.abs(previousViewport.y - nextViewport.y) > 8
    );

    if (!hasMeaningfulChange) {
      return;
    }

    viewportRef.current = nextViewport;
    onViewportChange?.(nextViewport);
  }, [onViewportChange]);

  const screenToWorld = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    const { x, y, zoom } = cameraRef.current;
    return {
      worldX: ((clientX - rect.left - width / 2 - x) / zoom) + width / 2,
      worldY: ((clientY - rect.top - height / 2 - y) / zoom) + height / 2,
    };
  }, [height, width]);

  const hitTest = useCallback((clientX: number, clientY: number): string | null => {
    const world = screenToWorld(clientX, clientY);
    if (!world) {
      return null;
    }

    const { worldX, worldY } = world;

    for (const node of simNodesRef.current) {
      const dx = (node.x ?? 0) - worldX;
      const dy = (node.y ?? 0) - worldY;
      const radius = Math.max(8, (node.radius ?? 8) + 4);
      if (dx * dx + dy * dy <= radius * radius) {
        return node.id;
      }
    }

    return null;
  }, [screenToWorld, simNodesRef]);

  const hitTestEdge = useCallback((clientX: number, clientY: number): string | null => {
    const world = screenToWorld(clientX, clientY);
    if (!world) {
      return null;
    }

    const tolerance = Math.max(10, 14 / Math.max(cameraRef.current.zoom, 0.6));
    let bestEdgeId: string | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    const simNodesById = new Map(simNodesRef.current.map((node) => [node.id, node]));

    for (const edge of edges) {
      const source = simNodesById.get(edge.source);
      const target = simNodesById.get(edge.target);
      if (!source || !target || edge.visible === false) {
        continue;
      }

      const startX = source.x ?? 0;
      const startY = source.y ?? 0;
      const endX = target.x ?? 0;
      const endY = target.y ?? 0;
      const dx = endX - startX;
      const dy = endY - startY;
      const lengthSquared = (dx * dx) + (dy * dy);
      if (lengthSquared === 0) {
        continue;
      }

      const projection = clamp(
        (((world.worldX - startX) * dx) + ((world.worldY - startY) * dy)) / lengthSquared,
        0,
        1,
      );
      const projectedX = startX + (projection * dx);
      const projectedY = startY + (projection * dy);
      const distance = Math.hypot(world.worldX - projectedX, world.worldY - projectedY);

      if (distance <= tolerance && distance < bestDistance) {
        bestDistance = distance;
        bestEdgeId = edge.id;
      }
    }

    return bestEdgeId;
  }, [edges, screenToWorld, simNodesRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    let mounted = true;

    const render = () => {
      if (!mounted) {
        return;
      }

      const devicePixelRatio = window.devicePixelRatio || 1;
      const shouldResizeCanvas =
        canvasMetricsRef.current.width !== width ||
        canvasMetricsRef.current.height !== height ||
        canvasMetricsRef.current.devicePixelRatio !== devicePixelRatio;

      if (shouldResizeCanvas) {
        canvas.width = width * devicePixelRatio;
        canvas.height = height * devicePixelRatio;
        context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
        canvasMetricsRef.current = {
          width,
          height,
          devicePixelRatio,
        };
      }

      const frameStartedAt = performance.now();
      const previousFrameStartedAt = lastFrameTimeRef.current ?? frameStartedAt;
      const deltaMs = frameStartedAt - previousFrameStartedAt;
      lastFrameTimeRef.current = frameStartedAt;
      context.clearRect(0, 0, width, height);

      const simulationNodes = visuals.animate && !physics.frozen ? tick() : simNodesRef.current;
      const nodeMap = new Map(simulationNodes.map((node) => [node.id, node]));
      const colorMap = new Map(
        simulationNodes.map((node) => [node.id, resolveNodeColor(node, edges, visuals.colorMode)]),
      );
      const {
        selectedNodeId: selectedNodeIdCurrent,
        hoveredNodeId: hoveredNodeIdCurrent,
        selectedEdgeId: selectedEdgeIdCurrent,
        hoveredEdgeId: hoveredEdgeIdCurrent,
        highlightedNodeIds: highlightedNodeIdsCurrent,
        highlightedEdgeIds: highlightedEdgeIdsCurrent,
      } = interactionRef.current;
      const highlightLerp = Math.min(1, deltaMs / (motionDurations.highlight * 1000));
      const camera = cameraRef.current;
      const zoomBand = resolveGraphZoomBand(camera.zoom);

      for (const nodeId of highlightProgressRef.current.keys()) {
        if (!nodeMap.has(nodeId)) {
          highlightProgressRef.current.delete(nodeId);
        }
      }

      context.save();
      context.translate(width / 2 + camera.x, height / 2 + camera.y);
      context.scale(camera.zoom, camera.zoom);
      context.translate(-width / 2, -height / 2);

      for (const edge of edges) {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);

        if (!source || !target || edge.visible === false) {
          continue;
        }

        const linkClass = classifyEdgeType(edge);
        const style = LINK_CLASS_STYLES[linkClass];
        const isHighlighted = highlightedEdgeIdsCurrent.has(edge.id);
        const isFocused = isHighlighted || edge.id === selectedEdgeIdCurrent || edge.id === hoveredEdgeIdCurrent;
        const isDimmed = (
          selectedNodeIdCurrent != null
          || hoveredNodeIdCurrent != null
          || selectedEdgeIdCurrent != null
          || hoveredEdgeIdCurrent != null
        ) && !isFocused;
        const edgeStrength = resolveEdgeStrength(edge);
        const sourceX = source.x ?? 0;
        const sourceY = source.y ?? 0;
        const targetX = target.x ?? 0;
        const targetY = target.y ?? 0;

        context.save();
        context.beginPath();
        context.moveTo(sourceX, sourceY);
        context.lineTo(targetX, targetY);
        context.setLineDash(style.dash);
        context.strokeStyle = style.stroke;
        context.globalAlpha = isFocused
          ? Math.min(0.96, 0.78 + (edgeStrength * 0.18))
          : isDimmed
            ? 0.1
            : (
              zoomBand === 'overview'
                ? 0.16 + (edgeStrength * 0.18)
                : zoomBand === 'evidence'
                  ? 0.26 + (edgeStrength * 0.28)
                  : 0.22 + (edgeStrength * 0.22)
            );
        context.lineWidth = visuals.linkThickness
          * (0.7 + (edgeStrength * 1.35))
          * (zoomBand === 'overview' ? 0.82 : zoomBand === 'evidence' ? 1.14 : 1)
          * (isFocused ? 1.45 : 1);
        context.stroke();

        if (visuals.showArrows && edge.directed) {
          const angle = Math.atan2(targetY - sourceY, targetX - sourceX);
          const arrowLength = 8;
          const arrowX = targetX - Math.cos(angle) * ((target.radius ?? 8) + 6);
          const arrowY = targetY - Math.sin(angle) * ((target.radius ?? 8) + 6);

          context.beginPath();
          context.moveTo(arrowX, arrowY);
          context.lineTo(
            arrowX - arrowLength * Math.cos(angle - 0.35),
            arrowY - arrowLength * Math.sin(angle - 0.35),
          );
          context.lineTo(
            arrowX - arrowLength * Math.cos(angle + 0.35),
            arrowY - arrowLength * Math.sin(angle + 0.35),
          );
          context.closePath();
          context.fillStyle = style.stroke;
          context.fill();
        }

        context.restore();
      }

      for (const node of simulationNodes) {
        const radius = Math.max(8, node.radius ?? visuals.nodeSize);
        const isSelected = node.id === selectedNodeIdCurrent;
        const isHovered = node.id === hoveredNodeIdCurrent;
        const isFocusedNeighbor = highlightedNodeIdsCurrent.has(node.id);
        const isDimmed = (
          selectedNodeIdCurrent != null
          || hoveredNodeIdCurrent != null
          || selectedEdgeIdCurrent != null
          || hoveredEdgeIdCurrent != null
        ) && !isFocusedNeighbor;
        const highlightTarget = isSelected ? 1 : isHovered ? 0.8 : isFocusedNeighbor ? 0.4 : 0;
        const highlightProgress = (
          (highlightProgressRef.current.get(node.id) ?? 0) +
          ((highlightTarget - (highlightProgressRef.current.get(node.id) ?? 0)) * highlightLerp)
        );
        const nodeColor = colorMap.get(node.id) ?? '#64748b';
        const nodeX = node.x ?? width / 2;
        const nodeY = node.y ?? height / 2;
        const animatedRadius = radius * (1 + (highlightProgress * 0.12));

        if (highlightProgress > 0.001 || highlightTarget > 0) {
          highlightProgressRef.current.set(node.id, highlightProgress);
        } else {
          highlightProgressRef.current.delete(node.id);
        }

        context.save();

        if (highlightProgress > 0.02) {
          const glowRadius = radius + 10 + (highlightProgress * 6);
          const glow = context.createRadialGradient(nodeX, nodeY, radius, nodeX, nodeY, glowRadius);
          glow.addColorStop(
            0,
            isSelected
              ? `rgba(250, 204, 21, ${0.18 + (highlightProgress * 0.24)})`
              : `rgba(96, 165, 250, ${0.14 + (highlightProgress * 0.18)})`,
          );
          glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
          context.fillStyle = glow;
          context.beginPath();
          context.arc(nodeX, nodeY, glowRadius, 0, Math.PI * 2);
          context.fill();
        }

        context.beginPath();
        context.arc(nodeX, nodeY, animatedRadius, 0, Math.PI * 2);
        context.fillStyle = nodeColor;
        context.globalAlpha = isDimmed ? 0.18 : 0.88 + (highlightProgress * 0.08);
        context.fill();

        context.lineWidth = node.fx != null && node.fy != null ? 2.2 : 1.2 + (highlightProgress * 0.6);
        context.strokeStyle = isSelected
          ? '#facc15'
          : node.fx != null && node.fy != null
            ? '#22d3ee'
            : 'rgba(226, 232, 240, 0.18)';
        context.stroke();

        const shouldShowLabel = visuals.showLabels && (
          isSelected ||
          isHovered ||
          (zoomBand === 'overview' && node.degree >= 8 && camera.zoom >= 0.62) ||
          (zoomBand === 'network' && node.degree >= 4 && camera.zoom >= 0.88) ||
          (zoomBand === 'evidence' && node.degree >= 2 && camera.zoom >= 1.08) ||
          camera.zoom >= 1.5
        );

        if (shouldShowLabel) {
          const label = node.label.length > 24 ? `${node.label.slice(0, 23)}…` : node.label;
          context.font = `${isSelected ? '700' : '600'} ${Math.max(10, 12 / camera.zoom)}px ${themeTypography.family.canvas}`;
          context.fillStyle = isDimmed ? 'rgba(148, 163, 184, 0.45)' : 'rgba(226, 232, 240, 0.95)';
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          context.fillText(label, nodeX, nodeY + animatedRadius + 13);
        }

        context.restore();
      }

      context.restore();

      const snapshotCallback = callbacksRef.current.onLayoutSnapshotChange;
      if (
        snapshotCallback
        && simulationNodes.length > 0
        && frameStartedAt - lastMiniMapEmitRef.current >= miniMapThrottleMs
      ) {
        const bounds = simulationNodes.reduce((accumulator, node) => ({
          minX: Math.min(accumulator.minX, node.x ?? 0),
          maxX: Math.max(accumulator.maxX, node.x ?? 0),
          minY: Math.min(accumulator.minY, node.y ?? 0),
          maxY: Math.max(accumulator.maxY, node.y ?? 0),
        }), {
          minX: Number.POSITIVE_INFINITY,
          maxX: Number.NEGATIVE_INFINITY,
          minY: Number.POSITIVE_INFINITY,
          maxY: Number.NEGATIVE_INFINITY,
        });

        snapshotCallback({
          nodes: simulationNodes.map((node) => ({
            id: node.id,
            x: node.x ?? 0,
            y: node.y ?? 0,
            type: node.type,
            highlighted: highlightedNodeIdsCurrent.has(node.id),
          })),
          bounds,
          viewport: viewportRef.current,
        });
        lastMiniMapEmitRef.current = frameStartedAt;
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      mounted = false;
      lastFrameTimeRef.current = null;
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [
    edges,
    height,
    physics.frozen,
    simNodesRef,
    tick,
    miniMapThrottleMs,
    visuals.animate,
    visuals.colorMode,
    visuals.linkThickness,
    visuals.nodeSize,
    visuals.showArrows,
    visuals.showLabels,
    width,
  ]);

  useEffect(() => {
    emitViewportChange();
  }, [emitViewportChange]);

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const nodeId = hitTest(event.clientX, event.clientY);
    if (nodeId) {
      const world = screenToWorld(event.clientX, event.clientY);
      if (!world) {
        return;
      }
      const node = simNodesRef.current.find((candidate) => candidate.id === nodeId);

      if (node) {
        dragRef.current = {
          nodeId,
          offsetX: (node.x ?? 0) - world.worldX,
          offsetY: (node.y ?? 0) - world.worldY,
          moved: false,
        };
      }

      return;
    }

    isPanningRef.current = true;
    panStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      cameraX: cameraRef.current.x,
      cameraY: cameraRef.current.y,
    };
  }, [hitTest, screenToWorld, simNodesRef]);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragRef.current) {
      const world = screenToWorld(event.clientX, event.clientY);
      if (!world) {
        return;
      }
      const nextX = world.worldX + dragRef.current.offsetX;
      const nextY = world.worldY + dragRef.current.offsetY;

      dragRef.current.moved = true;
      updateNodePosition(dragRef.current.nodeId, nextX, nextY, true);
      callbacksRef.current.onHoverDetailChange?.(null);
      callbacksRef.current.onEdgeHoverDetailChange?.(null);
      hideTooltip();
      return;
    }

    if (isPanningRef.current) {
      cameraRef.current.x = panStartRef.current.cameraX + (event.clientX - panStartRef.current.x);
      cameraRef.current.y = panStartRef.current.cameraY + (event.clientY - panStartRef.current.y);
      callbacksRef.current.onHoverDetailChange?.(null);
      callbacksRef.current.onEdgeHoverDetailChange?.(null);
      hideTooltip();
      return;
    }

    const nodeId = hitTest(event.clientX, event.clientY);
    if (hoveredNodeRef.current !== nodeId) {
      hoveredNodeRef.current = nodeId;
      callbacksRef.current.onHoverNode(nodeId);
    }

    if (nodeId) {
      const node = simNodesRef.current.find((candidate) => candidate.id === nodeId);
      if (!node) {
        callbacksRef.current.onHoverDetailChange?.(null);
        callbacksRef.current.onEdgeHoverDetailChange?.(null);
        hideTooltip();
        return;
      }

      const relationshipCount = relationshipCountByNodeId.get(nodeId) ?? 0;
      callbacksRef.current.onHoverDetailChange?.({
        node,
        screenX: event.clientX,
        screenY: event.clientY,
        relationshipCount,
      });
      callbacksRef.current.onHoverEdge?.(null);
      callbacksRef.current.onEdgeHoverDetailChange?.(null);
      hoveredEdgeRef.current = null;

      if (!disableInternalTooltip) {
        showTooltip(
          node,
          { clientX: event.clientX, clientY: event.clientY },
          relationshipCount,
        );
      } else {
        hideTooltip();
      }
      return;
    }

    callbacksRef.current.onHoverDetailChange?.(null);
    hideTooltip();

    const edgeId = hitTestEdge(event.clientX, event.clientY);
    if (hoveredEdgeRef.current !== edgeId) {
      hoveredEdgeRef.current = edgeId;
      callbacksRef.current.onHoverEdge?.(edgeId);
    }

    if (!edgeId) {
      callbacksRef.current.onEdgeHoverDetailChange?.(null);
      return;
    }
    const edge = edges.find((candidate) => candidate.id === edgeId) ?? null;
    callbacksRef.current.onEdgeHoverDetailChange?.(edge ? {
      edge,
      screenX: event.clientX,
      screenY: event.clientY,
      sourceNode: nodesById.get(edge.source) ?? null,
      targetNode: nodesById.get(edge.target) ?? null,
    } : null);
  }, [
    disableInternalTooltip,
    edges,
    hideTooltip,
    hitTest,
    hitTestEdge,
    nodesById,
    relationshipCountByNodeId,
    screenToWorld,
    showTooltip,
    simNodesRef,
    updateNodePosition,
  ]);

  const handleMouseUp = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragRef.current) {
      const { nodeId, moved } = dragRef.current;
      const node = simNodesRef.current.find((candidate) => candidate.id === nodeId);

      if (node) {
        onDragNode(nodeId, node.x ?? 0, node.y ?? 0);
        if (moved) {
          onPinNode(nodeId, node.x ?? 0, node.y ?? 0);
        } else {
          callbacksRef.current.onSelectEdge?.(null);
          callbacksRef.current.onSelectNode(nodeId);
        }
      }

      dragRef.current = null;
      return;
    }

    if (isPanningRef.current) {
      isPanningRef.current = false;
      emitViewportChange();
      return;
    }

    const nodeId = hitTest(event.clientX, event.clientY);
    if (nodeId) {
      callbacksRef.current.onSelectEdge?.(null);
      callbacksRef.current.onSelectNode(nodeId);
      return;
    }

    const edgeId = hitTestEdge(event.clientX, event.clientY);
    if (edgeId) {
      callbacksRef.current.onSelectNode(null);
      callbacksRef.current.onSelectEdge?.(edgeId);
      return;
    }

    callbacksRef.current.onSelectNode(null);
    callbacksRef.current.onSelectEdge?.(null);
  }, [emitViewportChange, hitTest, hitTestEdge, onDragNode, onPinNode, simNodesRef]);

  const handleDoubleClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const nodeId = hitTest(event.clientX, event.clientY);
    if (nodeId) {
      onDoubleClickNode(nodeId);
    }
  }, [hitTest, onDoubleClickNode]);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const camera = cameraRef.current;
    const previousZoom = camera.zoom;
    const nextZoom = clamp(previousZoom * (event.deltaY > 0 ? 0.92 : 1.08), 0.35, 3.5);
    const worldX = ((mouseX - width / 2 - camera.x) / previousZoom) + width / 2;
    const worldY = ((mouseY - height / 2 - camera.y) / previousZoom) + height / 2;

    camera.zoom = nextZoom;
    camera.x = mouseX - width / 2 - (worldX - width / 2) * nextZoom;
    camera.y = mouseY - height / 2 - (worldY - height / 2) * nextZoom;
    emitViewportChange();
  }, [emitViewportChange, height, width]);

  return (
    <canvas
      ref={canvasRef}
      className="vital-graph-canvas"
      height={height}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
      onMouseLeave={() => {
        hoveredNodeRef.current = null;
        hoveredEdgeRef.current = null;
        callbacksRef.current.onHoverNode(null);
        callbacksRef.current.onHoverEdge?.(null);
        callbacksRef.current.onHoverDetailChange?.(null);
        callbacksRef.current.onEdgeHoverDetailChange?.(null);
        hideTooltip();
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      style={{
        cursor: dragRef.current || isPanningRef.current
          ? 'grabbing'
          : hoveredNodeId || hoveredEdgeId
            ? 'pointer'
            : 'grab',
        height,
        width,
      }}
      width={width}
    />
  );
});
