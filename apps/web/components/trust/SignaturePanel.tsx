/**
 * VitalCV · Trust Surfaces · SignaturePanel v1
 *
 * Inverted dark surface reserved for the cryptographic plane:
 * signer display, fingerprint fixture, chain context. The canon
 * rule: inverted/dark surfaces are ONLY used for signature / chain /
 * signed-receipt areas. The CSS class `t-sig` is the only carrier of
 * that visual register.
 *
 * Hard safety contract:
 *   - No real ed25519 / RSA / EC key bytes ever rendered.
 *   - The signer fingerprint MUST be prefixed `fixture:` so it can't
 *     be mistaken for a live key.
 *   - The signer label MUST be one of {"design fixture",
 *     "demo signer fixture"} (typed in lib/trust/types.ts).
 *   - No "live signature verification" copy.
 */

import * as React from 'react';

import type { SignerFixture } from '@/lib/trust/types';
import { Mono } from './primitives';

export interface SignaturePanelProps {
  signer: SignerFixture;
  /** Optional canonical-payload short hash (fixture). */
  payloadHashFixture?: string;
  /** Optional "what this signs" caption. */
  caption?: string;
}

export function SignaturePanel({
  signer,
  payloadHashFixture,
  caption,
}: SignaturePanelProps) {
  // Defensive: refuse to render real-looking fingerprints.
  // A real ed25519 key is 64 hex chars; a fixture must announce itself.
  const fingerprintLooksFixture =
    typeof signer.fingerprintFixture === 'string' &&
    signer.fingerprintFixture.startsWith('fixture:');

  return (
    <section
      className="t-sig"
      data-testid="trust-signature-panel"
      data-fixture={String(fingerprintLooksFixture)}
      aria-label="Signature fixture (cryptographic plane)"
    >
      <header className="t-sig-head">
        <span className="t-sig-eye mono">cryptographic plane · fixture only</span>
        <span className="t-sig-tag mono">{signer.label}</span>
      </header>

      <div className="t-sig-grid">
        <div className="t-sig-row">
          <div className="t-sig-k mono">signer</div>
          <div className="t-sig-v">
            <Mono>{signer.displayName}</Mono>
          </div>
        </div>
        <div className="t-sig-row">
          <div className="t-sig-k mono">fingerprint</div>
          <div className="t-sig-v">
            {fingerprintLooksFixture ? (
              <Mono>{signer.fingerprintFixture}</Mono>
            ) : (
              <Mono>fixture:placeholder-not-a-real-key</Mono>
            )}
          </div>
        </div>
        {payloadHashFixture && (
          <div className="t-sig-row">
            <div className="t-sig-k mono">payload_hash</div>
            <div className="t-sig-v">
              <Mono>{payloadHashFixture}</Mono>
              <span className="t-sig-sub">fixture digest — not a live hash</span>
            </div>
          </div>
        )}
      </div>

      {caption && <p className="t-sig-caption">{caption}</p>}

      <footer className="t-sig-foot">
        <span className="t-sig-foot-copy">
          This panel renders a design fixture. It does not assert live
          signature verification, key continuity, or attribution to any
          live registry.
        </span>
      </footer>
    </section>
  );
}
