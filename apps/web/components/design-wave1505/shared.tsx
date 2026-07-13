'use client';

/**
 * Wave 1505 port — shell: hash router, nav, footer, prototype bar,
 * FeedbackWidget (DG-12.5), OfflineBanner (DG-12.2.3), EmptyState,
 * SkeletonStack, page scaffold. Ported from wave1505/w1505-shared.jsx.
 *
 * Port adaptations (each documented at the site):
 *  - cross-wave prototype links (../wave1501/index.html etc.) point at the
 *    real app routes ('/', '/status') instead;
 *  - a DesignRefNote strip marks the whole surface as a design reference so
 *    its fixture content is never mistaken for live product pages;
 *  - the FeedbackWidget "sent" state says plainly that the prototype
 *    transmits nothing.
 */

import * as React from 'react';
import Link from 'next/link';
import { PrimaryButton, QuietButton, SecondaryButton, StateChip, TrustGlyph, VtLogo } from './kit';

/* ---------- hash router ---------- */
export interface Route5 {
  name: string;
  sub?: string;
  doc?: string;
  requested?: string;
}

export const parseRoute5 = (h?: string): Route5 => {
  const hash = h || (typeof window === 'undefined' ? '#/' : window.location.hash || '#/');
  const seg = hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean);
  if (!seg.length) return { name: 'index' };
  if (seg[0] === 'auth') {
    const sub = seg[1] || 'overview';
    if (['sign-in', 'sign-up', 'verify', 'loading', 'overview'].includes(sub)) return { name: 'auth', sub };
    return { name: '404', requested: hash };
  }
  if (seg[0] === '404') return { name: '404', requested: '/passport/old-share-link' };
  if (seg[0] === 'error') return { name: 'error' };
  if (seg[0] === 'system') return { name: 'system' };
  if (seg[0] === 'legal') {
    const doc = seg[1] || 'privacy';
    if (['privacy', 'terms', 'dpa', 'cookies'].includes(doc)) return { name: 'legal', doc };
    return { name: '404', requested: hash };
  }
  if (seg[0] === 'contact') return { name: 'contact' };
  if (seg[0] === 'pricing') return { name: 'pricing' };
  if (seg[0] === 'audit') return { name: 'audit' };
  if (seg[0] === 'dev') return { name: 'devdesign' };
  if (seg[0] === 'governance') return { name: 'governance' };
  return { name: '404', requested: hash };
};

