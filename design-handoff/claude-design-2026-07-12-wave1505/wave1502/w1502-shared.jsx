// Wave 1502 · w1502-shared.jsx — router, nav, form kit, HonestyPanel,
// StepTimeline, BoundaryFooter. Consumes wave1500 tokens/primitives only.

/* NPI checksum — Luhn over '80840' + 10 digits (same rule as Wave 1501). */
const npiOk = (d) => {
  if (d.length !== 10) return false;
  const s = '80840' + d;
  let sum = 0, alt = false;
  for (let i = s.length - 1; i >= 0; i--) {
    let n = +s[i];
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n; alt = !alt;
  }
  return sum % 10 === 0;
};

/* ---------- hash router ---------- */
const parseRoute = (h) => {
  const hash = h || window.location.hash || '#/pilot';
  const m = hash.replace(/^#/, '').split('/').filter(Boolean);
  if (m[0] === 'review' && m[1] === 'request') return { name: 'request' };
  if (m[0] === 'review' && m[1]) return { name: 'entity', id: m[1] };
  return { name: 'pilot' };
};
const useRoute = () => {
  const [route, setRoute] = React.useState(() => parseRoute());
  React.useEffect(() => {
    const fn = () => { setRoute(parseRoute()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', fn);
    return () => window.removeEventListener('hashchange', fn);
  }, []);
  return route;
};

/* ---------- nav ---------- */
const S2_ROUTES = [
  { hash: '#/pilot', label: 'Employer pilot', match: 'pilot' },
  { hash: '#/review/request', label: 'Request a review', match: 'request' },
  { hash: '#/review/rev-2841', label: 'Reviewer surface', match: 'entity' },
];
const S2Nav = ({ route }) => (
  <header className="s2-nav">
    <div className="s2-container s2-nav-inner">
      <a className="s2-brand" href="../wave1501/index.html">VitalCV</a>
      <span className="s2-wave vt-eyebrow">Wave 1502 · buyer surfaces</span>
      <nav className="s2-tabs" aria-label="Surfaces">
        {S2_ROUTES.map((r) => (
          <a key={r.hash} className="s2-tab" href={r.hash}
            aria-current={route.name === r.match ? 'page' : undefined}>{r.label}</a>
        ))}
      </nav>
    </div>
  </header>
);

/* ---------- footer boundary (DG-11.1 boundary statement) ---------- */
const BoundaryFooter = ({ tight }) => (
  <footer className={`s2-foot${tight ? ' tight' : ''}`}>
    <div className="s2-container">
      <p className="s2-boundary">
        <TrustGlyph state="notDecisionGrade" size={16} />
        <span>A reviewer-ready head start — <span className="vt-accent-i">not</span> a final credentialing decision.</span>
      </p>
      <p className="s2-foot-base">© 2026 VitalCV · Employers accept a head start; committees remain the final step. A partial proof stays partial.</p>
    </div>
  </footer>
);

/* ---------- form kit (documented in CHANGES.md for promotion) ---------- */
const Field = ({ id, label, required, hint, error, children }) => (
  <div className="fk-field">
    <label className="fk-label" htmlFor={id}>
      {label}{required ? <span className="fk-req" aria-hidden="true">*</span> : null}
    </label>
    {children}
    {hint && !error ? <p className="fk-hint">{hint}</p> : null}
    {error ? (
      <p className="fk-err" id={`${id}-err`}>
        <TrustGlyph state="p0" size={11} />
        <span>{error}</span>
      </p>
    ) : null}
  </div>
);
const TextInput = React.forwardRef(({ id, error, ...rest }, ref) => (
  <input ref={ref} id={id} className={`fk-input${error ? ' err' : ''}`}
    aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} {...rest} />
));
const TextArea = React.forwardRef(({ id, error, rows = 4, ...rest }, ref) => (
  <textarea ref={ref} id={id} rows={rows} className={`fk-input${error ? ' err' : ''}`}
    aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} {...rest} />
));

const FREEMAIL = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com', 'icloud.com', 'proton.me', 'protonmail.com'];
const validateWorkEmail = (v) => {
  const t = (v || '').trim();
  if (!t) return 'Work email is required.';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(t)) return 'Enter a valid email — e.g. name@organization.org.';
  const dom = t.split('@')[1].toLowerCase();
  if (FREEMAIL.includes(dom)) return 'Use your work address — pilot scope is tied to your organization’s domain.';
  return null;
};
const validateRequired = (v, label) => ((v || '').trim() ? null : `${label} is required.`);

