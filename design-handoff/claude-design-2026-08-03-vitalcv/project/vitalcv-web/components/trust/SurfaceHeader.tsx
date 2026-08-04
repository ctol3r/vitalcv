// VitalCV · Trust Surfaces · SurfaceHeader
// Composes (1) Document Control band — regulated-doc header with form #, classification,
// effective date, controlled-by — and (2) State stamp — PREVIEW / SNAPSHOT / SIGNED —
// and (3) the canonical LineageHeader. Renders on every surface.
//
// This component is what makes the UI read as regulated infrastructure rather than
// startup software. The control header borrows form-number / classification / revision
// vocabulary from FDA / NIST controlled-document conventions.

import * as React from "react";
import type { Lineage, TrustState } from "@/lib/trust/types";
import { LineageHeader } from "./LineageHeader";

export interface SurfaceControl {
  /** form number — e.g. "VC-PASSPORT-v1", "VC-VERIFY-v1" */
  form: string;
  /** human surface name — e.g. "Provider passport" */
  title: string;
  /** classification — e.g. "PUBLIC · SIGNED", "PUBLIC · SNAPSHOT" */
  classification: string;
  /** effective date — ISO date or "rolling" */
  effective: string;
  /** revision — e.g. "rev 11 · 2026-05-11" */
  revision: string;
  /** controlled-by — DID or org name */
  controlledBy: string;
  /** state — drives the stamp watermark */
  state: TrustState;
}

export function SurfaceHeader({
  control,
  lineage,
}: {
  control: SurfaceControl;
  lineage: Lineage;
}) {
  const stateLabel =
    control.state === "preview" ? "preview" : control.state === "snapshot" ? "snapshot" : "signed";
  return (
    <>
      <section className="t-doc" aria-label="Document control">
        <div className="in">
          <div className="cell form">
            <div className="g">
              <span className="glyph">V</span>
              <span className="nm">VitalCV / Trust</span>
            </div>
            <div className="title">{control.title}</div>
          </div>

          <div className="cell">
            <div className="k">Form</div>
            <div className="v">
              {control.form}
              <span className="sub">controlled artifact</span>
            </div>
          </div>

          <div className="cell">
            <div className="k">Classification</div>
            <div className="v">
              {control.classification}
              <span className="sub">audience · trust state</span>
            </div>
          </div>

          <div className="cell">
            <div className="k">Effective</div>
            <div className="v">
              {control.effective}
              <span className="sub">{control.revision}</span>
            </div>
          </div>

          <div className="cell">
            <div className="k">Controlled by</div>
            <div className="v">
              {control.controlledBy}
              <span className="sub">issuer · signer of record</span>
            </div>
          </div>

          <div className="cell" style={{ borderLeft: 0 }}>
            <div
              className="t-stamp"
              data-state={control.state}
              aria-label={`Trust state · ${stateLabel}`}
            >
              <span className="lb">trust state</span>
              <span className="v">{stateLabel}</span>
            </div>
          </div>
        </div>
      </section>

      <div style={{ marginTop: 18 }}>
        <LineageHeader lineage={lineage} />
      </div>
    </>
  );
}

/** Render at end of page; mirrors document-control facts with revision / page / verify-url. */
export function SurfaceControlFooter({
  control,
  lineage,
  verifyUrl,
  pageOf,
}: {
  control: SurfaceControl;
  lineage: Lineage;
  verifyUrl: string;
  pageOf?: { n: number; of: number };
}) {
  return (
    <section className="t-control" aria-label="Controlled-document footer">
      <div className="in">
        <div className="cell">
          <div className="k">Form / revision</div>
          <div className="v">
            {control.form} · {control.revision}
            <span className="sub">{control.title}</span>
          </div>
        </div>
        <div className="cell">
          <div className="k">Signed by</div>
          <div className="v">
            {control.controlledBy}
            <span className="sub">issuer of record</span>
          </div>
        </div>
        <div className="cell">
          <div className="k">run_id</div>
          <div className="v">
            {lineage.runId}
            <span className="sub">batch · committed</span>
          </div>
        </div>
        <div className="cell">
          <div className="k">Verify</div>
          <div className="v">
            {verifyUrl}
            <span className="sub">offline re-verifiable</span>
          </div>
        </div>
        <div className="cell">
          <div className="k">Page</div>
          <div className="v">
            {pageOf ? `${pageOf.n} of ${pageOf.of}` : "1 of 1"}
            <span className="sub">controlled document</span>
          </div>
        </div>
      </div>
    </section>
  );
}
