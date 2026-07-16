'use client';

import * as React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BriefcaseBusiness,
  FileUp,
  Pause,
  Play,
  RefreshCw,
  SearchCheck,
  ShieldCheck,
  Wallet,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TrustGlyph } from '@/components/vital/TrustGlyph';
import type { EvidenceState } from '@/lib/vital/evidenceState';

// Each mockup row is either an EVIDENCE row (typed state → TrustGlyph, which
// never shows a check for gated/review/unavailable — the Trust Center's exact
// promise) or a WORKFLOW fact (no state → neutral dot that asserts nothing).
// The previous version drew a green check on every row, including "Access
// required" and "Review needed" — a truth-contract violation.
type UiRow = { label: string; state?: EvidenceState };

const PRODUCTS: ReadonlyArray<{
  id: string;
  title: string;
  eyebrow: string;
  body: string;
  icon: React.ComponentType<{ size?: number }>;
  ui: readonly UiRow[];
}> = [
  {
    id: 'wallet',
    title: 'CV Wallet',
    eyebrow: 'Clinician-owned evidence',
    body: 'Keep source checks, receipts, and Recognition together across every career move.',
    icon: Wallet,
    ui: [
      { label: 'NPI identity · Source-backed', state: 'source_backed' },
      { label: 'OIG / LEIE · Checked', state: 'checked' },
      { label: 'License · Access required', state: 'access_required' },
    ],
  },
  {
    id: 'readiness',
    title: 'Readiness',
    eyebrow: 'Know the next action',
    body: 'See what an employer can inspect today and what still needs access or review.',
    icon: ShieldCheck,
    ui: [
      { label: 'Identity · Source-backed', state: 'source_backed' },
      { label: 'Exclusions · Checked', state: 'checked' },
      { label: 'Licensure · Access required', state: 'access_required' },
    ],
  },
  {
    id: 'matcha',
    title: 'MATCHA',
    eyebrow: 'Explainable matching',
    body: 'Match source-backed evidence and stated preferences to role requirements with the reasoning visible.',
    icon: SearchCheck,
    ui: [
      { label: 'Specialty · Meets requirement', state: 'checked' },
      { label: 'Location · Your stated preference', state: 'self_attested' },
      { label: 'License · Review needed', state: 'needs_review' },
    ],
  },
  {
    id: 'apply',
    title: 'Apply with VitalCV',
    eyebrow: 'Reuse the proof packet',
    body: 'Choose what to disclose, send one attributed packet, and keep the consent receipt.',
    icon: FileUp,
    ui: [
      { label: '4 claims selected' },
      { label: 'Source states included' },
      { label: 'Consent receipt ready' },
    ],
  },
  {
    id: 'recognition',
    title: 'Employer Recognition',
    eyebrow: 'Accepted as a head start',
    body: 'Record an employer acceptance without confusing it with a final credentialing decision.',
    icon: Award,
    ui: [
      { label: 'Packet · Reviewed' },
      { label: 'Head start · Accepted', state: 'employer_decision' },
      { label: 'Audit event · Recorded' },
    ],
  },
  {
    id: 'reuse',
    title: 'Career reuse',
    eyebrow: 'Nothing resets',
    body: 'Carry the same evidence and prior Recognition into the next opportunity instead of rebuilding from zero.',
    icon: RefreshCw,
    ui: [
      { label: 'Wallet · Carried forward' },
      { label: 'Recognition · Reusable' },
      { label: 'New review · Ready to begin' },
    ],
  },
] as const;

// Auto-advance cadence. Slow enough to read a card (title + three rows),
// per Chris's 2026-07-16 direction reversing the wave's original no-autoplay
// rule. WCAG 2.2.2 is honored via the pause control + the suspend conditions
// in useAutoAdvance.
const AUTO_ADVANCE_MS = 6000;

