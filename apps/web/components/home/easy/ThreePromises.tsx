/**
 * ThreePromises — the whole bottom-half story in three warm cards.
 *
 * Founder directive (2026-08-16, amendment E.1): "simple, practical, easy,
 * positivity, and fun. not: boring, text-heavy, confusing, complicated."
 * Amendment E.2 (same day) tightened it further: "less text more higher level
 * and simplified visuals" with a clinical theme — so each body is now ONE
 * sentence, and the glyphs are clinical objects from the E.2 pictogram
 * vocabulary: an ID badge (the record travels), the consent toggle (kept),
 * and a watch whose strap resolves into a stethoscope curve (the standing
 * watch).
 *
 * Truth boundaries the copy holds without restating them: reuse is a claim
 * about the RECORD persisting (not about integrated apply inventory); the
 * watch claim stays at what the product does (tracks renewal dates); consent
 * is stated as the rule it is. No state vocabulary, no process diagrams.
 * The glyphs are decorative pictograms (aria-hidden), not scenes — they
 * depict no source, count, person, or result, so they carry no self-label
 * (EC-25 applies to pictograms exactly as to scenes).
 */
export default function ThreePromises() {
  return (
    <section
      className="ezh-promises"
      data-header-theme="light"
      data-ezh-reveal=""
      aria-labelledby="ezh-promises-h"
    >
      <div className="ezh-wrap">
        <div className="ezh-sec-head">
          <h2 id="ezh-promises-h">Three things. That&rsquo;s the whole idea.</h2>
        </div>

        <div className="ezh-promise-grid">
          <article className="ezh-promise">
            {/* ID badge (Option 1 "Chart & Badge"): accent band, punched
                slot, blank identity bars, and the take-it-everywhere arrow. */}
            <svg className="ezh-promise-glyph" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
              <rect x="11" y="8" width="22" height="30" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M12 14.5 v-3.5 a2 2 0 0 1 2 -2 h16 a2 2 0 0 1 2 2 v3.5 z" fill="var(--vt-home-e-action)" />
              <rect
                x="18.5"
                y="10.5"
                width="7"
                height="2.5"
                rx="1.25"
                fill="none"
                stroke="var(--vt-home-e-action-label)"
                strokeWidth="1.5"
              />
              <rect x="16" y="20" width="12" height="2.5" rx="1.25" fill="currentColor" fillOpacity=".45" />
              <rect x="16" y="25.5" width="9" height="2.5" rx="1.25" fill="currentColor" fillOpacity=".45" />
              <path
                d="M36 24 h7 M39.5 20.5 l3.5 3.5 -3.5 3.5"
                fill="none"
                stroke="var(--vt-home-e-action)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <h3>Build it once. Take it everywhere.</h3>
            <p>
              Your record moves with you &mdash; the next application starts from everything
              you&rsquo;ve already built.
            </p>
          </article>

          <article className="ezh-promise">
            {/* The consent toggle, unchanged (E.1). */}
            <svg className="ezh-promise-glyph" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
              <rect x="7" y="17" width="34" height="14" rx="7" fill="none" stroke="currentColor" strokeWidth="2" />
              <circle cx="34" cy="24" r="5" fill="var(--vt-home-e-action)" />
            </svg>
            <h3>You say what gets shared.</h3>
            <p>Nothing leaves your record until you say so.</p>
          </article>

          <article className="ezh-promise">
            {/* A watch whose strap resolves into a stethoscope curve —
                clinical time-keeping, depicting no fact. */}
            <svg className="ezh-promise-glyph" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
              <circle cx="24" cy="17" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
              <path
                d="M24 12.5 v4.5 l3.5 2"
                fill="none"
                stroke="var(--vt-home-e-action)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M20 25.5 C17 33 20 39 26 39 h3"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx="33.5" cy="39" r="3.5" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
            <h3>We keep watch, so you don&rsquo;t.</h3>
            <p>
              VitalCV tracks the dates and tells you when something needs you &mdash; most
              weeks, nothing does.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
