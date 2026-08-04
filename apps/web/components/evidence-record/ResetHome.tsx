'use client';

/**
 * DESIGN RESET — one clinician identity at poster scale, carried through four
 * full-bleed environments.
 *
 * Deliberately NOT carried over from Z1: the hero grid, the copy-column /
 * card-column arrangement, the story column, bordered cards in every chapter,
 * medical icons, the EKG divider, glass chrome, ambient loops.
 *
 * The opening is ONE scene: headline, one sentence, the NPI bar as the
 * centrepiece, and beneath it a single transformation rail the identity
 * travels. Typing drives it — the rail is not an illustration of the product,
 * it is the product reacting.
 *
 * Truth handling is unchanged in substance and moved out of the primary
 * hierarchy: resolution is simulated, the profile is fictional, and the
 * institution-review limitation is stated in fine print rather than as a
 * headline. No duration is promised and no credentialing claim is made.
 */

import { useEffect, useRef, useState } from 'react';

import { FUNNEL_EVENTS, trackFunnelEvent } from '@/lib/analytics/funnel';

const HOLDER = 'K. Osei, PA-C';
const MONOGRAM = 'KO';
const ROLE = 'Emergency medicine · 8 years';
const LANES_ANSWERED = 4;
const LANES_TOTAL = 6;

const OPPORTUNITY = {
  role: 'Emergency Medicine PA',
  org: 'Cascade Regional Medical Center',
  why: ['Your specialty', 'Your schedule', `${LANES_ANSWERED} of ${LANES_TOTAL} sources already answered`],
};

/** Real NPI check digit: Luhn over the 80840 issuer prefix + 9 digits. */
export function isValidNpi(npi: string): boolean {
  if (!/^\d{10}$/.test(npi)) return false;
  const digits = `80840${npi}`.split('').map(Number);
  const check = digits.pop() as number;
  let sum = 0;
  digits.reverse().forEach((d, i) => {
    const v = i % 2 === 0 ? d * 2 : d;
    sum += v > 9 ? v - 9 : v;
  });
  return (10 - (sum % 10)) % 10 === check;
}

const STEPS = ['NPI', 'Profile', 'Opportunity', 'Apply', 'Employer', 'Start'] as const;

interface Props {
  /** Canonical SEALED face — proof, cropped, inside the employer moment. */
  sealedFace: string;
}

