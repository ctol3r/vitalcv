import * as React from 'react';
import Link from 'next/link';

/**
 * LegalShell — wave1505 legal-template chrome (DG-12.3), applied to the real,
 * test-true legal content. Provides the paper/ink page, cross-document tabs,
 * a Fraunces heading + mono "last updated" stamp, and a `.wv-legal` prose
 * scope whose injected styles force the wave1505 palette onto descendant
 * headings/body/links/tables — so the existing content reads correctly on the
 * forced paper background regardless of the app's light/dark theme.
 *
 * The page CONTENT (and every test-pinned string) is passed in as children and
 * left untouched; only the surrounding chrome + typography change.
 *
 * Design Handoff Reference:
 *   design-handoff/claude-design-2026-07-12-wave1505/wave1505/w1505-legal.jsx
 */

const paper = '#f4f2ec';
const card = '#ffffff';
const ink = '#141414';
const rule = '#dddbd3';
const ruleSoft = '#e7e4dc';
const textSecondary = '#474540';
const textMuted = '#6b6860';
const textFaint = '#8a8780';
const displayFont = "var(--font-display, 'Fraunces', Georgia, serif)";
const monoFont = "var(--font-mono, 'Geist Mono', ui-monospace, monospace)";
const bodyFont = "var(--font-body, 'Geist', ui-sans-serif, system-ui, sans-serif)";

export type LegalDocKey = 'privacy' | 'terms' | 'dpa' | 'cookies';

const DOCS: ReadonlyArray<{ key: LegalDocKey; label: string; href: string }> = [
  { key: 'privacy', label: 'Privacy', href: '/privacy' },
  { key: 'terms', label: 'Terms', href: '/terms' },
  { key: 'dpa', label: 'DPA', href: '/legal/dpa' },
  { key: 'cookies', label: 'Cookies', href: '/legal/cookies' },
];

// Scoped to `.wv-legal` so nothing leaks into the app shell. Element+class
// selectors (specificity 0,1,1) beat Tailwind single-class utilities (0,1,0),
// so the existing content's `text-muted-foreground` etc. are overridden here.
const SCOPED_CSS = `
.wv-legal-page { background: ${paper}; color: ${ink}; min-height: 100vh; box-sizing: border-box;
  font-family: ${bodyFont}; }
.wv-legal-wrap { max-width: 860px; margin: 0 auto; padding: 56px 24px 80px; }
.wv-legal-tabs { display: flex; flex-wrap: wrap; gap: 2px; margin-bottom: 28px; }
/* EC-5 44px floor: 8px padding on a 10.5px mono line box measured 30px tall.
   inline-flex + min-height grows the bordered box to the floor; the label stays
   optically centred and the horizontal padding is unchanged. */
.wv-legal-tab { font-family: ${monoFont}; font-size: 10.5px; font-weight: 600; letter-spacing: 0.1em;
  text-transform: uppercase; text-decoration: none; color: ${textSecondary};
  display: inline-flex; align-items: center; min-height: 44px;
  padding: 0 14px; border: 1px solid ${rule}; border-radius: 2px; }
.wv-legal-tab:hover { color: ${ink}; border-color: ${ruleSoft}; }
.wv-legal-tab[aria-current="page"] { color: ${paper}; background: ${ink}; border-color: ${ink}; }
.wv-legal-eyebrow { font-family: ${monoFont}; font-size: 10px; font-weight: 500; letter-spacing: 0.2em;
  text-transform: uppercase; color: ${textFaint}; }
.wv-legal-title { font-family: ${displayFont}; font-weight: 560; font-size: 40px; line-height: 1.08;
  letter-spacing: -0.02em; margin: 10px 0 0; color: ${ink}; }
.wv-legal-stamp { font-family: ${monoFont}; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase;
  color: ${textMuted}; margin: 14px 0 0; display: flex; gap: 14px; flex-wrap: wrap; }
.wv-legal { max-width: 65ch; margin-top: 36px; }
.wv-legal section { padding: 24px 0; border-top: 1px solid ${ruleSoft}; }
.wv-legal section:first-child { border-top: none; padding-top: 0; }
.wv-legal h2 { font-family: ${displayFont}; font-weight: 560; font-size: 20px; letter-spacing: -0.01em;
  color: ${ink}; margin: 0 0 4px; }
.wv-legal h3 { font-family: ${displayFont}; font-weight: 560; font-size: 16px; color: ${ink}; margin: 0 0 4px; }
.wv-legal p, .wv-legal li { font-size: 14px; line-height: 1.75; color: ${textSecondary}; }
.wv-legal p { margin: 12px 0 0; }
.wv-legal ul, .wv-legal ol { margin: 12px 0 0; padding-left: 20px; }
.wv-legal li { margin-top: 6px; }
.wv-legal strong { color: ${ink}; font-weight: 600; }
.wv-legal a { color: ${ink}; text-decoration: underline; text-underline-offset: 2px; }
.wv-legal a:hover { color: #1f2c22; }
.wv-legal .prose { color: ${textSecondary}; max-width: none; }
.wv-legal table { width: 100%; border-collapse: collapse; margin-top: 14px; }
.wv-legal th { font-family: ${monoFont}; font-size: 9.5px; font-weight: 600; letter-spacing: 0.14em;
  text-transform: uppercase; color: ${textFaint}; text-align: left; padding: 8px 12px 8px 0;
  border-bottom: 1px solid ${rule}; }
.wv-legal td { font-size: 12.5px; line-height: 1.5; color: ${ink}; padding: 9px 12px 9px 0;
  border-bottom: 1px solid ${ruleSoft}; vertical-align: top; }
.wv-legal footer { margin-top: 40px; border-top: 1px solid ${rule}; padding-top: 24px;
  font-family: ${monoFont}; font-size: 10.5px; line-height: 1.7; letter-spacing: 0.02em; color: ${textMuted}; }
`;

export function LegalShell({
  activeDoc,
  eyebrow = 'Legal',
  title,
  updated,
  children,
}: {
  activeDoc: LegalDocKey;
  eyebrow?: string;
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="wv-legal-page">
      <style dangerouslySetInnerHTML={{ __html: SCOPED_CSS }} />
      <div className="wv-legal-wrap">
        <nav className="wv-legal-tabs" aria-label="Legal documents">
          {DOCS.map((d) => (
            <Link
              key={d.key}
              href={d.href}
              className="wv-legal-tab"
              aria-current={d.key === activeDoc ? 'page' : undefined}
            >
              {d.label}
            </Link>
          ))}
        </nav>
        <header>
          <span className="wv-legal-eyebrow">{eyebrow}</span>
          <h1 className="wv-legal-title">{title}</h1>
          <p className="wv-legal-stamp">
            <span>Last updated {updated}</span>
            <span>vitalcv.com</span>
          </p>
        </header>
        <div className="wv-legal">{children}</div>
      </div>
    </main>
  );
}
