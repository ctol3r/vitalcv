// Wave 1501 · hp-shared.jsx — section scaffold, reveal, CanonicalPath, role glyphs.
// Consumes wave1500 tokens/primitives only. No new colors.

/* Proof the rendering clock is alive: rAF fires pre-first-paint in live tabs
   (no flash) and never in frozen/capture contexts — where content must simply
   render visible with no entrance motion. hp.css gates ALL from-hidden states
   on html.motion-live. */
requestAnimationFrame(() => document.documentElement.classList.add('motion-live'));

const useReducedMotion = () => {
  const [reduced, setReduced] = React.useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const fn = (e) => setReduced(e.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return reduced;
};

/* Single-shot entrance on scroll — adds .is-in once, never repeats (DG-5.2). */
const Reveal = ({ as: Tag = 'div', delay = 0, className = '', style, children, ...rest }) => {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    /* already in (or above) the viewport → reveal synchronously; IO is only
       for below-fold elements. Plus a hard fallback so content can never stay
       hidden if observer callbacks don't fire. */
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.96) { el.classList.add('is-in'); return; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { el.classList.add('is-in'); io.disconnect(); }
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    io.observe(el);
    const failsafe = setTimeout(() => {
      if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add('is-in');
    }, 1200);
    const onScroll = () => {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.96) {
        el.classList.add('is-in');
        window.removeEventListener('scroll', onScroll);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { io.disconnect(); clearTimeout(failsafe); window.removeEventListener('scroll', onScroll); };
  }, []);
  return (
    <Tag ref={ref} className={`hp-reveal ${className}`}
      style={{ transitionDelay: delay ? `${delay}ms` : undefined, ...style }} {...rest}>
      {children}
    </Tag>
  );
};

/* Eyebrow → headline → body (DG-7.12 pattern, everywhere) */
const SecHead = ({ eyebrow, title, lede, brand }) => (
  <Reveal className="hp-sechead">
    <span className="vt-eyebrow" style={brand ? { color: 'var(--vt-brand)' } : undefined}>{eyebrow}</span>
    <h2>{title}</h2>
    {lede ? <p className="lede">{lede}</p> : null}
  </Reveal>
);

/* CanonicalPath — RECOGNITION → ACCEPTANCE → START (DG-7.6, reusable) */
const CPATH_STAGES = [
  { key: 'recognition', label: 'Recognition', def: 'A clean read from a primary source, kept on your record.' },
  { key: 'acceptance', label: 'Acceptance', def: 'An organization takes your snapshot as a head start.' },
  { key: 'start', label: 'Start', def: 'The first shift arrives sooner. Committees still decide.' },
];
const CanonicalPath = ({ compact }) => (
  <div className="cpath" role="list" aria-label="Canonical path: recognition, then acceptance, then start">
    {CPATH_STAGES.map((s, i) => (
      <React.Fragment key={s.key}>
        {i > 0 ? <div className="cpath-arrow" aria-hidden="true">→</div> : null}
        <div className="cpath-cell" role="listitem">
          <span className="cpath-label">
            <span className={`cpath-dot ${s.key}`}></span>
            {s.label.toUpperCase()}
          </span>
          {compact ? null : <span className="cpath-def">{s.def}</span>}
        </div>
      </React.Fragment>
    ))}
  </div>
);

/* Role glyphs — monochrome, currentColor, stroke 1.5 (matches TrustGlyph grammar) */
const RG = ({ children, size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 22 22" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const RoleGlyph = ({ role, size = 22 }) => {
  if (role === 'clinician') return (
    <RG size={size}><circle cx="11" cy="7.2" r="3.4" /><path d="M4.4 18.5 C5.2 14.6 7.8 12.6 11 12.6 C14.2 12.6 16.8 14.6 17.6 18.5" /></RG>);
  if (role === 'verifier') return (
    <RG size={size}><path d="M2.6 11 C4.8 6.9 7.7 5 11 5 C14.3 5 17.2 6.9 19.4 11 C17.2 15.1 14.3 17 11 17 C7.7 17 4.8 15.1 2.6 11 Z" /><circle cx="11" cy="11" r="2.6" /></RG>);
  if (role === 'employer') return (
    <RG size={size}><rect x="4.5" y="3.5" width="13" height="15" /><path d="M8 7.5 H9.5 M12.5 7.5 H14 M8 11 H9.5 M12.5 11 H14 M9.5 18.5 V15 H12.5 V18.5" /></RG>);
  return ( /* issuer — seal */
    <RG size={size}><circle cx="11" cy="8.4" r="4.4" /><path d="M8.6 12.2 L7 18.5 L11 16.3 L15 18.5 L13.4 12.2" /></RG>);
};

/* Anchor scroll without scrollIntoView */
const scrollToId = (id) => {
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - 68;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
};

Object.assign(window, { useReducedMotion, Reveal, SecHead, CanonicalPath, RoleGlyph, scrollToId });
