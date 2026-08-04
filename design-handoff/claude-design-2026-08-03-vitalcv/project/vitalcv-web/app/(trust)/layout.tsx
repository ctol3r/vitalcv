// VitalCV · Trust Surfaces · Shared layout
// Scopes trust.css under .trust-scope. Renders the runtime state band only —
// per-surface document control + lineage live inside each page via <SurfaceHeader />.

import * as React from "react";
import "../../styles/trust.css";

export const metadata = {
  title: "VitalCV · Trust Surfaces",
};

export default function TrustLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="trust-scope">
      <div className="t-runtime" aria-label="Runtime state band">
        <div className="in">
          <div className="grp">
            <span className="k">Runtime</span>
            <span className="v">vc.2026.05.11-a</span>
            <span className="sep">|</span>
            <span className="k">Origin</span>
            <span className="v">localhost:3030</span>
            <span className="sep">|</span>
            <span className="k">Issuer</span>
            <span className="v">did:web:vitalcv.health</span>
          </div>
          <div className="grp">
            <span className="k">Standards</span>
            <span className="v">W3C VC 2.0 · OpenID4VCI · StatusList2021 · RFC 3161</span>
          </div>
        </div>
      </div>

      <main className="t-main">{children}</main>
    </div>
  );
}
