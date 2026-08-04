/**
 * CareerEvidenceTimeline — a career across time, drawn as a ruled document.
 *
 * Replaces `MatchaConstellation`, retired under CD-13, which retires "public
 * knowledge graph, constellation, force simulation, node-link people diagram,
 * physics controls" outright. That component was a client canvas with orbital
 * motion, drag-to-rotate, twinkle and a time scrubber — it also idled forever,
 * which CD-11 forbids on its own.
 *
 * The replacement keeps what the constellation was actually FOR — a career has
 * a before, a now, and a headed-toward, and one record threads through all
 * three — and drops the mechanism doctrine retired. Three ruled columns read
 * left to right along a single axis. Geometry says what a thing is (CD-10): a
 * recorded fact is a solid row over a source line; a projection is an open,
 * dashed row that never gains one.
 *
 * Same honesty grammar as the other artifacts (see SceneArtifacts.tsx):
 *   - server-safe pure SVG, no client JS, no hooks;
 *   - the BASE composition is the final frame — no-JS and reduced-motion
 *     readers get the whole picture, the steps only replay how it assembled;
 *   - motion plays once on entry and rests (CD-11): nothing here idles;
 *   - <text> names PARTS only — never a source, a state, or a freshness word;
 *   - value-shaped marks are redacted bars. This drawing illustrates; it never
 *     stands in for a result.
 *
 * THE HONESTY RULE, enforced structurally rather than by convention:
 * `MatchaHub` rendered the constellation under the comment "built from your
 * real evidence" while passing no events at all — it drew the fixed
 * illustrative sky with three labels swapped. A caller that supplies no
 * `entries` here gets the illustrative set AND an unsuppressable note saying
 * so. There is no prop to turn that note off, because the previous failure was
 * a caller believing its own comment.
 */

import * as React from 'react';

export type CareerBand = 'began' | 'now' | 'headed';

export interface CareerEvidenceEntry {
  id: string;
  /** Names a PART of a career — never a source, a state, or a freshness word. */
  label: string;
  band: CareerBand;
  /**
   * A projection rather than a recorded fact. Everything in the `headed` band
   * is projected by definition; this stays explicit per-entry so a caller
   * cannot quietly promote one by moving it between bands.
   */
  projected?: boolean;
}

/**
 * The illustrative set. Deliberately NOT a claim about any clinician: these are
 * the CATEGORIES a career is assembled from, which is what makes the drawing
 * legible without asserting anyone's facts.
 */
const ILLUSTRATIVE: readonly CareerEvidenceEntry[] = [
  { id: 'residency', label: 'Residency', band: 'began' },
  { id: 'first-license', label: 'First license', band: 'began' },
  { id: 'boards', label: 'Board exam', band: 'began' },
  { id: 'first-role', label: 'First role', band: 'began' },

  { id: 'npi', label: 'NPI', band: 'now' },
  { id: 'license', label: 'State license', band: 'now' },
  { id: 'board-cert', label: 'Board certification', band: 'now' },
  { id: 'dea', label: 'DEA', band: 'now' },
  { id: 'readiness', label: 'Readiness', band: 'now' },

  { id: 'next-license', label: 'Next license', band: 'headed', projected: true },
  { id: 'subspecialty', label: 'Subspecialty', band: 'headed', projected: true },
  { id: 'leadership', label: 'Leadership', band: 'headed', projected: true },
];

const BANDS: ReadonlyArray<{ band: CareerBand; heading: string }> = [
  { band: 'began', heading: 'where you began' },
  { band: 'now', heading: 'where you are' },
  { band: 'headed', heading: 'where you’re headed' },
];

/* Layout. Three equal columns on a 720-wide field, one axis beneath them. */
const COL_W = 214;
const COL_GAP = 19;
const COL_X = (i: number) => 20 + i * (COL_W + COL_GAP);
const ROW_H = 30;
const ROWS_TOP = 56;
const AXIS_Y = 250;
const MAX_ROWS = 5;

