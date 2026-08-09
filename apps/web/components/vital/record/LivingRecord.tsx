import * as React from 'react';

import {
  APERTURE_COUNT,
  ILLUSTRATION_LABEL,
  ILLUSTRATIVE_STATES,
  RECORD_EDGE,
  RECORD_MAX_WIDTH_PX,
  RECORD_PROPORTION,
  RECORD_RADIUS,
  type IllustrativeState,
  type ImplementedFace,
} from './anatomy';

/**
 * LivingRecord — the protagonist object (ILL-03), drawn from the Z0 anatomy.
 *
 * One object in different faces; never a new card wearing the same name. The
 * identity-bearing parts are constant across every face: portrait silhouette,
 * 2px top edge over 1px hairlines, the spine the rows hang from, and six
 * apertures in registry order. What changes is fill, layer and crop.
 *
 * DOM and CSS rather than SVG, for three reasons that are all requirements
 * somewhere: rows are real text (EC-5's 200% zoom and screen-reader path),
 * EC-29 forbids body copy printed inside an image, and Z0's implementation-risk
 * map already classes this composition CSS/DOM ONLY.
 *
 * The artwork is `aria-hidden`. That is not an accessibility shortcut — EC-26
 * requires that removing every scene from a surface leaves it fully usable, so
 * the meaning lives in the composition's adjacent prose and the art carries
 * none of it alone. The illustration label stays visible and announced.
 *
 * Inert by construction: no link, no button, no tabindex. An illustration that
 * can be clicked starts making promises about what clicking does.
 */

type ClaimRow = { claim: string; state: IllustrativeState };

/** Face content. Abstract by design — no source names, no values, no counts. */
const FACE_ROWS: Record<ImplementedFace, ClaimRow[]> = {
  blank: [],
  returned: [
    { claim: 'Identity', state: 'answered' },
    { claim: 'Registration', state: 'answered' },
    { claim: 'Licence', state: 'open' },
    { claim: 'Where you want to work', state: 'yours' },
  ],
  deciding: [
    { claim: 'Identity', state: 'answered' },
    { claim: 'Registration', state: 'answered' },
    { claim: 'Licence', state: 'held' },
    { claim: 'Where you want to work', state: 'yours' },
  ],
  // Z0 face 9: "Held rows are absent, not greyed."
  arrived: [
    { claim: 'Identity', state: 'answered' },
    { claim: 'Registration', state: 'answered' },
  ],
  reviewed: [
    { claim: 'Identity', state: 'answered' },
    { claim: 'Registration', state: 'answered' },
  ],
};

/** How many apertures read as open, per face. Never "hidden" — Z0 is explicit. */
const FACE_OPEN_APERTURES: Record<ImplementedFace, number> = {
  blank: APERTURE_COUNT,
  returned: 2,
  deciding: 2,
  arrived: 2,
  reviewed: 2,
};

function Aperture({ open }: { open: boolean }) {
  return (
    <span
      className="inline-block h-[7px] w-[7px] border"
      style={{
        borderRadius: `${RECORD_RADIUS.evidencePx}px`,
        borderColor: 'var(--vt-scene-paper-line)',
        background: open ? 'transparent' : 'var(--vt-scene-paper-text)',
      }}
    />
  );
}

function StateMark({ state }: { state: IllustrativeState }) {
  const { glyph, word } = ILLUSTRATIVE_STATES[state];
  // Glyph AND word, always paired, always in paper ink — no hue anywhere, so
  // this can never be mistaken for a StateChip and never carries meaning by
  // colour (EC-4). See anatomy.ts for why a real chip is wrong here.
  return (
    <span className="flex shrink-0 items-center gap-[5px] font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--vt-scene-paper-text-secondary)]">
      <span>{glyph}</span>
      <span>{word}</span>
    </span>
  );
}

function ClaimRowLine({ row }: { row: ClaimRow }) {
  return (
    // Stacked, not claim-beside-state. Beside, the marker competed with the
    // claim for width inside a portrait object and the claim lost — see the
    // note in anatomy.ts. Stacking also means the row degrades by wrapping
    // rather than by silently truncating the only meaningful label.
    <li
      className="flex flex-col gap-[4px] border-t py-[6px] first:border-t-0"
      style={{ borderColor: 'var(--vt-scene-paper-line)' }}
    >
      <span className="text-[10px] font-medium leading-tight text-[var(--vt-scene-paper-text)]">
        {row.claim}
      </span>
      <span className="flex items-center gap-2">
        {/* The returned VALUE is a redaction rule, never invented text — an
            illustration must not contain a plausible result (EC-25.1/25.3). */}
        <span
          className="block h-[3px] min-w-[18px] flex-1"
          style={{
            background: 'var(--vt-scene-paper-line)',
            borderRadius: `${RECORD_RADIUS.evidencePx}px`,
          }}
        />
        <StateMark state={row.state} />
      </span>
    </li>
  );
}

