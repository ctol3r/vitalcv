'use client';

import * as React from 'react';
import { BriefcaseBusiness, Pause, Play } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollScrubHeading } from '@/components/motion/ScrollScrubHeading';
import { StoryIcon, type StoryIconName } from '@/components/home/StoryIcon';
import { TrustGlyph } from '@/components/vital/TrustGlyph';
import type { EvidenceState } from '@/lib/vital/evidenceState';

// Each mockup row is either an EVIDENCE row (typed state → TrustGlyph, which
// never shows a check for gated/review/unavailable — the Trust Center's exact
// promise) or a WORKFLOW fact (no state → neutral dot that asserts nothing).
type UiRow = { label: string; state?: EvidenceState };

const PRODUCTS: ReadonlyArray<{
  id: string;
  title: string;
  eyebrow: string;
  body: string;
  icon: StoryIconName;
  ui: readonly UiRow[];
}> = [
  {
    id: 'wallet',
    title: 'CV Wallet',
    eyebrow: 'Clinician-owned evidence',
    body: 'Source checks, receipts, and Recognition — one wallet.',
    icon: 'wallet',
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
    body: 'What employers can confirm today — and what still needs review.',
    icon: 'readiness',
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
    body: 'Evidence matched to role requirements, reasoning visible.',
    icon: 'match',
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
    body: 'One attributed packet. One consent receipt.',
    icon: 'apply',
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
    body: 'Acceptance recorded — not a credentialing decision.',
    icon: 'recognition',
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
    body: 'The same evidence carries to the next opportunity.',
    icon: 'reuse',
    ui: [
      { label: 'Wallet · Carried forward' },
      { label: 'Recognition · Reusable' },
      { label: 'New review · Ready to begin' },
    ],
  },
] as const;

/**
 * Continuous flow (Chris, 2026-07-17: "100% continuous flow"): the belt moves
 * at a constant reading pace with NO discrete stops — a seamless marquee, not
 * a slide deck. The card sequence is duplicated once and the offset wraps at
 * the halfway point, so the loop has no visible seam.
 *
 * WCAG 2.2.2 is honored the marquee way: a visible pause control, and the
 * flow suspends while hovered, focused, off-screen, or in a hidden tab.
 * prefers-reduced-motion collapses the belt to a static grid (CSS) and the
 * loop never starts.
 */
const FLOW_PX_PER_SECOND = 42;

