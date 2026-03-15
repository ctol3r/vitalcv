'use client';

/**
 * GraphCanvas.tsx — Force-directed graph renderer
 *
 * Canvas-based for performance. Handles:
 *   - Force simulation (d3-force-like, manual implementation)
 *   - Zoom / pan / drag
 *   - Node selection / hover / focus
 *   - Edge rendering with arrows and opacity
 *   - Label rendering with fade threshold
 *   - Cluster visual separation
 *   - Highlighted / selected state
 *   - Pinned node support
 *   - Responsive to physics parameter changes
 */

import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import type { GraphNode, GraphEdge, PhysicsConfig, DisplayConfig } from './types';

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  physics: PhysicsConfig;
  display: DisplayConfig;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onHoverNode: (id: string | null) => void;
  onDoubleClickNode: (id: string) => void;
  onDragNode: (id: string, x: number, y: number) => void;
  onPinNode: (id: string, x: number, y: number) => void;
  width: number;
  height: number;
}

interface SimNode extends GraphNode {
  vx: number;
  vy: number;
}

// ── Force simulation ──────────────────────────────────────────────────────────

function applyForces(
  nodes: SimNode[],
  edges: GraphEdge[],
  physics: PhysicsConfig,
  width: number,
  height: number,
): void {
  const cx = width / 2;
  const cy = height / 2;
  const { centerForce, repelForce, linkForce, linkDistance, clusterSpacing } = physics;

  // Center gravity
  for (const node of nodes) {
    if (node.fx !== undefined && node.fx !== null) continue;
    node.vx += (cx - (node.x ?? cx)) * centerForce * 0.01;
    node.vy += (cy - (node.y ?? cy)) * centerForce * 0.01;
  }

  // Repulsion (Barnes-Hut simplified — pairwise for <1000 nodes)
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]!;
      const b = nodes[j]!;
      if ((a.fx != null) && (b.fx != null)) continue;

      const dx = (b.x ?? 0) - (a.x ?? 0);
      const dy = (b.y ?? 0) - (a.y ?? 0);
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      // Extra repulsion for same-cluster nodes if cluster spacing > 0
      const sameCluster = a.clusterId === b.clusterId && a.clusterId;
      const force = repelForce / (dist * dist);
      const clusterBonus = sameCluster ? 0 : clusterSpacing * 0.05;

      const fx = (dx / dist) * (force + clusterBonus);
      const fy = (dy / dist) * (force + clusterBonus);

      if (a.fx == null) { a.vx -= fx; a.vy -= fy; }
      if (b.fx == null) { b.vx += fx; b.vy += fy; }
    }
  }

  // Link attraction
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  for (const edge of edges) {
    if (!edge.visible) continue;
    const a = nodeMap.get(edge.source);
    const b = nodeMap.get(edge.target);
    if (!a || !b) continue;

    const dx = (b.x ?? 0) - (a.x ?? 0);
    const dy = (b.y ?? 0) - (a.y ?? 0);
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const force = (dist - linkDistance) * linkForce * 0.01;

    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;

    if (a.fx == null) { a.vx += fx; a.vy += fy; }
    if (b.fx == null) { b.vx -= fx; b.vy -= fy; }
  }

  // Apply velocity with damping
  const damping = 0.85;
  for (const node of nodes) {
    if (node.fx != null && node.fy != null) {
      node.x = node.fx;
      node.y = node.fy;
      node.vx = 0;
      node.vy = 0;
      continue;
    }
    node.vx *= damping;
    node.vy *= damping;
    node.x = (node.x ?? cx) + node.vx;
    node.y = (node.y ?? cy) + node.vy;
  }
}

// ── Canvas renderer ───────────────────────────────────────────────────────────

