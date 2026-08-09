import * as React from 'react';

import { VitalPill } from '../VitalPill';
import { RECORD_EDGE, RECORD_RADIUS } from './anatomy';

/**
 * SourceKiosk — an issuer, drawn as scene furniture (ILL-03).
 *
 * Not part of the record's anatomy, and deliberately so: Z0's parts list
 * describes the object a clinician owns, and an issuer is an actor outside it.
 * The kiosk therefore sits on the dark scene register while the record stays
 * paper — the material difference IS the boundary, before any label is read.
 *
 * Truth constraints this component encodes rather than trusts a caller with:
 *
 *  - `kind` is a closed union of CATEGORIES, never a source name. EC-25.2 bans
 *    a scene implying a source response that did not occur or a source that is
 *    not integrated, and naming "NPPES" or "Nursys" in artwork is exactly how
 *    an illustration starts looking like a result. Categories cannot.
 *  - `limitation` is required, not optional. An issuer contributes one fact
 *    with a known edge; a kiosk that can omit its limitation would quietly
 *    become a certification of the whole person.
 *  - There is no "confirmed" or "cleared" affordance at all. The kiosk releases
 *    a fact; it never signs off on anyone.
 *
 * The name renders as a VitalPill — a word-label, which EC-20 as amended A-2
 * still permits the pill for. Nothing here depicts an action, so nothing here
 * is square-cornered by that rule.
 */

export type SourceKioskKind = 'training' | 'licensing' | 'certification';

/**
 * Each kiosk gets a distinct roof so the three read apart in silhouette — the
 * arch of a school, the louvred front of a records cabinet, the struck circle
 * of a seal. Ported from the founder's ILL prototype, which is where the idea
 * of giving issuers a recognisable architecture came from; the shapes do the
 * telling-apart so the labels do not have to shout.
 */
const KIOSK: Record<
  SourceKioskKind,
  { label: string; contributes: string; limitation: string; roof: 'arch' | 'cabinet' | 'seal' }
> = {
  training: {
    label: 'A training record',
    contributes: 'That the training was completed, and when',
    limitation: 'Not that you are licensed to practise today',
    roof: 'arch',
  },
  licensing: {
    label: 'A licensing board',
    contributes: 'The status it holds, on the date it answered',
    limitation: 'Only for its own state, and only as of that date',
    roof: 'cabinet',
  },
  certification: {
    label: 'A certification body',
    contributes: 'Whether a certification is on file',
    limitation: 'Not a judgement about your practice',
    roof: 'seal',
  },
};

function Roof({ shape }: { shape: 'arch' | 'cabinet' | 'seal' }) {
  // --vt-scene-line-strong, not panel-raised: at #232120 on #1D1B19 the roofs
  // measured about 1.1:1 against the kiosk body and the three shapes were
  // indistinguishable on screen — which loses the entire reason for having
  // them. The roof is structure, so it takes the structural rule colour.
  const base: React.CSSProperties = {
    height: shape === 'arch' ? 16 : 12,
    background: 'var(--vt-scene-line-strong)',
    borderBottom: `${RECORD_EDGE.hairlinePx}px solid var(--vt-scene-line)`,
  };
  if (shape === 'arch') base.borderRadius = '40px 40px 0 0';
  if (shape === 'cabinet') {
    base.background =
      'repeating-linear-gradient(90deg, var(--vt-scene-line-strong) 0 9px, var(--vt-scene-panel) 9px 11px)';
  }
  return (
    <div aria-hidden="true" className="relative -mx-3 -mt-3 mb-2.5" style={base}>
      {shape === 'seal' && (
        <span
          className="absolute left-1/2 top-[1px] block h-[10px] w-[10px] -translate-x-1/2 border"
          // Ink, not brass. The prototype's brass seal would have introduced a
          // hue with no token behind it; the shape carries the meaning anyway.
          style={{ borderRadius: '9999px', borderColor: 'var(--vt-scene-text-secondary)' }}
        />
      )}
    </div>
  );
}

export interface SourceKioskProps {
  kind: SourceKioskKind;
  className?: string;
}

export function SourceKiosk({ kind, className }: SourceKioskProps) {
  const { label, contributes, limitation, roof } = KIOSK[kind];

  return (
    <div
      data-source-kiosk=""
      data-kind={kind}
      className={`flex flex-col gap-2 overflow-hidden px-3 py-3 ${className ?? ''}`}
      style={{
        background: 'var(--vt-scene-panel)',
        border: `${RECORD_EDGE.hairlinePx}px solid var(--vt-scene-line)`,
        borderRadius: `${RECORD_RADIUS.evidencePx}px`,
        boxShadow: 'none',
      }}
    >
      <Roof shape={roof} />
      <VitalPill label={label} />
      <p className="text-[11px] leading-snug text-[var(--vt-scene-text-secondary)]">
        Contributes: {contributes}
      </p>
      <p className="text-[11px] leading-snug text-[var(--vt-scene-text-tertiary)]">
        Does not mean: {limitation}
      </p>
    </div>
  );
}
