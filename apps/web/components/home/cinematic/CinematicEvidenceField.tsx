import * as React from 'react';

/**
 * A decorative, source-honest atmosphere for the NPI-first homepage.
 *
 * The field visualizes the product model—one provider identifier gathering
 * bounded evidence into a portable record—without presenting live source
 * results. It is deliberately aria-hidden because the actionable and factual
 * version of the story remains in AskHome and the four-step spine.
 */
export function CinematicEvidenceField() {
  const sources = [
    { id: 'identity', label: 'identity', x: 154, y: 170, side: 'left' },
    { id: 'exclusions', label: 'exclusions', x: 168, y: 390, side: 'left' },
    { id: 'enrollment', label: 'enrollment', x: 846, y: 180, side: 'right' },
    { id: 'licensure', label: 'licensure', x: 858, y: 386, side: 'right' },
  ] as const;

  return (
    <div
      className="cinematic-evidence-field"
      data-home-cinematic-field=""
      // Opts this layer into the phase contract (home-surfaces.css). It is a
      // PRECEDING sibling of the phase carrier, so it is reached with `:has()`
      // rather than by inheritance — this attribute is the handle.
      data-home-atmosphere=""
      aria-hidden="true"
    >
      <svg className="cinematic-evidence-field__svg" viewBox="0 0 1024 640">
        <defs>
          <linearGradient id="cinematic-record-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity="0.12" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0.02" />
          </linearGradient>
          <radialGradient id="cinematic-record-glow">
            <stop offset="0" stopColor="currentColor" stopOpacity="0.18" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
        </defs>

        <ellipse
          className="cinematic-evidence-field__glow"
          cx="512"
          cy="306"
          rx="310"
          ry="245"
          fill="url(#cinematic-record-glow)"
        />

        {sources.map((source, index) => {
          const isLeft = source.side === 'left';
          const startX = isLeft ? source.x + 74 : source.x - 74;
          const controlX = isLeft ? 340 : 684;
          const endX = isLeft ? 424 : 600;
          return (
            <g
              key={source.id}
              className="cinematic-evidence-field__source"
              style={{ '--cinematic-order': index } as React.CSSProperties}
            >
              <path
                className="cinematic-evidence-field__path"
                d={`M ${startX} ${source.y} C ${controlX} ${source.y}, ${controlX} 306, ${endX} 306`}
              />
              <circle
                className="cinematic-evidence-field__node-ring"
                cx={source.x}
                cy={source.y}
                r="30"
              />
              <circle
                className="cinematic-evidence-field__node"
                cx={source.x}
                cy={source.y}
                r="7"
              />
              <text
                className="cinematic-evidence-field__label"
                x={source.x}
                y={source.y + 52}
                textAnchor="middle"
              >
                {source.label}
              </text>
            </g>
          );
        })}

        <g className="cinematic-evidence-field__record">
          <rect
            className="cinematic-evidence-field__record-shadow"
            x="424"
            y="184"
            width="176"
            height="244"
            rx="54"
          />
          <rect
            className="cinematic-evidence-field__record-shell"
            x="424"
            y="176"
            width="176"
            height="244"
            rx="54"
            fill="url(#cinematic-record-fill)"
          />
          <path
            className="cinematic-evidence-field__record-notch"
            d="M 424 344 H 450 Q 468 344 468 362 V 420"
          />
          <text className="cinematic-evidence-field__record-kicker" x="454" y="222">
            ONE NPI
          </text>
          <text className="cinematic-evidence-field__record-title" x="454" y="272">
            YOUR
          </text>
          <text className="cinematic-evidence-field__record-title" x="454" y="306">
            RECORD
          </text>
          <line
            className="cinematic-evidence-field__record-rule"
            x1="454"
            y1="336"
            x2="570"
            y2="336"
          />
          {/*
            NO SEAL, NO TICK. This card used to carry a checkmark in a circle,
            painted in `--vt-state-source-confirmed` — so the homepage showed a
            green confirmed mark on "YOUR RECORD" permanently, before anyone
            had typed an NPI.

            Phase-gating it does not rescue it: `resolved` includes exclusions
            and attention states, so a generic success mark is dishonest at
            EVERY phase, not just at rest. The atmosphere is decorative and
            therefore may never assert a source outcome at all (RISK 1).

            One component away, `evidence-input.css` already refuses green for a
            checksum-valid NPI: "green means exactly one thing — a named source
            returned a match". The same rule has to bind the decoration.
          */}
        </g>

        <text className="cinematic-evidence-field__caption" x="512" y="514" textAnchor="middle">
          evidence gathers · permission travels · decisions stay human
        </text>
      </svg>
    </div>
  );
}