export function ProductCarousel() {
  const sectionRef = React.useRef<HTMLElement>(null);
  const trackRef = React.useRef<HTMLDivElement>(null);
  const cardRefs = React.useRef<Array<HTMLElement | null>>([]);
  const [active, setActive] = React.useState(0);
  const dragRef = React.useRef({ pointerId: -1, startX: 0, scrollLeft: 0, moved: false });
  // User intent: the pause button toggles it, any manual navigation clears it.
  const [autoPlay, setAutoPlay] = React.useState(true);
  const [reducedMotion, setReducedMotion] = React.useState(false);

  const goTo = React.useCallback((index: number, behavior: ScrollBehavior = 'smooth') => {
    const safeIndex = Math.max(0, Math.min(PRODUCTS.length - 1, index));
    const track = trackRef.current;
    const card = cardRefs.current[safeIndex];
    if (!track || !card) return;
    track.scrollTo({ left: card.offsetLeft - track.offsetLeft, behavior });
    setActive(safeIndex);
  }, []);

  // Manual navigation is a stronger signal than hover: the visitor took the
  // wheel, so auto-advance stops for good (the pause button can restart it).
  const stopAuto = React.useCallback(() => setAutoPlay(false), []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  // Auto-advance loop. The interval always ticks while enabled; each tick
  // re-checks the suspend conditions (hover, focus inside, off-screen, hidden
  // tab) so pausing never tears down state, and resuming needs no bookkeeping.
  const activeRef = React.useRef(active);
  activeRef.current = active;
  React.useEffect(() => {
    if (!autoPlay || reducedMotion || typeof window === 'undefined') return;
    const section = sectionRef.current;
    if (!section) return;

    const hold = { hover: false, focus: false, offscreen: true, hidden: document.hidden };
    const onEnter = () => { hold.hover = true; };
    const onLeave = () => { hold.hover = false; };
    const onFocusIn = () => { hold.focus = true; };
    const onFocusOut = (event: FocusEvent) => {
      hold.focus = section.contains(event.relatedTarget as Node | null);
    };
    const onVisibility = () => { hold.hidden = document.hidden; };
    section.addEventListener('pointerenter', onEnter);
    section.addEventListener('pointerleave', onLeave);
    section.addEventListener('focusin', onFocusIn);
    section.addEventListener('focusout', onFocusOut);
    document.addEventListener('visibilitychange', onVisibility);

    const observer =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            (entries) => { hold.offscreen = !entries.some((entry) => entry.isIntersecting); },
            { threshold: 0.35 },
          )
        : null;
    observer?.observe(section);

    const timer = window.setInterval(() => {
      if (hold.hover || hold.focus || hold.offscreen || hold.hidden) return;
      goTo((activeRef.current + 1) % PRODUCTS.length);
    }, AUTO_ADVANCE_MS);

    return () => {
      window.clearInterval(timer);
      observer?.disconnect();
      section.removeEventListener('pointerenter', onEnter);
      section.removeEventListener('pointerleave', onLeave);
      section.removeEventListener('focusin', onFocusIn);
      section.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [autoPlay, reducedMotion, goTo]);

  React.useEffect(() => {
    const track = trackRef.current;
    if (!track || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const mostVisible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!mostVisible) return;
        const index = Number((mostVisible.target as HTMLElement).dataset.carouselIndex);
        if (Number.isFinite(index)) setActive(index);
      },
      { root: track, threshold: [0.45, 0.65, 0.85] },
    );
    cardRefs.current.forEach((card) => card && observer.observe(card));
    return () => observer.disconnect();
  }, []);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    let next = active;
    if (event.key === 'ArrowRight') next = Math.min(PRODUCTS.length - 1, active + 1);
    else if (event.key === 'ArrowLeft') next = Math.max(0, active - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = PRODUCTS.length - 1;
    else return;
    event.preventDefault();
    stopAuto();
    goTo(next);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    stopAuto();
    if (event.pointerType === 'touch') return;
    const track = trackRef.current;
    if (!track) return;
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, scrollLeft: track.scrollLeft, moved: false };
    track.setPointerCapture(event.pointerId);
    track.dataset.dragging = 'true';
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    const drag = dragRef.current;
    if (!track || drag.pointerId !== event.pointerId) return;
    const delta = event.clientX - drag.startX;
    if (Math.abs(delta) > 4) drag.moved = true;
    track.scrollLeft = drag.scrollLeft - delta;
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    if (!track || dragRef.current.pointerId !== event.pointerId) return;
    track.releasePointerCapture(event.pointerId);
    delete track.dataset.dragging;
    dragRef.current.pointerId = -1;
  };

  return (
    <section
      ref={sectionRef}
      data-home-product-carousel=""
      data-carousel-autoplay={autoPlay && !reducedMotion ? 'on' : 'off'}
      className="product-carousel"
      aria-labelledby="product-carousel-title"
    >
      <div className="product-carousel-heading">
        <div>
          <p className="mz-eyebrow">The product, end to end</p>
          <h2 id="product-carousel-title" className="mz-h1">
            One career record. <em className="mz-accent">Six reusable surfaces.</em>
          </h2>
        </div>
        <div className="product-carousel-controls">
          {/* No aria-live here: with auto-advance it would announce every 6s.
              Manual position is conveyed by the slides' own labels. */}
          <span className="product-carousel-count">
            {String(active + 1).padStart(2, '0')} / {String(PRODUCTS.length).padStart(2, '0')}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={autoPlay ? 'Pause auto-advance' : 'Resume auto-advance'}
            aria-pressed={!autoPlay}
            onClick={() => setAutoPlay((value) => !value)}
          >
            {autoPlay ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Previous product"
            disabled={active === 0}
            onClick={() => { stopAuto(); goTo(active - 1); }}
          >
            <ArrowLeft size={16} aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Next product"
            disabled={active === PRODUCTS.length - 1}
            onClick={() => { stopAuto(); goTo(active + 1); }}
          >
            <ArrowRight size={16} aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div
        ref={trackRef}
        className="product-carousel-track"
        tabIndex={0}
        role="region"
        aria-roledescription="carousel"
        aria-label="VitalCV product surfaces"
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onWheel={(event) => {
          // Horizontal trackpad swipes are manual navigation; vertical wheel
          // over the track is just page scrolling passing through.
          if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) stopAuto();
        }}
      >
        {PRODUCTS.map((product, index) => {
          const Icon = product.icon;
          return (
            <article
              key={product.id}
              ref={(node) => { cardRefs.current[index] = node; }}
              data-carousel-card={product.id}
              data-carousel-index={index}
              aria-label={`${index + 1} of ${PRODUCTS.length}: ${product.title}`}
              className="product-carousel-card"
            >
              <Card className="product-carousel-card-shell">
                <div className="product-carousel-card-copy">
                  <span className="product-carousel-card-icon" aria-hidden="true"><Icon size={19} /></span>
                  <p>{product.eyebrow}</p>
                  <h3>{product.title}</h3>
                  <p>{product.body}</p>
                </div>
                <div className="product-carousel-ui" aria-hidden="true">
                  <div>
                    <span>VitalCV</span>
                    <BriefcaseBusiness size={15} />
                  </div>
                  <ul>
                    {product.ui.map((row) => (
                      <li key={row.label}>
                        {row.state ? (
                          <TrustGlyph state={row.state} labelHidden size={13} />
                        ) : (
                          <span
                            aria-hidden="true"
                            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: 'var(--vt-text-muted)' }}
                          />
                        )}
                        <span>{row.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            </article>
          );
        })}
      </div>

      <div className="product-carousel-progress" aria-hidden="true">
        {PRODUCTS.map((product, index) => (
          <span key={product.id} data-active={index === active ? 'true' : 'false'} />
        ))}
      </div>
    </section>
  );
}

export default ProductCarousel;