export function ProductCarousel() {
  const sectionRef = React.useRef<HTMLElement>(null);
  const beltRef = React.useRef<HTMLDivElement>(null);
  const offsetRef = React.useRef(0);
  const dragRef = React.useRef({ pointerId: -1, lastX: 0, moved: false });
  // User intent: the pause button toggles it.
  const [autoPlay, setAutoPlay] = React.useState(true);
  const [reducedMotion, setReducedMotion] = React.useState(false);
  // The duplicate set exists only on the client with motion allowed — the
  // server render (and reduced motion) is a single, honest list.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  const flowing = mounted && !reducedMotion;

  // The flow loop. Holds (hover, focus, off-screen, hidden tab) suspend
  // advancement without tearing anything down; the offset lives in a ref and
  // is applied as a transform — React never re-renders per frame.
  React.useEffect(() => {
    if (!flowing || !autoPlay) return;
    const section = sectionRef.current;
    const belt = beltRef.current;
    if (!section || !belt) return;

    const hold = { hover: false, focus: false, offscreen: true, hidden: document.hidden, dragging: false };
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
            { threshold: 0.2 },
          )
        : null;
    observer?.observe(section);

    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const wrapAt = belt.scrollWidth / 2;
      if (!hold.hover && !hold.focus && !hold.offscreen && !hold.hidden && !dragRef.current.moved && wrapAt > 0) {
        offsetRef.current += FLOW_PX_PER_SECOND * dt;
        if (offsetRef.current >= wrapAt) offsetRef.current -= wrapAt;
        belt.style.transform = `translate3d(${-offsetRef.current}px, 0, 0)`;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
      section.removeEventListener('pointerenter', onEnter);
      section.removeEventListener('pointerleave', onLeave);
      section.removeEventListener('focusin', onFocusIn);
      section.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [flowing, autoPlay]);

  // Manual control moves the same offset the flow uses, so drag and flow can
  // never fight: drag while flowing, release, and the belt streams on from
  // exactly where the hand left it.
  const applyOffset = React.useCallback((delta: number) => {
    const belt = beltRef.current;
    if (!belt) return;
    const wrapAt = belt.scrollWidth / 2;
    if (wrapAt <= 0) return;
    let next = offsetRef.current + delta;
    next = ((next % wrapAt) + wrapAt) % wrapAt;
    offsetRef.current = next;
    belt.style.transform = `translate3d(${-next}px, 0, 0)`;
  }, []);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!flowing) return;
    dragRef.current = { pointerId: event.pointerId, lastX: event.clientX, moved: false };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    event.currentTarget.dataset.dragging = 'true';
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag.pointerId !== event.pointerId) return;
    const delta = event.clientX - drag.lastX;
    if (Math.abs(delta) > 0) {
      drag.moved = true;
      drag.lastX = event.clientX;
      applyOffset(-delta);
    }
  };
  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current.pointerId !== event.pointerId) return;
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    delete event.currentTarget.dataset.dragging;
    dragRef.current = { pointerId: -1, lastX: 0, moved: false };
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!flowing) return;
    // A keyboard nudge of one card width in either direction; the flow itself
    // is already suspended because focus is inside the section.
    const card = beltRef.current?.querySelector<HTMLElement>('.product-carousel-card');
    const stride = (card?.offsetWidth ?? 480) + 16;
    if (event.key === 'ArrowRight') applyOffset(stride);
    else if (event.key === 'ArrowLeft') applyOffset(-stride);
    else return;
    event.preventDefault();
  };

  const renderCard = (product: (typeof PRODUCTS)[number], index: number, clone: boolean) => {
    return (
      <article
        key={clone ? `${product.id}-clone` : product.id}
        data-carousel-card={clone ? undefined : product.id}
        aria-hidden={clone ? 'true' : undefined}
        aria-label={clone ? undefined : `${index + 1} of ${PRODUCTS.length}: ${product.title}`}
        className="product-carousel-card"
      >
        <Card className="product-carousel-card-shell">
          <div className="product-carousel-card-copy">
            <span className="product-carousel-card-icon" aria-hidden="true"><StoryIcon name={product.icon} size={38} /></span>
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
  };

  return (
    <section
      ref={sectionRef}
      data-home-product-carousel=""
      data-carousel-flow="continuous"
      data-carousel-autoplay={autoPlay && flowing ? 'on' : 'off'}
      data-carousel-speed-pps={FLOW_PX_PER_SECOND}
      className="product-carousel"
      aria-labelledby="product-carousel-title"
    >
      <div className="product-carousel-heading">
        <div>
          <p className="mz-eyebrow"><span className="mz-eyebrow-index" aria-hidden="true">06</span>The product, end to end</p>
          <ScrollScrubHeading
            id="product-carousel-title"
            as="h2"
            className="mz-h1"
            text="One career record. Six reusable surfaces."
            accentWords={['Six reusable surfaces.']}
            accentColor="var(--accent)"
          />
        </div>
        <div className="product-carousel-controls">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={autoPlay ? 'Pause the product flow' : 'Resume the product flow'}
            aria-pressed={!autoPlay}
            onClick={() => setAutoPlay((value) => !value)}
          >
            {autoPlay ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
          </Button>
        </div>
      </div>

      <div
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
      >
        <div ref={beltRef} className="product-carousel-belt" data-carousel-belt="">
          {PRODUCTS.map((product, index) => renderCard(product, index, false))}
          {/* The seam-hiding duplicate — presentation only, hidden from AT. */}
          {flowing ? PRODUCTS.map((product, index) => renderCard(product, index, true)) : null}
        </div>
      </div>
    </section>
  );
}

export default ProductCarousel;
