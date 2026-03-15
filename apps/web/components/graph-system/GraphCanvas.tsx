'use client';

/**
 * GraphCanvas.tsx — Force-directed graph renderer
 *
 * Canvas-based for performance. Handles:
 *   - Force simulation with collision detection and cluster gravity
 *   - Cluster hull background regions
 *   - Semantic edge color vocabulary
 *   - Zoom / pan / drag / pin
 *   - Node selection / hover with screen-position reporting
 *   - Label rendering with zoom-adaptive fade
 *   - Nunito Sans typography on labels
 */

import { useRef, useEffect, useCallback } from 'react';
import type { GraphNode, GraphEdge, PhysicsConfig, DisplayConfig } from './types';
import {
  getEdgeColor,
  getNodeColor,
  getClusterHullColor,
  getClusterBorderColor,
  type NodeType,
  type EdgeType,
} from './types';

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  physics: PhysicsConfig;
  display: DisplayConfig;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onHoverNode: (id: string | null, screenX?: number, screenY?: number) => void;
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

interface Camera {
  x: number;
  y: number;
  zoom: number;
}

// ── Coordinate transforms ──────────────────────────────────────────────────

function nodeToScreen(
  nx: number, ny: number,
  cam: Camera, w: number, h: number,
): { x: number; y: number } {
  return {
    x: (nx - w / 2) * cam.zoom + w / 2 + cam.x,
    y: (ny - h / 2) * cam.zoom + h / 2 + cam.y,
  };
}

// ── Force simulation ───────────────────────────────────────────────────────

function applyForces(
  nodes: SimNode[],
  edges: GraphEdge[],
  physics: PhysicsConfig,
  width: number,
  height: number,
): void {
  const cx = width / 2;
  const cy = height / 2;
  const {
    centerForce, repelForce, linkForce, linkDistance,
    clusterSpacing, clusterGravity, collisionRadius,
  } = physics;

  // ── Center gravity ─────────────────────────────────────────────────────
  for (const node of nodes) {
    if (node.fx != null) continue;
    node.vx += (cx - (node.x ?? cx)) * centerForce * 0.01;
    node.vy += (cy - (node.y ?? cy)) * centerForce * 0.01;
  }

  // ── Cluster centroid gravity ───────────────────────────────────────────
  if (clusterGravity > 0) {
    const centroids = new Map<string, { x: number; y: number; count: number }>();
    for (const node of nodes) {
      if (!node.clusterId) continue;
      const c = centroids.get(node.clusterId) ?? { x: 0, y: 0, count: 0 };
      c.x += (node.x ?? cx);
      c.y += (node.y ?? cy);
      c.count++;
      centroids.set(node.clusterId, c);
    }
    for (const c of centroids.values()) {
      c.x /= c.count;
      c.y /= c.count;
    }
    for (const node of nodes) {
      if (!node.clusterId || node.fx != null) continue;
      const c = centroids.get(node.clusterId);
      if (!c) continue;
      node.vx += ((c.x - (node.x ?? cx)) * clusterGravity * 0.006);
      node.vy += ((c.y - (node.y ?? cy)) * clusterGravity * 0.006);
    }
  }

  // ── Repulsion + collision ──────────────────────────────────────────────
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]!;
      const b = nodes[j]!;

      const dx = (b.x ?? 0) - (a.x ?? 0);
      const dy = (b.y ?? 0) - (a.y ?? 0);
      const dist2 = dx * dx + dy * dy;
      const dist = Math.sqrt(dist2) || 0.001;

      // Extra repulsion between cross-cluster nodes
      const sameCluster = a.clusterId && a.clusterId === b.clusterId;
      const repelBonus = sameCluster ? 0 : clusterSpacing * 0.04;
      const repelF = (repelForce + repelBonus) / (dist2 || 1);

      const fx = (dx / dist) * repelF;
      const fy = (dy / dist) * repelF;
      if (a.fx == null) { a.vx -= fx; a.vy -= fy; }
      if (b.fx == null) { b.vx += fx; b.vy += fy; }

      // Hard collision: push nodes apart so they don't overlap
      const nodeR = (a.size ?? 6) + (b.size ?? 6) + collisionRadius;
      if (dist < nodeR) {
        const overlap = (nodeR - dist) / 2;
        const px = (dx / dist) * overlap * 0.6;
        const py = (dy / dist) * overlap * 0.6;
        if (a.fx == null) { a.vx -= px; a.vy -= py; }
        if (b.fx == null) { b.vx += px; b.vy += py; }
      }
    }
  }

  // ── Link attraction ────────────────────────────────────────────────────
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  for (const edge of edges) {
    if (!edge.visible) continue;
    const a = nodeMap.get(edge.source);
    const b = nodeMap.get(edge.target);
    if (!a || !b) continue;

    const dx = (b.x ?? 0) - (a.x ?? 0);
    const dy = (b.y ?? 0) - (a.y ?? 0);
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;

    // Vary link distance by edge semantic class
    let targetDist = linkDistance;
    const type = edge.type as EdgeType;
    if (type === 'issued_by' || type === 'verified_by' || type === 'attested_by') {
      targetDist = linkDistance * 0.85; // trust edges pull tight
    } else if (type === 'ai_suggested_link' || type === 'semantic_similarity') {
      targetDist = linkDistance * 1.3; // AI edges relax
    } else if (type === 'same_as' || type === 'related_to') {
      targetDist = linkDistance * 1.5;
    }

    const force = (dist - targetDist) * linkForce * 0.01;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;

    if (a.fx == null) { a.vx += fx; a.vy += fy; }
    if (b.fx == null) { b.vx -= fx; b.vy -= fy; }
  }

  // ── Integrate with damping ─────────────────────────────────────────────
  const damping = 0.84;
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

