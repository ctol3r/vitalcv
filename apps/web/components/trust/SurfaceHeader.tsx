/**
 * VitalCV · Trust Surfaces · SurfaceHeader + SurfaceControlFooter
 *
 * The controlled-document header that sits above every trust surface,
 * and the matching footer that closes it. Both render as audit
 * artifacts — form number, classification, effective date, revision,
 * controlled-by — never as marketing chrome.
 *
 * The header is paired with a LineageHeader (separate component) so
 * the binding reading order (Object → Ownership → checked_at →
 * Channel → Replay → run_id) is asserted by a single source of
 * truth (`lineageCells()` in lib/trust/format.ts).
 */

import * as React from 'react';

import type { Lineage, TrustState } from '@/lib/trust/types';
import { LineageHeader } from './LineageHeader';
import { StateStamp, Mono } from './primitives';

/** Controlled-document header metadata. */
export interface SurfaceControl {
  /** Form number — e.g. "VC-PASSPORT-v1". Monospace. */
  form: string;
  /** Human-readable title shown next to the form glyph. */
  title: string;
  /** Classification stripe — e.g. "PUBLIC · DOCTRINE", "DEMO · FIXTURE". */
  classification: string;
  /** Effective ISO timestamp (mono). */
  effective: string;
  /** Revision string — e.g. "rev 1 · 2026-05-18". */
  revision: string;
  /** Authority — e.g. "did:web:vitalcv.health (design fixture)". */
  controlledBy: string;
  /** Stage stamp — preview / snapshot / signed. */
  state: TrustState;
}

export interface SurfaceHeaderProps {
  control: SurfaceControl;
  lineage: Lineage;
}

/**
 * Two-row controlled-document header:
 *   Row 1 — t-doc band: form · title · classification · effective ·
 *           revision · stage stamp.
 *   Row 2 — LineageHeader: binding cells in canonical reading order.
 */
export function SurfaceHeader({ control, lineage }: SurfaceHeaderProps) {
  return (
    <header className="t-surface" data-testid="trust-surface-header">
      <div className="t-doc">
        <div className="in">
          <div className="cell form">
            <div className="g">
              <span className="glyph" aria-hidden>
                VC
              </span>
              <div>
                <div className="nm">{control.form}</div>
                <div className="title">{control.title}</div>
              </div>
            </div>
          </div>
          <div className="cell">
            <div className="k">classification</div>
            <div className="v">
              <Mono>{control.classification}</Mono>
            </div>
          </div>
          <div className="cell">
            <div className="k">effective</div>
            <div className="v">
              <Mono>{control.effective}</Mono>
            </div>
          </div>
          <div className="cell">
            <div className="k">revision</div>
            <div className="v">
              <Mono>{control.revision}</Mono>
            </div>
          </div>
          <div className="cell">
            <div className="k">controlled_by</div>
            <div className="v">
              <Mono>{control.controlledBy}</Mono>
              <span className="sub">design fixture — not a live registry</span>
            </div>
          </div>
          <div className="cell" style={{ alignSelf: 'center' }}>
            <StateStamp state={control.state} caption="stage" />
          </div>
        </div>
      </div>

      <LineageHeader lineage={lineage} />
    </header>
  );
}

/* ───────────────────────────────────────────────────────────────────
 * SurfaceControlFooter — closes the controlled-document. Renders the
 * same form fields as the header in a compact bottom stripe so any
 * printed artifact carries the metadata on both ends.
 * ─────────────────────────────────────────────────────────────────── */
export interface SurfaceControlFooterProps {
  control: SurfaceControl;
  /** Compact identifier for this rendering (e.g. run_id). */
  runId?: string;
  /** Page-of-pages marker — e.g. "01 / 01". */
  page?: string;
}

export function SurfaceControlFooter({
  control,
  runId,
  page = '01 / 01',
}: SurfaceControlFooterProps) {
  return (
    <footer
      className="t-control"
      data-testid="trust-control-footer"
      role="contentinfo"
    >
      <div className="in">
        <div className="t-control-row">
          <span className="t-control-k mono">form</span>
          <span className="t-control-v mono">{control.form}</span>
          <span className="t-control-sep" aria-hidden>
            ·
          </span>
          <span className="t-control-k mono">rev</span>
          <span className="t-control-v mono">{control.revision}</span>
          <span className="t-control-sep" aria-hidden>
            ·
          </span>
          <span className="t-control-k mono">control</span>
          <span className="t-control-v mono">{control.controlledBy}</span>
          {runId && (
            <>
              <span className="t-control-sep" aria-hidden>
                ·
              </span>
              <span className="t-control-k mono">run_id</span>
              <span className="t-control-v mono">{runId}</span>
            </>
          )}
          <span className="t-control-spacer" />
          <span className="t-control-k mono">page</span>
          <span className="t-control-v mono">{page}</span>
        </div>
      </div>
    </footer>
  );
}