export function ResetHome({ sealedFace }: Props) {
  const [raw, setRaw] = useState('');
  const [phase, setPhase] = useState<'idle' | 'resolving' | 'live' | 'invalid'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const typed = inputRef.current?.value ?? '';
    if (typed) setRaw((c) => (c ? c : typed));
    trackFunnelEvent(FUNNEL_EVENTS.HOMEPAGE_VIEWED);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => { if (e.isIntersecting) e.target.setAttribute('data-seen', ''); }),
      { rootMargin: '0px 0px -10% 0px' },
    );
    root.querySelectorAll('[data-rst-reveal]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const digits = raw.replace(/\D/g, '').slice(0, 10);
  const live = phase === 'live';

  const submit = () => {
    if (digits.length !== 10 || !isValidNpi(digits)) { setPhase('invalid'); return; }
    if (timer.current) clearTimeout(timer.current);
    setPhase('resolving');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    timer.current = setTimeout(() => setPhase('live'), reduced ? 500 : 1000);
  };

  /* How far the identity has travelled the rail. Typing moves it off the
   * first node; resolving carries it to the profile; the rest is the story. */
  const reached = live ? 6 : phase === 'resolving' ? 2 : digits.length > 0 ? 1 : 0;
  const progress = `${Math.max(8, (reached / STEPS.length) * 100)}%`;

  return (
    <div className="rst" ref={rootRef}>
      {/* ============ OPENING — one unified scene ============ */}
      <section className="rst-room rst-open" data-home-hero aria-label="Start with your NPI">
        <h1 className="rst-h">Get hired for the right opportunity—and start <em>sooner</em>.</h1>
        <p className="rst-sub">
          Build your clinician profile from your NPI, apply with it, and give employers a head start.
        </p>

        <form
          className="rst-bar"
          onSubmit={(e) => { e.preventDefault(); submit(); }}
        >
          <label className="sr-only" htmlFor="rst-npi">Your 10-digit NPI</label>
          <input
            ref={inputRef}
            id="rst-npi"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Your 10-digit NPI"
            value={digits}
            onChange={(e) => { setRaw(e.target.value); if (phase === 'invalid' || phase === 'live') setPhase('idle'); }}
          />
          <button type="submit" data-home-primary-cta disabled={phase === 'resolving'}>
            {phase === 'resolving' ? 'Building…' : 'Start with your NPI'}
          </button>
        </form>

        {phase === 'invalid' && (
          <p className="rst-msg" role="status">That number fails the NPI check digit. Re-enter it as it appears in the NPPES registry.</p>
        )}

        {/* THE TRANSFORMATION — one rail, the identity travelling it */}
        <div className="rst-track" style={{ ['--rst-progress' as string]: progress }} aria-label="NPI to start">
          {STEPS.map((name, i) => {
            const on = i < reached;
            return (
              <div className="rst-step" key={name} data-on={on ? '' : undefined}>
                <div className={`rst-plate${on ? '' : ' rst-plate--ghost'}${on && live ? ' rst-anim' : ''}`}>
                  {i === 0 && (
                    <span className="rst-mono-lg">
                      {digits.length ? `${digits.slice(0, 2)}${'•'.repeat(digits.length - 2)}` : '··········'}
                    </span>
                  )}
                  {i === 1 && (
                    <>
                      <span className={`rst-mono rst-mono--sm${on ? '' : ' rst-mono--ghost'}`} aria-hidden="true">{on ? MONOGRAM : ''}</span>
                      <span className="rst-plate-name">{on ? HOLDER : 'Your profile'}</span>
                    </>
                  )}
                  {i === 2 && <span className="rst-plate-name">{on ? OPPORTUNITY.role : 'A match'}</span>}
                  {i === 3 && (
                    <>
                      <span className={`rst-mono rst-mono--sm${on ? '' : ' rst-mono--ghost'}`} aria-hidden="true">{on ? MONOGRAM : ''}</span>
                      <span className="rst-plate-sub">travels</span>
                    </>
                  )}
                  {i === 4 && <span className="rst-plate-name">{on ? 'Cascade Regional' : 'The employer'}</span>}
                  {i === 5 && <span className="rst-plate-name">{on ? 'Start confirmed' : 'Day one'}</span>}
                </div>
                <span className="rst-step-name">{name}</span>
              </div>
            );
          })}
        </div>

        <p className="rst-fine">
          Simulated preview · fictional clinician · institutions still run their own review
        </p>
      </section>

      {/* ============ 1 · CREATE — ink ============ */}
      <section className="rst-room rst-room--ink rst-create" aria-label="Create">
        <span className="rst-mark" aria-hidden="true">01</span>
        <div className="rst-create-id" data-rst-reveal>
          <span className="rst-mono rst-mono--xl" aria-hidden="true">{MONOGRAM}</span>
          <p className="rst-name-xl">{HOLDER}</p>
          <p className="rst-role">{ROLE}</p>
          <div className="rst-lanes" role="img" aria-label={`${LANES_ANSWERED} of ${LANES_TOTAL} sources answered`}>
            {Array.from({ length: LANES_TOTAL }, (_, i) => (
              <span className="rst-lane" key={i} data-f={i < LANES_ANSWERED ? '' : undefined} />
            ))}
          </div>
        </div>
        <div data-rst-reveal>
          <h2 className="rst-h">A number becomes a career.</h2>
          <p className="rst-sub">Your NPI assembles a profile you own and reuse — not another application form.</p>
        </div>
      </section>

      {/* ============ 2 · DISCOVER — ivory ============ */}
      <section className="rst-room rst-room--deep rst-discover" aria-label="Discover">
        <span className="rst-mark" aria-hidden="true">02</span>
        <div data-rst-reveal>
          <h2 className="rst-h">Work that fits more than a résumé.</h2>
        </div>
        <div className="rst-opp" data-rst-reveal>
          <div>
            <p className="rst-opp-role">{OPPORTUNITY.role}</p>
            <p className="rst-opp-org">{OPPORTUNITY.org}</p>
            <button type="button" className="rst-act">Apply with VitalCV</button>
          </div>
          <ul className="rst-why">
            {OPPORTUNITY.why.map((w) => <li key={w}>{w}</li>)}
          </ul>
        </div>
        <p className="rst-fine">Illustrative match — not a live listing</p>
      </section>

      {/* ============ 3 · APPLY — indigo ============ */}
      <section className="rst-room rst-room--indigo rst-apply" aria-label="Apply">
        <span className="rst-mark" aria-hidden="true">03</span>
        <div data-rst-reveal>
          <h2 className="rst-h">The same profile, handed over.</h2>
          <p className="rst-sub">You choose what travels. The employer sees where each item came from.</p>
        </div>
        <div className="rst-cross" data-rst-reveal>
          <div className="rst-side">
            <span className="rst-who">You</span>
            <div className="rst-carry">
              <span className="rst-mono rst-mono--sm" aria-hidden="true">{MONOGRAM}</span>
              <span>
                <span className="rst-carry-name">{HOLDER}</span>
                <span className="rst-carry-sub">with permission</span>
              </span>
            </div>
          </div>
          <span className="rst-arrow" aria-hidden="true">→</span>
          <div className="rst-side rst-side--to">
            <span className="rst-who">{OPPORTUNITY.org}</span>
            <div className="rst-carry">
              <span className="rst-mono rst-mono--sm" aria-hidden="true">{MONOGRAM}</span>
              <span>
                <span className="rst-carry-name">Received</span>
                <span className="rst-carry-sub">{LANES_ANSWERED} of {LANES_TOTAL} answered</span>
              </span>
            </div>
            <div className="rst-proof evr-scene" dangerouslySetInnerHTML={{ __html: sealedFace }} />
          </div>
        </div>
      </section>

      {/* ============ 4 · CONTINUE — ivory ============ */}
      <section className="rst-room rst-continue" aria-label="Continue">
        <span className="rst-mark" aria-hidden="true">04</span>
        <div data-rst-reveal>
          <h2 className="rst-h">Review starts ahead, not from zero.</h2>
          <p className="rst-outcome">Start sooner.</p>
        </div>
        <div className="rst-keep" data-rst-reveal>
          <span className="rst-mono rst-mono--xl" aria-hidden="true">{MONOGRAM}</span>
          <p className="rst-keep-line">Your profile stays yours — ready for the next opportunity.</p>
        </div>
        <p className="rst-fine">Employers make their own hiring and credentialing decisions.</p>
      </section>
    </div>
  );
}
