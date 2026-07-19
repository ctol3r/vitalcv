import * as React from 'react';

/**
 * EvidenceModelMap (SHD-2.3) — the public Evidence Network's abstract system
 * visual, in the scene/Graphene vocabulary.
 *
 * It shows the MODEL, never people: named sources converge into a
 * clinician-owned record, which forms a consented proof packet routed toward
 * opportunity and a single bounded employer-Recognition ring. Every mark is a
 * system concept — there are no clinician nodes, no synthetic names, no
 * physics/debug controls. The topology is decorative (the labelled concept
 * cards on the page are the accessible source of truth), so the container is
 * exposed to assistive tech only as a summarizing `role="img"`. Pure static SVG
 * (SSR-safe, theme-aware via CSS vars) — no canvas, no render loop.
 */

const C = {
  source: 'var(--vt-accent-emerald)',
  gated: 'var(--vt-state-stale, #a2670b)',
  // Issuer/proof violet (art direction) — explicit so it stays distinct from ink
  // in both themes rather than resolving to a near-black --accent.
  proof: 'var(--vt-issuer-violet, #6f5ce6)',
  opportunity: 'var(--vt-field-opportunity, #2f6fb0)',
  line: 'var(--vt-border)',
  capsule: 'var(--vt-surface)',
  capsuleEdge: 'var(--vt-border)',
} as const;

// Left inputs: three live public lanes + one access-gated lane.
const INPUTS = [
  { y: 12, color: C.source },
  { y: 24, color: C.source },
  { y: 36, color: C.source },
  { y: 50, color: C.gated },
];
const RECORD = { x: 42, y: 31 };
const PACKET = { x: 62, y: 31 };
const OPP = { x: 82, y: 17 };
const RECOG = { x: 82, y: 45 };

function LegendItem({ color, dashed, label }: { color: string; dashed?: boolean; label: string }) {
  return (
    <li style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
      <span
        aria-hidden="true"
        style={{
          width: 9,
          height: 9,
          borderRadius: 999,
          background: dashed ? 'transparent' : color,
          border: dashed ? `1.5px dashed ${color}` : 'none',
          display: 'inline-block',
        }}
      />
      {label}
    </li>
  );
}

export function EvidenceModelMap() {
  return (
    <figure
      data-evidence-model-map=""
      role="img"
      aria-label="Diagram of the evidence model: named sources converge into a clinician-owned record, which forms a consented proof packet routed toward opportunities and a single bounded employer-Recognition signal. It shows system concepts only — no clinicians and no live data."
      style={{ margin: '26px 0 0', display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <div
        style={{
          borderRadius: 16,
          border: '1px solid var(--vt-border)',
          background: 'var(--vt-surface-subtle, transparent)',
          padding: '10px 14px',
        }}
      >
        <svg viewBox="0 0 100 62" preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: 'auto', display: 'block' }} aria-hidden="true">
          {/* converging edges: inputs → record */}
          {INPUTS.map((n, i) => (
            <line key={`in-${i}`} x1={14} y1={n.y} x2={RECORD.x} y2={RECORD.y} stroke={C.line} strokeWidth={0.3} />
          ))}
          {/* record → packet → opportunity + recognition */}
          <line x1={RECORD.x} y1={RECORD.y} x2={PACKET.x} y2={PACKET.y} stroke={C.line} strokeWidth={0.3} />
          <line x1={PACKET.x} y1={PACKET.y} x2={OPP.x} y2={OPP.y} stroke={C.line} strokeWidth={0.3} />
          <line x1={PACKET.x} y1={PACKET.y} x2={RECOG.x} y2={RECOG.y} stroke={C.line} strokeWidth={0.3} />

          {/* input nodes */}
          {INPUTS.map((n, i) => (
            <circle key={`n-${i}`} cx={14} cy={n.y} r={2.1} fill={n.color} opacity={0.9} />
          ))}
          {/* clinician-owned record capsule */}
          <rect x={RECORD.x - 6} y={RECORD.y - 5} width={12} height={10} rx={3} fill={C.capsule} stroke={C.capsuleEdge} strokeWidth={0.4} />
          <line x1={RECORD.x - 3.5} y1={RECORD.y} x2={RECORD.x + 3.5} y2={RECORD.y} stroke={C.line} strokeWidth={0.3} />
          {/* proof packet */}
          <rect x={PACKET.x - 3} y={PACKET.y - 3.4} width={6} height={6.8} rx={1.4} fill={C.proof} opacity={0.85} />
          {/* opportunity */}
          <circle cx={OPP.x} cy={OPP.y} r={2.3} fill={C.opportunity} opacity={0.9} />
          {/* single bounded Recognition ring — never a universal cleared signal */}
          <circle cx={RECOG.x} cy={RECOG.y} r={3.4} fill="none" stroke={C.opportunity} strokeWidth={0.7} />
          <circle cx={RECOG.x} cy={RECOG.y} r={1.3} fill={C.source} opacity={0.85} />
        </svg>
      </div>

      <figcaption>
        <ul
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px 18px',
            margin: 0,
            padding: 0,
            listStyle: 'none',
            fontFamily: 'var(--vt-font-mono, ui-monospace, monospace)',
            fontSize: 11,
            letterSpacing: '0.02em',
            color: 'var(--vt-text-secondary)',
          }}
        >
          <LegendItem color={C.source} label="Sources read live → record" />
          <LegendItem color={C.gated} label="Access-gated lane" />
          <LegendItem color={C.proof} label="Consented proof packet" />
          <LegendItem color={C.opportunity} label="Opportunity" />
          <LegendItem color={C.opportunity} dashed label="Bounded employer Recognition" />
        </ul>
        <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--vt-text-muted)' }}>
          A system diagram — every mark is a concept, not a person. The detail is in the sections below.
        </p>
      </figcaption>
    </figure>
  );
}

export default EvidenceModelMap;
