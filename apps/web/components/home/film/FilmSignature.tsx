import * as React from 'react';

/**
 * FilmSignature — why anyone should believe a VitalCV receipt.
 *
 * This is the scene the competitors cannot answer. Medallion and Carefam both
 * ask a buyer to trust a dashboard; neither publishes anything a buyer can
 * check independently. VitalCV signs its receipts with ES256 and publishes the
 * public key, so a verifier can check one WITHOUT trusting VitalCV. In an era
 * where a convincing-looking credential PDF takes seconds to generate, that is
 * the differentiator — and it is live today, not roadmap.
 *
 * WHAT THIS DELIBERATELY DOES NOT SAY.
 *
 * No "blockchain", "chain", "ledger", "wallet", "DID" or "verifiable
 * credential". The competitive mandate bans that vocabulary from the clinician
 * acquisition path, the YC research is explicit that VitalCV must not pitch as
 * a blockchain company, and `TRUST_ANCHORS` is a feature flag set to false —
 * anchoring is not running, so naming it would describe something that does not
 * exist. The plain-language version is both honest and stronger.
 *
 * Every value shown here is a fact about VitalCV's own signing setup — the
 * algorithm, the key id, where the key is published. Nothing here is about a
 * person, so there is nothing to fabricate.
 */

/** Published at /.well-known/jwks.json. Public by design — it is a public key. */
const SIGNING = {
  alg: 'ES256',
  curve: 'P-256',
  kid: 'vcv-es256-prod-1',
  jwks: '/.well-known/jwks.json',
} as const;

export function FilmSignature() {
  return (
    <aside className="film-record film-signature" aria-label="How a VitalCV receipt is checked">
      <header className="film-record-head">
        <span className="film-record-kicker">Signed receipt</span>
        <p className="film-record-note">
          Every receipt VitalCV issues is signed. The key that checks it is
          published, so a verifier never has to take our word for it.
        </p>
      </header>

      <ul className="film-record-lanes">
        <li className="film-record-lane">
          <div className="film-record-lane-id">
            <span className="film-record-lane-name">Signature</span>
            <span className="film-record-lane-src">
              {SIGNING.alg} · {SIGNING.curve}
            </span>
          </div>
          <span className="film-record-stamp" data-reachable="">
            <span aria-hidden="true" className="film-record-glyph">
              ◆
            </span>
            Asymmetric
          </span>
        </li>

        <li className="film-record-lane">
          <div className="film-record-lane-id">
            <span className="film-record-lane-name">Key identifier</span>
            <span className="film-record-lane-src">{SIGNING.kid}</span>
          </div>
          <span className="film-record-stamp" data-reachable="">
            <span aria-hidden="true" className="film-record-glyph">
              ◆
            </span>
            Published
          </span>
        </li>

        <li className="film-record-lane">
          <div className="film-record-lane-id">
            <span className="film-record-lane-name">Where the key lives</span>
            <span className="film-record-lane-src">{SIGNING.jwks}</span>
          </div>
          {/* A real link to a real endpoint. The claim is checkable in one
              click, which is the entire point of the scene. */}
          <a
            className="film-record-stamp film-record-stamp-link"
            href={SIGNING.jwks}
            target="_blank"
            rel="noreferrer"
          >
            <span aria-hidden="true" className="film-record-glyph">
              ↗
            </span>
            Open it
          </a>
        </li>
      </ul>

      <footer className="film-record-foot">
        A signature proves a receipt came from VitalCV unaltered. It does not
        make the underlying fact true — that still depends on the source that
        returned it, which every receipt names.
      </footer>
    </aside>
  );
}

export default FilmSignature;
