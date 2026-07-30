/**
 * Scene artifacts — the place, the practice, and the person.
 *
 * The existing artifact set (PageArtifacts, AskHome's CheckRun/Packet) can
 * describe a DOCUMENT well: paper, rules, seals, slots. It could not draw a
 * PLACE or a PERSON, which is why every surface resolved to a variation on the
 * same grey rectangle — a hospital and a worklist were both just a box.
 *
 * These three fill that gap:
 *   HospitalArtifact  — the employer as somewhere real, drawn as an elevation
 *   SpecialtyArtifact — the practice, as a set of equal-weight glyphs
 *   ClinicianArtifact — the person, and the record that travels with them
 *
 * Same honesty grammar as every other artifact, pinned by
 * scene-artifacts.test.tsx and page-artifacts.test.tsx:
 *   - server-safe pure SVG, no client JS;
 *   - the BASE composition is the final frame — no-JS and reduced-motion
 *     readers get the whole picture, the steps only replay how it assembled;
 *   - motion plays once on entry and rests (CD-11): nothing here idles;
 *   - <text> names PARTS only — never a source, a state, or a freshness word;
 *   - value-shaped marks are redacted bars. These drawings illustrate; they
 *     never stand in for a result.
 *
 * Glass follows the 2026-07-28 ruling: illustrative artifacts may be glass,
 * real evidence surfaces stay solid (see artifact-motion.css).
 *
 * Traced paths carry pathLength={100} so --trace-len is always 100 regardless
 * of the path's real geometry — the alternative is measuring every curve by
 * hand and having it silently desync the first time someone nudges a control
 * point.
 */

import * as React from 'react';

/* ────────────────────────────────────────────────────────────────────────────
 * The hospital, as a place.
 *
 * Drawn as an architectural ELEVATION rather than an icon or an isometric
 * block (CD-13 retires isometric/3D blobs). An elevation suits the product's
 * register — it is a measured drawing of a real thing, the same family as a
 * lab report or a court docket, and it reads instantly as "a hospital" without
 * a single stock photograph or a medical-cross clip-art.
 *
 * The building is deliberately the quietest thing in the frame. The subject is
 * the packet arriving at its door and the one lit window where somebody is
 * reading it — the employer is a SETTING for a decision, not the hero.
 * ──────────────────────────────────────────────────────────────────────────── */