export default function GraphCanvas({
  nodes, edges, physics, display,
  selectedNodeId, hoveredNodeId,
  onSelectNode, onHoverNode, onDoubleClickNode,
  onDragNode, onPinNode,
  width, height,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const simNodesRef = useRef<SimNode[]>([]);
  const cameraRef = useRef({ x: 0, y: 0, zoom: 1 });
  const dragRef = useRef<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, camX: 0, camY: 0 });

  // Initialize simulation nodes
  useEffect(() => {
    simNodesRef.current = nodes.map(n => ({
      ...n,
      x: n.x ?? width / 2 + (Math.random() - 0.5) * width * 0.6,
      y: n.y ?? height / 2 + (Math.random() - 0.5) * height * 0.6,
      vx: 0, vy: 0,
    }));
  }, [nodes, width, height]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    let running = true;

    function render() {
      if (!running || !ctx) return;
      const cam = cameraRef.current;
      const simNodes = simNodesRef.current;

      // Physics step
      if (display.animate && !physics.frozen) {
        applyForces(simNodes, edges, physics, width, height);
      }

      // Clear
      ctx.fillStyle = '#080e1a';
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.translate(width / 2 + cam.x, height / 2 + cam.y);
      ctx.scale(cam.zoom, cam.zoom);
      ctx.translate(-width / 2, -height / 2);

      const nodeMap = new Map(simNodes.map(n => [n.id, n]));

      // ── Draw edges ──────────────────────────────────────────────────
      for (const edge of edges) {
        if (!edge.visible) continue;
        const src = nodeMap.get(edge.source);
        const tgt = nodeMap.get(edge.target);
        if (!src || !tgt) continue;
        if (!src.visible || !tgt.visible) continue;

        const isHighlighted = edge.highlighted ||
          src.id === selectedNodeId || tgt.id === selectedNodeId ||
          src.id === hoveredNodeId || tgt.id === hoveredNodeId;

        ctx.beginPath();
        ctx.moveTo(src.x ?? 0, src.y ?? 0);
        ctx.lineTo(tgt.x ?? 0, tgt.y ?? 0);

        ctx.strokeStyle = edge.color ?? '#1e3a5f';
        ctx.globalAlpha = isHighlighted ? 0.8 : 0.15 + (edge.confidence ?? 0.5) * 0.2;
        ctx.lineWidth = isHighlighted
          ? display.linkThickness * 1.5
          : display.linkThickness * (0.5 + (edge.confidence ?? 0.5) * 0.5);
        ctx.stroke();

        // Arrow
        if (display.showArrows && edge.directed) {
          const angle = Math.atan2((tgt.y ?? 0) - (src.y ?? 0), (tgt.x ?? 0) - (src.x ?? 0));
          const arrowLen = 6;
          const ex = (tgt.x ?? 0) - Math.cos(angle) * ((tgt.size ?? 6) + 2);
          const ey = (tgt.y ?? 0) - Math.sin(angle) * ((tgt.size ?? 6) + 2);
          ctx.beginPath();
          ctx.moveTo(ex, ey);
          ctx.lineTo(ex - arrowLen * Math.cos(angle - 0.4), ey - arrowLen * Math.sin(angle - 0.4));
          ctx.lineTo(ex - arrowLen * Math.cos(angle + 0.4), ey - arrowLen * Math.sin(angle + 0.4));
          ctx.closePath();
          ctx.fillStyle = edge.color ?? '#1e3a5f';
          ctx.fill();
        }

        ctx.globalAlpha = 1;
      }

      // ── Draw nodes ──────────────────────────────────────────────────
      for (const node of simNodes) {
        if (!node.visible) continue;

        const isSelected = node.id === selectedNodeId;
        const isHovered = node.id === hoveredNodeId;
        const isNeighborOfSelected = selectedNodeId && edges.some(e =>
          e.visible && ((e.source === selectedNodeId && e.target === node.id) ||
                        (e.target === selectedNodeId && e.source === node.id))
        );

        const baseSize = (node.size ?? 6) * (display.nodeSize / 6);
        const radius = isSelected ? baseSize * 1.4 : isHovered ? baseSize * 1.2 : baseSize;

        const nx = node.x ?? 0;
        const ny = node.y ?? 0;

        // Glow for selected / hovered
        if (isSelected || isHovered) {
          ctx.beginPath();
          ctx.arc(nx, ny, radius + 4, 0, Math.PI * 2);
          const gradient = ctx.createRadialGradient(nx, ny, radius, nx, ny, radius + 8);
          gradient.addColorStop(0, isSelected ? 'rgba(245,158,11,0.4)' : 'rgba(96,165,250,0.3)');
          gradient.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = gradient;
          ctx.fill();
        }

        // Node circle
        ctx.beginPath();
        ctx.arc(nx, ny, radius, 0, Math.PI * 2);
        const dimmed = selectedNodeId && !isSelected && !isHovered && !isNeighborOfSelected;
        ctx.globalAlpha = dimmed ? 0.2 : 1;
        ctx.fillStyle = isSelected ? '#f59e0b' : node.color;
        ctx.fill();

        // Border for pinned nodes
        if (node.fx != null) {
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Label
        if (display.showLabels && cam.zoom >= display.textFadeThreshold) {
          const showLabel = isSelected || isHovered || isNeighborOfSelected ||
            (cam.zoom > 0.8 && node.degree > 2) ||
            cam.zoom > 1.5;

          if (showLabel) {
            ctx.font = `${isSelected ? 'bold ' : ''}${Math.max(9, 11 / cam.zoom)}px Inter, system-ui, sans-serif`;
            ctx.fillStyle = isSelected ? '#fbbf24' : dimmed ? 'rgba(148,163,184,0.3)' : 'rgba(203,213,225,0.85)';
            ctx.textAlign = 'center';
            ctx.fillText(
              node.label.length > 20 ? node.label.slice(0, 18) + '…' : node.label,
              nx, ny + radius + 12,
            );
          }
        }

        ctx.globalAlpha = 1;
      }

      ctx.restore();

      animRef.current = requestAnimationFrame(render);
    }

    animRef.current = requestAnimationFrame(render);

    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
    };
  }, [edges, physics, display, selectedNodeId, hoveredNodeId, width, height]);

  // ── Hit testing ─────────────────────────────────────────────────────────

  const hitTest = useCallback((clientX: number, clientY: number): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const cam = cameraRef.current;

    const mx = ((clientX - rect.left - width / 2 - cam.x) / cam.zoom) + width / 2;
    const my = ((clientY - rect.top - height / 2 - cam.y) / cam.zoom) + height / 2;

    for (const node of simNodesRef.current) {
      if (!node.visible) continue;
      const dx = (node.x ?? 0) - mx;
      const dy = (node.y ?? 0) - my;
      const r = (node.size ?? 6) * (display.nodeSize / 6) + 4;
      if (dx * dx + dy * dy < r * r) return node.id;
    }
    return null;
  }, [width, height, display.nodeSize]);

  // ── Mouse handlers ──────────────────────────────────────────────────────

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const nodeId = hitTest(e.clientX, e.clientY);
    if (nodeId) {
      const node = simNodesRef.current.find(n => n.id === nodeId);
      if (node) {
        const rect = canvasRef.current!.getBoundingClientRect();
        const cam = cameraRef.current;
        const mx = ((e.clientX - rect.left - width / 2 - cam.x) / cam.zoom) + width / 2;
        const my = ((e.clientY - rect.top - height / 2 - cam.y) / cam.zoom) + height / 2;
        dragRef.current = { nodeId, offsetX: (node.x ?? 0) - mx, offsetY: (node.y ?? 0) - my };
      }
    } else {
      isPanningRef.current = true;
      panStartRef.current = {
        x: e.clientX, y: e.clientY,
        camX: cameraRef.current.x, camY: cameraRef.current.y,
      };
    }
  }, [hitTest, width, height]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragRef.current) {
      const rect = canvasRef.current!.getBoundingClientRect();
      const cam = cameraRef.current;
      const mx = ((e.clientX - rect.left - width / 2 - cam.x) / cam.zoom) + width / 2;
      const my = ((e.clientY - rect.top - height / 2 - cam.y) / cam.zoom) + height / 2;
      const node = simNodesRef.current.find(n => n.id === dragRef.current!.nodeId);
      if (node) {
        node.x = mx + dragRef.current.offsetX;
        node.y = my + dragRef.current.offsetY;
        node.fx = node.x;
        node.fy = node.y;
        node.vx = 0;
        node.vy = 0;
      }
    } else if (isPanningRef.current) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      cameraRef.current.x = panStartRef.current.camX + dx;
      cameraRef.current.y = panStartRef.current.camY + dy;
    } else {
      const nodeId = hitTest(e.clientX, e.clientY);
      onHoverNode(nodeId);
    }
  }, [hitTest, onHoverNode, width, height]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (dragRef.current) {
      const node = simNodesRef.current.find(n => n.id === dragRef.current!.nodeId);
      if (node) {
        onDragNode(node.id, node.x ?? 0, node.y ?? 0);
      }
      dragRef.current = null;
    } else if (isPanningRef.current) {
      isPanningRef.current = false;
    } else {
      const nodeId = hitTest(e.clientX, e.clientY);
      onSelectNode(nodeId);
    }
  }, [hitTest, onSelectNode, onDragNode]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const nodeId = hitTest(e.clientX, e.clientY);
    if (nodeId) onDoubleClickNode(nodeId);
  }, [hitTest, onDoubleClickNode]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    cameraRef.current.zoom = Math.max(0.1, Math.min(5, cameraRef.current.zoom * delta));
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, cursor: dragRef.current ? 'grabbing' : 'default' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      onWheel={handleWheel}
    />
  );
}
