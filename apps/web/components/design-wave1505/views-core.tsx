'use client';

/**
 * Wave 1505 port — core routes: index hub, auth (DG-12.1), system states
 * (DG-12.2), legal (DG-12.3), contact (DG-12.4.1), pricing (DG-13.3).
 * Ported from wave1505/w1505-{app,auth,system,legal,contact,pricing}.jsx.
 *
 * Port adaptations (documented at each site): prototype cross-wave links
 * point at real app routes; the contact success state says plainly that the
 * prototype sends nothing.
 */

import * as React from 'react';
import {
  ErrorSummary, Field, HonestyLabel, PrimaryButton, QuietButton, SecondaryButton,
  StateChip, TextArea, TextInput, TokenRow, TrustGlyph, VtLogo,
  validateRequired, validateWorkEmail,
} from './kit';
import { EmptyState, OfflineBanner, ProtoBar, Route5, S5Page, S5Section, SkeletonStack } from './shared';

/* ================= index hub (w1505-app.jsx) ================= */

const HUB_CARDS = [
  { id: 'A · DG-12.1', t: 'Auth surfaces', d: 'Clerk themed to the house: sign-in, sign-up, verification, loading. Zero default purple.', links: [['#/auth', 'Overview + spec'], ['#/auth/sign-in', 'Sign in']] },
  { id: 'B · DG-12.2', t: 'Error & system states', d: '404, fail-closed error, offline banner, and the empty-state gallery — every state designed.', links: [['#/system', 'Gallery'], ['#/404', '404'], ['#/error', 'Error']] },
  { id: 'C · DG-12.3', t: 'Legal prose template', d: 'One template, four documents. 65ch Geist body, Fraunces headings, sticky TOC, mono stamps.', links: [['#/legal/privacy', 'Privacy'], ['#/legal/dpa', 'DPA']] },
  { id: 'D · DG-12.4 / 13.3', t: 'Contact · pricing · feedback', d: 'Form-kit contact with designed success; paper/ink pricing under the honesty doctrine; the feedback affordance on every chromed page.', links: [['#/contact', 'Contact'], ['#/pricing', 'Pricing']] },
  { id: 'E · DG-14 / 15', t: 'Responsive + a11y sweep', d: 'Findings → fixes → verified, across 7 viewports, keyboard, grayscale, screen readers, reduced motion.', links: [['#/audit', 'Checklist']] },
  { id: 'F · DG-18', t: 'Governance artifacts', d: 'DESIGN_SYSTEM.md, the /dev/design living style guide, the regression matrix, the lint rules.', links: [['#/dev/design', '/dev/design'], ['#/governance', 'Specs']] },
];

const ACCEPT = [
  { p: 'Zero default-styled third-party UI — Clerk fully themed, mapping shipped.', where: '#/auth' },
  { p: 'Every empty, error, and loading state designed; unknown routes land on the designed 404 for real.', where: '#/system' },
  { p: 'Grayscale + keyboard + reduced-motion + 360px passes on all surfaces, with fixes named.', where: '#/audit' },
  { p: 'DESIGN_SYSTEM.md is self-sufficient — palette rationale, ramps, states, component rules, do/don’t gallery.', where: 'DESIGN_SYSTEM.md' },
  { p: 'The do/don’t gallery encodes the honesty doctrine visually (gated + checkmark = never).', where: 'DESIGN_SYSTEM.md §9' },
];

export const IndexRoute = () => (
  <S5Page eyebrow="Wave 1505 · closing wave · D-W7/W8" title={<span>The pages nobody designs — <span className="vt-accent-i">designed.</span></span>}
    lede="System pages, quality gates, and the governance that keeps the house from drifting. After this wave the design program is done — and guarded."
    label="Wave 1505 index">
    <S5Section first eyebrow="Scope" title="Six deliverables">
      <div className="hub-grid">
        {HUB_CARDS.map((c) => (
          <div className="hub-card" key={c.id}>
            <span className="hid">{c.id}</span>
            <h3>{c.t}</h3>
            <p>{c.d}</p>
            <div className="hub-links">{c.links.map(([h, l]) => <a key={h + l} href={h}>{l}</a>)}</div>
          </div>
        ))}
      </div>
    </S5Section>
    <S5Section eyebrow="Acceptance criteria" title="Checked against the brief">
      <div className="hub-accept" style={{ maxWidth: 760 }}>
        {ACCEPT.map((a) => (
          <div className="hub-accept-row" key={a.where + a.p.slice(0, 12)}>
            <StateChip state="checked" size="sm" label="Met" />
            <div>
              <p>{a.p}</p>
              <span className="where vt-num">{a.where}</span>
            </div>
          </div>
        ))}
      </div>
    </S5Section>
  </S5Page>
);

/* ================= auth (w1505-auth.jsx) ================= */

const AuthProvIcon = ({ kind }: { kind: 'google' | 'microsoft' }) => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'google'
      ? <path d="M12 7.2 H7 M12 7.2 A5 5 0 1 1 10.6 3.6" />
      : <g><rect x="2" y="2" width="4.6" height="4.6" /><rect x="7.4" y="2" width="4.6" height="4.6" /><rect x="2" y="7.4" width="4.6" height="4.6" /><rect x="7.4" y="7.4" width="4.6" height="4.6" /></g>}
  </svg>
);

const CkBadge = () => (
  <span className="ck-badge"><TrustGlyph state="gated" size={11} />Secured by Clerk · themed by the house</span>
);

const AuthShell = ({ children, under, label, viewing }: {
  children: React.ReactNode; under?: string; label: string; viewing?: { href: string; label: string };
}) => (
  <div className="auth-page s5-fade" data-screen-label={label}>
    <a className="skip-link" href="#auth-main">Skip to content</a>
    <div className="auth-brand"><VtLogo size={19} /></div>
    <main id="auth-main" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {children}
    </main>
    {under ? <div className="auth-under"><p>{under}</p></div> : null}
    <ProtoBar viewing={viewing} />
  </div>
);

