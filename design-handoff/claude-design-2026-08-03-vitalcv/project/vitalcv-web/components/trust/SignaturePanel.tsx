// VitalCV · Trust Surfaces · SignaturePanel
// Canon v1 · §05 — issuer continuity in 4 cells. Must be present on every signed surface.

import * as React from "react";
import type { SignerContinuity } from "@/lib/trust/types";

export function SignaturePanel({ signer }: { signer: SignerContinuity }) {
  const pct = Math.min(100, (signer.activeKeyInServiceDays / signer.activeKeyRotationDays) * 100);
  return (
    <section className="t-sig" aria-label="Issuer continuity">
      <header className="hd">
        <span>
          <strong>Issuer continuity</strong> · trust path goes around VitalCV — verifiable offline against{" "}
          <code>{signer.did}</code>
        </span>
        <span>last re-attested 2 d ago</span>
      </header>
      <div className="body">
        <div className="col">
          <div className="k">Active signing key</div>
          <div className="v">
            {signer.activeKeyFingerprint}
            <span className="sub">
              ed25519 · in service {signer.activeKeyInServiceDays} d
            </span>
          </div>
          <div
            className="age"
            title={`${signer.activeKeyInServiceDays} / ${signer.activeKeyRotationDays} d`}
          >
            <div className="f" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="col">
          <div className="k">DID document</div>
          <div className="v">
            {signer.didDocumentUrl}
            <span className="sub">200 OK · pinned</span>
          </div>
        </div>
        <div className="col">
          <div className="k">Status list</div>
          <div className="v">
            StatusList2021
            <span className="sub">{signer.statusListUrl}</span>
          </div>
        </div>
        <div className="col">
          <div className="k">Backup signer</div>
          <div className="v">
            {signer.backupKeyFingerprint}
            <span className="sub">
              HSM-resident · quorum {signer.quorumAvailable} of {signer.quorumRequired} ·{" "}
              {signer.backupKeyArmed ? "armed" : "cold"}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
