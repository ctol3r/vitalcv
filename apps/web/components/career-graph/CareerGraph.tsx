'use client';

/**
 * CareerGraph — a self-contained, dependency-free force-directed knowledge
 * graph for the Provider Career Evidence Network, in the Obsidian/Roam idiom:
 * canvas render, a velocity-Verlet force simulation with the four canonical
 * controls (center / repel / link / link-distance), draggable+pinnable nodes,
 * wheel zoom, background pan, hover-neighborhood highlight, node-size-by-degree,
 * color-by-group (the 3 doctrine groups), bidirectional backlinks, a Filters/
 * Display/Forces control panel, and a dark/light theme toggle.
 *
 * This mirrors the model of the in-repo graph-system engine (group/type nodes,
 * `backlink` edges, the same four force params, colorMode 'group') so it can be
 * folded into that engine later; it is built standalone here to ship a clean,
 * verifiable public surface without the ops-domain coupling.
 */

import * as React from 'react';
import {
  CAREER_EDGES, CAREER_NODES, EDGE_META, GROUP_META,
  type CareerEdge, type CareerNode, type EdgeKind, type GraphGroup,
} from './data';

/* ------------------------------- theming ------------------------------- */
type ThemeName = 'dark' | 'light';
interface Theme {
  bg: string; panelBg: string; panelBorder: string; text: string; textMuted: string;
  edge: string; edgeBacklink: string; edgeSource: string; edgeRecognition: string;
  nodeStroke: string; label: string; labelHalo: string; ring: string;
  group: Record<GraphGroup, string>;
}
const THEMES: Record<ThemeName, Theme> = {
  dark: {
    bg: '#0e1414', panelBg: 'rgba(17,24,24,0.92)', panelBorder: 'rgba(255,255,255,0.10)',
    text: '#e8eae6', textMuted: '#8b978f',
    edge: 'rgba(120,150,150,0.22)', edgeBacklink: 'rgba(79,110,220,0.45)',
    edgeSource: 'rgba(120,150,150,0.16)', edgeRecognition: 'rgba(120,180,110,0.5)',
    nodeStroke: '#0e1414', label: '#c9d1cb', labelHalo: '#0e1414', ring: 'rgba(255,255,255,0.25)',
    group: { holder: '#7cc4ff', verifier: '#6fe0b0', issuer: '#c8a6ff', evidence: '#7d8a84' },
  },
  light: {
    bg: '#f4f2ec', panelBg: 'rgba(255,255,255,0.94)', panelBorder: '#dddbd3',
    text: '#141414', textMuted: '#6b6860',
    edge: 'rgba(20,20,20,0.14)', edgeBacklink: 'rgba(79,70,229,0.42)',
    edgeSource: 'rgba(20,20,20,0.10)', edgeRecognition: 'rgba(28,92,56,0.5)',
    nodeStroke: '#f4f2ec', label: '#33312c', labelHalo: '#f4f2ec', ring: 'rgba(20,20,20,0.28)',
    group: { holder: '#1a6fb0', verifier: '#1c7c54', issuer: '#6b46c1', evidence: '#8a8780' },
  },
};
const EDGE_COLOR = (t: Theme, k: EdgeKind) =>
  k === 'backlink' ? t.edgeBacklink : k === 'source' ? t.edgeSource
    : k === 'recognition' ? t.edgeRecognition : t.edge;

/* hex (#rrggbb) → rgba(...) with alpha, for canvas glows/particles where the
   group palette is stored as hex and we need per-draw opacity. */
function hexA(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);

/* ---------------------------- sim data types --------------------------- */
interface SimNode extends CareerNode { x: number; y: number; vx: number; vy: number; deg: number; pinned: boolean; }

interface Physics { center: number; repel: number; link: number; distance: number; frozen: boolean; }
const DEFAULT_PHYSICS: Physics = { center: 0.012, repel: 1900, link: 0.05, distance: 96, frozen: false };
interface Display { arrows: boolean; textFade: number; nodeSize: number; linkThickness: number; }
// textFade sets the label zoom gate: labels show when zoom >= 2.2 - textFade.
// 1.6 => gate 0.6, so labels are legible at rest (default zoom 1.0) and stay on
// until the graph is zoomed well out — a lower text threshold than the prior
// 1.15 (gate 1.05, labels hidden at rest except hubs).
const DEFAULT_DISPLAY: Display = { arrows: false, textFade: 1.6, nodeSize: 1, linkThickness: 1 };

