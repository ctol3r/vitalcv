'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Band System — primitive and component reference specimens.
 *
 * Every specimen is rendered in BOTH base registers because EC-20's
 * light/dark doctrine makes light a required register (evidence,
 * dense workflow, legibility-critical surfaces), not a derived one.
 * A primitive that only reads correctly in one register is not done.
 *
 * The third block adds `.bandsys-scene`, which rebinds the shape and
 * surface tokens to the ratified scene scale (A-1/A-2). Identical
 * markup — the components pick up reference R3's warmth from tokens
 * alone.
 */

/** Opt-in reveal for `.bs-rule--reveal`. Reduced motion resolves to the
 *  drawn state; scripting-off is handled in CSS (EC-4). */
function useRuleReveal() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scope = root.current;
    if (!scope) return;

    const rules = Array.from(scope.querySelectorAll<HTMLElement>('.bs-rule--reveal'));
    if (rules.length === 0) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof IntersectionObserver === 'undefined') {
      rules.forEach((rule) => rule.classList.add('is-revealed'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -10% 0px' },
    );

    rules.forEach((rule) => observer.observe(rule));
    return () => observer.disconnect();
  }, []);

  return root;
}

const SEGMENT_OPTIONS = ['All sources', 'Confirmed', 'Needs you'] as const;

/**
 * Segmented control.
 *
 * The active option is drawn by CSS from `aria-current` alone, so it is
 * readable with no script at all. This hook is the ENHANCEMENT: it
 * measures the active option, hands its geometry to the travelling
 * indicator, and only then adds `--armed`, which retires the static
 * rule. If it never runs, the control still reads correctly — that is
 * the inversion of reference R3's version, where the active state is
 * invisible until its script positions the blob.
 */
function Segment() {
  const listRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [armed, setArmed] = useState(false);

  const measure = useCallback(() => {
    const list = listRef.current;
    if (!list) return;

    const option = list.querySelectorAll<HTMLElement>('.bs-segment__option')[active];
    if (!option) return;

    list.style.setProperty('--vt-bs-seg-x', `${option.offsetLeft}px`);
    list.style.setProperty('--vt-bs-seg-w', `${option.offsetWidth}px`);
    setArmed(true);
  }, [active]);

  // Layout effect so the geometry lands in the same frame as `--armed`;
  // otherwise the static rule and a zero-width bar both paint for a tick.
  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [measure]);

  return (
    <div
      ref={listRef}
      className={`bs-segment${armed ? ' bs-segment--armed' : ''}`}
      data-probe="segment"
      role="group"
      aria-label="Filter evidence by state"
    >
      {SEGMENT_OPTIONS.map((label, index) => (
        <button
          key={label}
          type="button"
          className="bs-segment__option"
          aria-current={index === active ? 'true' : undefined}
          onClick={() => setActive(index)}
        >
          {label}
        </button>
      ))}
      <span className="bs-segment__indicator" aria-hidden="true" />
    </div>
  );
}

function Action({
  variant,
  children,
}: {
  variant: 'primary' | 'secondary' | 'quiet';
  children: ReactNode;
}) {
  return (
    <button type="button" className={`bs-action bs-action--${variant}`} data-probe="action">
      <span className="bs-action__rail" aria-hidden="true">
        <span className="bs-action__glyph bs-action__glyph--lead">→</span>
      </span>
      <span className="bs-action__label">{children}</span>
      <span className="bs-action__rail" aria-hidden="true">
        <span className="bs-action__glyph bs-action__glyph--trail">→</span>
      </span>
    </button>
  );
}

function IconButton({ size, label }: { size?: 'md' | 'lg'; label: string }) {
  return (
    <button
      type="button"
      className={`bs-iconbtn${size ? ` bs-iconbtn--${size}` : ''}`}
      aria-label={label}
      data-probe="iconbtn"
    >
      <span className="bs-iconbtn__mark">
        <span className="bs-iconbtn__slot" aria-hidden="true">
          →
        </span>
        <span className="bs-iconbtn__slot" aria-hidden="true">
          →
        </span>
      </span>
    </button>
  );
}

