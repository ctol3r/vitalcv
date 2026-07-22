/**
 * Career Evidence Field — shared semantic model (SHD-2.1).
 *
 * ONE seeded composition binds every renderer tier — WebGPU, Canvas 2D, and
 * the static SVG poster — so all three communicate the same meaning: source
 * signals converge into the clinician-owned wallet capsule; muted arcs move
 * out toward opportunity; exactly one bounded employer-acceptance ring;
 * a single rare amber "needs action" signal (unknown is not adverse).
 *
 * Deterministic by construction: no Math.random, identical geometry on every
 * render (no CLS), and GPU/non-GPU screenshots stay semantically equivalent
 * (the tasklist's exit criterion).
 */

import { ALL_NODES, type GraphNodeId } from '@/components/home/evidence-field/graph';

/* deterministic PRNG so the field's geometry is identical every render */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type SignalKind = 'source' | 'proof' | 'opportunity' | 'attention';

export interface Atom {
  x: number; // normalized 0..1
  y: number;
  /** depth layer −1..1 (used by the WebGPU tier; 2D ignores it) */
  z: number;
  kind: SignalKind;
  base: number; // base radius weight
  phase: number; // animation phase offset
}

export interface FieldModel {
  atoms: Atom[];
  capsule: { x: number; y: number };
  /** source/proof atom index → capsule (evidence converging in) */
  inLinks: number[];
  /** capsule → opportunity atom index (career moving out) */
  outLinks: number[];
  /** the single opportunity that carries a bounded acceptance ring */
  acceptance: number;
}

/** One curated, seeded composition — a system metaphor, not a data graph. */
export function buildModel(): FieldModel {
  const rnd = mulberry32(0x51a1c7);
  const atoms: Atom[] = [];
  const capsule = { x: 0.6, y: 0.5 };

  // Source + proof signals fan in from the left in two soft arcs.
  const inCount = 7;
  for (let i = 0; i < inCount; i++) {
    const t = i / (inCount - 1);
    const kind: SignalKind = i % 3 === 1 ? 'proof' : 'source';
    atoms.push({
      x: 0.08 + rnd() * 0.16 + t * 0.06,
      y: 0.12 + t * 0.76 + (rnd() - 0.5) * 0.08,
      z: (rnd() - 0.5) * 1.2,
      kind,
      base: 0.7 + rnd() * 0.9,
      phase: rnd() * Math.PI * 2,
    });
  }
  // A single, rare "needs action" signal — unknown is not adverse.
  atoms.push({
    x: 0.2,
    y: 0.5 + (rnd() - 0.5) * 0.1,
    z: (rnd() - 0.5) * 0.8,
    kind: 'attention',
    base: 0.6,
    phase: rnd() * 6,
  });

  // Opportunities sit to the right of the capsule.
  const outCount = 4;
  const oppStart = atoms.length;
  for (let i = 0; i < outCount; i++) {
    const t = i / (outCount - 1);
    atoms.push({
      x: 0.84 + rnd() * 0.08,
      y: 0.2 + t * 0.6 + (rnd() - 0.5) * 0.06,
      z: (rnd() - 0.5) * 1.2,
      kind: 'opportunity',
      base: 0.8 + rnd() * 0.7,
      phase: rnd() * Math.PI * 2,
    });
  }

  // HERO-RESET-1: pin the anchor geometry of the composition. The three real
  // public sources, the single amber needs-action signal, and the ringed
  // opportunity hold curated deterministic positions so the SVG poster, the
  // Canvas 2D tier, the WebGPU tier, and the HTML label overlay all agree on
  // where the named story sits. Every other atom stays seeded texture.
  // Pinning also zeroes z: the WebGPU tier fits the z = 0 plane exactly onto
  // the panel, so a named station stays under its HTML label instead of
  // parallaxing out from beneath the word that names it. Unlabelled texture
  // atoms keep their seeded depth — they are what carries the 3D.
  const pin = (index: number, x: number, y: number) => {
    const atom = atoms[index];
    if (atom) {
      atom.x = x;
      atom.y = y;
      atom.z = 0;
    }
  };
  pin(0, 0.1, 0.16); // NPPES
  pin(3, 0.085, 0.46); // OIG / LEIE
  pin(5, 0.175, 0.885); // texture source — its seeded spot sat on the PECOS label
  pin(6, 0.105, 0.76); // PECOS
  pin(7, 0.24, 0.66); // needs-action signal, clear of the source labels
  pin(oppStart + 1, 0.87, 0.44); // the one opportunity carrying the bounded ring

  const inLinks = atoms
    .map((_, i) => i)
    .filter((i) => i < inCount + 1 && atoms[i].kind !== 'opportunity');
  const outLinks = atoms.map((_, i) => i).filter((i) => i >= oppStart);
  return { atoms, capsule, inLinks, outLinks, acceptance: oppStart + 1 };
}

