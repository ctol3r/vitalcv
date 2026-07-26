/**
 * CareerEvidenceGraph — a calm, STATIC map of the career evidence network.
 *
 * Redrawn to the Calm Wave D56 doctrine: paper + ink, thin ink strokes, mono labels, semantic
 * dots only. No animation, no gradient, no glow, no force simulation (doctrine §1.4 / §3 forbid
 * looping animations and decorative visuals). Deterministic layout — pure and server-renderable.
 *
 * It's a conceptual model, labeled as such: your evidence, the sources that back it, your
 * readiness, and the opportunities and recognition it unlocks — interconnected.
 */

type Kind = 'you' | 'credential' | 'source' | 'readiness' | 'recognition' | 'specialty' | 'opportunity';

interface Node {
  id: string;
  label?: string;
  kind: Kind;
  x: number;
  y: number;
  hub?: boolean;
}

// Ink-first palette; two semantic accents (source-backed green, recognition indigo).
const FILL: Record<Kind, string> = {
  you: '#0f0e0c',
  credential: '#1c5c38', // --ok (source-backed)
  source: '#6b6860', // --ink-500
  readiness: '#0f0e0c',
  recognition: '#4f46e5', // --accent
  specialty: '#474540', // --ink-600
  opportunity: '#96938a', // --ink-400 (not yet acted)
};

const NODES: Node[] = [
  { id: 'you', label: 'You', kind: 'you', x: 360, y: 205, hub: true },
  // credentials (upper-left) → sources (far left)
  { id: 'npi', label: 'NPI', kind: 'credential', x: 250, y: 120, hub: true },
  { id: 'license', label: 'State License', kind: 'credential', x: 205, y: 205, hub: true },
  { id: 'board', label: 'Board Cert', kind: 'credential', x: 250, y: 290, hub: true },
  { id: 'nppes', label: 'NPPES', kind: 'source', x: 110, y: 120 },
  { id: 'stateboard', label: 'State Board', kind: 'source', x: 92, y: 205 },
  { id: 'abms', label: 'ABMS', kind: 'source', x: 110, y: 290 },
  // readiness (right of center)
  { id: 'readiness', label: 'Readiness', kind: 'readiness', x: 470, y: 150, hub: true },
  // specialty (below center)
  { id: 'specialty', label: 'Specialty', kind: 'specialty', x: 400, y: 320, hub: true },
  // recognition (upper right)
  { id: 'recognition', label: 'Recognition', kind: 'recognition', x: 545, y: 250, hub: true },
  // opportunities (right)
  { id: 'opp1', label: 'Opportunity', kind: 'opportunity', x: 615, y: 130 },
  { id: 'opp2', kind: 'opportunity', x: 640, y: 195 },
  { id: 'opp3', kind: 'opportunity', x: 625, y: 320 },
  { id: 'emp1', label: 'Employer', kind: 'recognition', x: 590, y: 350 },
];

const EDGES: Array<[string, string]> = [
  ['you', 'npi'], ['you', 'license'], ['you', 'board'], ['you', 'specialty'], ['you', 'readiness'],
  ['npi', 'nppes'], ['license', 'stateboard'], ['board', 'abms'],
  ['readiness', 'npi'], ['readiness', 'license'], ['readiness', 'board'],
  ['readiness', 'opp1'], ['readiness', 'opp2'], ['specialty', 'opp1'], ['specialty', 'opp3'],
  ['recognition', 'readiness'], ['recognition', 'opp1'], ['recognition', 'emp1'],
];

const BY_ID = new Map(NODES.map((n) => [n.id, n] as const));

const LEGEND: Array<{ c: string; label: string }> = [
  { c: FILL.credential, label: 'Source-backed evidence' },
  { c: FILL.source, label: 'Sources' },
  { c: FILL.recognition, label: 'Recognition' },
  { c: FILL.opportunity, label: 'Opportunities' },
];

export function CareerEvidenceGraph() {
  return (
    <div>
      <svg viewBox="0 0 720 400" width="100%" role="img" aria-label="A static map of the career evidence network" style={{ display: 'block' }}>
        {/* edges — thin ink strokes */}
        {EDGES.map(([a, b], i) => {
          const na = BY_ID.get(a)!;
          const nb = BY_ID.get(b)!;
          return <line key={i} x1={na.x} y1={na.y} x2={nb.x} y2={nb.y} stroke="#c2bfb5" strokeWidth={1} />;
        })}
        {/* nodes */}
        {NODES.map((n) => {
          const r = n.id === 'you' ? 7 : n.hub ? 5 : 3.5;
          return (
            <g key={n.id}>
              {n.kind === 'you' ? (
                <rect x={n.x - r} y={n.y - r} width={r * 2} height={r * 2} fill={FILL.you} />
              ) : (
                <circle cx={n.x} cy={n.y} r={r} fill={FILL[n.kind]} />
              )}
              {n.label ? (
                <text
                  x={n.x}
                  y={n.y - r - 6}
                  textAnchor="middle"
                  fontFamily="var(--font-geist-mono, ui-monospace, monospace)"
                  fontSize={9.5}
                  fill="#474540"
                  style={{ letterSpacing: '0.02em' }}
                >
                  {n.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {/* legend — mono */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', marginTop: 8 }}>
        {LEGEND.map((l) => (
          <span key={l.label} className="mz-mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--ink-500, #6b6860)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: l.c }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
