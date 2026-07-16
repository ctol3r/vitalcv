'use client';

import * as React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BriefcaseBusiness,
  FileUp,
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

export function ProductCarousel() {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const cardRefs = React.useRef<Array<HTMLElement | null>>([]);
  const [active, setActive] = React.useState(0);
  const dragRef = React.useRef({ pointerId: -1, startX: 0, scrollLeft: 0, moved: false });

  const goTo = React.useCallback((index: number, behavior: ScrollBehavior = 'smooth') => {
    const safeIndex = Math.max(0, Math.min(PRODUCTS.length - 1, index));
    const track = trackRef.current;
    const card = cardRefs.current[safeIndex];
    if (!track || !card) return;
    track.scrollTo({ left: card.offsetLeft - track.offsetLeft, behavior });
    setActive(safeIndex);
  }, []);

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
    goTo(next);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
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
    <section data-home-product-carousel="" className="product-carousel" aria-labelledby="product-carousel-title">
      <div className="product-carousel-heading">
        <div>
          <p className="mz-eyebrow">The product, end to end</p>
          <h2 id="product-carousel-title" className="mz-h1">
            One career record. <em className="mz-accent">Six reusable surfaces.</em>
          </h2>
        </div>
        <div className="product-carousel-controls">
          <span aria-live="polite" className="product-carousel-count">
            {String(active + 1).padStart(2, '0')} / {String(PRODUCTS.length).padStart(2, '0')}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Previous product"
            disabled={active === 0}
            onClick={() => goTo(active - 1)}
          >
            <ArrowLeft size={16} aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Next product"
            disabled={active === PRODUCTS.length - 1}
            onClick={() => goTo(active + 1)}
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