export function CareerEvidenceTimeline({
  entries,
  className,
}: {
  /** Real, recorded career events. Omit to draw the illustrative set. */
  entries?: readonly CareerEvidenceEntry[];
  className?: string;
}) {
  const isIllustrative = entries === undefined || entries.length === 0;
  const source = isIllustrative ? ILLUSTRATIVE : entries;

  // Overflow is truncated rather than overlapped: a drawing that runs its rows
  // into each other is worse than one that shows fewer and says nothing about
  // the rest. Callers with more events want a ledger, not an artifact.
  const byBand = BANDS.map(({ band, heading }) => ({
    band,
    heading,
    rows: source.filter((e) => e.band === band).slice(0, MAX_ROWS),
  }));

  return (
    <svg
      viewBox="0 0 720 290"
      className={['ask-art', 'ask-art--wide', className].filter(Boolean).join(' ')}
      role="img"
      aria-label={
        'A career drawn as three ruled columns along one axis: where you began, where you are, and where ' +
        'you’re headed. Recorded entries sit as solid rows over a source line; projected entries are open ' +
        'and dashed, and never gain one.'
      }
    >
      {byBand.map(({ band, heading, rows }, colIndex) => {
        const x = COL_X(colIndex);
        return (
          <g key={band}>
            <text x={x} y={22} className="ask-art-label ask-art-step-1">
              {heading}
            </text>

            {/* The column field. Glass is permitted here: this is an
                illustrative artifact, not an evidence surface (CD-12). */}
            <rect
              x={x}
              y={34}
              width={COL_W}
              height={MAX_ROWS * ROW_H + 14}
              rx={10}
              className="ask-art-glass"
            />
            <path d={`M${x + 8} 38 H${x + COL_W - 8}`} className="ask-art-glass-edge" />

            {rows.map((entry, rowIndex) => {
              const y = ROWS_TOP + rowIndex * ROW_H;
              const projected = entry.projected === true || band === 'headed';
              return (
                <g
                  key={entry.id}
                  className="ask-art-item"
                  style={{
                    ['--i' as string]: colIndex * MAX_ROWS + rowIndex,
                    ['--set-delay' as string]: '160ms',
                  }}
                >
                  {/* GEOMETRY CARRIES THE CLAIM (CD-10). A recorded entry is a
                      closed row sitting on a drawn source line. A projection is
                      an open dashed outline with nothing under it — the missing
                      line IS the statement, so no caption has to make it. */}
                  <rect
                    x={x + 12}
                    y={y}
                    width={COL_W - 24}
                    height={18}
                    rx={4}
                    className={projected ? 'ask-art-slot-open' : 'ask-art-slot'}
                  />
                  <text x={x + 22} y={y + 13} className="ask-art-label">
                    {entry.label}
                  </text>
                  {!projected && (
                    <path d={`M${x + 12} ${y + 22} H${x + COL_W - 12}`} className="ask-art-rule" />
                  )}
                </g>
              );
            })}
          </g>
        );
      })}

      {/* THE POINT OF THE DRAWING. The columns land first — the phases of a
          career, each with its own entries — and only THEN does one line draw
          itself left to right beneath all three. Same argument the specialty
          artifact makes about rooms: many phases, one record threading through
          every one. The line has to arrive last and has to be DRAWN, not faded
          in, or the sequence says nothing. */}
      <path
        d={`M20 ${AXIS_Y} H700`}
        pathLength={100}
        className="ask-art-trace ask-art-traced"
        style={{ ['--trace-len' as string]: 100, ['--trace-delay' as string]: '1250ms' }}
      />
      {BANDS.map((_, i) => (
        <path
          key={i}
          d={`M${COL_X(i) + COL_W / 2} ${AXIS_Y - 6} V${AXIS_Y + 6}`}
          className="ask-art-tick ask-art-step-6"
        />
      ))}

      <text x="20" y={AXIS_Y + 28} className="ask-art-note ask-art-step-6">
        {isIllustrative
          ? 'Illustrative — the shape of a career, not your record'
          : 'One record, carried across every phase'}
      </text>
    </svg>
  );
}

export default CareerEvidenceTimeline;