export function HospitalArtifact() {
  // Window grid for a wing. `lit` marks the rooms with someone behind them —
  // illustrative light, not a state signal.
  const wing = (x0: number, y0: number, cols: number, rows: number, lit: number[]) =>
    Array.from({ length: cols * rows }, (_, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      return (
        <rect
          key={`${x0}-${i}`}
          x={x0 + c * 26}
          y={y0 + r * 26}
          width={16}
          height={16}
          rx={1.5}
          className={`${lit.includes(i) ? 'ask-art-window--lit' : 'ask-art-window'} ask-art-item`}
          style={{ ['--i' as string]: i, ['--set-delay' as string]: '760ms' }}
        />
      );
    });

  return (
    <svg
      viewBox="0 0 720 400"
      className="ask-art ask-art--wide"
      role="img"
      aria-label="An elevation drawing of a hospital: two wings and a central entrance, a consented packet arriving at the door, and one lit upper room where a reviewer is reading it"
    >
      {/* ── the building ─────────────────────────────────────────── */}
      {/* left wing */}
      <rect x="48" y="150" width="150" height="184" className="ask-art-wall ask-art-step-1" />
      {/* central block, taller — the entrance mass */}
      <rect x="198" y="92" width="232" height="242" className="ask-art-wall-2 ask-art-step-1" />
      {/* right wing, stepped down again so the roofline reads as a building
          rather than a bar chart */}
      <rect x="430" y="168" width="180" height="166" className="ask-art-wall ask-art-step-1" />

      {/* roof parapets — a 4px lip is the whole difference between a building
          and three grey rectangles. */}
      <path
        d="M44 150 H202 M194 92 H434 M426 168 H614"
        className="ask-art-rule ask-art-step-1"
      />

      {/* rooftop helipad — an H in a circle. Chosen over a medical cross
          deliberately: the cross is clip-art, the pad is specific, and it says
          "this is a hospital big enough to receive" without a word of copy. */}
      <circle cx="314" cy="66" r="17" className="ask-art-glyph ask-art-step-2" />
      <path d="M308 58 V74 M320 58 V74 M308 66 H320" className="ask-art-glyph ask-art-step-2" />

      {/* ── glass curtain wall on the central block ──────────────── */}
      <rect
        x="214"
        y="112"
        width="200"
        height="118"
        rx="3"
        className="ask-art-glass ask-art-glass-in"
        style={{ ['--glass-delay' as string]: '520ms' }}
      />
      <path d="M218 116 H410" className="ask-art-glass-edge ask-art-step-2" />
      {/* mullions */}
      <path
        d="M264 112 V230 M314 112 V230 M364 112 V230 M214 171 H414"
        className="ask-art-boundary ask-art-step-3"
      />

      {/* The consequence begins only after the 1900ms + 900ms delivery trace
          has finished. Step 8 starts at 3140ms, leaving a deliberate 340ms
          pause before the room lights. The first cut used step 4; the previous
          correction used step 7 at 2680ms and was still 120ms early. */}
      <rect x="316" y="114" width="46" height="55" className="ask-art-window--lit ask-art-step-8" />
      {/* Someone appears only after the room itself has lit. */}
      <g className="ask-art-step-9">
        <circle cx="339" cy="132" r="5" className="ask-art-figure-soft" />
        <path d="M331 148 q8 -9 16 0" className="ask-art-figure-soft" />
      </g>

      {/* ── wing windows — part of the SETTING, so they arrive early ─ */}
      {wing(70, 178, 4, 5, [2, 9])}
      {wing(452, 196, 5, 4, [7])}

      {/* ── entrance ─────────────────────────────────────────────── */}
      {/* Canopy, sized to the doors it actually covers — it used to overhang
          them by 24px each side, which read as a frame around nothing. */}
      <path d="M268 288 H360" className="ask-art-rule ask-art-step-3" />
      <path d="M272 288 V334 M356 288 V334" className="ask-art-boundary ask-art-step-3" />
      {/* doors — glass, with a rule under the canopy so the entrance reads as
          the way IN rather than another blank panel */}
      <rect x="278" y="292" width="72" height="42" rx="2" className="ask-art-glass ask-art-step-3" />
      <path d="M282 296 H346" className="ask-art-glass-edge ask-art-step-3" />
      <path d="M314 292 V334" className="ask-art-rule ask-art-step-3" />

      {/* ground */}
      <path d="M24 334 H696" className="ask-art-ground ask-art-step-1" />

      {/* ── BEAT 4: the packet arrives ───────────────────────────── */}
      <g className="ask-art-step-4">
        <rect x="596" y="266" width="52" height="68" rx="3" className="ask-art-paper" />
        <path d="M606 284 H638 M606 296 H630 M606 308 H638" className="ask-art-meta" />
        <circle cx="622" cy="322" r="7" className="ask-art-seal" />
      </g>
      {/* Its path to the door — traced, because direction is the one meaning
          this motion is allowed to carry. It has to REACH the entrance: the
          first version stopped at x=386, well short of the doors, so the packet
          appeared to be travelling to nowhere in particular. */}
      <path
        d="M590 322 Q470 330 348 326"
        pathLength={100}
        className="ask-art-trace ask-art-traced"
        style={{ ['--trace-len' as string]: 100, ['--trace-delay' as string]: '1900ms' }}
      />

      {/* ── labels: parts only, in narrative order ───────────────── */}
      <text x="48" y="140" className="ask-art-label ask-art-step-1">
        the hospital
      </text>
      <text x="316" y="106" className="ask-art-label ask-art-step-8">
        review room
      </text>
      <text x="596" y="256" className="ask-art-label ask-art-step-4">
        one packet
      </text>
      <text x="48" y="364" className="ask-art-note ask-art-step-10">
        the committee still decides
      </text>
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * The specialties.
 *
 * Six glyphs at ONE stroke weight on identical glass tiles, because no
 * specialty outranks another and the drawing should not imply a ranking the
 * product does not make. Each tile is the same size for the same reason.
 *
 * The cardiac trace is the only animated stroke: it draws itself once, then
 * rests. It is the set's anchor — the one drawing everybody reads instantly.
 * ──────────────────────────────────────────────────────────────────────────── */
const SPECIALTIES: { label: string; glyph: React.ReactNode }[] = [
  {
    label: 'cardiology',
    glyph: (
      <path
        d="M6 26 H18 L23 14 L29 38 L35 22 L40 26 H54"
        pathLength={100}
        className="ask-art-trace ask-art-traced"
        style={{ ['--trace-len' as string]: 100, ['--trace-delay' as string]: '1200ms' }}
      />
    ),
  },
  {
    label: 'emergency',
    glyph: (
      // The star of life — the actual EMS standard, and six straight spokes
      // survive being drawn at 40px. The stretcher this replaced turned into an
      // unreadable table-on-wheels at tile size.
      <g className="ask-art-glyph">
        <path d="M10 24 H46" />
        <path d="M19 8.4 L37 39.6" />
        <path d="M37 8.4 L19 39.6" />
      </g>
    ),
  },
  {
    label: 'anesthesia',
    glyph: (
      // A mask and its tube. The dial-and-hook this replaced read as a magnifying
      // glass — a gauge is only legible when you already know it is a gauge.
      <g className="ask-art-glyph">
        <path d="M14 12 Q28 5 42 12 Q45 27 34 34 Q28 38 22 34 Q11 27 14 12 Z" />
        <path d="M42 26 Q52 28 52 38" />
      </g>
    ),
  },
  {
    label: 'radiology',
    glyph: (
      <g className="ask-art-glyph">
        {/* a scan window with a ribcage suggestion */}
        <rect x="10" y="8" width="40" height="34" rx="3" />
        <path d="M30 14 V38" />
        <path d="M30 20 q-9 2 -11 7 M30 20 q9 2 11 7 M30 28 q-8 2 -10 6 M30 28 q8 2 10 6" />
      </g>
    ),
  },
  {
    label: 'surgery',
    glyph: (
      // Scissors: two ring handles and crossed blades. The previous pair of
      // abstract crossed strokes just read as an X.
      <g className="ask-art-glyph">
        <circle cx="19" cy="37" r="5" />
        <circle cx="37" cy="37" r="5" />
        <path d="M21 33 L40 9" />
        <path d="M35 33 L16 9" />
      </g>
    ),
  },
  {
    label: 'nursing',
    glyph: (
      // A ward bed, side elevation — headboard, mattress, pillow, legs. The
      // "hand supporting a pulse" it replaces resolved to a dome with a
      // squiggle in it. A bed is unmistakable and carries no gendered cue the
      // way a nurse's cap would.
      <g className="ask-art-glyph">
        <path d="M8 10 V34" />
        <path d="M8 22 H50 V30 H8" />
        <rect x="13" y="15" width="14" height="7" rx="2" />
        <path d="M13 34 V41 M45 34 V41" />
      </g>
    ),
  },
];

export function SpecialtyArtifact() {
  return (
    <svg
      viewBox="0 0 720 220"
      className="ask-art ask-art--wide"
      role="img"
      aria-label="Six medical specialties drawn at equal weight on identical tiles: cardiology, emergency, anesthesia, radiology, surgery and nursing"
    >
      <text x="20" y="20" className="ask-art-label ask-art-step-1">
        where you practise
      </text>
      {SPECIALTIES.map((s, i) => {
        const x = 20 + i * 114;
        return (
          <g
            key={s.label}
            className="ask-art-item"
            style={{ ['--i' as string]: i, ['--set-delay' as string]: '200ms' }}
          >
            <rect x={x} y={30} width={100} height={110} rx={10} className="ask-art-glass" />
            <path d={`M${x + 8} 34 H${x + 92}`} className="ask-art-glass-edge" />
            <g transform={`translate(${x + 20}, 56)`}>{s.glyph}</g>
            <text x={x + 50} y={126} textAnchor="middle" className="ask-art-label">
              {s.label}
            </text>
          </g>
        );
      })}
      {/* THE POINT OF THE DRAWING. Six tiles land one by one — the many rooms
          a clinician might practise in — and only THEN does a single line draw
          itself left to right underneath all of them. That order is the whole
          argument: many rooms, then one record threading through every one.
          As a static dashed rule it said nothing; the sequence is what carries
          the meaning, so the line has to arrive last and has to be drawn, not
          faded in. */}
      <path
        d="M20 168 H700"
        pathLength={100}
        className="ask-art-trace ask-art-traced"
        style={{ ['--trace-len' as string]: 100, ['--trace-delay' as string]: '1150ms' }}
      />
      <text x="20" y="192" className="ask-art-note ask-art-step-6">
        one record, whichever room you practise in
      </text>
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * The clinician, and the record that travels with them.
 *
 * A figure, not a portrait: stroke-only, no face, no gender, no skin tone, no
 * photograph. That is a doctrine requirement (CD-13) but it is also the honest
 * choice — the product's claim is that the RECORD travels, and a specific
 * person in the drawing would quietly narrow who that is meant to be.
 * ──────────────────────────────────────────────────────────────────────────── */
export function ClinicianArtifact() {
  return (
    <svg
      viewBox="0 0 720 320"
      className="ask-art ask-art--wide"
      role="img"
      aria-label="A drawn clinician beside the record that travels with them: claim rows each carrying a source line, and the record moving on to the next application intact"
    >
      {/* ── the clinician ────────────────────────────────────────── */}
      <g className="ask-art-step-1">
        {/* head */}
        <circle cx="104" cy="62" r="20" className="ask-art-figure" />
        {/* neck */}
        <path d="M96 80 V96 M112 80 V96" className="ask-art-figure" />
        {/* The coat. Two earlier attempts read as a dome, because the body was
            a single arc from hem to hem — an arc has no shoulders. What makes a
            figure is a SLOPE that flattens: up the side, a short diagonal at
            the shoulder, then a flat collar run. */}
        <path
          d="M56 192 V148 Q56 126 76 118 L94 108 H114 L132 118 Q152 126 152 148 V192"
          className="ask-art-figure"
        />
        {/* lapels — a V opening from the collar */}
        <path d="M94 108 L104 130 L114 108" className="ask-art-figure-soft" />
        <path d="M104 130 V192" className="ask-art-figure-soft" />
        {/* The stethoscope hangs AROUND the neck and down the chest to a bell.
            The first version tucked a small U inside the coat, where it read as
            a stray mark rather than an instrument. */}
        <path
          d="M92 110 Q80 146 92 164 M116 110 Q128 146 116 164"
          pathLength={100}
          className="ask-art-trace ask-art-traced"
          style={{ ['--trace-len' as string]: 100, ['--trace-delay' as string]: '700ms' }}
        />
        <circle cx="104" cy="170" r="7" className="ask-art-seal" />
      </g>
      <path d="M40 192 H168" className="ask-art-ground ask-art-step-1" />
      <text x="56" y="212" className="ask-art-label ask-art-step-1">
        the clinician
      </text>

      {/* ── the record, on glass ─────────────────────────────────── */}
      <rect
        x="222"
        y="34"
        width="266"
        height="212"
        rx="12"
        className="ask-art-glass ask-art-glass-in"
        style={{ ['--glass-delay' as string]: '420ms' }}
      />
      <path d="M232 40 H478" className="ask-art-glass-edge ask-art-step-2" />
      <text x="244" y="24" className="ask-art-label ask-art-step-2">
        their record
      </text>

      {/* claim rows — each a line plus the shorter meta line that carries where
          it came from. The meta line is the whole argument of the product, so
          it is drawn on every row without exception. */}
      {/* The rows arrive first, bare — three facts about a career and nothing
          else. */}
      {[70, 118, 166].map((y, i) => (
        <line
          key={`row-${y}`}
          x1="244"
          y1={y}
          x2="418"
          y2={y}
          className="ask-art-line ask-art-item"
          style={{ ['--i' as string]: i, ['--set-delay' as string]: '1000ms' }}
        />
      ))}
      {/* THEN each one gains the shorter line underneath that names where it
          came from. Separating these two beats is deliberate: a claim and its
          provenance arriving together is a picture, a claim gaining its
          provenance is an argument — and the argument is the product. The
          caption lands on the same beat so the reader is told what they just
          watched happen. */}
      {[70, 118, 166].map((y, i) => (
        <line
          key={`src-${y}`}
          x1="244"
          y1={y + 16}
          x2="356"
          y2={y + 16}
          className="ask-art-meta ask-art-item"
          style={{ ['--i' as string]: i, ['--set-delay' as string]: '1800ms' }}
        />
      ))}
      <text x="244" y="228" className="ask-art-label ask-art-step-6">
        each row names its source
      </text>
      {/* Only a row that names its source gets sealed. */}
      {[70, 118, 166].map((y, i) => (
        <circle
          key={`seal-${y}`}
          cx="452"
          cy={y + 6}
          r="11"
          className="ask-art-seal ask-art-item"
          style={{ ['--i' as string]: i, ['--set-delay' as string]: '2500ms' }}
        />
      ))}

      {/* ── it travels ──────────────────────────────────────────── */}
      <path
        d="M496 140 H566"
        pathLength={100}
        className="ask-art-trace ask-art-traced"
        style={{ ['--trace-len' as string]: 100, ['--trace-delay' as string]: '3050ms' }}
      />
      <g className="ask-art-step-9">
        <rect x="574" y="76" width="112" height="128" rx="6" className="ask-art-glass-tint" />
        <path d="M594 112 H666 M594 132 H646 M594 152 H666" className="ask-art-meta" />
        <text x="574" y="66" className="ask-art-label">
          next application
        </text>
      </g>
      <text x="222" y="288" className="ask-art-note ask-art-step-10">
        carried, not re-typed
      </text>
    </svg>
  );
}
