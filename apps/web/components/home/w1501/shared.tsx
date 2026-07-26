'use client';

/**
 * Wave 1501 shared scaffold — port of `wave1501/hp-shared.jsx`.
 * Reveal / SecHead / CanonicalPath / RoleGlyph / useReducedMotion / scrollToId.
 */

import * as React from 'react';

export const useReducedMotion = () => {
  // SSR-safe: assume motion is allowed, then correct on mount. Assuming
  // "reduced" instead would render the static tier into the HTML and make the
  // animated tier a post-hydration pop for every visitor.
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const fn = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return reduced;
};

/**
 * Arms the entrance-motion layer.
 *
 * `hp.css` only hides `.hp-reveal` under `html.js.motion-live`, so the server
 * HTML is always fully visible — no-JS and capture contexts can never get a
 * blank page. Arming happens in a rAF from the ISLAND ROOT's effect, which in
 * React runs after every child's effect. That ordering is load-bearing: each
 * Reveal marks itself `.is-in` first, so by the time the hidden state exists,
 * everything above the fold is already exempt from it. Arming earlier (module
 * scope, or a parent effect that beat the children) would flash the fold.
 */
export const useArmEntranceMotion = () => {
  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.add('js');
    const raf = requestAnimationFrame(() => root.classList.add('motion-live'));
    return () => cancelAnimationFrame(raf);
  }, []);
};

/* Single-shot entrance on scroll — adds .is-in once, never repeats (DG-5.2). */
export const Reveal = ({
  as: Tag = 'div',
  delay = 0,
  className = '',
  style,
  children,
  ...rest
}: {
  as?: React.ElementType;
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
} & Record<string, unknown>) => {
  const ref = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    /* Already in (or above) the viewport → reveal synchronously; the observer
       is only for below-fold elements. The failsafe + scroll listener exist
       because a missed observer callback would leave content permanently
       invisible, which is a far worse failure than a skipped animation. */
    if (el.getBoundingClientRect().top < window.innerHeight * 0.96) {
      el.classList.add('is-in');
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.classList.add('is-in');
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
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
    return () => {
      io.disconnect();
      clearTimeout(failsafe);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);
  return (
    <Tag
      ref={ref}
      className={`hp-reveal ${className}`}
      style={{ transitionDelay: delay ? `${delay}ms` : undefined, ...style }}
      {...rest}
    >
      {children}
    </Tag>
  );
};

/* Eyebrow → headline → body (DG-7.12 pattern, everywhere) */
export const SecHead = ({
  eyebrow,
  title,
  lede,
  brand,
  id,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lede?: string;
  brand?: boolean;
  id?: string;
}) => (
  <Reveal className="hp-sechead">
    <span className="vt-eyebrow" style={brand ? { color: 'var(--vt-brand)' } : undefined}>
      {eyebrow}
    </span>
    <h2 id={id}>{title}</h2>
    {lede ? <p className="lede">{lede}</p> : null}
  </Reveal>
);

/* CanonicalPath — RECOGNITION → ACCEPTANCE → START (DG-7.6, reusable) */
const CPATH_STAGES = [
  { key: 'recognition', label: 'Recognition', def: 'A clean read from a primary source, kept on your record.' },
  { key: 'acceptance', label: 'Acceptance', def: 'An organization takes your snapshot as a head start.' },
  { key: 'start', label: 'Start', def: 'The first shift arrives sooner. Committees still decide.' },
] as const;

export const CanonicalPath = ({ compact }: { compact?: boolean }) => (
  <div className="cpath" role="list" aria-label="Canonical path: recognition, then acceptance, then start">
    {CPATH_STAGES.map((s, i) => (
      <React.Fragment key={s.key}>
        {i > 0 ? (
          <div className="cpath-arrow" aria-hidden="true">
            →
          </div>
        ) : null}
        <div className="cpath-cell" role="listitem">
          <span className="cpath-label">
            <span className={`cpath-dot ${s.key}`} />
            {s.label.toUpperCase()}
          </span>
          {compact ? null : <span className="cpath-def">{s.def}</span>}
        </div>
      </React.Fragment>
    ))}
  </div>
);

/* Role glyphs — monochrome, currentColor, stroke 1.5 (matches TrustGlyph grammar) */
export type RoleKey = 'clinician' | 'verifier' | 'employer' | 'issuer';

const RG = ({ children, size = 22 }: { children: React.ReactNode; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 22 22"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const RoleGlyph = ({ role, size = 22 }: { role: RoleKey; size?: number }) => {
  if (role === 'clinician')
    return (
      <RG size={size}>
        <circle cx="11" cy="7.2" r="3.4" />
        <path d="M4.4 18.5 C5.2 14.6 7.8 12.6 11 12.6 C14.2 12.6 16.8 14.6 17.6 18.5" />
      </RG>
    );
  if (role === 'verifier')
    return (
      <RG size={size}>
        <path d="M2.6 11 C4.8 6.9 7.7 5 11 5 C14.3 5 17.2 6.9 19.4 11 C17.2 15.1 14.3 17 11 17 C7.7 17 4.8 15.1 2.6 11 Z" />
        <circle cx="11" cy="11" r="2.6" />
      </RG>
    );
  if (role === 'employer')
    return (
      <RG size={size}>
        <rect x="4.5" y="3.5" width="13" height="15" />
        <path d="M8 7.5 H9.5 M12.5 7.5 H14 M8 11 H9.5 M12.5 11 H14 M9.5 18.5 V15 H12.5 V18.5" />
      </RG>
    );
  return (
    /* issuer — seal */
    <RG size={size}>
      <circle cx="11" cy="8.4" r="4.4" />
      <path d="M8.6 12.2 L7 18.5 L11 16.3 L15 18.5 L13.4 12.2" />
    </RG>
  );
};

/* Anchor scroll without scrollIntoView */
export const scrollToId = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  const top = el.getBoundingClientRect().top + window.scrollY - 68;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
};