const ALL_GROUPS: GraphGroup[] = ['holder', 'verifier', 'issuer', 'evidence'];

/* seeded layout so first paint is deterministic (no Math.random at import) */
function seededXY(i: number, n: number): [number, number] {
  const golden = 2.399963;
  const r = 30 + Math.sqrt(i + 1) * 26;
  const a = i * golden;
  return [Math.cos(a) * r, Math.sin(a) * r + (i % 2 ? 4 : -4) * (n > 40 ? 1 : 0)];
}

export default function CareerGraph({
  initialTheme = 'dark',
  initialPanelOpen = true,
  transparentBg = false,
}: { initialTheme?: ThemeName; initialPanelOpen?: boolean; transparentBg?: boolean }) {
  const [themeName, setThemeName] = React.useState<ThemeName>(initialTheme);
  const theme = THEMES[themeName];
  const [physics, setPhysics] = React.useState<Physics>(DEFAULT_PHYSICS);
  const [display, setDisplay] = React.useState<Display>(DEFAULT_DISPLAY);
  const [enabledGroups, setEnabledGroups] = React.useState<Set<GraphGroup>>(new Set(ALL_GROUPS));
  const [showBacklinks, setShowBacklinks] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [selected, setSelected] = React.useState<string | null>(null);
  const [panelOpen, setPanelOpen] = React.useState(initialPanelOpen);
  const [hovered, setHovered] = React.useState<string | null>(null);

  const wrapRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const camera = React.useRef({ x: 0, y: 0, zoom: 1 });
  const nodesRef = React.useRef<SimNode[]>([]);
  const dragRef = React.useRef<{ id: string | null; panning: boolean; lx: number; ly: number; moved: boolean } | null>(null);
  const hoverRef = React.useRef<string | null>(null);
  const selectedRef = React.useRef<string | null>(null);
  const reduced = React.useRef(false);
  // wake/settle: the sim runs only while it has energy or the user is
  // interacting, then stops (no perpetual rAF pegging a CPU core).
  const kickRef = React.useRef<(reheat?: number) => void>(() => {});
  const dirtyRef = React.useRef(true);
  // Advanced-animation state: a staggered entrance (intro 0→1), a monotonic
  // clock for flowing link particles + source pulses, and an onscreen gate so
  // the continuous effects pause when the graph scrolls out of view (no idle
  // CPU burn on the homepage). All of it collapses to a static frame under
  // prefers-reduced-motion.
  const introRef = React.useRef(0);
  const clockRef = React.useRef(0);
  const onscreenRef = React.useRef(true);

  // live refs so the rAF loop reads latest UI state without re-subscribing
  const physicsRef = React.useRef(physics); physicsRef.current = physics;
  const displayRef = React.useRef(display); displayRef.current = display;
  const themeRef = React.useRef(theme); themeRef.current = theme;
  const groupsRef = React.useRef(enabledGroups); groupsRef.current = enabledGroups;
  const backlinksRef = React.useRef(showBacklinks); backlinksRef.current = showBacklinks;
  const searchRef = React.useRef(search); searchRef.current = search;

  // build sim nodes + adjacency once
  const { degree, neighbors, incident } = React.useMemo(() => {
    const deg = new Map<string, number>();
    const nb = new Map<string, Set<string>>();
    const inc = new Map<string, CareerEdge[]>();
    for (const n of CAREER_NODES) { deg.set(n.id, 0); nb.set(n.id, new Set()); inc.set(n.id, []); }
    for (const e of CAREER_EDGES) {
      if (e.kind === 'backlink') continue; // count structure once
      deg.set(e.source, (deg.get(e.source) ?? 0) + 1);
      deg.set(e.target, (deg.get(e.target) ?? 0) + 1);
      nb.get(e.source)?.add(e.target); nb.get(e.target)?.add(e.source);
    }
    for (const e of CAREER_EDGES) { inc.get(e.source)?.push(e); inc.get(e.target)?.push(e); }
    return { degree: deg, neighbors: nb, incident: inc };
  }, []);

  React.useEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    nodesRef.current = CAREER_NODES.map((n, i) => {
      const [x, y] = seededXY(i, CAREER_NODES.length);
      return { ...n, x, y, vx: 0, vy: 0, deg: degree.get(n.id) ?? 0, pinned: false };
    });
  }, [degree]);

  // keep refs synced with selection/hover for the render loop
  selectedRef.current = selected; hoverRef.current = hovered;

  /* ------------------------- simulation + render ------------------------ */
  React.useEffect(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0, w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    let alpha = 1;

    const resize = () => {
      const r = wrap.getBoundingClientRect();
      // Guard against a 0-dimension measurement (pre-layout, or a shrink-wrapped
      // parent): setting the canvas to 0px would stick even once width arrives,
      // since an absolutely-positioned canvas lets an explicit width override
      // inset:0. Skip until we have real dimensions; the ResizeObserver re-fires.
      if (r.width < 1 || r.height < 1) return;
      w = r.width; h = r.height; dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    };
    resize();
    const ro = new ResizeObserver(() => { resize(); kickRef.current(0.3); });
    ro.observe(wrap);

    // Pause continuous effects when the graph is scrolled out of view.
    const io = new IntersectionObserver(
      (entries) => {
        const on = entries[0]?.isIntersecting ?? true;
        onscreenRef.current = on;
        if (on) kickRef.current(0);
      },
      { threshold: 0.02 },
    );
    io.observe(wrap);

    const radius = (n: SimNode) => (3.2 + Math.sqrt(n.deg) * 2.1) * displayRef.current.nodeSize;

    let last = performance.now();
    const step = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const P = physicsRef.current, sim = nodesRef.current;
      const dragging = dragRef.current != null;
      // Continuous flourishes (particles, pulses, entrance) run only while the
      // graph is on screen and motion is allowed.
      const fx = !reduced.current && onscreenRef.current;
      if (fx) clockRef.current += dt;
      if (introRef.current < 1) introRef.current = reduced.current ? 1 : Math.min(1, introRef.current + dt / 1.1);
      if (!P.frozen && (alpha > 0.02 || dragging)) {
        // repel (approx O(n²); fine for this curated set)
        for (let i = 0; i < sim.length; i++) {
          const a = sim[i];
          for (let j = i + 1; j < sim.length; j++) {
            const b = sim[j];
            let dx = a.x - b.x, dy = a.y - b.y;
            let d2 = dx * dx + dy * dy; if (d2 < 0.01) { d2 = 0.01; dx = 0.1; }
            // degree-weighted: hubs push each other apart a little harder so the
            // dense centre spreads instead of piling up — but CAPPED, or the
            // high-degree source hubs (NPPES/OIG, deg ~14) fling to the corners.
            const f = (P.repel * alpha * (1 + Math.min(a.deg + b.deg, 10) * 0.05)) / d2;
            const d = Math.sqrt(d2), fx = (dx / d) * f, fy = (dy / d) * f;
            a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
          }
          // center gravity
          a.vx -= a.x * P.center * alpha; a.vy -= a.y * P.center * alpha;
        }
        // links (springs)
        for (const e of CAREER_EDGES) {
          if (e.kind === 'backlink') continue;
          const s = sim.find((n) => n.id === e.source), t = sim.find((n) => n.id === e.target);
          if (!s || !t) continue;
          const dx = t.x - s.x, dy = t.y - s.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
          const f = ((d - P.distance) / d) * P.link * alpha;
          const fx = dx * f, fy = dy * f;
          s.vx += fx; s.vy += fy; t.vx -= fx; t.vy -= fy;
        }
        for (const n of sim) {
          if (n.pinned) { n.vx = 0; n.vy = 0; continue; }
          n.vx *= 0.82; n.vy *= 0.82;
          n.x += n.vx; n.y += n.vy;
        }
        alpha *= 0.984; // ~4s of settling energy, enough to fully expand, then stop
      }
      draw();
      const animating = (!P.frozen && alpha > 0.02) || dragging || fx || introRef.current < 1;
      if (animating || dirtyRef.current) { dirtyRef.current = false; raf = requestAnimationFrame(step); }
      else { raf = 0; } // settled — stop until woken
    };
    const wake = () => { if (!raf) raf = requestAnimationFrame(step); };
    kickRef.current = (reheat = 0) => {
      if (reheat) alpha = Math.max(alpha, reheat);
      dirtyRef.current = true; wake();
    };

    const draw = () => {
      const T = themeRef.current, D = displayRef.current, sim = nodesRef.current;
      const groups = groupsRef.current, showBL = backlinksRef.current;
      const q = searchRef.current.trim().toLowerCase();
      const cam = camera.current;
      const isLight = T === THEMES.light;
      const intro = introRef.current, eIntro = easeOut(intro);
      const eEdge = easeOut(clamp01((intro - 0.12) / 0.88));   // edges arrive just after nodes
      const fxOn = !reduced.current && onscreenRef.current;
      const clock = clockRef.current;
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);
      // transparentBg lets the paper/section show through so the graph dissolves
      // into the page (edge-fade mask lives on the wrapper); otherwise paint the
      // theme canvas for the standalone explorer surfaces.
      if (!transparentBg) { ctx.fillStyle = T.bg; ctx.fillRect(0, 0, w, h); }
      ctx.translate(w / 2 + cam.x, h / 2 + cam.y);
      ctx.scale(cam.zoom, cam.zoom);

      const visible = (n: SimNode) => groups.has(n.group) && (!q || n.label.toLowerCase().includes(q));
      const pos = new Map(sim.map((n) => [n.id, n]));
      const hov = hoverRef.current ?? selectedRef.current;
      const hovNeighbors = hov ? neighbors.get(hov) : null;
      const focus = (id: string) => !hov || id === hov || (hovNeighbors?.has(id) ?? false);

      // edges
      ctx.lineCap = 'round';
      for (const e of CAREER_EDGES) {
        if (e.kind === 'backlink' && !showBL) continue;
        const s = pos.get(e.source), t = pos.get(e.target);
        if (!s || !t || !visible(s) || !visible(t)) continue;
        const dim = hov && !(focus(e.source) && focus(e.target));
        ctx.globalAlpha = (dim ? 0.05 : 1) * eEdge;
        ctx.strokeStyle = EDGE_COLOR(T, e.kind);
        ctx.lineWidth = (e.kind === 'backlink' ? 1.1 : 1) * D.linkThickness / cam.zoom;
        if (e.kind === 'backlink') ctx.setLineDash([3 / cam.zoom, 3 / cam.zoom]); else ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y); ctx.stroke();
        if (D.arrows && e.kind !== 'backlink') {
          const ang = Math.atan2(t.y - s.y, t.x - s.x), r = radius(t) + 2;
          const ax = t.x - Math.cos(ang) * r, ay = t.y - Math.sin(ang) * r, k = 4 / cam.zoom;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(ax - Math.cos(ang - 0.4) * k, ay - Math.sin(ang - 0.4) * k);
          ctx.lineTo(ax - Math.cos(ang + 0.4) * k, ay - Math.sin(ang + 0.4) * k);
          ctx.closePath(); ctx.fillStyle = EDGE_COLOR(T, e.kind); ctx.fill();
        }
      }
      ctx.setLineDash([]);

      // flowing particles — evidence travelling the network; emerge + vanish
      // smoothly at the endpoints so they read as motion, not dotted lines.
      if (fxOn) {
        for (let i = 0; i < CAREER_EDGES.length; i++) {
          const e = CAREER_EDGES[i];
          // Particles only on the meaningful links (credentials + recognition),
          // never on the numerous source-backbone or backlink edges — keeps the
          // motion legible and calm instead of a busy swarm.
          if (e.kind === 'backlink' || e.kind === 'source') continue;
          const s = pos.get(e.source), t = pos.get(e.target);
          if (!s || !t || !visible(s) || !visible(t)) continue;
          if (hov && !(focus(e.source) && focus(e.target))) continue;
          const phase = (i * 0.1371) % 1;
          const speed = e.kind === 'recognition' ? 0.17 : 0.1;
          const frac = (clock * speed + phase) % 1;
          const px = s.x + (t.x - s.x) * frac, py = s.y + (t.y - s.y) * frac;
          const pr = (e.kind === 'recognition' ? 2.1 : 1.5) / cam.zoom;
          ctx.globalAlpha = eEdge * (0.3 + 0.55 * Math.sin(frac * Math.PI));
          ctx.fillStyle = EDGE_COLOR(T, e.kind);
          ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // nodes
      for (const n of sim) {
        if (!visible(n)) continue;
        const r = radius(n) * (0.12 + 0.88 * eIntro);   // scale-in entrance
        const dim = hov && !focus(n.id);
        const a = dim ? 0.16 : 1;

        // soft glow halo — depth + colour bleed into the paper
        if (!dim) {
          const gr = r * 2.7;
          const glow = ctx.createRadialGradient(n.x, n.y, r * 0.35, n.x, n.y, gr);
          glow.addColorStop(0, hexA(T.group[n.group], 0.16 * eIntro));
          glow.addColorStop(1, hexA(T.group[n.group], 0));
          ctx.globalAlpha = 1; ctx.fillStyle = glow;
          ctx.beginPath(); ctx.arc(n.x, n.y, gr, 0, Math.PI * 2); ctx.fill();
        }

        // source-hub pulse ring — the primary sources quietly breathe
        if (fxOn && !dim && n.deg >= 6) {
          const pulse = 0.5 + 0.5 * Math.sin(clock * 1.4 + n.x * 0.04 + n.y * 0.04);
          ctx.globalAlpha = (0.1 + 0.14 * pulse) * eIntro;
          ctx.strokeStyle = hexA(T.group[n.group], 1); ctx.lineWidth = 1 / cam.zoom;
          ctx.beginPath(); ctx.arc(n.x, n.y, r + (3 + pulse * 5) / cam.zoom, 0, Math.PI * 2); ctx.stroke();
        }

        ctx.globalAlpha = a;
        if (selectedRef.current === n.id || hoverRef.current === n.id) {
          ctx.beginPath(); ctx.arc(n.x, n.y, r + 3 / cam.zoom, 0, Math.PI * 2);
          ctx.strokeStyle = T.ring; ctx.lineWidth = 1.5 / cam.zoom; ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = T.group[n.group]; ctx.fill();
        ctx.lineWidth = 1 / cam.zoom; ctx.strokeStyle = T.nodeStroke; ctx.stroke();
        // refined bead highlight — a small offset gloss for a dimensional feel
        ctx.globalAlpha = a * eIntro;
        ctx.beginPath(); ctx.arc(n.x - r * 0.28, n.y - r * 0.32, r * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = hexA('#ffffff', isLight ? 0.45 : 0.24); ctx.fill();
      }

      // labels (fade with zoom + degree)
      ctx.globalAlpha = eIntro;
      const showLabels = cam.zoom >= (2.2 - D.textFade);
      for (const n of sim) {
        if (!visible(n)) continue;
        // Below the zoom gate, still label the well-connected nodes (deg >= 3,
        // lowered from 6) so zoomed-out views keep more context, not just the
        // top hubs.
        const big = n.deg >= 3;
        if (!showLabels && !(hov && focus(n.id)) && !big) continue;
        if (hov && !focus(n.id)) continue;
        const r = radius(n) * (0.12 + 0.88 * eIntro), fs = Math.max(9, 11 / cam.zoom);
        ctx.font = `${fs}px ui-monospace, 'Geist Mono', monospace`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        const tx = n.x + r + 5 / cam.zoom, ty = n.y;
        ctx.lineWidth = 3 / cam.zoom; ctx.strokeStyle = T.labelHalo;
        ctx.strokeText(n.label, tx, ty);
        ctx.fillStyle = T.label; ctx.fillText(n.label, tx, ty);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    };

    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); raf = 0; kickRef.current = () => {}; ro.disconnect(); io.disconnect(); };
  }, [neighbors]);

  // Redraw on visual-state changes; give physics changes a small reheat so the
  // layout visibly responds. Never reheats on hover/select (no drift on hover).
  React.useEffect(() => { kickRef.current(0); }, [themeName, display, enabledGroups, showBacklinks, search, selected, hovered]);
  React.useEffect(() => { kickRef.current(0.3); }, [physics]);

  /* --------------------------- pointer handling -------------------------- */
  const toWorld = (cx: number, cy: number) => {
    const wrap = wrapRef.current!, r = wrap.getBoundingClientRect(), cam = camera.current;
    return {
      x: (cx - r.left - r.width / 2 - cam.x) / cam.zoom,
      y: (cy - r.top - r.height / 2 - cam.y) / cam.zoom,
    };
  };
  const hitTest = (cx: number, cy: number): SimNode | null => {
    const p = toWorld(cx, cy), sim = nodesRef.current, groups = groupsRef.current;
    let best: SimNode | null = null, bestD = Infinity;
    for (const n of sim) {
      if (!groups.has(n.group)) continue;
      const r = (3.2 + Math.sqrt(n.deg) * 2.1) * displayRef.current.nodeSize + 4;
      const d = (n.x - p.x) ** 2 + (n.y - p.y) ** 2;
      if (d < r * r && d < bestD) { bestD = d; best = n; }
    }
    return best;
  };
  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const hit = hitTest(e.clientX, e.clientY);
    dragRef.current = { id: hit?.id ?? null, panning: !hit, lx: e.clientX, ly: e.clientY, moved: false };
    if (hit) { hit.pinned = true; }
    kickRef.current(0); // wake for drag/redraw, but never disturb the layout on a plain click
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) { // hover
      const hit = hitTest(e.clientX, e.clientY);
      const id = hit?.id ?? null;
      if (id !== hoverRef.current) { hoverRef.current = id; setHovered(id); kickRef.current(0); }
      if (wrapRef.current) wrapRef.current.style.cursor = hit ? 'pointer' : 'grab';
      return;
    }
    const dx = e.clientX - d.lx, dy = e.clientY - d.ly;
    if (Math.abs(dx) + Math.abs(dy) > 2) d.moved = true;
    d.lx = e.clientX; d.ly = e.clientY;
    if (d.id) {
      const n = nodesRef.current.find((x) => x.id === d.id);
      if (n) { n.x += dx / camera.current.zoom; n.y += dy / camera.current.zoom; n.vx = 0; n.vy = 0; }
    } else if (d.panning) { camera.current.x += dx; camera.current.y += dy; }
    kickRef.current(0);
  };
  const onPointerUp = () => {
    const d = dragRef.current;
    if (d && d.id) {
      const n = nodesRef.current.find((x) => x.id === d.id);
      if (n && !d.moved) { n.pinned = false; setSelected((s) => (s === d.id ? null : d.id)); }
      // if moved, leave pinned so the user's layout sticks (Obsidian-like)
    }
    dragRef.current = null;
    if (wrapRef.current) wrapRef.current.style.cursor = 'grab';
    kickRef.current(0.12);
  };
  const onWheel = (e: React.WheelEvent) => {
    const cam = camera.current, factor = Math.exp(-e.deltaY * 0.0015);
    const next = Math.min(4, Math.max(0.25, cam.zoom * factor));
    cam.zoom = next;
    kickRef.current(0);
  };

  const resetView = () => { camera.current = { x: 0, y: 0, zoom: 1 }; nodesRef.current.forEach((n) => { n.pinned = false; }); kickRef.current(0.6); };

  /* ------------------------------ selection ------------------------------ */
  const selectedNode = selected ? CAREER_NODES.find((n) => n.id === selected) ?? null : null;
  const selInfo = React.useMemo(() => {
    if (!selected) return null;
    const inc = incident.get(selected) ?? [];
    const label = (id: string) => CAREER_NODES.find((n) => n.id === id)?.label ?? id;
    const out = inc.filter((e) => e.source === selected && e.kind !== 'backlink')
      .map((e) => ({ id: e.target, label: label(e.target), kind: e.kind }));
    const back = inc.filter((e) => e.target === selected && e.kind !== 'backlink')
      .map((e) => ({ id: e.source, label: label(e.source), kind: e.kind }));
    return { out, back };
  }, [selected, incident]);

  const toggleGroup = (g: GraphGroup) => setEnabledGroups((prev) => {
    const next = new Set(prev); next.has(g) ? next.delete(g) : next.add(g); return next;
  });

  /* -------------------------------- render ------------------------------- */
  const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 };
  const labelStyle: React.CSSProperties = { fontFamily: "ui-monospace, 'Geist Mono', monospace", fontSize: 10.5, letterSpacing: '0.04em', color: theme.textMuted };
  const groupHead: React.CSSProperties = { fontFamily: "ui-monospace, 'Geist Mono', monospace", fontSize: 9.5, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: theme.textMuted, margin: '2px 0 12px' };

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: '100%',
      background: transparentBg ? 'transparent' : theme.bg, overflow: 'hidden', touchAction: 'none', cursor: 'grab',
      // Dissolve the canvas edges into the surrounding paper when embedded, so
      // the network reads as part of the page rather than a boxed widget.
      ...(transparentBg ? {
        WebkitMaskImage: 'radial-gradient(120% 92% at 50% 46%, #000 58%, transparent 100%)',
        maskImage: 'radial-gradient(120% 92% at 50% 46%, #000 58%, transparent 100%)',
      } : null) }}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel}>
      <canvas ref={canvasRef} style={{ display: 'block', position: 'absolute', inset: 0 }} />

      {/* controls panel */}
      <div style={{ position: 'absolute', top: 16, left: 16, width: panelOpen ? 250 : 'auto', maxHeight: 'calc(100% - 32px)', overflowY: 'auto',
        background: theme.panelBg, border: `1px solid ${theme.panelBorder}`, borderRadius: 8, backdropFilter: 'blur(8px)', color: theme.text, zIndex: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: panelOpen ? `1px solid ${theme.panelBorder}` : 'none' }}>
          <button type="button" onClick={() => setPanelOpen((o) => !o)}
            style={{ ...groupHead, margin: 0, background: 'none', border: 'none', cursor: 'pointer', color: theme.text }}>
            {panelOpen ? '▾ Graph view' : '▸'}
          </button>
          {panelOpen ? (
            <button type="button" onClick={() => setThemeName((t) => (t === 'dark' ? 'light' : 'dark'))}
              style={{ ...labelStyle, background: 'none', border: `1px solid ${theme.panelBorder}`, borderRadius: 4, padding: '3px 8px', cursor: 'pointer', color: theme.text }}>
              {themeName === 'dark' ? '◐ Light' : '◑ Dark'}
            </button>
          ) : null}
        </div>

        {panelOpen ? (
          <div style={{ padding: 14 }}>
            <div style={groupHead}>Filters</div>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search nodes…"
              style={{ width: '100%', boxSizing: 'border-box', marginBottom: 14, padding: '8px 10px', fontSize: 12,
                background: 'transparent', color: theme.text, border: `1px solid ${theme.panelBorder}`, borderRadius: 4, outline: 'none' }} />
            {ALL_GROUPS.map((g) => (
              <div key={g} style={rowStyle}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: theme.text }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: theme.group[g] }} />
                  {GROUP_META[g].label}
                </span>
                <Toggle on={enabledGroups.has(g)} color={theme.group[g]} track={theme.panelBorder} onClick={() => toggleGroup(g)} />
              </div>
            ))}
            <div style={rowStyle}>
              <span style={{ fontSize: 12, color: theme.text }}>Backlinks</span>
              <Toggle on={showBacklinks} color={theme.group.holder} track={theme.panelBorder} onClick={() => setShowBacklinks((v) => !v)} />
            </div>

            <div style={{ ...groupHead, marginTop: 16 }}>Display</div>
            <div style={rowStyle}><span style={{ fontSize: 12 }}>Arrows</span>
              <Toggle on={display.arrows} color={theme.group.holder} track={theme.panelBorder} onClick={() => setDisplay((d) => ({ ...d, arrows: !d.arrows }))} /></div>
            <Slider label="Text fade threshold" value={display.textFade} min={0} max={2} step={0.05} theme={theme} onChange={(v) => setDisplay((d) => ({ ...d, textFade: v }))} />
            <Slider label="Node size" value={display.nodeSize} min={0.5} max={2.4} step={0.1} theme={theme} onChange={(v) => setDisplay((d) => ({ ...d, nodeSize: v }))} />
            <Slider label="Link thickness" value={display.linkThickness} min={0.4} max={3} step={0.1} theme={theme} onChange={(v) => setDisplay((d) => ({ ...d, linkThickness: v }))} />

            <div style={{ ...groupHead, marginTop: 16 }}>Forces</div>
            <Slider label="Center force" value={physics.center} min={0} max={0.08} step={0.002} theme={theme} onChange={(v) => setPhysics((p) => ({ ...p, center: v }))} />
            <Slider label="Repel force" value={physics.repel} min={100} max={2400} step={20} theme={theme} onChange={(v) => setPhysics((p) => ({ ...p, repel: v }))} />
            <Slider label="Link force" value={physics.link} min={0} max={0.2} step={0.005} theme={theme} onChange={(v) => setPhysics((p) => ({ ...p, link: v }))} />
            <Slider label="Link distance" value={physics.distance} min={20} max={180} step={2} theme={theme} onChange={(v) => setPhysics((p) => ({ ...p, distance: v }))} />

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="button" onClick={() => setPhysics((p) => ({ ...p, frozen: !p.frozen }))}
                style={{ flex: 1, ...labelStyle, color: theme.text, background: 'none', border: `1px solid ${theme.panelBorder}`, borderRadius: 4, padding: '7px 0', cursor: 'pointer' }}>
                {physics.frozen ? '▶ Resume' : '⏸ Freeze'}
              </button>
              <button type="button" onClick={resetView}
                style={{ flex: 1, ...labelStyle, color: theme.text, background: 'none', border: `1px solid ${theme.panelBorder}`, borderRadius: 4, padding: '7px 0', cursor: 'pointer' }}>
                ⟲ Reset
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* selection / backlinks panel */}
      {selectedNode && selInfo ? (
        <div style={{ position: 'absolute', top: 16, right: 16, width: 250, maxHeight: 'calc(100% - 32px)', overflowY: 'auto',
          background: theme.panelBg, border: `1px solid ${theme.panelBorder}`, borderRadius: 8, backdropFilter: 'blur(8px)', color: theme.text, zIndex: 5, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 600 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: theme.group[selectedNode.group] }} />
                {selectedNode.label}
              </div>
              <div style={{ ...labelStyle, marginTop: 4 }}>{GROUP_META[selectedNode.group].label}</div>
            </div>
            <button type="button" onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: theme.textMuted, cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
          </div>
          <BacklinkList title={`Links → (${selInfo.out.length})`} items={selInfo.out} theme={theme} onPick={setSelected} />
          <BacklinkList title={`Backlinks ← (${selInfo.back.length})`} items={selInfo.back} theme={theme} onPick={setSelected} />
        </div>
      ) : null}

      {/* honesty + legend footer */}
      <div style={{ position: 'absolute', bottom: 12, right: 16, ...labelStyle, textAlign: 'right', zIndex: 5, pointerEvents: 'none' }}>
        {CAREER_NODES.length} nodes · {CAREER_EDGES.filter((e) => e.kind !== 'backlink').length} links · illustrative structure
      </div>
    </div>
  );
}

