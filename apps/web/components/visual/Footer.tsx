import Link from 'next/link';
import * as React from 'react';

/**
 * Full visual-system footer — 4-column grid + bottom trust-row + disclaimer.
 * Used on Overview, Trust, Trust/Attribution, Status routes.
 *
 * For routes that need only the bottom strip (e.g. Passport's signed
 * receipt line), use `FooterBottom` instead.
 */
export function Footer({
  receipt = 'VS-D57-0001 · ed25519',
  lastRead = '09:14 UTC · 3 of 4 sources responding',
}: {
  receipt?: string;
  lastRead?: string;
}) {
  return (
    <footer className="vs-footer">
      <div className="vs-footer-in">
        <div className="vs-brand-blob">
          <Link href="/" className="vs-brand">
            <span className="vs-glyph">V</span>
            <span>VitalCV</span>
          </Link>
          <p>
            Reusable, source-backed clinician readiness. VitalCV reads public registries and shows
            their state — the institution decides.
          </p>
          <div className="vs-scope">
            <span>
              <b>Scope</b> · public-source reader · review-bounded
            </span>
            <span>
              <b>Not</b> · a credentialing body · not final approval
            </span>
          </div>
        </div>
        <div className="vs-col">
          <span className="vs-ttl">Product</span>
          <Link href="/passport?npi=1699264564">Passport</Link>
          <Link href="/trust">Trust register</Link>
          <Link href="/trust/attribution">Source attribution</Link>
          <Link href="/status">Connector status</Link>
        </div>
        <div className="vs-col">
          <span className="vs-ttl">Account</span>
          <Link href="/sign-in">Sign in</Link>
          <Link href="/sign-up">Get a passport</Link>
          <Link href="/contact">Talk to us</Link>
        </div>
        <div className="vs-col">
          <span className="vs-ttl">Sources read</span>
          <Link href="/trust/attribution#nppes">NPPES · CMS</Link>
          <Link href="/trust/attribution#abms">ABMS</Link>
          <Link href="/trust/attribution#oig">OIG LEIE</Link>
          <Link href="/trust/attribution#state">State boards</Link>
        </div>
      </div>
      <div className="vs-footer-bottom">
        <span className="vs-truth-row">
          <span className="vs-dot" />
          Last read {lastRead}
        </span>
        <span className="vs-sp" />
        <span>© 2026 VitalCV · Preview build D57</span>
        <span>Receipt {receipt}</span>
      </div>
      <div
        className="vs-footer-in"
        style={{ gridTemplateColumns: '1fr', paddingTop: 0, paddingBottom: 18 }}
      >
        <p className="vs-disclaimer">
          VitalCV does not credential clinicians and does not assert HIPAA, SOC 2, or NCQA
          accreditation status. Source reads reflect public registries at the times shown.
          Institutions retain full authority over hiring, privileging, and renewal decisions.
        </p>
      </div>
    </footer>
  );
}

/** Compact bottom-only footer for the passport (and other tight surfaces). */
export function FooterBottom({
  left,
  right,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <footer className="vs-footer">
      <div className="vs-footer-bottom">
        <span className="vs-truth-row">
          <span className="vs-dot" />
          {left}
        </span>
        <span className="vs-sp" />
        <span>{right}</span>
      </div>
    </footer>
  );
}
