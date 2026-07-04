'use client';

/**
 * CareerEvidenceGraph — an interactive, animated map of VitalCV's core thesis: your career
 * evidence, the sources that back it, and the opportunities it unlocks, all interconnected.
 *
 * Rendered with a small hand-rolled force simulation on a canvas (no external graph lib).
 * This is a *conceptual model*, labeled as such — the node labels are honest category names
 * (NPI, State License, NPPES, Readiness, Recognition…), not claims about a specific clinician.
 *
 * Respects prefers-reduced-motion: settles to a static layout instead of animating.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

type NodeKind = 'you' | 'credential' | 'source' | 'readiness' | 'specialty' | 'opportunity' | 'recognition';

interface GraphNode {
  id: string;
  label: string;
  kind: NodeKind;
  // simulation state
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hub?: boolean;
}

interface GraphEdge {
  a: string;
  b: string;
}

const PALETTE: Record<NodeKind, string> = {
  you: '#F6E05E',
  credential: '#4FD1C5',
  source: '#63B3ED',
  readiness: '#38B2AC',
  specialty: '#B794F4',
  opportunity: '#68D391',
  recognition: '#F6AD55',
};

const LEGEND: Array<{ kind: NodeKind; label: string }> = [
  { kind: 'credential', label: 'Credentials' },
  { kind: 'source', label: 'Sources' },
  { kind: 'readiness', label: 'Readiness' },
  { kind: 'recognition', label: 'Recognition' },
  { kind: 'specialty', label: 'Specialty' },
  { kind: 'opportunity', label: 'Opportunities' },
];

// Honest, conceptual structure of the evidence network.
function buildGraph(): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const raw: Array<Omit<GraphNode, 'x' | 'y' | 'vx' | 'vy'>> = [
    { id: 'you', label: 'You', kind: 'you', r: 15, hub: true },
    // credentials
    { id: 'npi', label: 'NPI', kind: 'credential', r: 8, hub: true },
    { id: 'license', label: 'State License', kind: 'credential', r: 8, hub: true },
    { id: 'board', label: 'Board Cert', kind: 'credential', r: 8, hub: true },
    { id: 'dea', label: 'DEA', kind: 'credential', r: 6 },
    { id: 'bls', label: 'BLS / ACLS', kind: 'credential', r: 6 },
    // sources
    { id: 'nppes', label: 'NPPES', kind: 'source', r: 7 },
    { id: 'stateboard', label: 'State Board', kind: 'source', r: 7 },
    { id: 'abms', label: 'ABMS', kind: 'source', r: 6 },
    { id: 'dea-reg', label: 'DEA Registry', kind: 'source', r: 5 },
    // readiness + recognition
    { id: 'readiness', label: 'Readiness', kind: 'readiness', r: 12, hub: true },
    { id: 'recognition', label: 'Recognition', kind: 'recognition', r: 10, hub: true },
    // specialty
    { id: 'specialty', label: 'Specialty', kind: 'specialty', r: 9, hub: true },
    // opportunities
    { id: 'opp1', label: 'Opportunity', kind: 'opportunity', r: 7 },
    { id: 'opp2', label: 'Opportunity', kind: 'opportunity', r: 6 },
    { id: 'opp3', label: 'Opportunity', kind: 'opportunity', r: 6 },
    { id: 'opp4', label: 'Opportunity', kind: 'opportunity', r: 5 },
    // employers (recognition sources)
    { id: 'emp1', label: 'Employer', kind: 'recognition', r: 5 },
    { id: 'emp2', label: 'Employer', kind: 'recognition', r: 5 },
  ];

  const edges: GraphEdge[] = [
    // you → your evidence
    { a: 'you', b: 'npi' }, { a: 'you', b: 'license' }, { a: 'you', b: 'board' },
    { a: 'you', b: 'specialty' }, { a: 'you', b: 'readiness' },
    { a: 'license', b: 'dea' }, { a: 'board', b: 'bls' },
    // credentials ← sources (provenance)
    { a: 'npi', b: 'nppes' }, { a: 'license', b: 'stateboard' },
    { a: 'board', b: 'abms' }, { a: 'dea', b: 'dea-reg' },
    // readiness aggregates credentials
    { a: 'readiness', b: 'npi' }, { a: 'readiness', b: 'license' }, { a: 'readiness', b: 'board' },
    // opportunities ← readiness + specialty
    { a: 'readiness', b: 'opp1' }, { a: 'readiness', b: 'opp2' }, { a: 'readiness', b: 'opp3' }, { a: 'readiness', b: 'opp4' },
    { a: 'specialty', b: 'opp1' }, { a: 'specialty', b: 'opp2' }, { a: 'specialty', b: 'opp3' },
    // recognition ← employers + readiness
    { a: 'recognition', b: 'readiness' }, { a: 'recognition', b: 'emp1' }, { a: 'recognition', b: 'emp2' },
    { a: 'recognition', b: 'opp1' },
  ];

  const nodes: GraphNode[] = raw.map((n, i) => {
    const angle = (i / raw.length) * Math.PI * 2;
    const radius = n.id === 'you' ? 0 : 120 + (i % 5) * 22;
    return {
      ...n,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
    };
  });

  return { nodes, edges };
}

export function CareerEvidenceGraph({ height = 460 }: { height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);
  const { nodes, edges } = useMemo(() => buildGraph(), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const adjacency = new Map<string, Set<string>>();
    nodes.forEach((n) => adjacency.set(n.id, new Set()));
    edges.forEach((e) => {
      adjacency.get(e.a)?.add(e.b);
      adjacency.get(e.b)?.add(e.a);
    });
    const byId = new Map(nodes.map((n) => [n.id, n] as const));

    let width = wrap.clientWidth;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    const setSize = () => {
      width = wrap.clientWidth;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };
    setSize();

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let hovered: string | null = null;
    let mouse = { x: 0, y: 0, active: false };

    const cx = () => width / 2;
    const cy = () => height / 2;

    function step(alpha: number) {
      // repulsion
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 0.01) { dx = Math.cos(i) * 0.5; dy = Math.sin(i) * 0.5; d2 = 0.25; }
          const d = Math.sqrt(d2);
          const force = (4200 / d2) * alpha;
          const fx = (dx / d) * force;
          const fy = (dy / d) * force;
          a.vx += fx; a.vy += fy;
          b.vx -= fx; b.vy -= fy;
        }
      }
      // springs
      for (const e of edges) {
        const a = byId.get(e.a)!;
        const b = byId.get(e.b)!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const rest = 92;
        const force = (d - rest) * 0.035 * alpha;
        const fx = (dx / d) * force;
        const fy = (dy / d) * force;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }
      // centering + integrate
      for (const n of nodes) {
        n.vx += -n.x * 0.012 * alpha;
        n.vy += -n.y * 0.012 * alpha;
        n.vx *= 0.82;
        n.vy *= 0.82;
        if (n.id === 'you') { n.x = 0; n.y = 0; n.vx = 0; n.vy = 0; continue; }
        n.x += n.vx;
        n.y += n.vy;
      }
    }

    function draw() {
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.translate(cx(), cy());

      const near = hovered ? adjacency.get(hovered) : null;

      // edges
      for (const e of edges) {
        const a = byId.get(e.a)!;
        const b = byId.get(e.b)!;
        const lit = hovered && (e.a === hovered || e.b === hovered);
        ctx.strokeStyle = lit ? 'rgba(79,209,197,0.75)' : hovered ? 'rgba(79,209,197,0.06)' : 'rgba(79,209,197,0.16)';
        ctx.lineWidth = lit ? 1.6 : 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // nodes
      for (const n of nodes) {
        const dim = hovered && n.id !== hovered && !near?.has(n.id);
        ctx.globalAlpha = dim ? 0.25 : 1;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = PALETTE[n.kind];
        ctx.shadowColor = PALETTE[n.kind];
        ctx.shadowBlur = n.id === hovered ? 18 : n.hub ? 8 : 0;
        ctx.fill();
        ctx.shadowBlur = 0;

        // labels: hubs always, plus hovered
        if ((n.hub || n.id === hovered) && !dim) {
          ctx.globalAlpha = 1;
          ctx.fillStyle = 'rgba(237,242,240,0.92)';
          ctx.font = `${n.id === 'you' ? 13 : 11}px ui-sans-serif, system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(n.label, n.x, n.y - n.r - 6);
        }
      }
      ctx.globalAlpha = 1;
    }

    // reduced motion: settle then draw once
    if (reduced) {
      for (let i = 0; i < 320; i++) step(1);
      draw();
    }

    let raf = 0;
    let alpha = 1;
    const loop = () => {
      alpha = Math.max(0.05, alpha * 0.992);
      step(alpha);
      draw();
      raf = requestAnimationFrame(loop);
    };
    if (!reduced) raf = requestAnimationFrame(loop);

    // hover detection
    const onMove = (ev: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse = { x: ev.clientX - rect.left - cx(), y: ev.clientY - rect.top - cy(), active: true };
      let found: string | null = null;
      let best = 22 * 22;
      for (const n of nodes) {
        const dx = n.x - mouse.x;
        const dy = n.y - mouse.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < best && d2 < (n.r + 12) * (n.r + 12)) { best = d2; found = n.id; }
      }
      if (found !== hovered) {
        hovered = found;
        setHoverLabel(found ? byId.get(found)!.label : null);
        if (reduced) draw();
      }
      canvas.style.cursor = found ? 'pointer' : 'default';
    };
    const onLeave = () => { hovered = null; setHoverLabel(null); if (reduced) draw(); };
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);

    const ro = new ResizeObserver(() => { setSize(); if (reduced) draw(); });
    ro.observe(wrap);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseleave', onLeave);
      ro.disconnect();
    };
  }, [nodes, edges, height]);

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      <canvas ref={canvasRef} aria-label="Interactive diagram of the career evidence network" />
      {/* Legend */}
      <div
        style={{
          position: 'absolute',
          left: 16,
          bottom: 14,
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px 14px',
          maxWidth: 'calc(100% - 32px)',
        }}
      >
        {LEGEND.map((l) => (
          <span key={l.kind} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(237,242,240,0.6)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: PALETTE[l.kind] }} />
            {l.label}
          </span>
        ))}
      </div>
      {/* Hover readout */}
      <div style={{ position: 'absolute', right: 16, top: 14, fontSize: 12, color: 'rgba(237,242,240,0.7)', minHeight: 16 }}>
        {hoverLabel ? `→ ${hoverLabel}` : 'Hover a node'}
      </div>
    </div>
  );
}
