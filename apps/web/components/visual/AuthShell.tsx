import Link from 'next/link';
import * as React from 'react';

export type AuthDisclosure = {
  /** Glyph rendered in the small square — single character (e.g. "i" or "+"). */
  glyph?: string;
  label: string;
  body: React.ReactNode;
};

/**
 * Two-column auth split layout used by /sign-in and /sign-up.
 *
 * Left rail: dark ink-strong background with brand, headline (with italic
 * accent), and a stack of disclosure rows. Right rail: paper substrate
 * holding the form itself (Clerk component or custom form).
 *
 * The actual auth UI is rendered as `children`. The shell is just
 * presentational — it owns no state and never talks to an auth provider.
 */
export type AuthShellProps = {
  /** "Three things a passport gives you." style headline. JSX so callers can use <em>…</em>. */
  headline: React.ReactNode;
  disclosures: AuthDisclosure[];
  children: React.ReactNode;
};

export function AuthShell({ headline, disclosures, children }: AuthShellProps) {
  return (
    <main className="vs-page split">
      <div className="vs-auth">
        <aside className="vs-auth-left">
          <Link href="/" className="vs-brand" style={{ color: 'var(--vs-paper)' }}>
            <span className="vs-glyph">V</span>
            <span>VitalCV</span>
            <span className="vs-ver">PREVIEW</span>
          </Link>
          <h2>{headline}</h2>

          <div className="vs-auth-disclosures">
            {disclosures.map((d, index) => (
              <div key={index} className="vs-row">
                <span className="vs-ic">{d.glyph ?? 'i'}</span>
                <div>
                  <span className="vs-k">{d.label}</span>
                  <span className="vs-v">{d.body}</span>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <section className="vs-auth-right">{children}</section>
      </div>
    </main>
  );
}