export const MODEL = buildModel();

export interface FieldAnchor {
  /* Derived from the graph rather than restated, so the two cannot disagree
     about which nodes exist — the same reason FIELD_ANCHORS itself is now a
     map over ALL_NODES instead of a hand-picked list of atom indices. */
  id: GraphNodeId;
  label: string;
  x: number;
  y: number;
}

/**
 * Labeled anchors of the shared composition (HERO-RESET-1). The labels name
 * real public sources and abstract roles only — never a person, an employer,
 * or a fabricated outcome. Coordinates come FROM the model so the overlay can
 * never drift from the geometry the tiers render.
 */
/**
 * The named anchors, now DERIVED from the graph layout rather than restated.
 *
 * These used to be hand-picked indices into MODEL.atoms (the seeded particle
 * scatter). The hero renders from `evidence-field/graph.ts` instead, so keeping
 * a second, independently-authored copy of the composition here is exactly how
 * a label drifts away from the node it names. One source of truth: the graph.
 */
export const FIELD_ANCHORS: FieldAnchor[] = ALL_NODES.map((n) => ({
  id: n.id,
  label: n.label,
  x: n.x,
  y: n.y,
}));

export interface Palette {
  source: string;
  proof: string;
  opportunity: string;
  attention: string;
  ink: string;
  line: string;
  capsule: string;
  capsuleEdge: string;
}

export function readPalette(el: HTMLElement): Palette {
  const s = getComputedStyle(el);
  const v = (name: string, fallback: string) => {
    const raw = s.getPropertyValue(name).trim();
    return raw || fallback;
  };
  return {
    source: v('--vt-accent-emerald', '#1c7c54'),
    proof: v('--accent', '#4f46e5'),
    opportunity: v('--vt-field-opportunity', '#2f6fb0'),
    attention: v('--vt-state-stale', '#a2670b'),
    ink: v('--vt-text-primary', '#141414'),
    line: v('--vt-border', '#dddbd3'),
    capsule: v('--vt-surface', '#ffffff'),
    capsuleEdge: v('--vt-border', '#dddbd3'),
  };
}

export function withAlpha(color: string, a: number): string {
  const c = color.trim();
  if (c.startsWith('#')) {
    const h = c.slice(1);
    const n = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
    const r = parseInt(n.slice(0, 2), 16),
      g = parseInt(n.slice(2, 4), 16),
      b = parseInt(n.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }
  // oklch()/rgb()/hsl() → wrap via color-mix so alpha still applies theme colors.
  return `color-mix(in oklab, ${c} ${Math.round(a * 100)}%, transparent)`;
}

export const KIND_COLOR = (p: Palette, k: SignalKind) =>
  k === 'source'
    ? p.source
    : k === 'proof'
      ? p.proof
      : k === 'opportunity'
        ? p.opportunity
        : p.attention;

export type RGB = [number, number, number];

/**
 * Resolve ANY CSS color (hex/oklch/color-mix/var output) to linear-ish sRGB
 * 0..1 for GPU uniforms, via a throwaway 2D canvas readback. Returns null when
 * the environment cannot parse (the GPU tier then falls back).
 */
export function cssColorToRgb(color: string): RGB | null {
  try {
    const cvs = document.createElement('canvas');
    cvs.width = 1;
    cvs.height = 1;
    const ctx = cvs.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.fillStyle = '#000';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0] / 255, d[1] / 255, d[2] / 255];
  } catch {
    return null;
  }
}