// ── Cluster hull rendering ─────────────────────────────────────────────────

function drawClusterHulls(
  ctx: CanvasRenderingContext2D,
  nodes: SimNode[],
  display: DisplayConfig,
): void {
  if (!display.showClusterHulls) return;

  const clusters = new Map<string, { xs: number[]; ys: number[] }>();
  for (const n of nodes) {
    if (!n.visible || !n.clusterId) continue;
    const c = clusters.get(n.clusterId) ?? { xs: [], ys: [] };
    c.xs.push(n.x ?? 0);
    c.ys.push(n.y ?? 0);
    clusters.set(n.clusterId, c);
  }

  for (const [clusterId, { xs, ys }] of clusters) {
    if (xs.length < 2) continue;

    const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const cy = ys.reduce((a, b) => a + b, 0) / ys.length;

    // Radius = max distance from centroid + padding
    let maxR = 0;
    for (let i = 0; i < xs.length; i++) {
      const dx = (xs[i]! - cx);
      const dy = (ys[i]! - cy);
      maxR = Math.max(maxR, Math.sqrt(dx * dx + dy * dy));
    }
    const hullR = maxR + 28;

    // Draw filled hull
    ctx.beginPath();
    ctx.arc(cx, cy, hullR, 0, Math.PI * 2);
    ctx.fillStyle = getClusterHullColor(clusterId);
    ctx.fill();

    // Draw border ring
    ctx.beginPath();
    ctx.arc(cx, cy, hullR, 0, Math.PI * 2);
    ctx.strokeStyle = getClusterBorderColor(clusterId);
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

// ── Canvas renderer ────────────────────────────────────────────────────────

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
  const cameraRef = useRef<Camera>({ x: 0, y: 0, zoom: 1 });
  const dragRef = useRef<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, camX: 0, camY: 0 });
  const lastClickRef = useRef<{ id: string; time: number } | null>(null);

  // Initialize simulation nodes
  useEffect(() => {
    const existing = new Map(simNodesRef.current.map(n => [n.id, n]));
    simNodesRef.current = nodes.map(n => {
      const prev = existing.get(n.id);
      return {
        ...n,
        x: prev?.x ?? n.x ?? width / 2 + (Math.random() - 0.5) * width * 0.6,
        y: prev?.y ?? n.y ?? height / 2 + (Math.random() - 0.5) * height * 0.6,
        fx: n.fx ?? prev?.fx ?? undefined,
        fy: n.fy ?? prev?.fy ?? undefined,
        vx: prev?.vx ?? 0,
        vy: prev?.vy ?? 0,
      } as SimNode;
    });
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

      // Physics tick
      if (display.animate && !physics.frozen) {
        applyForces(simNodes, edges, physics, width, height);
      }

      // ── Clear ────────────────────────────────────────────────────────
      ctx.fillStyle = '#080e1a';
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.translate(width / 2 + cam.x, height / 2 + cam.y);
      ctx.scale(cam.zoom, cam.zoom);
      ctx.translate(-width / 2, -height / 2);

      const nodeMap = new Map(simNodes.map(n => [n.id, n]));

      // ── Cluster hulls (drawn first, below everything) ─────────────────
      drawClusterHulls(ctx, simNodes, display);

      // ── Edges ─────────────────────────────────────────────────────────
      for (const edge of edges) {
        if (!edge.visible) continue;
        const src = nodeMap.get(edge.source);
        const tgt = nodeMap.get(edge.target);
        if (!src || !tgt || !src.visible || !tgt.visible) continue;

        const isHighlighted = edge.highlighted ||
          src.id === selectedNodeId || tgt.id === selectedNodeId ||
          src.id === hoveredNodeId || tgt.id === hoveredNodeId;

        const edgeColor = edge.color ?? getEdgeColor(edge.type as EdgeType);
        const conf = edge.confidence ?? 0.5;

        ctx.beginPath();
        ctx.moveTo(src.x ?? 0, src.y ?? 0);
        ctx.lineTo(tgt.x ?? 0, tgt.y ?? 0);
        ctx.strokeStyle = edgeColor;
        ctx.globalAlpha = isHighlighted ? 0.85 : 0.12 + conf * 0.18;
        ctx.lineWidth = isHighlighted
          ? display.linkThickness * 1.8
          : display.linkThickness * (0.4 + conf * 0.6);
        ctx.stroke();

        // Arrow head
        if (display.showArrows && edge.directed) {
          const sx = src.x ?? 0; const sy = src.y ?? 0;
          const tx = tgt.x ?? 0; const ty = tgt.y ?? 0;
          const angle = Math.atan2(ty - sy, tx - sx);
          const arrowLen = 7;
          const nodeR = (tgt.size ?? 6) * (display.nodeSize / 6) + 2;
          const ex = tx - Math.cos(angle) * nodeR;
          const ey = ty - Math.sin(angle) * nodeR;
          ctx.beginPath();
          ctx.moveTo(ex, ey);
          ctx.lineTo(ex - arrowLen * Math.cos(angle - 0.42), ey - arrowLen * Math.sin(angle - 0.42));
          ctx.lineTo(ex - arrowLen * Math.cos(angle + 0.42), ey - arrowLen * Math.sin(angle + 0.42));
          ctx.closePath();
          ctx.fillStyle = edgeColor;
          ctx.fill();
        }

        ctx.globalAlpha = 1;
      }

      // ── Nodes ─────────────────────────────────────────────────────────
      for (const node of simNodes) {
        if (!node.visible) continue;

        const isSelected = node.id === selectedNodeId;
        const isHovered = node.id === hoveredNodeId;
        const isNeighbor = selectedNodeId
          ? edges.some(e => e.visible &&
              ((e.source === selectedNodeId && e.target === node.id) ||
               (e.target === selectedNodeId && e.source === node.id)))
          : false;
        const isDimmed = !!selectedNodeId && !isSelected && !isHovered && !isNeighbor;

        const baseSize = (node.size ?? 6) * (display.nodeSize / 6);
        const radius = isSelected ? baseSize * 1.5 : isHovered ? baseSize * 1.25 : baseSize;
        const nx = node.x ?? 0;
        const ny = node.y ?? 0;

        const nodeColor = isSelected
          ? '#f59e0b'
          : node.color !== '#475569'
            ? node.color
            : getNodeColor(node.type as NodeType);

        // Glow for selected / hovered
        if (isSelected || isHovered) {
          const glowR = radius + (isSelected ? 10 : 6);
          const grad = ctx.createRadialGradient(nx, ny, radius * 0.5, nx, ny, glowR);
          grad.addColorStop(0, isSelected ? 'rgba(245,158,11,0.5)' : 'rgba(96,165,250,0.35)');
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.beginPath();
          ctx.arc(nx, ny, glowR, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
        }

        // Node ring for neighbors
        if (isNeighbor && !isSelected) {
          ctx.beginPath();
          ctx.arc(nx, ny, radius + 2.5, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(96,165,250,0.4)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Node fill
        ctx.beginPath();
        ctx.arc(nx, ny, radius, 0, Math.PI * 2);
        ctx.globalAlpha = isDimmed ? 0.18 : 1;
        ctx.fillStyle = nodeColor;
        ctx.fill();

        // Pin indicator (pinned = amber border)
        if (node.fx != null) {
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // ── Label ──────────────────────────────────────────────────────
        if (display.showLabels) {
          const showLabel = isSelected || isHovered || isNeighbor ||
            (cam.zoom > 0.85 && node.degree > 2) || cam.zoom > 1.6;

          if (showLabel) {
            const fontSize = Math.max(9, 11 / cam.zoom);
            ctx.font = `${isSelected ? '600 ' : '400 '}${fontSize}px 'Nunito Sans', Inter, system-ui, sans-serif`;
            ctx.globalAlpha = isDimmed ? 0.2 : 1;
            ctx.fillStyle = isSelected
              ? '#fbbf24'
              : isHovered
                ? '#e2e8f0'
                : '#94a3b8';
            ctx.textAlign = 'center';
            ctx.fillText(
              node.label.length > 22 ? node.label.slice(0, 20) + '…' : node.label,
              nx, ny + radius + Math.max(10, 13 / cam.zoom),
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

  // ── Hit testing ──────────────────────────────────────────────────────────

  const hitTest = useCallback((clientX: number, clientY: number): { id: string; sx: number; sy: number } | null => {
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
      const r = (node.size ?? 6) * (display.nodeSize / 6) + 6;
      if (dx * dx + dy * dy < r * r) {
        const screen = nodeToScreen(node.x ?? 0, node.y ?? 0, cam, width, height);
        return { id: node.id, sx: screen.x, sy: screen.y };
      }
    }
    return null;
  }, [width, height, display.nodeSize]);

  // ── Mouse handlers ───────────────────────────────────────────────────────

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const hit = hitTest(e.clientX, e.clientY);
    if (hit) {
      const node = simNodesRef.current.find(n => n.id === hit.id);
      if (node) {
        const rect = canvasRef.current!.getBoundingClientRect();
        const cam = cameraRef.current;
        const mx = ((e.clientX - rect.left - width / 2 - cam.x) / cam.zoom) + width / 2;
        const my = ((e.clientY - rect.top - height / 2 - cam.y) / cam.zoom) + height / 2;
        dragRef.current = {
          nodeId: hit.id,
          offsetX: (node.x ?? 0) - mx,
          offsetY: (node.y ?? 0) - my,
        };
      }
    } else {
      isPanningRef.current = true;
      panStartRef.current = { x: e.clientX, y: e.clientY, camX: cameraRef.current.x, camY: cameraRef.current.y };
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
        node.vx = 0; node.vy = 0;
      }
    } else if (isPanningRef.current) {
      cameraRef.current.x = panStartRef.current.camX + (e.clientX - panStartRef.current.x);
      cameraRef.current.y = panStartRef.current.camY + (e.clientY - panStartRef.current.y);
    } else {
      const hit = hitTest(e.clientX, e.clientY);
      onHoverNode(hit?.id ?? null, hit?.sx, hit?.sy);
    }
  }, [hitTest, onHoverNode, width, height]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (dragRef.current) {
      const node = simNodesRef.current.find(n => n.id === dragRef.current!.nodeId);
      if (node) {
        onDragNode(node.id, node.x ?? 0, node.y ?? 0);
        // Pin if dragged
        onPinNode(node.id, node.x ?? 0, node.y ?? 0);
      }
      dragRef.current = null;
    } else if (isPanningRef.current) {
      isPanningRef.current = false;
    } else {
      const hit = hitTest(e.clientX, e.clientY);
      const now = Date.now();
      if (hit) {
        // Double-click detection
        const last = lastClickRef.current;
        if (last && last.id === hit.id && now - last.time < 350) {
          onDoubleClickNode(hit.id);
          lastClickRef.current = null;
        } else {
          lastClickRef.current = { id: hit.id, time: now };
          onSelectNode(hit.id);
        }
      } else {
        onSelectNode(null);
        lastClickRef.current = null;
      }
    }
  }, [hitTest, onSelectNode, onDragNode, onPinNode, onDoubleClickNode]);

  const handleMouseLeave = useCallback(() => {
    if (!dragRef.current) onHoverNode(null);
  }, [onHoverNode]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    cameraRef.current.zoom = Math.max(0.08, Math.min(6, cameraRef.current.zoom * factor));
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, cursor: dragRef.current ? 'grabbing' : 'default' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
    />
  );
}