export const AuthSignIn = () => {
  const [email, setEmail] = React.useState('');
  return (
    <AuthShell label="Auth · sign in" under="Signing in reads nothing new. Sources are only checked when you ask."
      viewing={{ href: '#/auth/sign-in', label: '/sign-in' }}>
      <div className="ck-card">
        <div className="ck-head">
          <h1>Sign in</h1>
          <p className="sub">Back to your passport, exactly as you left it.</p>
        </div>
        <div className="ck-social">
          <button type="button" className="ck-social-btn"><AuthProvIcon kind="google" />Continue with Google</button>
          <button type="button" className="ck-social-btn"><AuthProvIcon kind="microsoft" />Continue with Microsoft</button>
        </div>
        <div className="ck-div"><span>OR</span></div>
        <form className="ck-form" onSubmit={(e) => { e.preventDefault(); window.location.hash = '#/auth/verify'; }}>
          <Field id="si-email" label="Email address">
            <TextInput id="si-email" type="email" autoComplete="email" placeholder="you@practice.org"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <button type="submit" className="ck-primary" disabled={!email.includes('@')}>Continue</button>
        </form>
        <div className="ck-foot">
          <span className="ck-foot-line">No account? <a href="#/auth/sign-up">Create one</a> — free for clinicians.</span>
          <CkBadge />
        </div>
      </div>
    </AuthShell>
  );
};

export const AuthSignUp = () => {
  const [v, setV] = React.useState({ first: '', last: '', email: '' });
  const ok = v.first.trim() && v.last.trim() && v.email.includes('@');
  return (
    <AuthShell label="Auth · sign up" under="An account holds your snapshots. It never changes what sources say."
      viewing={{ href: '#/auth/sign-up', label: '/sign-up' }}>
      <div className="ck-card">
        <div className="ck-head">
          <h1>Create your account</h1>
          <p className="sub">Free for clinicians. Your record stays yours.</p>
        </div>
        <div className="ck-social">
          <button type="button" className="ck-social-btn"><AuthProvIcon kind="google" />Continue with Google</button>
          <button type="button" className="ck-social-btn"><AuthProvIcon kind="microsoft" />Continue with Microsoft</button>
        </div>
        <div className="ck-div"><span>OR</span></div>
        <form className="ck-form" onSubmit={(e) => { e.preventDefault(); window.location.hash = '#/auth/verify'; }}>
          <div className="ck-name-grid">
            <Field id="su-first" label="First name">
              <TextInput id="su-first" autoComplete="given-name" value={v.first}
                onChange={(e) => setV({ ...v, first: e.target.value })} />
            </Field>
            <Field id="su-last" label="Last name">
              <TextInput id="su-last" autoComplete="family-name" value={v.last}
                onChange={(e) => setV({ ...v, last: e.target.value })} />
            </Field>
          </div>
          <Field id="su-email" label="Email address" hint="Work email if you have one — either works.">
            <TextInput id="su-email" type="email" autoComplete="email" placeholder="you@practice.org"
              value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
          </Field>
          <button type="submit" className="ck-primary" disabled={!ok}>Continue</button>
        </form>
        <div className="ck-foot">
          <span className="ck-foot-line">Already have an account? <a href="#/auth/sign-in">Sign in</a></span>
          <span className="ck-foot-line" style={{ fontSize: 11.5, color: 'var(--vt-text-muted)' }}>
            By continuing you agree to the <a href="#/legal/terms">Terms</a> and <a href="#/legal/privacy">Privacy notice</a>.
          </span>
          <CkBadge />
        </div>
      </div>
    </AuthShell>
  );
};

export const AuthVerify = () => {
  const [code, setCode] = React.useState('');
  const [focused, setFocused] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const done = code.length === 6;
  return (
    <AuthShell label="Auth · verify email" under="We verify the inbox, not the person. Identity comes from sources, not sign-up."
      viewing={{ href: '#/auth/verify', label: '/verify' }}>
      <div className="ck-card">
        <div className="ck-head">
          <h1>Check your email</h1>
          <p className="sub">A six-digit code was sent to <strong style={{ fontWeight: 600 }}>a.okafor@practice.org</strong>. It expires in 10 minutes.</p>
        </div>
        <div className="ck-form">
          <div className="fk-field">
            <label className="fk-label" htmlFor="vf-code">Verification code</label>
            <div className="code-cells" onClick={() => inputRef.current && inputRef.current.focus()}>
              <input ref={inputRef} id="vf-code" className="code-hidden" value={code}
                inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code"
                aria-label="Six-digit verification code"
                onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <span key={i} aria-hidden="true"
                  className={`code-cell${code[i] ? '' : ' empty'}${focused && i === Math.min(code.length, 5) ? ' focus' : ''}`}>
                  {code[i] || '·'}
                </span>
              ))}
            </div>
            <div className="code-meta">
              <span className={`cnt vt-num${done ? ' done' : ''}`} aria-live="polite">{code.length}/6{done ? ' · checking' : ''}</span>
              <QuietButton small onClick={() => setCode('')}>Resend code</QuietButton>
            </div>
          </div>
          <button type="button" className="ck-primary" disabled={!done}
            onClick={() => { window.location.hash = '#/auth/loading'; }}>
            {done ? 'Verify and continue' : 'Enter the code'}
          </button>
        </div>
        <div className="ck-foot">
          <span className="ck-foot-line"><a href="#/auth/sign-in">Use a different email</a></span>
          <CkBadge />
        </div>
      </div>
    </AuthShell>
  );
};