/* ------------------------------ sub-components ----------------------------- */
function Toggle({ on, color, track, onClick }: { on: boolean; color: string; track: string; onClick: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onClick}
      style={{ width: 30, height: 17, borderRadius: 9, border: 'none', cursor: 'pointer', flexShrink: 0,
        background: on ? color : track, position: 'relative', transition: 'background 140ms' }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 15 : 2, width: 13, height: 13, borderRadius: '50%', background: '#fff', transition: 'left 140ms' }} />
    </button>
  );
}

function Slider({ label, value, min, max, step, theme, onChange }: {
  label: string; value: number; min: number; max: number; step: number; theme: Theme; onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: "ui-monospace, 'Geist Mono', monospace", fontSize: 10, letterSpacing: '0.03em', color: theme.textMuted, marginBottom: 5 }}>{label}</div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: theme.group.holder, cursor: 'pointer' }} />
    </div>
  );
}

function BacklinkList({ title, items, theme, onPick }: {
  title: string; items: Array<{ id: string; label: string; kind: EdgeKind }>; theme: Theme; onPick: (id: string) => void;
}) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontFamily: "ui-monospace, 'Geist Mono', monospace", fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.textMuted, marginBottom: 8 }}>{title}</div>
      {items.length === 0 ? <div style={{ fontSize: 12, color: theme.textMuted }}>None</div> : items.map((it) => (
        <button key={it.id + it.kind} type="button" onClick={() => onPick(it.id)}
          style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: 8, alignItems: 'baseline', textAlign: 'left',
            background: 'none', border: 'none', borderBottom: `1px solid ${theme.panelBorder}`, padding: '7px 0', cursor: 'pointer', color: theme.text }}>
          <span style={{ fontSize: 12.5 }}>{it.label}</span>
          <span style={{ fontFamily: "ui-monospace, 'Geist Mono', monospace", fontSize: 9, color: theme.textMuted, whiteSpace: 'nowrap' }}>{EDGE_META[it.kind].label}</span>
        </button>
      ))}
    </div>
  );
}