/* Error summary — designed failure state, role=alert, links focus fields */
const ErrorSummary = ({ errors, order, labels, refs }) => {
  const keys = order.filter((k) => errors[k]);
  if (!keys.length) return null;
  return (
    <div className="fk-summary" role="alert">
      <span className="t"><TrustGlyph state="p0" size={12} /> {keys.length} field{keys.length > 1 ? 's' : ''} need{keys.length > 1 ? '' : 's'} attention</span>
      <ul>
        {keys.map((k) => (
          <li key={k}>
            <button type="button" onClick={() => { const el = refs[k] && refs[k].current; if (el) el.focus(); }}>
              {labels[k]} — {errors[k]}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

/* Success card — designed success state */
const SuccessCard = ({ title, receipt, children, onReset, resetLabel }) => (
  <div className="fk-success" role="status">
    <StateChip state="checked" label="Recorded" />
    <h3>{title}</h3>
    <span className="receipt vt-num">{receipt}</span>
    {children}
    {onReset ? <QuietButton onClick={onReset}>{resetLabel || 'Submit another request'}</QuietButton> : null}
  </div>
);

/* ---------- segmented NPI field (Wave 1501 pattern, form-kit variant) ---------- */
const NpiField = ({ id, value, onChange, extError }) => {
  const [focused, setFocused] = React.useState(false);
  const inputRef = React.useRef(null);
  const digits = value || '';
  const complete = digits.length === 10;
  const valid = complete && npiOk(digits);
  const checksumErr = complete && !valid;
  const activeIdx = focused && !complete ? digits.length : -1;
  const error = extError || (checksumErr ? 'Checksum failed — these ten digits don’t validate as an NPI. Check for a typo.' : null);
  return (
    <div>
      <div className={`npi-cells${error ? ' error' : ''}`} onClick={() => inputRef.current && inputRef.current.focus()}>
        <input ref={inputRef} className="npi-real" value={digits} id={id}
          inputMode="numeric" pattern="[0-9]*" autoComplete="off"
          aria-label="Clinician National Provider Identifier, 10 digits"
          aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 10))} />
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={i} aria-hidden="true"
            className={`npi-cell${digits[i] ? ' filled' : ''}${i === activeIdx ? ' active' : ''}`}>
            {digits[i] || ''}
          </span>
        ))}
      </div>
      <div className="npi-meta">
        <span className={`npi-count${valid ? ' done' : ''}`} aria-live="polite">
          {digits.length}/10{valid ? ' · format OK' : ''}
        </span>
        <span className="npi-micro">Public identifier — not PHI.</span>
      </div>
      {error ? (
        <p className="fk-err" id={`${id}-err`} style={{ marginTop: 8 }}>
          <TrustGlyph state="p0" size={11} /><span>{error}</span>
        </p>
      ) : null}
    </div>
  );
};

/* ---------- HonestyPanel (DG-8.4) — signature side-by-side pair ---------- */
const HonestyPanel = ({ tone, title, items, foot }) => (
  <section className={`hn-panel ${tone}`} aria-label={title}>
    <header className="hn-panel-head">
      <TrustGlyph state={tone === 'ok' ? 'checked' : 'stale'} size={14} />
      <span className="t">{title}</span>
      <span className="n vt-num">{items.length} lanes</span>
    </header>
    <ul className="hn-items">
      {items.map((it) => (
        <li className="hn-item" key={it.label}>
          <div>
            <span className="lab">{it.label}</span>
            <span className="src">{it.source}</span>
            {it.note ? <p className="note">{it.note}</p> : null}
          </div>
          <StateChip state={it.state} size="sm" label={it.chipLabel} />
        </li>
      ))}
    </ul>
    {foot ? <div className="hn-panel-foot"><HonestyLabel>{foot}</HonestyLabel></div> : null}
  </section>
);

/* ---------- StepTimeline — mono labels, hairline connector ---------- */
const StepTimeline = ({ steps }) => (
  <ol className="tl">
    {steps.map((s, i) => (
      <li className="tl-step" key={s.key}>
        <div className="tl-marker vt-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</div>
        <div className="tl-body">
          <span className="tl-key">{s.key}</span>
          <h3>{s.title}</h3>
          <p>{s.body}</p>
          {s.meta ? <span className="tl-meta">{s.meta}</span> : null}
        </div>
      </li>
    ))}
  </ol>
);

Object.assign(window, {
  npiOk, parseRoute, useRoute, S2Nav, S2_ROUTES, BoundaryFooter,
  Field, TextInput, TextArea, validateWorkEmail, validateRequired,
  ErrorSummary, SuccessCard, NpiField, HonestyPanel, StepTimeline,
});
