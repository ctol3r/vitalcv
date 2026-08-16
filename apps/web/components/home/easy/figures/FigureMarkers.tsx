/**
 * Hoisted arrowhead markers for every drawn homepage figure (amendment E).
 *
 * They live in ONE standalone zero-size SVG, mounted once by EasyHome, because
 * marker defs inside a figure whose wide variant is `display: none` at narrow
 * widths make every arrow that references them vanish on a phone.
 *
 * No `currentColor` in here: a hoisted marker resolves `currentColor` against
 * ITSELF, not against the path referencing it. Fills route through the
 * `--vt-home-e-figure-*` tokens via classes in easy-home.css, and the two
 * accent markers exist because one hue cannot serve both grounds — the paper
 * accent is illegible on the ink band.
 */
export default function FigureMarkers() {
  return (
    <svg className="ezh-fig-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <marker
          id="ezh-ar"
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M0 0 L8 4 L0 8 z" className="ezh-mk-ink" />
        </marker>
        <marker
          id="ezh-arh"
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M0 0 L8 4 L0 8 z" className="ezh-mk-hot" />
        </marker>
        <marker
          id="ezh-arb"
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M0 0 L8 4 L0 8 z" className="ezh-mk-band" />
        </marker>
      </defs>
    </svg>
  );
}
