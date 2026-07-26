'use client';

/**
 * CareerEvidenceField — the homepage hero's evidence graph.
 *
 * ── Why this was rebuilt ──────────────────────────────────────────────────────
 * The previous field was a 616-line canvas stack (WebGPU → Canvas2D → poster)
 * drawing a seeded particle scatter. Three problems, all of them visible:
 *   1. It read as noise. Dots sprayed around an empty capsule at pseudo-random
 *      offsets, with no hierarchy and no way to tell what any dot meant.
 *   2. It was not interactive. Nothing responded to a pointer or a keyboard.
 *   3. It was unverifiable. Canvas pixels cannot be asserted on in vitest, and
 *      a GPU tier that silently painted zero pixels shipped to production once
 *      already — the poster masked it and no test could see it.
 *
 * This is SVG instead: the same composition, but every node is a real DOM
 * element, so it is crisp at any DPR, keyboard-reachable, screen-reader
 * labelled, and assertable in a unit test. It is also a third of the code.
 *
 * ── Two modes ────────────────────────────────────────────────────────────────
 * IDLE (no `npi`): illustrative STRUCTURE — the named public lanes and the
 *   abstract roles, explicitly labelled as structure, naming no real person.
 * LIVE (`npi` set): that clinician's actual public snapshot, built lane by lane
 *   from /api/identity/bootstrap and /api/trust-state as the results land.
 *
 * The truth contract holds in both: no lane reaches an affirmative state unless
 * the API affirmatively says so, licensure never auto-clears (state boards are
 * access-gated by policy), and the employer decision is drawn as exactly one
 * bounded ring because institution review remains the final step.
 */

import * as React from 'react';

import {
  ALL_NODES,
  EDGES,
  EDGE_VIEWBOX,
  OUTCOME_NODES,
  RECORD_NODE,
  SOURCE_NODES,
  STATE_LEGEND,
  edgePath,
  liveSourceStates,
  nodeById,
  pct,
  stateColor,
  type EvidenceState,
  type GraphNode,
  type LiveTrust,
} from '@/components/home/evidence-field/graph';
import { cn } from '@/lib/utils';

export type FieldSignal = 'idle' | 'listening' | 'ready';

interface Bootstrap {
  firstName?: string;
  lastName?: string;
  specialty?: string;
  state?: string;
}

/** Motion + interaction styling. Scoped by the `ceg-` prefix. */
const GRAPH_CSS = `
.ceg-edge {
  fill: none;
  stroke-linecap: round;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: ceg-draw 1100ms cubic-bezier(0.2,0.7,0.2,1) forwards;
  animation-delay: calc(var(--i, 0) * 90ms);
  transition: stroke-opacity 220ms ease, stroke-width 220ms ease;
}
@keyframes ceg-draw { to { stroke-dashoffset: 0; } }

/* A slow travelling pulse — the only continuous motion, and it is a few pixels
   wide. Atmosphere should come from content, not from tinting the page. */
.ceg-pulse {
  fill: none;
  stroke-linecap: round;
  stroke-dasharray: 0.04 0.96;
  animation: ceg-travel 5200ms linear infinite;
  animation-delay: calc(var(--i, 0) * 620ms);
  opacity: 0.55;
}
@keyframes ceg-travel { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }

.ceg-node {
  animation: ceg-pop 620ms cubic-bezier(0.2,0.7,0.2,1) both;
  animation-delay: calc(var(--i, 0) * 90ms + 260ms);
}
@keyframes ceg-pop { from { opacity: 0; } to { opacity: 1; } }

.ceg-hit { transition: transform 180ms cubic-bezier(0.2,0.7,0.2,1); }
.ceg-hit:hover, .ceg-hit:focus-visible { transform: translate(-50%, -50%) scale(1.06); }
.ceg-hit:focus-visible {
  outline: 2px solid var(--vt-focus-ring, currentColor);
  outline-offset: 3px;
  border-radius: 8px;
}

.ceg-ring {
  transform-box: fill-box;
  transform-origin: center;
  animation: ceg-breathe 4600ms ease-in-out infinite;
}
@keyframes ceg-breathe { 0%,100% { opacity: 0.35; } 50% { opacity: 0.75; } }

@media (prefers-reduced-motion: reduce) {
  .ceg-edge { animation: none; stroke-dashoffset: 0; }
  .ceg-pulse { display: none; }
  .ceg-node { animation: none; }
  .ceg-ring { animation: none; opacity: 0.5; }
  .ceg-hit { transition: none; }
}
`;

