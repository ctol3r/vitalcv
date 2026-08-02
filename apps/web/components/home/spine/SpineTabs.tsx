'use client';

/**
 * SpineTabs — the product's four-step argument as one operable section.
 *
 * NPI → source evidence → the packet you choose → hospital review. On the
 * homepage today those four moments are spread across a ledger, two chapters
 * and three beats, ~4,900px apart; a reader meets them as a stack of
 * sections rather than as a sequence they can move through.
 *
 * The interaction model is dock.io's: a list of topics driving ONE persistent
 * pane, nothing auto-advancing, one thing on screen at a time. That is not
 * the card carousel CD-13 retires — a Rolodex slides a stack past the reader;
 * this swaps the contents of a stable frame. The staging is Abridge's:
 * name the step, then show the real surface for it.
 *
 * PROGRESSIVE ENHANCEMENT IS THE DESIGN.
 * `data-enhanced` is set in an effect, so:
 *   - Server render / no JS: `enhanced` is false → every panel is visible,
 *     stacked, each under its own heading, and the tablist is hidden by CSS
 *     (a tab list nothing can drive is a lie). The section degrades to
 *     exactly the stacked composition it replaces.
 *   - After hydration: one panel shows, the tablist appears and drives it.
 * Reduced motion removes the pane's settle animation via the CSS guard.
 *
 * Keyboard follows the WAI-ARIA tabs pattern: arrows move and activate,
 * Home/End jump to the ends, and roving tabindex keeps one stop in the
 * sequence.
 */

import * as React from 'react';

export interface SpineStep {
  id: string;
  /** "Step 1" — the position, said plainly. */
  step: string;
  /** The moment's name, e.g. "Start with your NPI". */
  name: string;
  /** One line on what happens here. */
  line: string;
  /** The surface for this step. */
  panel: React.ReactNode;
  /** Shown under the panel when the surface is a drawing, not live data. */
  illustrative?: boolean;
}

export function SpineTabs({
  steps,
  eyebrow,
  title,
  lede,
}: {
  steps: readonly SpineStep[];
  eyebrow: string;
  title: string;
  lede: string;
}) {
  const [active, setActive] = React.useState(0);
  const [enhanced, setEnhanced] = React.useState(false);
  const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  // Only after mount — the server render must be the stacked composition.
  React.useEffect(() => setEnhanced(true), []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, i: number) => {
    const last = steps.length - 1;
    let next: number | null = null;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = i === last ? 0 : i + 1;
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = i === 0 ? last : i - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = last;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <section className="spine" aria-labelledby="spine-title" data-enhanced={enhanced ? '' : undefined}>
      <div className="spine-head">
        <p className="spine-eyebrow">{eyebrow}</p>
        <h2 id="spine-title" className="spine-title">
          {title}
        </h2>
        <p className="spine-lede">{lede}</p>
      </div>

      <div className="spine-body">
        <div
          className="spine-tabs"
          role="tablist"
          aria-orientation="vertical"
          aria-label="The four steps"
        >
          {steps.map((s, i) => (
            <button
              key={s.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`spine-tab-${s.id}`}
              aria-selected={i === active}
              aria-controls={`spine-panel-${s.id}`}
              // Roving tabindex: the tablist is ONE tab stop, arrows move inside it.
              tabIndex={i === active ? 0 : -1}
              className="spine-tab"
              onClick={() => setActive(i)}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              <span className="spine-tab-step">{s.step}</span>
              <span className="spine-tab-name">{s.name}</span>
              <span className="spine-tab-line">{s.line}</span>
            </button>
          ))}
        </div>

        <div className="spine-panels">
          {steps.map((s, i) => (
            <div
              key={s.id}
              id={`spine-panel-${s.id}`}
              className="spine-panel"
              role={enhanced ? 'tabpanel' : undefined}
              aria-labelledby={enhanced ? `spine-tab-${s.id}` : undefined}
              // Before hydration nothing is hidden — all four read as a stack.
              hidden={enhanced && i !== active}
              tabIndex={enhanced ? 0 : undefined}
            >
              <p className="spine-panel-heading">
                {s.step} · {s.name}
              </p>
              {s.panel}
              {s.illustrative ? (
                <p className="spine-panel-note">Illustrative — not a live result</p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
