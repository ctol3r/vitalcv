/**
 * GraphPreview — a minimal static credential graph visualization.
 *
 * Shows the relationship between an NPI, their credentials, and verification
 * status. Pure SVG, no drag, no glow, no animation beyond 300ms transitions.
 */

const nodes = [
  { id: 'npi', label: 'NPI', x: 200, y: 60 },
  { id: 'license', label: 'Medical License', x: 80, y: 180 },
  { id: 'exclusions', label: 'OIG Exclusions', x: 200, y: 220 },
  { id: 'enrollment', label: 'CMS Enrollment', x: 320, y: 180 },
  { id: 'vc', label: 'Verifiable Credential', x: 200, y: 340 },
];

const edges: [string, string][] = [
  ['npi', 'license'],
  ['npi', 'exclusions'],
  ['npi', 'enrollment'],
  ['license', 'vc'],
  ['exclusions', 'vc'],
  ['enrollment', 'vc'],
];

function getNode(id: string) {
  return nodes.find((n) => n.id === id)!;
}

export function GraphPreview() {
  return (
    <section className="border-t border-border py-24">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="grid items-center gap-12 md:grid-cols-2">
          {/* Left: description */}
          <div>
            <h2 className="text-sm font-medium uppercase tracking-widest text-muted">
              Credential Graph
            </h2>
            <p className="mt-4 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              One identity. Every credential. Linked and verifiable.
            </p>
            <p className="mt-4 text-base leading-relaxed text-muted">
              VitalCV builds a connected graph of clinician evidence
              — NPI identity, state licenses, OIG exclusion checks, CMS
              enrollment — all anchored to a single portable identity.
            </p>
          </div>

          {/* Right: static graph */}
          <div className="flex justify-center">
            <svg
              viewBox="0 0 400 400"
              className="h-[320px] w-[320px] md:h-[400px] md:w-[400px]"
              aria-label="Credential graph showing NPI connected to license, OIG exclusions, CMS enrollment, and verifiable credential"
              role="img"
            >
              {/* Edges */}
              {edges.map(([from, to]) => {
                const a = getNode(from);
                const b = getNode(to);
                return (
                  <line
                    key={`${from}-${to}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke="var(--border)"
                    strokeWidth={1}
                  />
                );
              })}

              {/* Nodes */}
              {nodes.map((node) => (
                <g key={node.id}>
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={node.id === 'npi' ? 28 : 22}
                    fill="var(--surface)"
                    stroke="var(--border)"
                    strokeWidth={1}
                  />
                  <text
                    x={node.x}
                    y={node.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="var(--foreground)"
                    fontSize={node.id === 'npi' ? 11 : 9}
                    fontWeight={node.id === 'npi' ? 600 : 400}
                    fontFamily="var(--font-sans)"
                  >
                    {node.label}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}