export const useRoute5 = (): Route5 => {
  const [route, setRoute] = React.useState<Route5>(() => parseRoute5());
  React.useEffect(() => {
    // The initial state was computed before hydration could see the hash on
    // first client render; recompute once on mount, then follow hash changes.
    setRoute(parseRoute5());
    const fn = () => { setRoute(parseRoute5()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', fn);
    return () => window.removeEventListener('hashchange', fn);
  }, []);
  return route;
};

/* ---------- nav ---------- */
export const S5_ROUTES = [
  { hash: '#/', label: 'Index', match: 'index' },
  { hash: '#/auth', label: 'Auth', match: 'auth' },
  { hash: '#/system', label: 'System states', match: 'system' },
  { hash: '#/legal/privacy', label: 'Legal', match: 'legal' },
  { hash: '#/contact', label: 'Contact', match: 'contact' },
  { hash: '#/pricing', label: 'Pricing', match: 'pricing' },
  { hash: '#/audit', label: 'Audit', match: 'audit' },
  { hash: '#/dev/design', label: '/dev/design', match: 'devdesign' },
  { hash: '#/governance', label: 'Governance', match: 'governance' },
];

export const S5Nav = ({ route }: { route: Route5 }) => (
  <header className="s5-nav">
    <div className="s5-container s5-nav-inner">
      {/* port: brand exits to the real app home, not the wave1501 prototype */}
      <Link className="s5-brand-link" href="/" aria-label="VitalCV home">
        <VtLogo size={18} />
      </Link>
      <span className="vt-eyebrow" style={{ whiteSpace: 'nowrap' }}>Wave 1505 · system &amp; governance</span>
      <nav className="s5-tabs" aria-label="Wave 1505 surfaces">
        {S5_ROUTES.map((r) => (
          <a key={r.hash} className="s5-tab" href={r.hash}
            aria-current={route.name === r.match ? 'page' : undefined}>{r.label}</a>
        ))}
      </nav>
    </div>
  </header>
);

/* ---------- design-reference strip (port addition) ----------
   Mirrors the wave1503 DemoStrip grammar. Keeps the surface honest: the
   legal text, pricing figures, receipts, and audit results below are design
   fixtures, not the live product pages. */
export const DesignRefNote = () => (
  <div className="s5-ref no-print" role="note" aria-label="Design reference notice">
    <div className="s5-container s5-ref-inner">
      <span className="glyph"><TrustGlyph state="notDecisionGrade" size={12} /></span>
      <span>Design reference · wave 1505 · content is illustrative fixture data — the live product pages remain canonical</span>
    </div>
  </div>
);

/* ---------- footer ---------- */
export const S5Footer = () => (
  <footer className="s5-foot">
    <div className="s5-container">
      <p className="s5-boundary">
        <TrustGlyph state="notDecisionGrade" size={16} />
        <span>Every state designed — <span className="vt-accent-i">especially</span> the ones nobody sees twice.</span>
      </p>
      <ul className="s5-foot-links">
        <li><a href="#/legal/privacy">Privacy</a></li>
        <li><a href="#/legal/terms">Terms</a></li>
        <li><a href="#/legal/dpa">DPA</a></li>
        <li><a href="#/legal/cookies">Cookies</a></li>
        <li><a href="#/contact">Contact</a></li>
        {/* port: the wave1504 prototype status page → the real /status route */}
        <li><Link href="/status">Status</Link></li>
        <li><a href="#/dev/design">/dev/design</a></li>
      </ul>
      <p className="s5-foot-base">© 2026 VitalCV · did:web:vitalcv.com · Doctrine v1.0 · A partial proof stays partial.</p>
    </div>
  </footer>
);

/* ---------- prototype bar (chrome-less full-page states) ---------- */
export const ProtoBar = ({ viewing }: { viewing?: { href: string; label: string } }) => (
  <nav className="s5-proto no-print" aria-label="Prototype navigation">
    <a href="#/">← Wave 1505 index</a>
    {viewing ? <a href={viewing.href} aria-current="page">{viewing.label}</a> : null}
  </nav>
);

/* ---------- page scaffold ---------- */
export const S5Page = ({ eyebrow, title, lede, children, label }: {
  eyebrow?: string; title: React.ReactNode; lede?: string; children?: React.ReactNode; label?: string;
}) => (
  <div className="s5-fade" data-screen-label={label || (typeof title === 'string' ? title : undefined)}>
    <div className="s5-container s5-doctrine">
      {eyebrow ? <span className="vt-eyebrow">{eyebrow}</span> : null}
      <h1>{title}</h1>
      {lede ? <p className="lede">{lede}</p> : null}
    </div>
    {children}
  </div>
);

export const S5Section = ({ eyebrow, title, lede, first, children, id }: {
  eyebrow?: string; title?: string; lede?: string; first?: boolean; children?: React.ReactNode; id?: string;
}) => (
  <section id={id} className={`s5-section${first ? ' first' : ''}`}>
    <div className="s5-container">
      {(eyebrow || title || lede) ? (
        <div className="s5-sechead">
          {eyebrow ? <span className="vt-eyebrow">{eyebrow}</span> : null}
          {title ? <h2>{title}</h2> : null}
          {lede ? <p className="lede">{lede}</p> : null}
        </div>
      ) : null}
      {children}
    </div>
  </section>
);

/* ---------- OfflineBanner (DG-12.2.3) ----------
   Dashed rule = degraded semantics (never opacity). role="status",
   polite announcement. `inline` renders the pattern inside flow for
   the gallery; default is sticky under the nav at --vt-z-banner. */
export const OfflineBanner = ({ inline, onRetry }: { inline?: boolean; onRetry?: () => void }) => (
  <div className={`off-banner${inline ? ' inline' : ''}`} role="status" aria-live="polite">
    <div className={inline ? 'off-inner' : 's5-container off-inner'}>
      <span className="off-glyph"><TrustGlyph state="unavailable" size={14} /></span>
      <span className="off-label">Connection lost</span>
      <span className="off-copy">Showing the last checked data — freshness stamps stay honest.</span>
      <span className="off-act"><QuietButton small onClick={onRetry}>Retry now</QuietButton></span>
    </div>
  </div>
);

/* ---------- EmptyState (DG-12.2.4) ----------
   Honest and calm: glyph in a plain frame (solid rule — dashed is
   reserved for degraded), one Fraunces line, one reason, ONE action. */
export const EmptyState = ({ glyph = 'pending', title, why, action, onAction, secondary }: {
  glyph?: string; title: string; why: string; action?: string; onAction?: () => void; secondary?: boolean;
}) => (
  <div className="empty-card" role="status">
    <span className="empty-glyph"><TrustGlyph state={glyph} size={20} /></span>
    <h3>{title}</h3>
    <p className="why">{why}</p>
    {action ? (
      <span className="act">
        {secondary
          ? <SecondaryButton onClick={onAction}>{action}</SecondaryButton>
          : <PrimaryButton onClick={onAction}>{action}</PrimaryButton>}
      </span>
    ) : null}
  </div>
);

/* ---------- SkeletonStack — loading placeholder (allowed shimmer) ---------- */
export const SkeletonStack = ({ lines = ['w80', 'w60', 'w40'] }: { lines?: string[] }) => (
  <div className="sk-stack" role="status" aria-label="Loading">
    {lines.map((w, i) => <span key={i} className={`sk-line ${w}`}></span>)}
  </div>
);

/* ---------- FeedbackWidget (DG-12.5) ----------
   Right-edge vertical tab at mid-height: never overlaps bottom CTAs at
   360px by construction. z from the token scale. Non-modal panel,
   Escape closes, focus returns to the tab. */
export const FeedbackWidget = () => {
  const [open, setOpen] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [msg, setMsg] = React.useState('');
  const tabRef = React.useRef<HTMLButtonElement>(null);
  const areaRef = React.useRef<HTMLTextAreaElement>(null);
  // port fix: the prototype focused the tab synchronously on close, but the
  // tab is unmounted while the panel is open, so focus never returned. Honor
  // the documented contract (Esc closes, focus returns to the tab) by
  // focusing after the tab has re-rendered.
  const returnFocus = React.useRef(false);
  React.useEffect(() => {
    if (!open && returnFocus.current) {
      returnFocus.current = false;
      if (tabRef.current) tabRef.current.focus();
    }
  }, [open]);
  React.useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { returnFocus.current = true; setOpen(false); }
    };
    document.addEventListener('keydown', onKey);
    if (areaRef.current) areaRef.current.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  const close = () => { returnFocus.current = true; setOpen(false); setSent(false); setMsg(''); };
  return (
    <React.Fragment>
      {!open ? (
        <button ref={tabRef} type="button" className="fb-tab no-print"
          aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
          Feedback
        </button>
      ) : null}
      {open ? (
        <div className="fb-panel no-print" role="dialog" aria-label="Send feedback">
          {!sent ? (
            <React.Fragment>
              <div className="fb-head">
                <h2>Feedback</h2>
                <button type="button" className="fb-close" onClick={close}>Close</button>
              </div>
              <p className="fb-note">Read by the design team. Not for support, account issues, or anything patient-related.</p>
              <div className="fk-field">
                <label className="fk-label" htmlFor="fb-msg">What should we know?</label>
                <textarea ref={areaRef} id="fb-msg" rows={4} className="fk-input"
                  value={msg} onChange={(e) => setMsg(e.target.value)}
                  placeholder="Something unclear, broken, or dishonest — tell us where." />
              </div>
              <PrimaryButton disabled={!msg.trim()} onClick={() => setSent(true)}>Send feedback</PrimaryButton>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <div className="fb-head">
                <h2>Prototype demo</h2>
                <button type="button" className="fb-close" onClick={close}>Close</button>
              </div>
              <StateChip state="notDecisionGrade" label="Not transmitted" />
              {/* port: the prototype fabricated a receipt id here; this surface
                  sends nothing, so it says so — fail-closed honesty. */}
              <p className="fb-note">Nothing was sent — this widget demonstrates the designed anatomy only.
                In product, submissions are recorded with a reference id and read at the next design review.</p>
            </React.Fragment>
          )}
        </div>
      ) : null}
    </React.Fragment>
  );
};