export interface LivingRecordProps {
  face: ImplementedFace;
  /** Caption rendered beneath the object; the composition supplies the prose. */
  caption?: string;
  /** `recipient` draws the smaller, lighter frame of Z0's RECIPIENT FRAME. */
  variant?: 'record' | 'recipient';
  className?: string;
}

export function LivingRecord({
  face,
  caption,
  variant = 'record',
  className,
}: LivingRecordProps) {
  const rows = FACE_ROWS[face];
  const openApertures = FACE_OPEN_APERTURES[face];
  const isRecipient = variant === 'recipient';

  return (
    <figure className={`m-0 flex flex-col gap-2 ${className ?? ''}`}>
      <div
        data-living-record=""
        data-face={face}
        data-variant={variant}
        aria-hidden="true"
        className="relative flex w-full flex-col overflow-hidden px-3 py-3"
        style={{
          // Z0 PROPORTIONS — portrait always. A landscape record reads as a
          // dashboard panel, which is the one thing it must not be.
          aspectRatio: RECORD_PROPORTION.desktop,
          // "Same object, less of it" — the recipient frame is structurally
          // smaller than the record, not smaller by whatever column it lands in.
          maxWidth: `${RECORD_MAX_WIDTH_PX[isRecipient ? 'recipient' : 'record']}px`,
          // Z0 FRONT: opaque warm paper. Never glass, and never theme-switched
          // — --vt-scene-* is declared once on :root and survives html.dark.
          background: 'var(--vt-scene-paper)',
          borderRadius: `${RECORD_RADIUS.evidencePx}px`,
          // Z0 EDGE: the signature asymmetry.
          borderStyle: 'solid',
          borderColor: isRecipient ? 'var(--vt-scene-paper-line)' : 'var(--vt-scene-paper-text)',
          borderWidth: `${RECORD_EDGE.hairlinePx}px`,
          borderTopWidth: `${RECORD_EDGE.topEdgePx}px`,
          // Z0 SHADOW: "None on evidence. Ever." Depth is overlap and edge weight.
          boxShadow: 'none',
          opacity: isRecipient ? 0.96 : 1,
        }}
      >
        {/* Z0 SOURCE APERTURES — six, in registry order, open or filled, never hidden. */}
        <div className="flex items-center gap-[5px]">
          {Array.from({ length: APERTURE_COUNT }, (_, i) => (
            <Aperture key={i} open={i >= APERTURE_COUNT - openApertures} />
          ))}
        </div>

        {/* Z0 SPINE — the vertical axis the rows hang from. */}
        <div className="relative mt-3 flex-1">
          <span
            aria-hidden="true"
            className="absolute bottom-0 left-0 top-0 w-px"
            style={{ background: 'var(--vt-scene-paper-line)' }}
          />
          <ul className="m-0 list-none pl-3">
            {rows.map((row) => (
              <ClaimRowLine key={row.claim} row={row} />
            ))}
          </ul>
        </div>

        {/* Z0 PERMISSION LAYER — a decision laid OVER facts, which is the only
            reason the object is allowed one translucent element at all. */}
        {face === 'deciding' && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 top-[38%]"
            style={{
              background: 'color-mix(in oklab, var(--vt-scene-paper-text) 8%, transparent)',
              // Depicts the approval action, so it is square (EC-20, A-2).
              borderRadius: `${RECORD_RADIUS.actionPx}px`,
              borderTop: `${RECORD_EDGE.hairlinePx}px solid var(--vt-scene-paper-text)`,
            }}
          />
        )}

        {/* Z0 CONSENT SEAL — circular, and the only circular element in the system. */}
        {(face === 'deciding' || face === 'arrived' || face === 'reviewed') && (
          <span
            aria-hidden="true"
            data-consent-seal=""
            className="absolute bottom-[9px] right-[9px] flex h-[18px] w-[18px] items-center justify-center border font-mono text-[8px]"
            style={{
              borderRadius: RECORD_RADIUS.seal,
              borderColor: 'var(--vt-scene-paper-text)',
              color: 'var(--vt-scene-paper-text)',
            }}
          >
            ✓
          </span>
        )}
      </div>

      {caption && (
        <figcaption className="text-[11px] leading-snug text-[var(--vt-scene-text-secondary)]">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

/** The label every composition carries, per the locked EC-20 illustration row. */
export function IllustrationLabel({ className }: { className?: string }) {
  return (
    <p
      data-illustration-label=""
      className={`font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--vt-scene-text-tertiary)] ${className ?? ''}`}
    >
      {ILLUSTRATION_LABEL}
    </p>
  );
}
