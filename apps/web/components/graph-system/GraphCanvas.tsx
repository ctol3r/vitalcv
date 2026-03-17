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
  highlightedNodeIds: Set<string>;
  highlightedEdgeIds: Set<string>;
  onSelectNode: (id: string | null) => void;
  onHoverNode: (id: string | null) => void;
  onDoubleClickNode: (id: string) => void;
  onDragNode: (id: string, x: number, y: number) => void;
  onPinNode: (id: string, x: number, y: number) => void;
  onViewportChange?: (viewport: GraphViewportState) => void;
  onHoverDetailChange?: (detail: GraphHoverDetail | null) => void;
  disableInternalTooltip?: boolean;
  width: number;
  height: number;
  layoutVersion?: number;
}

export interface GraphHoverDetail {
  node: GraphNode;
  screenX: number;
  screenY: number;
  relationshipCount: number;
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
  highlightedNodeIds,
  highlightedEdgeIds,
  onSelectNode,
  onHoverNode,
  onDoubleClickNode,
  onDragNode,
  onPinNode,
  onViewportChange,
  onHoverDetailChange,
  disableInternalTooltip = false,
  width,
  height,
  layoutVersion = 0,
}: Props) {
  const nodes = useMemo(
    () => (rawNodes.length > 500 ? rawNodes.slice(0, 500) : rawNodes),
    [rawNodes],
  );
  const edges = useMemo(() => {
    const subset = rawEdges.length > 1000 ? rawEdges.slice(0, 1000) : rawEdges;
    const nodeIds = new Set(nodes.map((node) => node.id));
    return subset.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));
  }, [nodes, rawEdges]);

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

  const relationshipCountByNodeId = useMemo(() => {
    const counts = new Map<string, number>();

    for (const edge of edges) {
      counts.set(edge.source, (counts.get(edge.source) ?? 0) + 1);
      counts.set(edge.target, (counts.get(edge.target) ?? 0) + 1);
    }

    return counts;
  }, [edges]);

  const { simNodesRef, tick, updateNodePosition } = useGraphPhysics({
    nodes,
    edges,
    width,
    height,
    physics,
    visuals,
    selectedNodeId,
    layoutVersion,
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

  const hitTest = useCallback((clientX: number, clientY: number): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    const { x, y, zoom } = cameraRef.current;
    const worldX = ((clientX - rect.left - width / 2 - x) / zoom) + width / 2;
    const worldY = ((clientY - rect.top - height / 2 - y) / zoom) + height / 2;

    for (const node of simNodesRef.current) {
      const dx = (node.x ?? 0) - worldX;
      const dy = (node.y ?? 0) - worldY;
      const radius = Math.max(8, (node.radius ?? 8) + 4);
      if (dx * dx + dy * dy <= radius * radius) {
        return node.id;
      }
    }

    return null;
  }, [height, simNodesRef, width]);

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
        const isHighlighted = highlightedEdgeIds.has(edge.id);
        const isDimmed = (selectedNodeId != null || hoveredNodeId != null) && !isHighlighted;
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
        context.globalAlpha = isHighlighted
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
          * (isHighlighted ? 1.45 : 1);
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
        const isSelected = node.id === selectedNodeId;
        const isHovered = node.id === hoveredNodeId;
        const isFocusedNeighbor = highlightedNodeIds.has(node.id);
        const isDimmed = (selectedNodeId != null || hoveredNodeId != null) && !isFocusedNeighbor;
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
    highlightedEdgeIds,
    highlightedNodeIds,
    hoveredNodeId,
    physics.frozen,
    selectedNodeId,
    simNodesRef,
    tick,
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
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const { x, y, zoom } = cameraRef.current;
      const worldX = ((event.clientX - rect.left - width / 2 - x) / zoom) + width / 2;
      const worldY = ((event.clientY - rect.top - height / 2 - y) / zoom) + height / 2;
      const node = simNodesRef.current.find((candidate) => candidate.id === nodeId);

      if (node) {
        dragRef.current = {
          nodeId,
          offsetX: (node.x ?? 0) - worldX,
          offsetY: (node.y ?? 0) - worldY,
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
  }, [height, hitTest, simNodesRef, width]);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    if (dragRef.current) {
      const rect = canvas.getBoundingClientRect();
      const { x, y, zoom } = cameraRef.current;
      const worldX = ((event.clientX - rect.left - width / 2 - x) / zoom) + width / 2;
      const worldY = ((event.clientY - rect.top - height / 2 - y) / zoom) + height / 2;
      const nextX = worldX + dragRef.current.offsetX;
      const nextY = worldY + dragRef.current.offsetY;

      dragRef.current.moved = true;
      updateNodePosition(dragRef.current.nodeId, nextX, nextY, true);
      onHoverDetailChange?.(null);
      hideTooltip();
      return;
    }

    if (isPanningRef.current) {
      cameraRef.current.x = panStartRef.current.cameraX + (event.clientX - panStartRef.current.x);
      cameraRef.current.y = panStartRef.current.cameraY + (event.clientY - panStartRef.current.y);
      onHoverDetailChange?.(null);
      hideTooltip();
      return;
    }

    const nodeId = hitTest(event.clientX, event.clientY);
    if (hoveredNodeRef.current !== nodeId) {
      hoveredNodeRef.current = nodeId;
      onHoverNode(nodeId);
    }

    if (!nodeId) {
      onHoverDetailChange?.(null);
      hideTooltip();
      return;
    }

    const node = simNodesRef.current.find((candidate) => candidate.id === nodeId);
    if (!node) {
      onHoverDetailChange?.(null);
      hideTooltip();
      return;
    }

    const relationshipCount = relationshipCountByNodeId.get(nodeId) ?? 0;
    onHoverDetailChange?.({
      node,
      screenX: event.clientX,
      screenY: event.clientY,
      relationshipCount,
    });

    if (!disableInternalTooltip) {
      showTooltip(
        node,
        { clientX: event.clientX, clientY: event.clientY },
        relationshipCount,
      );
    } else {
      hideTooltip();
    }
  }, [
    disableInternalTooltip,
    hideTooltip,
    hitTest,
    onHoverDetailChange,
    onHoverNode,
    relationshipCountByNodeId,
    showTooltip,
    simNodesRef,
    updateNodePosition,
    height,
    width,
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
          onSelectNode(nodeId);
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

    onSelectNode(hitTest(event.clientX, event.clientY));
  }, [emitViewportChange, hitTest, onDragNode, onPinNode, onSelectNode, simNodesRef]);

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
        onHoverNode(null);
        onHoverDetailChange?.(null);
        hideTooltip();
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      style={{
        cursor: dragRef.current || isPanningRef.current
          ? 'grabbing'
          : hoveredNodeId
            ? 'pointer'
            : 'grab',
        height,
        width,
      }}
      width={width}
    />
  );
});