export function CareerEvidenceField({
  signal = 'idle',
  npi = null,
}: {
  signal?: FieldSignal;
  npi?: string | null;
}) {
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [trust, setTrust] = React.useState<LiveTrust | null>(null);
  const [boot, setBoot] = React.useState<Bootstrap | null>(null);
  const [liveError, setLiveError] = React.useState(false);

  const live = Boolean(npi);

  // Live mode: resolve the real lanes. Nothing renders as an affirmative state
  // until the API actually returns it — until then every lane is 'resolving',
  // which is drawn muted, not as cleared.
  React.useEffect(() => {
    if (!npi) {
      setTrust(null);
      setBoot(null);
      setLiveError(false);
      return;
    }
    let alive = true;
    setTrust(null);
    setBoot(null);
    setLiveError(false);
    (async () => {
      try {
        const [bRes, tRes] = await Promise.all([
          fetch(`/api/identity/bootstrap/${npi}`, { cache: 'no-store' }),
          fetch(`/api/trust-state/${npi}`, { cache: 'no-store' }).catch(() => null),
        ]);
        if (!alive) return;
        if (bRes.ok) setBoot((await bRes.json()) as Bootstrap);
        else setLiveError(true);
        if (tRes && tRes.ok) setTrust((await tRes.json()) as LiveTrust);
      } catch {
        if (alive) setLiveError(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [npi]);

  const liveStates = React.useMemo(() => (live ? liveSourceStates(trust) : null), [live, trust]);

  const stateFor = React.useCallback(
    (node: GraphNode): EvidenceState => liveStates?.[node.id] ?? node.state,
    [liveStates],
  );

  const active = activeId ? nodeById(activeId) : null;

  return (
    <div
      data-home-evidence-field=""
      data-field-signal={signal}
      data-field-mode={live ? 'live' : 'structure'}
      className={cn(
        'relative w-full transition-opacity duration-500',
        signal === 'idle' ? 'opacity-95' : 'opacity-100',
      )}
    >
      <style>{GRAPH_CSS}</style>

      <div className="relative aspect-[4/3] w-full sm:aspect-[16/11]">
        {/* Decorative visual layer. The MEANING lives in the labels and legend
            below, which stay outside this aria-hidden subtree. */}
        {/* EDGE LAYER — its own stretched coordinate space.
            Path `d` data cannot take percentages, so edges cannot live in the
            percentage-based node layer below. `preserveAspectRatio="none"` maps
            0–100 onto the box in both axes (what percentages do), and
            non-scaling-stroke keeps the stretch from fattening the lines. */}
        <svg
          data-field-edges=""
          aria-hidden="true"
          viewBox={EDGE_VIEWBOX}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          {EDGES.map((e, i) => {
            const a = nodeById(e.from)!;
            const b = nodeById(e.to)!;
            const d = edgePath(a, b);
            // An edge carries the state of whichever end is a SOURCE; the
            // record→outcome edges stay neutral, because an outcome is never
            // something VitalCV asserts.
            const source = SOURCE_NODES.find((n) => n.id === e.from);
            const colour = source ? stateColor(stateFor(source)) : 'var(--vt-text-muted)';
            const isActive = activeId === e.from || activeId === e.to;
            return (
              <g key={`${e.from}-${e.to}`} style={{ '--i': i } as React.CSSProperties}>
                <path
                  className="ceg-edge"
                  d={d}
                  pathLength={1}
                  vectorEffect="non-scaling-stroke"
                  stroke={colour}
                  strokeWidth={isActive ? 2.25 : 1.4}
                  strokeOpacity={activeId ? (isActive ? 0.95 : 0.16) : 0.62}
                />
                <path
                  className="ceg-pulse"
                  d={d}
                  pathLength={1}
                  vectorEffect="non-scaling-stroke"
                  stroke={colour}
                  strokeWidth={2.5}
                />
              </g>
            );
          })}
        </svg>

        {/* NODE LAYER — percentage geometry, no viewBox, so circles stay round
            and every anchor stays in-pane at any panel aspect. */}
        <svg
          data-field-poster=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full overflow-visible"
        >
          {/* The ONE bounded employer-decision ring. Never a universal
              "cleared" signal — it marks the step VitalCV does not take. */}
          <circle
            data-poster-ring=""
            className="ceg-ring"
            cx={pct(OUTCOME_NODES[1].x)}
            cy={pct(OUTCOME_NODES[1].y)}
            r="26"
            fill="none"
            stroke="var(--vt-text-muted)"
            strokeWidth={1}
            strokeDasharray="3 4"
          />

          {/* Nodes. NPPES lands at cx="10.00%" — the in-pane anchor the
              responsive-geometry test pins. */}
          {ALL_NODES.map((n, i) => {
            const isRecord = n.id === RECORD_NODE.id;
            const colour = stateColor(stateFor(n));
            const dim = activeId != null && activeId !== n.id;
            return (
              <g
                key={n.id}
                className="ceg-node"
                style={{ '--i': i } as React.CSSProperties}
                opacity={dim ? 0.45 : 1}
              >
                {isRecord ? (
                  <>
                    <circle
                      cx={pct(n.x)}
                      cy={pct(n.y)}
                      r="34"
                      fill="var(--vt-surface)"
                      stroke="var(--vt-border)"
                      strokeWidth={1}
                    />
                    <circle cx={pct(n.x)} cy={pct(n.y)} r="7" fill="var(--vt-text-primary)" />
                  </>
                ) : (
                  <>
                    <circle
                      cx={pct(n.x)}
                      cy={pct(n.y)}
                      r="13"
                      fill="var(--vt-surface)"
                      stroke={colour}
                      strokeWidth={1.25}
                    />
                    <circle cx={pct(n.x)} cy={pct(n.y)} r="4.5" fill={colour} />
                  </>
                )}
              </g>
            );
          })}
        </svg>

        {/* Labels + hit targets. Real buttons: keyboard-reachable, announced,
            and the reason this composition is interactive at all. */}
        <div data-field-labels="" className="pointer-events-none absolute inset-0 z-[2]">
          {ALL_NODES.map((n) => {
            const isRecord = n.id === RECORD_NODE.id;
            return (
              // The hit target is exactly the node's own circle; the label is
              // pushed BELOW it. Previously the label lived inside a centred
              // flex column, so half its height was pulled back up over the
              // circle and every name sat on top of the dot it named.
              <button
                key={n.id}
                type="button"
                data-field-label={n.id}
                className="ceg-hit pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-transparent"
                style={{
                  left: pct(n.x),
                  top: pct(n.y),
                  width: isRecord ? 74 : 30,
                  height: isRecord ? 74 : 30,
                }}
                onMouseEnter={() => setActiveId(n.id)}
                onMouseLeave={() => setActiveId((cur) => (cur === n.id ? null : cur))}
                onFocus={() => setActiveId(n.id)}
                onBlur={() => setActiveId((cur) => (cur === n.id ? null : cur))}
                aria-describedby="ceg-detail"
              >
                <span
                  className={cn(
                    'absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.1em]',
                    isRecord
                      ? 'text-[11px] font-semibold tracking-[0.08em] text-[var(--vt-text-primary)]'
                      : 'text-[var(--vt-text-secondary)]',
                  )}
                >
                  {/* The record node keeps its STRUCTURAL label even in live
                      mode. Substituting the clinician's name here rendered it
                      twice on the same screen — once as this node, once in
                      LiveNpiResult's identity block — which is both the
                      duplication this rebuild is removing and a Playwright
                      strict-mode violation in npi-truth-engine. The card owns
                      identity; the graph owns structure. */}
                  {n.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* One live detail line: what the focused node actually is. This is the
          payoff for making the graph interactive — every node explains itself
          without a tooltip a keyboard user cannot reach. */}
      <p
        id="ceg-detail"
        aria-live="polite"
        className="mt-1 min-h-[2.5rem] text-[12px] leading-relaxed text-[var(--vt-text-secondary)]"
      >
        {active ? (
          <>
            <span className="font-semibold text-[var(--vt-text-primary)]">{active.label}</span>
            {' — '}
            {active.detail}
          </>
        ) : live ? (
          liveError ? (
            <>We couldn&rsquo;t reach the registry. That is a system state, not a finding about this NPI.</>
          ) : trust ? (
            <>Live public snapshot for NPI {npi}. Hover or tab a node to see what each lane returns.</>
          ) : (
            <>Resolving each public source for NPI {npi}…</>
          )
        ) : (
          <>Hover or tab any node to see what it is.</>
        )}
      </p>

      <Legend live={live} />
    </div>
  );
}

function Legend({ live }: { live: boolean }) {
  return (
    <div
      data-field-legend=""
      aria-label="Evidence states this page distinguishes"
      className="mt-2 border-t border-[var(--vt-border-subtle)] pt-2"
    >
      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {STATE_LEGEND.map((item) => (
          <li
            key={item.state}
            className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--vt-text-secondary)]"
          >
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: item.color }} />
            {item.label}
          </li>
        ))}
      </ul>
      {/* In LIVE mode this paragraph is deliberately absent. LiveNpiResult
          renders directly beneath the graph and already carries the snapshot
          limitation ("A public snapshot of what primary sources return today
          — not a completed credentialing decision…"), which npi-truth-engine
          asserts. Repeating it here put the same sentence on screen twice and
          broke that test on a strict-mode violation. The card owns the
          disclaimer; the graph owns the structure. */}
      {live ? null : (
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--vt-text-muted)]">
          Named public sources shown: NPPES, OIG/LEIE, and PECOS — signals flowing into a record
          you own. State licensure is access-gated and drawn as such. Illustrative structure:
          no real people or employers are represented until you enter an NPI.
        </p>
      )}
    </div>
  );
}

export default CareerEvidenceField;