function Specimens() {
  return (
    <>
      <section className="bs-band">
        <p className="bs-earmark">01 — Earmark</p>
        <hr className="bs-rule bs-rule--reveal" style={{ margin: '0.75rem 0 1.5rem' }} />
        <p className="bs-earmark">NPI 1063708299 · Read 2026-08-09 14:02 UTC</p>
        <p style={{ marginTop: '0.75rem', maxInlineSize: '52ch', color: 'var(--vt-bs-ink-2)' }}>
          11px mono, uppercase, +0.08em, <code>slashed-zero</code> and <code>tabular-nums</code>.
          The slashed zero is a correctness affordance on a surface where identifiers and dates
          are the content — not decoration.
        </p>
      </section>

      <section className="bs-band">
        <p className="bs-earmark">02 — Hairline rule</p>
        <hr className="bs-rule bs-rule--reveal" style={{ margin: '0.75rem 0 1.5rem' }} />
        <div style={{ display: 'grid', gap: '1.25rem', maxInlineSize: '52ch' }}>
          <div>
            <p className="bs-earmark" style={{ marginBottom: '0.5rem' }}>Static (default)</p>
            <hr className="bs-rule" />
          </div>
          <div>
            <p className="bs-earmark" style={{ marginBottom: '0.5rem' }}>Strong</p>
            <hr className="bs-rule bs-rule--strong" />
          </div>
          <div>
            <p className="bs-earmark" style={{ marginBottom: '0.5rem' }}>Dashed</p>
            <hr className="bs-rule bs-rule--dashed" />
          </div>
          <div>
            <p className="bs-earmark" style={{ marginBottom: '0.5rem' }}>Reveal (staggered)</p>
            <hr className="bs-rule bs-rule--reveal" />
            <hr
              className="bs-rule bs-rule--reveal"
              style={{ marginTop: '0.5rem', ['--vt-bs-delay' as string]: '120ms' }}
            />
            <hr
              className="bs-rule bs-rule--reveal"
              style={{ marginTop: '0.5rem', ['--vt-bs-delay' as string]: '240ms' }}
            />
          </div>
        </div>
      </section>

      <section className="bs-band">
        <p className="bs-earmark">03 — Link and CTA</p>
        <hr className="bs-rule bs-rule--reveal" style={{ margin: '0.75rem 0 1.5rem' }} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'center' }}>
          <a className="bs-link" href="#band-system">
            Travelling underline
          </a>
          <button type="button" className="bs-cta">
            <span>Internal action</span>
            <span className="bs-cta__glyph" aria-hidden="true">
              →
            </span>
          </button>
          <a className="bs-cta bs-cta--external" href="#band-system">
            <span>External destination</span>
            <span className="bs-cta__glyph" aria-hidden="true">
              ↗
            </span>
          </a>
        </div>
        <p style={{ marginTop: '1.25rem', maxInlineSize: '52ch', color: 'var(--vt-bs-ink-2)' }}>
          Tab to each control: focus is styled outside the hover media query, so the affordance
          survives on touch-capable laptops. Every control clears the 44px block floor.
        </p>
      </section>

      <section className="bs-band">
        <p className="bs-earmark">04 — Column span without grid parentage</p>
        <hr className="bs-rule bs-rule--reveal" style={{ margin: '0.75rem 0 1.5rem' }} />

        {/* Alignment proof. The first row is a real grid child; the second is
            a plain block outside any grid, sized by `--vt-bs-track`. Their right
            edges must agree exactly — that is the whole claim. */}
        <div className="bs-band__grid" style={{ rowGap: '0.5rem' }}>
          <div
            data-probe="grid-child"
            style={{
              gridColumn: 'span 4',
              blockSize: '2.5rem',
              background: 'var(--vt-bs-raised)',
              border: '1px solid var(--vt-bs-hairline)',
              borderRadius: '2px',
            }}
          />
        </div>
        <div
          data-probe="span-util"
          className="bs-span bs-span-4"
          style={{
            blockSize: '2.5rem',
            marginBlockStart: '0.5rem',
            background: 'var(--vt-bs-raised)',
            border: '1px solid var(--vt-bs-ink)',
            borderRadius: '2px',
          }}
        />
        <p className="bs-earmark" style={{ marginBlockStart: '0.75rem' }}>
          Top: grid child, span 4 · Bottom: .bs-span-4, no grid parent
        </p>
        <p style={{ marginTop: '0.75rem', maxInlineSize: '52ch', color: 'var(--vt-bs-ink-2)' }}>
          The reference computes this from <code>100svw</code>, which counts the scrollbar — its
          own 4-column span paints 4.99px wide of a true grid child. Container units exclude it.
        </p>
      </section>

      <section className="bs-band">
        <p className="bs-earmark">05 — Panel and stat</p>
        <hr className="bs-rule bs-rule--reveal" style={{ margin: '0.75rem 0 1.5rem' }} />
        <div className="bs-band__grid">
          <div className="bs-panel" style={{ gridColumn: 'span 12' }}>
            <div className="bs-stat">
              <p className="bs-earmark">Illustration — not a live result</p>
              <p className="bs-stat__figure">1,024</p>
              <hr className="bs-rule" />
              <p className="bs-stat__desc">
                Static figure, tabular and slashed. Figures animate only between real returned
                values; illustrative figures are static and labelled.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Component layer ─────────────────────────────────────── */}

      <section className="bs-band bs-reveal">
        <p className="bs-earmark">06 — Action · dual-glyph swap</p>
        <hr className="bs-rule bs-rule--reveal" style={{ margin: '0.75rem 0 1.5rem' }} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          <Action variant="primary">Start with your NPI</Action>
          <Action variant="secondary">See the record</Action>
          <Action variant="quiet">Not now</Action>
          <button type="button" className="bs-action bs-action--secondary" disabled>
            <span className="bs-action__rail" aria-hidden="true">
              <span className="bs-action__glyph bs-action__glyph--lead">→</span>
            </span>
            <span className="bs-action__label">Unavailable</span>
            <span className="bs-action__rail" aria-hidden="true">
              <span className="bs-action__glyph bs-action__glyph--trail">→</span>
            </span>
          </button>
        </div>
        <p style={{ marginTop: '1.25rem', maxInlineSize: '56ch', color: 'var(--vt-bs-ink-2)' }}>
          The trailing arrow leaves to the right as a second arrives from the left and the label
          slides to meet it — one arrow overtaking the label, not two cross-fading. The resting
          arrow is drawn before any pointer arrives, so the affordance never depends on hover.
        </p>
      </section>

      <section className="bs-band bs-reveal">
        <p className="bs-earmark">07 — Icon instrument · one-variable slide</p>
        <hr className="bs-rule bs-rule--reveal" style={{ margin: '0.75rem 0 1.5rem' }} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          <IconButton label="Next, 24px mark" />
          <IconButton size="md" label="Next, 32px mark" />
          <IconButton size="lg" label="Next, 44px mark" />
        </div>
        <p style={{ marginTop: '1.25rem', maxInlineSize: '56ch', color: 'var(--vt-bs-ink-2)' }}>
          Both glyphs move from one custom property: slot one translates by it, slot two by it
          minus 100%. The reference&rsquo;s 24px and 32px marks are kept — the hit area around
          them is expanded to 44px rather than the mark shrunk to match it.
        </p>
      </section>

      <section className="bs-band bs-reveal">
        <p className="bs-earmark">08 — Segment · travelling indicator</p>
        <hr className="bs-rule bs-rule--reveal" style={{ margin: '0.75rem 0 1.5rem' }} />
        <Segment />
        <p style={{ marginTop: '1.25rem', maxInlineSize: '56ch', color: 'var(--vt-bs-ink-2)' }}>
          One indicator travels rather than each option carrying its own ground. The selected
          option is drawn by CSS from <code>aria-current</code>, so it stays readable if the
          measuring script never runs; arming then hands the job to the bar. Never both at once.
        </p>
      </section>

      <section className="bs-band bs-reveal">
        <p className="bs-earmark">09 — Row · hover reveal</p>
        <hr className="bs-rule bs-rule--reveal" style={{ margin: '0.75rem 0 1.5rem' }} />
        <div style={{ maxInlineSize: '52ch' }}>
          {['NPPES registry', 'State licensure board', 'OIG exclusions'].map((source) => (
            <a key={source} className="bs-row" href="#band-system" data-probe="row">
              <span className="bs-tag">Source</span>
              <span className="bs-row__label">{source}</span>
              <span className="bs-row__glyph" aria-hidden="true">
                →
              </span>
            </a>
          ))}
        </div>
        <p style={{ marginTop: '1.25rem', maxInlineSize: '56ch', color: 'var(--vt-bs-ink-2)' }}>
          Ground fades and the label travels on hover, gated on hover <em>capability</em> rather
          than a width breakpoint — the reference gates this at 1080px, which switches it on for a
          narrow laptop window and off for a 1024px tablet.
        </p>
      </section>

      <section className="bs-band bs-reveal">
        <p className="bs-earmark">10 — Disclosure · coordinated dividers</p>
        <hr className="bs-rule bs-rule--reveal" style={{ margin: '0.75rem 0 1.5rem' }} />
        <div style={{ maxInlineSize: '62ch' }}>
          {[
            {
              q: 'What does VitalCV read from a source?',
              a: 'The record shows what was returned, when it was read, and which source returned it.',
            },
            {
              q: 'What happens when a source disagrees?',
              a: 'Both readings stay on the record with their timestamps. Nothing is silently reconciled.',
            },
            {
              q: 'Who controls the record?',
              a: 'The clinician. Presentation may simplify the controller; it never collapses it.',
            },
          ].map((item) => (
            <details key={item.q} className="bs-disclosure" data-probe="disclosure">
              <summary className="bs-disclosure__summary">
                <span>{item.q}</span>
                <span className="bs-disclosure__marker" aria-hidden="true">
                  +
                </span>
              </summary>
              <div className="bs-disclosure__panel">{item.a}</div>
            </details>
          ))}
        </div>
        <p style={{ marginTop: '1.25rem', maxInlineSize: '56ch', color: 'var(--vt-bs-ink-2)' }}>
          A row drops its own divider when the row below it is open or hovered, so an active row
          reads as one block. Built on <code>&lt;details&gt;</code>, so it opens before hydration
          and with no script at all.
        </p>
      </section>

      <section className="bs-band bs-reveal">
        <p className="bs-earmark">11 — Field · floating label on 1lh</p>
        <hr className="bs-rule bs-rule--reveal" style={{ margin: '0.75rem 0 1.5rem' }} />
        <div style={{ display: 'grid', gap: '1rem', maxInlineSize: '28rem' }}>
          <div className="bs-field">
            <input
              id="bs-field-npi"
              className="bs-field__input"
              type="text"
              inputMode="numeric"
              placeholder=" "
              data-probe="field"
            />
            <label className="bs-field__label" htmlFor="bs-field-npi">
              NPI number
            </label>
          </div>
          <div className="bs-field">
            <input
              id="bs-field-name"
              className="bs-field__input"
              type="text"
              placeholder=" "
              defaultValue="Prefilled value"
            />
            <label className="bs-field__label" htmlFor="bs-field-name">
              Full name
            </label>
          </div>
        </div>
        <p style={{ marginTop: '1.25rem', maxInlineSize: '56ch', color: 'var(--vt-bs-ink-2)' }}>
          The label parks exactly one line-height down, so it cannot drift from the type size. It
          stays a real <code>&lt;label for&gt;</code> throughout — only its position animates, so
          the control keeps one stable accessible name whether empty or filled.
        </p>
      </section>

      <section className="bs-band bs-reveal">
        <p className="bs-earmark">12 — Surface, tag and skeleton</p>
        <hr className="bs-rule bs-rule--reveal" style={{ margin: '0.75rem 0 1.5rem' }} />
        <div className="bs-surface" style={{ maxInlineSize: '32rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span className="bs-tag">NPPES</span>
            <span className="bs-tag">Read 2026-08-10</span>
            <span className="bs-tag">Illustration</span>
          </div>
          <div style={{ display: 'grid', gap: '0.5rem', marginBlockStart: '1.25rem' }}>
            <div className="bs-skeleton" style={{ inlineSize: '70%' }} />
            <div className="bs-skeleton" style={{ inlineSize: '45%' }} />
          </div>
          <p className="bs-earmark" style={{ marginBlockStart: '1rem' }}>
            Placeholder — pair with a live-region status word
          </p>
        </div>
        <p style={{ marginTop: '1.25rem', maxInlineSize: '56ch', color: 'var(--vt-bs-ink-2)' }}>
          The tag is a word-label, so it may round; the action beside it may not. That is the one
          place the two systems genuinely differ, and the silhouette is doing the work.
        </p>
      </section>
    </>
  );
}