export const AuthLoading = () => {
  React.useEffect(() => {
    const t = setTimeout(() => { window.location.hash = '#/auth'; }, 3600);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="authload s5-fade" data-screen-label="Auth · loading interstitial" role="status" aria-live="polite">
      <div className="authload-box">
        <VtLogo size={19} />
        <span className="authload-track" aria-hidden="true"></span>
        <span className="authload-line">Verifying session</span>
        <p className="authload-note">Nothing is shown until it&rsquo;s checked. This usually takes under a second.</p>
      </div>
      <ProtoBar viewing={{ href: '#/auth/loading', label: '/loading' }} />
    </div>
  );
};

/* ---------- Clerk appearance mapping (implementable spec) ---------- */
const CK_VARS = [
  { k: 'colorPrimary', v: '#141414', note: 'var(--ink-900) — buttons, active states' },
  { k: 'colorText', v: '#141414', note: 'var(--vt-text)' },
  { k: 'colorTextSecondary', v: '#474540', note: 'var(--vt-text-secondary)' },
  { k: 'colorBackground', v: '#ffffff', note: 'var(--vt-surface-card) — card only; page stays paper' },
  { k: 'colorInputBackground', v: '#ffffff', note: 'var(--vt-surface-card)' },
  { k: 'colorInputText', v: '#141414', note: 'var(--vt-text)' },
  { k: 'colorDanger', v: '#7a1414', note: 'var(--hue-p0)' },
  { k: 'colorSuccess', v: '#1c5c38', note: 'var(--hue-ok)' },
  { k: 'colorWarning', v: '#7d5a1e', note: 'var(--hue-watch)' },
  { k: 'colorNeutral', v: '#141414', note: 'kills residual purple in borders/shadows' },
  { k: 'fontFamily', v: "'Geist', ui-sans-serif, system-ui", note: 'var(--font-body)' },
  { k: 'fontFamilyButtons', v: "'Geist', ui-sans-serif, system-ui", note: 'same — no second face' },
  { k: 'borderRadius', v: '2px', note: 'var(--radius-1) — near-sharp public' },
];
const CK_ELEMENTS = [
  { k: 'rootBox / cardBox', v: 'box-shadow: none; border: 1px solid #dddbd3; border-radius: 4px', note: 'rules, not shadows (DG-1.10)' },
  { k: 'card', v: 'background: #ffffff; padding: 32px; gap: 20px', note: 'paper-0 card on paper-100 page' },
  { k: 'headerTitle', v: "font-family: 'Fraunces'; font-weight: 560; font-size: 24px; letter-spacing: -0.015em", note: 'display face' },
  { k: 'headerSubtitle', v: 'color: #474540; font-size: 13px', note: '' },
  { k: 'logoBox', v: 'render house wordmark (brand/logo.jsx), 19px', note: 'never the Clerk logo slot default' },
  { k: 'socialButtonsBlockButton', v: 'height 46px; border: 1px solid #141414; border-radius: 2px; Geist Mono 10.5px caps +0.12em', note: 'monochrome provider glyphs, no brand colors' },
  { k: 'dividerLine / dividerText', v: 'line #dddbd3 · text Geist Mono 9.5px caps +0.2em #6b6860', note: '' },
  { k: 'formFieldLabel', v: 'font-size: 12.5px; font-weight: 600; color: #141414', note: 'form-kit label' },
  { k: 'formFieldInput', v: 'height 46px; border: 1px solid #141414; border-radius: 2px; font-size 14px', note: 'form-kit input; ≥44px target' },
  { k: 'formFieldInput:focus', v: 'box-shadow: 0 0 0 2px #f4f2ec, 0 0 0 4px #141414', note: 'var(--vt-focus-ring) — uniform ring' },
  { k: 'formButtonPrimary', v: 'background #141414 → hover #1f2c22; height 46px; radius 2px; no ::after arrow', note: 'ink fill, matcha-900 hover' },
  { k: 'formFieldErrorText', v: 'Geist Mono 10.5px, color #7a1414, glyph + label', note: 'never color alone' },
  { k: 'footerActionLink', v: 'color #141414; underline, offset 3px; hover #1f2c22', note: 'house link grammar' },
  { k: 'badge / footer', v: 'Geist Mono 9px caps +0.14em, color #6b6860; background none', note: '"Secured by Clerk" stays — restyled, honest' },
  { k: 'spinner / loading', v: 'currentColor only; static track + ink sweep', note: 'no purple spinner; reduced-motion → static' },
];

export const AuthOverview = () => (
  <S5Page eyebrow="DG-12.1 · Auth surfaces" title={<span>One house, even at the <span className="vt-accent-i">front door.</span></span>}
    lede="Clerk handles the session; the house handles every pixel. Paper background, ink text, house buttons and focus ring, Geist type, the wordmark where Clerk's logo slot sits. Zero default purple."
    label="Auth · overview">
    <S5Section first eyebrow="Full-page states" title="The four surfaces"
      lede="Each opens chrome-less, exactly as a signed-out visitor meets it.">
      <div className="hub-grid">
        {[
          { href: '#/auth/sign-in', id: 'AUTH-1', t: 'Sign in', d: 'Email-first with two social options. Social buttons are outline + mono caps — provider glyphs render monochrome.' },
          { href: '#/auth/sign-up', id: 'AUTH-2', t: 'Sign up', d: 'Name pair + email. Legal consent links inline. Free-for-clinicians stated plainly, no asterisk.' },
          { href: '#/auth/verify', id: 'AUTH-3', t: 'Email verification', d: 'Six code cells in the NPI-cell grammar. Digit count announced via aria-live. Resend is a quiet action.' },
          { href: '#/auth/loading', id: 'AUTH-4', t: 'Loading interstitial', d: 'Wordmark, hairline sweep (static under reduced motion), one mono line. No skeleton of a page that isn’t there yet.' },
        ].map((c) => (
          <div className="hub-card" key={c.id}>
            <span className="hid">{c.id}</span>
            <h3>{c.t}</h3>
            <p>{c.d}</p>
            <div className="hub-links"><a href={c.href}>Open full page</a></div>
          </div>
        ))}
      </div>
    </S5Section>
    <S5Section eyebrow="Implementable spec" title="Clerk appearance API mapping"
      lede="Lives at lib/clerkAppearance.ts and is passed to <ClerkProvider appearance>. Values are the resolved hex of house tokens — Clerk can't read CSS variables server-side, so the file carries the token name in a comment per line.">
      <div className="s5-twocol">
        <div>
          <h3 style={{ fontSize: 15, marginBottom: 10 }}>appearance.variables</h3>
          <div>{CK_VARS.map((r) => <TokenRow key={r.k} k={r.k} value={r.v} display={`${r.v}${r.note ? '  ·  ' + r.note : ''}`} />)}</div>
        </div>
        <div>
          <h3 style={{ fontSize: 15, marginBottom: 10 }}>appearance.elements</h3>
          <div>{CK_ELEMENTS.map((r) => <TokenRow key={r.k} k={r.k} value={r.v} display={`${r.v}${r.note ? '  ·  ' + r.note : ''}`} />)}</div>
        </div>
      </div>
      <p style={{ margin: '18px 0 0', fontFamily: 'var(--font-mono)', fontSize: 10.5, lineHeight: 1.7, color: 'var(--vt-text-secondary)', maxWidth: '88ch' }}>
        ACCEPTANCE · Render sign-in, sign-up, verification, and the SSO-callback interstitial; screenshot at 360/768/1440. grep the computed styles for
        rgb values of Clerk&rsquo;s defaults (#6c47ff family) — any hit fails the gate. Focus ring on every interactive element must equal var(--vt-focus-ring).
      </p>
    </S5Section>
  </S5Page>
);

export const AuthRoute = ({ route }: { route: Route5 }) => {
  if (route.sub === 'sign-in') return <AuthSignIn />;
  if (route.sub === 'sign-up') return <AuthSignUp />;
  if (route.sub === 'verify') return <AuthVerify />;
  if (route.sub === 'loading') return <AuthLoading />;
  return <AuthOverview />;
};

/* ================= system states (w1505-system.jsx) ================= */

export const Sys404 = ({ requested }: { requested?: string }) => (
  <div className="sys-page s5-fade" data-screen-label="System · 404">
    <div className="sys-top"><VtLogo size={18} /></div>
    <main className="sys-mid">
      <div className="sys-block">
        <div className="sys-echo vt-num" aria-label="Request echo">
          GET {requested || '/passport/old-share-link'}<br />
          <span className="code">→ 404 · NOT FOUND</span> · nothing at this address
        </div>
        <h1>This page isn&rsquo;t part of the record.</h1>
        <p className="body">The address may have changed, or it never existed. Nothing was deleted
          silently — if a share link stopped working, its holder revoked it, and that revocation is logged.</p>
        <div className="sys-ctas">
          {/* port: prototype linked ../wave1501 + wave1504 #/status → real routes */}
          <PrimaryButton size="lg" onClick={() => { window.location.href = '/'; }}>Back to vitalcv.com</PrimaryButton>
          <QuietButton onClick={() => { window.location.href = '/status'; }}>Check system status</QuietButton>
        </div>
      </div>
    </main>
    <p className="sys-foot">© 2026 VitalCV · a partial proof stays partial</p>
    <ProtoBar viewing={{ href: '#/404', label: '/404' }} />
  </div>
);

export const SysError = () => (
  <div className="sys-page s5-fade" data-screen-label="System · error">
    <div className="sys-top"><VtLogo size={18} /></div>
    <main className="sys-mid">
      <div className="sys-block" role="alert">
        <div className="sys-echo vt-num" aria-label="Failure reference">
          run_2026-07-12_0812Z · <span className="code">FAILED</span> · err_a41f<br />
          reference logged — include it if you write in
        </div>
        <h1>Something failed on our side.</h1>
        <p className="body">Nothing was recorded as successful. If you were mid-request, it did not
          complete — no partial result was saved, and no source was marked checked. Retry when ready.</p>
        <div className="sys-ctas">
          <PrimaryButton size="lg" onClick={() => window.location.reload()}>Try again</PrimaryButton>
          <QuietButton onClick={() => { window.location.hash = '#/contact'; }}>Write to us</QuietButton>
        </div>
      </div>
    </main>
    <p className="sys-foot">© 2026 VitalCV · errors are stated, never dressed up</p>
    <ProtoBar viewing={{ href: '#/error', label: '/error' }} />
  </div>
);

const EMPTIES = [
  {
    ctx: 'Passport · /passport', glyph: 'pending',
    title: 'No sources checked yet.',
    why: 'Your passport starts empty on purpose — it only ever shows what a source actually said.',
    action: 'Enter an NPI to run the first check',
  },
  {
    ctx: 'Reviewer queue · /review', glyph: 'reviewRequired',
    title: 'Nothing waiting for review.',
    why: 'Every submitted packet has been decided. New requests appear here the moment they arrive.',
    action: 'View decided packets', secondary: true,
  },
  {
    ctx: 'Recognitions · /passport#recognitions', glyph: 'checked',
    title: 'No Recognitions yet.',
    why: 'A Recognition is recorded when an employer accepts your packet as a head start. Sharing your passport is how they happen.',
    action: 'Share your passport',
  },
  {
    ctx: 'Opportunities · /opportunities', glyph: 'previewOnly',
    title: 'No matched opportunities right now.',
    why: 'Matches come from employer lanes that fit your license states and specialty — none fit today. We don’t pad this list.',
    action: 'Review your lane preferences', secondary: true,
  },
];

export const SystemRoute = () => {
  const [offline, setOffline] = React.useState(false);
  return (
    <React.Fragment>
      {offline ? <OfflineBanner onRetry={() => setOffline(false)} /> : null}
      <S5Page eyebrow="DG-12.2 · Error & system states" title={<span>Where trust <span className="vt-accent-i">quietly</span> lives or dies.</span>}
        lede="A default-styled 404 breaks the spell faster than any bug. Every terminal, degraded, and empty state is designed, honest, and calm — with exactly one next action."
        label="System states">
        <S5Section first eyebrow="Terminal states" title="404 · error · loading"
          lede="Full-page states, opened chrome-less as a visitor would meet them.">
          <div className="hub-grid">
            <div className="hub-card">
              <span className="hid">SYS-404</span>
              <h3>Not found</h3>
              <p>Wordmark, mono echo of the requested path, Fraunces headline, one CTA home. Unknown routes in this prototype land here for real.</p>
              <div className="hub-links"><a href="#/404">Open full page</a><a href="#/definitely/not/a/route">Trigger via bad route</a></div>
            </div>
            <div className="hub-card">
              <span className="hid">SYS-ERR</span>
              <h3>Something failed</h3>
              <p>Fail-closed honesty: &ldquo;Nothing was recorded as successful.&rdquo; A logged reference, a retry, and a path to a person. Never a mascot.</p>
              <div className="hub-links"><a href="#/error">Open full page</a></div>
            </div>
            <div className="hub-card">
              <span className="hid">SYS-LOAD</span>
              <h3>Loading interstitial</h3>
              <p>Wordmark + hairline sweep + one mono line. The skeleton grammar below covers in-page loading; this covers whole-surface waits.</p>
              <div className="hub-links"><a href="#/auth/loading">Open full page</a></div>
            </div>
          </div>
        </S5Section>

        <S5Section eyebrow="Degraded pattern" title="Offline / degraded banner"
          lede="For data surfaces: sticks under the nav at --vt-z-banner, dashed rules carry the degraded semantics, freshness stamps keep telling the truth underneath. role=status, announced politely.">
          <OfflineBanner inline onRetry={() => {}} />
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 20, flexWrap: 'wrap' }}>
            <SecondaryButton onClick={() => setOffline(!offline)} aria-pressed={offline}>
              {offline ? 'Unpin demo banner' : 'Pin banner under nav (demo)'}
            </SecondaryButton>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--vt-text-muted)', letterSpacing: '0.05em' }}>
              RULE · never a toast; never auto-dismiss; retry is manual
            </span>
          </div>
        </S5Section>

        <S5Section eyebrow="DG-12.2.4" title="Empty-state gallery"
          lede="Honest and calm. Each names the surface, says why it's empty without apology or fake data, and offers ONE next action. Solid rule frames — dashed is reserved for degraded.">
          <div className="empty-grid">
            {EMPTIES.map((e) => (
              <div key={e.ctx}>
                <span className="empty-ctx">{e.ctx}</span>
                <EmptyState glyph={e.glyph} title={e.title} why={e.why} action={e.action} secondary={e.secondary} />
              </div>
            ))}
          </div>
        </S5Section>

        <S5Section eyebrow="Loading grammar" title="The empty · loading · error triad"
          lede="Every data region ships all three, in the same footprint, so the page never jumps or flashes unstyled.">
          <div className="hub-grid">
            <div className="hub-card">
              <span className="hid">Loading</span>
              <div style={{ padding: '10px 0' }}><SkeletonStack /></div>
              <p>Skeleton shimmer — the one allowed infinite animation, static under reduced motion. Skeletons mirror the real layout, never invent rows.</p>
            </div>
            <div className="hub-card">
              <span className="hid">Empty</span>
              <div style={{ padding: '10px 0' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--vt-text-muted)' }}>
                  <TrustGlyph state="pending" size={13} /> No sources checked yet.
                </span>
              </div>
              <p>Inline form for tight regions; the full EmptyState card for primary regions. Same copy voice either way.</p>
            </div>
            <div className="hub-card">
              <span className="hid">Error</span>
              <div style={{ padding: '10px 0' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--vt-state-p0)' }}>
                  <TrustGlyph state="p0" size={13} /> Couldn&rsquo;t load. Nothing recorded. <QuietButton small>Retry</QuietButton>
                </span>
              </div>
              <p>Region-level failure keeps the rest of the page alive. Copy never says &ldquo;oops&rdquo; and never claims partial success.</p>
            </div>
          </div>
        </S5Section>
      </S5Page>
    </React.Fragment>
  );
};

/* ================= legal (w1505-legal.jsx) ================= */

interface LegalSection { id: string; h: string; body: React.ReactNode }
interface LegalDoc { title: string; updated: string; version: string; sections: LegalSection[] }

const LEGAL_DOCS: Record<string, LegalDoc> = {
  privacy: {
    title: 'Privacy notice',
    updated: '2026-07-01', version: 'v1.2',
    sections: [
      { id: 'what-we-read', h: 'What we read', body: (
        <React.Fragment>
          <p>VitalCV reads public, primary sources about licensed clinicians — NPPES, state medical
            board registries, the OIG exclusion list, and, where a clinician authorizes it, CMS PECOS.
            Every read is initiated by a person: the clinician, or an anonymous visitor entering an NPI
            on the preview plane.</p>
          <p>We record what the source said, when we read it, and through which channel. That lineage
            is visible on every surface that shows the data.</p>
        </React.Fragment>
      ) },
      { id: 'what-we-store', h: 'What we store', body: (
        <React.Fragment>
          <p>For account holders: your snapshots, your Recognitions, your share links and their
            revocations, and the audit trail of checks you ran. For anonymous previews: the check
            result is cached briefly and is not tied to you.</p>
          <div className="mono-note">NOT PHI · VitalCV stores no patient data, no clinical records,
            no claims data. The record is about the clinician&rsquo;s credentials, never their patients.</div>
        </React.Fragment>
      ) },
      { id: 'what-we-never-do', h: 'What we never do', body: (
        <ul>
          <li>We never sell your data, in any definition of &ldquo;sell&rdquo;.</li>
          <li>We never show an employer anything you didn&rsquo;t explicitly share.</li>
          <li>We never alter what a source said — contradictions are shown, not resolved silently.</li>
          <li>We never use your record to train models or build advertising profiles.</li>
        </ul>
      ) },
      { id: 'sharing', h: 'Sharing and revocation', body: (
        <p>A share link exposes exactly the snapshot you chose, to whoever holds the link, until you
          revoke it. Revocation is immediate and logged. Employers see a revoked page that says the
          holder revoked access — nothing softer, nothing vaguer.</p>
      ) },
      { id: 'retention', h: 'Retention', body: (
        <p>Snapshots are kept while your account exists. Delete your account and snapshots are purged
          within 30 days; the fact that a Recognition once occurred remains in the counterparty&rsquo;s
          records, as it does in any exchange of documents. Anonymous preview caches expire within
          24 hours.</p>
      ) },
      { id: 'your-rights', h: 'Your rights', body: (
        <p>Export everything, correct what&rsquo;s wrong at the source (we link you to the source&rsquo;s own
          correction process — we can&rsquo;t edit their records), delete your account, or object to a
          read. Write to <a href="#/contact">privacy@vitalcv.com</a> — a person answers within two
          business days.</p>
      ) },
    ],
  },
  terms: {
    title: 'Terms of service',
    updated: '2026-07-01', version: 'v1.1',
    sections: [
      { id: 'the-service', h: 'The service', body: (
        <p>VitalCV compiles source-backed evidence about clinician credentials into a passport the
          clinician owns and shares. Free for clinicians. Employers use it to start — not finish —
          their own review.</p>
      ) },
      { id: 'decision-boundary', h: 'The decision boundary', body: (
        <React.Fragment>
          <p>VitalCV output is a head start for employer review, not a credentialing decision.
            It is not primary-source verification under NCQA or Joint Commission standards unless a
            surface explicitly says so, and no surface currently does.</p>
          <div className="mono-note">HARD RULE · Anything marked &ldquo;Not decision-grade&rdquo; or
            &ldquo;Self-attested&rdquo; must not be the basis of an employment or privileging decision.</div>
        </React.Fragment>
      ) },
      { id: 'acceptable-use', h: 'Acceptable use', body: (
        <ul>
          <li>Don&rsquo;t probe NPIs at scale — the preview plane is rate-limited and monitored.</li>
          <li>Don&rsquo;t re-publish share pages or represent a snapshot as newer than its timestamp.</li>
          <li>Don&rsquo;t attempt to use VitalCV data for patient-facing or marketing purposes.</li>
        </ul>
      ) },
      { id: 'availability', h: 'Availability', body: (
        // port: the wave1504 prototype status page → the real /status route
        <p>Sources go down; when they do, we say so on the surface and on <a href="/status">/status</a>.
          We target high availability but sell no SLA outside a signed pilot or enterprise agreement.</p>
      ) },
      { id: 'liability', h: 'Liability', body: (
        <p>We stand behind the lineage: what we show is what the source said at the recorded time,
          through the recorded channel. We are not liable for source errors themselves, for decisions
          made against the stated boundary, or for indirect damages. Statutory rights remain.</p>
      ) },
      { id: 'changes', h: 'Changes', body: (
        <p>Material changes are announced by email and on this page 30 days before they take effect.
          The version stamp above changes every time this document does.</p>
      ) },
    ],
  },
  dpa: {
    title: 'Data processing addendum',
    updated: '2026-07-01', version: 'v1.0',
    sections: [
      { id: 'roles', h: 'Roles', body: (
        <p>For employer pilot data (reviewer accounts, packet decisions), the employer is the
          controller and VitalCV the processor. For clinician passports, VitalCV is the controller —
          clinicians deal with us directly under the <a href="#/legal/privacy">privacy notice</a>.</p>
      ) },
      { id: 'scope', h: 'Scope of processing', body: (
        <p>Processing is limited to compiling, storing, and presenting credential evidence and its
          lineage. No PHI is processed under this addendum, and no BAA is offered because none is
          needed: the record is about clinicians, not patients.</p>
      ) },
      { id: 'subprocessors', h: 'Subprocessors', body: (
        <React.Fragment>
          <p>Current subprocessors, each under a written agreement mirroring these terms:</p>
          <table className="lg-table">
            <thead><tr><th scope="col">Provider</th><th scope="col">Purpose</th><th scope="col">Region</th></tr></thead>
            <tbody>
              <tr><td className="mono">Railway</td><td>Application hosting</td><td className="mono">US</td></tr>
              <tr><td className="mono">Neon</td><td>Postgres database</td><td className="mono">US</td></tr>
              <tr><td className="mono">Clerk</td><td>Authentication</td><td className="mono">US</td></tr>
              <tr><td className="mono">Resend</td><td>Transactional email</td><td className="mono">US</td></tr>
            </tbody>
          </table>
          <p>Changes are announced 30 days in advance; controllers may object in writing.</p>
        </React.Fragment>
      ) },
      { id: 'security', h: 'Security measures', body: (
        <ul>
          <li>Encryption in transit and at rest; keys rotated on the published schedule (see key history on the trust register).</li>
          <li>Access on least-privilege; production access logged and reviewed.</li>
          <li>Signed artifacts: institutional receipts are verifiable against published keys.</li>
        </ul>
      ) },
      { id: 'incidents', h: 'Incidents', body: (
        <p>Confirmed incidents affecting controller data are notified without undue delay and within
          72 hours, with what we know, what we don&rsquo;t, and what happens next — the same fail-closed
          honesty the product uses.</p>
      ) },
      { id: 'deletion', h: 'Return and deletion', body: (
        <p>On termination, controller data is exported on request and deleted within 30 days, with
          written confirmation. Audit lineage that references the controller (e.g. Recognitions
          issued to clinicians) survives as the clinician&rsquo;s record.</p>
      ) },
    ],
  },
  cookies: {
    title: 'Cookie notice',
    updated: '2026-07-01', version: 'v1.0',
    sections: [
      { id: 'stance', h: 'Our stance', body: (
        <p>No advertising cookies, no cross-site tracking, no analytics that require a banner.
          The short table below is the complete list — if it grows, this page changes first.</p>
      ) },
      { id: 'the-list', h: 'The complete list', body: (
        <table className="lg-table">
          <thead><tr><th scope="col">Cookie</th><th scope="col">Purpose</th><th scope="col">Lifetime</th></tr></thead>
          <tbody>
            <tr><td className="mono">__session</td><td>Clerk authentication — keeps you signed in.</td><td className="mono">7 days</td></tr>
            <tr><td className="mono">__client_uat</td><td>Clerk session freshness check.</td><td className="mono">session</td></tr>
            <tr><td className="mono">vcv_prefs</td><td>Interface preferences (e.g. dismissed banners).</td><td className="mono">6 months</td></tr>
          </tbody>
        </table>
      ) },
      { id: 'no-banner', h: 'Why there is no cookie banner', body: (
        <p>Everything above is strictly necessary for a service you asked for, which is why you
          don&rsquo;t see a consent banner. If we ever add a category that requires consent, the banner
          will be designed to house rules — and this notice updated 30 days before.</p>
      ) },
      { id: 'controls', h: 'Your controls', body: (
        <p>Clear cookies in your browser at any time; you&rsquo;ll be signed out and preferences reset.
          Nothing about your passport or snapshots lives in cookies.</p>
      ) },
    ],
  },
};

const LEGAL_ORDER = [
  { key: 'privacy', label: 'Privacy' },
  { key: 'terms', label: 'Terms' },
  { key: 'dpa', label: 'DPA' },
  { key: 'cookies', label: 'Cookies' },
];

export const LegalRoute = ({ doc }: { doc?: string }) => {
  const key = doc && LEGAL_DOCS[doc] ? doc : 'privacy';
  const d = LEGAL_DOCS[key];
  return (
    <div className="s5-fade" data-screen-label={`Legal · ${d.title}`}>
      <div className="s5-container" style={{ paddingTop: 'var(--space-10)', paddingBottom: 'var(--space-4)' }}>
        <span className="vt-eyebrow">DG-12.3 · Legal</span>
        <nav className="lg-tabs" aria-label="Legal documents" style={{ marginTop: 12 }}>
          {LEGAL_ORDER.map((t) => (
            <a key={t.key} className="lg-tab" href={`#/legal/${t.key}`}
              aria-current={key === t.key ? 'page' : undefined}>{t.label}</a>
          ))}
        </nav>
        <div className="lg-layout">
          <aside className="lg-toc" aria-label="On this page">
            <span className="lg-toc-label">On this page</span>
            {d.sections.map((s, i) => (
              <a key={s.id} href={`#/legal/${key}`} onClick={(e) => {
                e.preventDefault();
                const el = document.getElementById(s.id);
                if (el) { const y = el.getBoundingClientRect().top + window.pageYOffset - 72; window.scrollTo(0, y); }
              }}>
                <span className="n vt-num">{String(i + 1).padStart(2, '0')}</span>{s.h}
              </a>
            ))}
          </aside>
          <article>
            <header className="lg-head">
              <h1>{d.title}</h1>
              <span className="lg-stamp vt-num">
                <span>Last updated {d.updated}</span>
                <span>{d.version}</span>
                <span>vitalcv.com/legal/{key}</span>
              </span>
            </header>
            <div className="lg-prose">
              {d.sections.map((s, i) => (
                <section key={s.id} id={s.id}>
                  <h2><span className="n vt-num">{String(i + 1).padStart(2, '0')}</span><a className="anchor" href={`#/legal/${key}`} onClick={(e) => e.preventDefault()}>{s.h}</a></h2>
                  {s.body}
                </section>
              ))}
            </div>
          </article>
        </div>
      </div>
    </div>
  );
};

/* ================= contact (w1505-contact.jsx) ================= */

const CONTACT_TOPICS = [
  'Employer pilot inquiry',
  'Review request',
  'Data correction',
  'Security disclosure',
  'Press',
  'Something else',
];

export const ContactRoute = () => {
  const [v, setV] = React.useState({ name: '', email: '', org: '', topic: '', msg: '' });
  const [errors, setErrors] = React.useState<Record<string, string | null>>({});
  const [sent, setSent] = React.useState(false);
  const refs = {
    name: React.useRef<HTMLInputElement>(null),
    email: React.useRef<HTMLInputElement>(null),
    topic: React.useRef<HTMLSelectElement>(null),
    msg: React.useRef<HTMLTextAreaElement>(null),
  };
  const labels = { name: 'Your name', email: 'Work email', topic: 'Topic', msg: 'Message' };
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setV({ ...v, [k]: e.target.value });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string | null> = {};
    errs.name = validateRequired(v.name, 'Your name');
    errs.email = validateWorkEmail(v.email);
    errs.topic = v.topic ? null : 'Choose a topic so it reaches the right person.';
    errs.msg = validateRequired(v.msg, 'Message');
    Object.keys(errs).forEach((k) => { if (!errs[k]) delete errs[k]; });
    setErrors(errs);
    if (!Object.keys(errs).length) setSent(true);
  };
  return (
    <S5Page eyebrow="DG-12.4.1 · Contact" title={<span>A person reads <span className="vt-accent-i">every</span> message.</span>}
      lede="No chatbot, no ticket deflection. Say what you need; we route it to whoever can actually decide."
      label="Contact">
      <S5Section first>
        <div className="ct-grid">
          <div style={{ maxWidth: 560 }}>
            {!sent ? (
              <form className="fk-form" onSubmit={submit} noValidate>
                <ErrorSummary errors={errors} order={['name', 'email', 'topic', 'msg']} labels={labels} refs={refs} />
                <Field id="ct-name" label="Your name" required error={errors.name}>
                  <TextInput ref={refs.name} id="ct-name" autoComplete="name" value={v.name} onChange={set('name')} error={errors.name} />
                </Field>
                <Field id="ct-email" label="Work email" required error={errors.email}
                  hint="Personal email is fine for clinician topics.">
                  <TextInput ref={refs.email} id="ct-email" type="email" autoComplete="email"
                    placeholder="you@organization.org" value={v.email} onChange={set('email')} error={errors.email} />
                </Field>
                <Field id="ct-org" label="Organization" hint="Optional.">
                  <TextInput id="ct-org" autoComplete="organization" value={v.org} onChange={set('org')} />
                </Field>
                <Field id="ct-topic" label="Topic" required error={errors.topic}>
                  <select ref={refs.topic} id="ct-topic" className={`fk-input${errors.topic ? ' err' : ''}`}
                    aria-invalid={!!errors.topic} aria-describedby={errors.topic ? 'ct-topic-err' : undefined}
                    value={v.topic} onChange={set('topic')}>
                    <option value="">Choose one</option>
                    {CONTACT_TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field id="ct-msg" label="Message" required error={errors.msg}
                  hint="Please don't include patient information — this form isn't for PHI, and we'd have to delete it.">
                  <TextArea ref={refs.msg} id="ct-msg" rows={6} value={v.msg} onChange={set('msg')} error={errors.msg} />
                </Field>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                  <PrimaryButton size="lg" type="submit">Send message</PrimaryButton>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.05em', color: 'var(--vt-text-muted)' }}>
                    Reviewed within two business days
                  </span>
                </div>
              </form>
            ) : (
              /* port: the prototype fabricated a message receipt; this surface
                 transmits nothing, so the success state says so plainly. */
              <div className="fk-success" role="status">
                <StateChip state="notDecisionGrade" label="Not transmitted" />
                <h3>Designed success state.</h3>
                <span className="receipt vt-num">prototype demo · nothing was sent</span>
                <p>In product, the message is recorded with a reference id, lands in front of a person
                  — not a queue-bot — and gets an answer at <strong style={{ fontWeight: 600 }}>{v.email || 'your email'}</strong> within
                  two business days. Security disclosures are triaged the same day.</p>
                <QuietButton onClick={() => { setSent(false); setV({ name: '', email: '', org: '', topic: '', msg: '' }); }}>
                  Reset the demo form
                </QuietButton>
              </div>
            )}
          </div>
          <aside className="ct-aside" aria-label="What to expect">
            <div className="ct-expect">
              <span className="vt-eyebrow">What to expect</span>
              <div className="row"><TrustGlyph state="reviewRequired" size={14} />
                <p><strong>Reviewed within two business days.</strong> Every message, by a person with authority to act on it.</p></div>
              <div className="row"><TrustGlyph state="stale" size={14} />
                <p><strong>Security disclosures</strong> are triaged same-day. Use the topic above and include the run reference if you have one.</p></div>
              <div className="row"><TrustGlyph state="notDecisionGrade" size={14} />
                <p><strong>Data corrections</strong> usually belong at the source. We&rsquo;ll tell you which registry to correct and re-read it once you have.</p></div>
            </div>
            <div className="ct-expect">
              <span className="vt-eyebrow">Prefer email</span>
              <div className="row"><TrustGlyph state="previewOnly" size={14} />
                <p><span className="vt-num" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>hello@vitalcv.com</span><br />
                Same inbox, same two-day promise.</p></div>
            </div>
          </aside>
        </div>
      </S5Section>
    </S5Page>
  );
};

/* ================= pricing (w1505-pricing.jsx) ================= */

const PIncRow = ({ inc, children }: { inc?: boolean; children: React.ReactNode }) => (
  <div className={`pr-row ${inc ? 'inc' : 'exc'}`}>
    <TrustGlyph state={inc ? 'checked' : 'unavailable'} size={13} />
    <span>{children}</span>
  </div>
);

export const PricingRoute = () => (
  <S5Page eyebrow="DG-13.3 · Pricing" title={<span>Plain terms, <span className="vt-accent-i">stated</span> — not teased.</span>}
    lede="Three ways to use VitalCV. The only numbers on this page are labeled for exactly what they are."
    label="Pricing">
    <S5Section first>
      <div className="pr-grid">
        <div className="pr-card" data-comment-anchor="pricing-clinicians">
          <span className="pr-aud">Clinicians</span>
          <div className="pr-price">
            <span className="amt vt-num">$0</span>
            <span className="per">FREE · ALWAYS · NO CARD</span>
          </div>
          <p className="pr-desc">Your credentials are your record. Charging you to hold it would be a
            conflict of interest we don&rsquo;t want.</p>
          <div className="pr-rows">
            <PIncRow inc>Passport with source-backed checks and lineage</PIncRow>
            <PIncRow inc>Share links with instant revocation</PIncRow>
            <PIncRow inc>Recognitions from accepting employers</PIncRow>
            <PIncRow inc>Refresh on stale sources, anytime</PIncRow>
          </div>
          {/* port: prototype linked the wave1503 get-ready page → real /get-ready */}
          <div className="pr-cta"><SecondaryButton size="lg" onClick={() => { window.location.href = '/get-ready'; }}>Check your readiness</SecondaryButton></div>
        </div>

        <div className="pr-card lead" data-comment-anchor="pricing-pilot">
          <span className="pr-aud">Employer pilot</span>
          <div className="pr-price">
            <span className="amt vt-num">$1,500<span style={{ fontSize: 18, fontWeight: 480 }}>/mo</span></span>
            <span className="per">PER FACILITY · 90-DAY PILOT</span>
          </div>
          <HonestyLabel>Illustrative figure — actual pilot pricing is set in the signed pilot scope, not on this page.</HonestyLabel>
          <p className="pr-desc">A bounded pilot with written scope: which lanes, which sources, what
            &ldquo;accepted as head start&rdquo; means on your side.</p>
          <div className="pr-rows">
            <PIncRow inc>Reviewer surface for your credentialing team</PIncRow>
            <PIncRow inc>Packet requests + Recognition issuing</PIncRow>
            <PIncRow inc>Named contact, two-business-day answers</PIncRow>
            <PIncRow>No primary-source verification service — your review stays yours</PIncRow>
          </div>
          <div className="pr-cta"><PrimaryButton size="lg" onClick={() => { window.location.hash = '#/contact'; }}>Start a pilot conversation</PrimaryButton></div>
        </div>

        <div className="pr-card" data-comment-anchor="pricing-network">
          <span className="pr-aud">Networks &amp; systems</span>
          <div className="pr-price">
            <span className="amt">In the agreement</span>
            <span className="per">MULTI-FACILITY · SIGNED SCOPE</span>
          </div>
          <p className="pr-desc">Priced per signed scope — facilities, lanes, integration depth. If we
            can&rsquo;t state it plainly in the agreement, we don&rsquo;t sell it.</p>
          <div className="pr-rows">
            <PIncRow inc>Everything in the pilot, across facilities</PIncRow>
            <PIncRow inc>DPA + subprocessor commitments (<a href="#/legal/dpa">read it first</a>)</PIncRow>
            <PIncRow inc>Uptime terms in writing</PIncRow>
            <PIncRow>No exclusivity — clinicians stay free either way</PIncRow>
          </div>
          <div className="pr-cta"><SecondaryButton size="lg" onClick={() => { window.location.hash = '#/contact'; }}>Talk to us</SecondaryButton></div>
        </div>
      </div>
    </S5Section>

    <S5Section eyebrow="Doctrine" title="What this page will never claim">
      <div className="s5-twocol">
        <div className="pr-never">
          <span className="vt-eyebrow">Prohibited on /pricing — lint-enforced</span>
          <ul>
            <li><TrustGlyph state="p0" size={12} />No invented customer counts or &ldquo;trusted by 500+ organizations&rdquo;.</li>
            <li><TrustGlyph state="p0" size={12} />No &ldquo;as seen in&rdquo; strips, no logos we didn&rsquo;t earn in writing.</li>
            <li><TrustGlyph state="p0" size={12} />No ROI guarantees, payback math, or &ldquo;cheapest&rdquo; claims.</li>
            <li><TrustGlyph state="p0" size={12} />No unlabeled illustrative metrics — every example number carries the HonestyLabel.</li>
            <li><TrustGlyph state="p0" size={12} />No countdown timers, seat scarcity, or launch-pricing pressure.</li>
          </ul>
        </div>
        <div className="pr-faq">
          <h3 style={{ fontSize: 16, marginBottom: 6 }}>Asked plainly, answered plainly</h3>
          <details>
            <summary><span className="m" aria-hidden="true"></span>Why is the pilot number &ldquo;illustrative&rdquo;?</summary>
            <p>Because real pilot pricing depends on facilities and lanes, and pretending otherwise
              would make the page dishonest. The number shows the shape of the cost; the signed scope
              carries the real one.</p>
          </details>
          <details>
            <summary><span className="m" aria-hidden="true"></span>Will clinicians ever be charged?</summary>
            <p>No. If that ever changed it would be announced 90 days ahead, and existing passports
              would stay free. The business is employer-side, on purpose.</p>
          </details>
          <details>
            <summary><span className="m" aria-hidden="true"></span>Is there a discount for annual commitment?</summary>
            <p>Sometimes, in the agreement, where it can be stated exactly. We don&rsquo;t advertise
              percentages we&rsquo;d have to caveat.</p>
          </details>
          <details>
            <summary><span className="m" aria-hidden="true"></span>What happens when the pilot ends?</summary>
            <p>It ends. Data is exported or deleted per the DPA, Recognitions already issued remain
              with the clinicians who earned them, and renewal is a new signed scope — never an
              auto-rollover.</p>
          </details>
        </div>
      </div>
    </S5Section>
  </S5Page>
);
