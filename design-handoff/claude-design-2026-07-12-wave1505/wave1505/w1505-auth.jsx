// Wave 1505 · w1505-auth.jsx — Clerk themed to the house system (DG-12.1).
// Sign-in, sign-up, verification, loading interstitial + the appearance
// API mapping that makes it implementable. Zero default Clerk purple.

/* ---------- provider glyphs (monochrome, currentColor — DG-4.6) ---------- */
const AuthProvIcon = ({ kind }) => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'google'
      ? <path d="M12 7.2 H7 M12 7.2 A5 5 0 1 1 10.6 3.6" />
      : <g><rect x="2" y="2" width="4.6" height="4.6" /><rect x="7.4" y="2" width="4.6" height="4.6" /><rect x="2" y="7.4" width="4.6" height="4.6" /><rect x="7.4" y="7.4" width="4.6" height="4.6" /></g>}
  </svg>
);

/* ---------- shared card chrome ---------- */
const CkBadge = () => (
  <span className="ck-badge"><TrustGlyph state="gated" size={11} />Secured by Clerk · themed by the house</span>
);
const AuthShell = ({ children, under, label, viewing }) => (
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

/* ---------- sign-in ---------- */
const AuthSignIn = () => {
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

/* ---------- sign-up ---------- */
const AuthSignUp = () => {
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

/* ---------- email verification ---------- */
const AuthVerify = () => {
  const [code, setCode] = React.useState('');
  const [focused, setFocused] = React.useState(false);
  const inputRef = React.useRef(null);
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

/* ---------- loading interstitial ---------- */
const AuthLoading = () => {
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
        <p className="authload-note">Nothing is shown until it's checked. This usually takes under a second.</p>
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

const AuthOverview = () => (
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
        rgb values of Clerk's defaults (#6c47ff family) — any hit fails the gate. Focus ring on every interactive element must equal var(--vt-focus-ring).
      </p>
    </S5Section>
  </S5Page>
);

const AuthRoute = ({ route }) => {
  if (route.sub === 'sign-in') return <AuthSignIn />;
  if (route.sub === 'sign-up') return <AuthSignUp />;
  if (route.sub === 'verify') return <AuthVerify />;
  if (route.sub === 'loading') return <AuthLoading />;
  return <AuthOverview />;
};

Object.assign(window, { AuthRoute, AuthSignIn, AuthSignUp, AuthVerify, AuthLoading, AuthOverview });