export default function BandSystemReference() {
  const root = useRuleReveal();

  return (
    <div ref={root}>
      <div className="bandsys bandsys-dark" id="band-system">
        <section className="bs-band">
          <p className="bs-earmark">VitalCV · Band System · Dark register</p>
          <hr className="bs-rule bs-rule--strong bs-rule--reveal" style={{ margin: '0.75rem 0 1.5rem' }} />
          <h1 className="bs-heading">Structural primitives, both registers.</h1>
          <p style={{ marginTop: '1rem', maxInlineSize: '56ch', color: 'var(--vt-bs-ink-2)' }}>
            Near-sharp graphite: the island&rsquo;s own convention, and the register required for
            evidence, dense workflow, and legibility-critical surfaces.
          </p>
        </section>
        <Specimens />
      </div>

      <div className="bandsys bandsys-light">
        <section className="bs-band">
          <p className="bs-earmark">VitalCV · Band System · Light register</p>
          <hr className="bs-rule bs-rule--strong bs-rule--reveal" style={{ margin: '0.75rem 0 1.5rem' }} />
          <h1 className="bs-heading">Required, not derived.</h1>
          <p style={{ marginTop: '1rem', maxInlineSize: '56ch', color: 'var(--vt-bs-ink-2)' }}>
            The light register is required for evidence, dense workflow, and legibility-critical
            surfaces. Identical markup below — only the register class changes.
          </p>
        </section>
        <Specimens />
      </div>

      {/* Scene register — the synthesis. Same markup, same components;
          shape and surface tokens rebound to the ratified scene scale, so
          reference R3's warmth arrives through tokens rather than through
          a second set of components. */}
      <div className="bandsys bandsys-dark bandsys-scene bs-scene">
        <section className="bs-band">
          <p className="bs-earmark">VitalCV · Band System · Scene register</p>
          <hr className="bs-rule bs-rule--strong bs-rule--reveal" style={{ margin: '0.75rem 0 1.5rem' }} />
          <h1 className="bs-heading">Same components, softer character.</h1>
          <p style={{ marginTop: '1rem', maxInlineSize: '56ch', color: 'var(--vt-bs-ink-2)' }}>
            Nothing below is a different component. The shape scale, the frosted surface and the
            single atmospheric wash are rebound from tokens — panels soften to 24px, labels become
            pills, and actions stay square, because silhouette is what tells you a thing can be
            acted on.
          </p>
        </section>
        <Specimens />
      </div>
    </div>
  );
}
