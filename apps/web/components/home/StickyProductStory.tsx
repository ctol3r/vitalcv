'use client';

import * as React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Circle,
  FileCheck2,
  Fingerprint,
  Lock,
  SearchCheck,
  Send,
  ShieldCheck,
} from 'lucide-react';

import { Card } from '@/components/ui/card';

type StateKind = 'source' | 'checked' | 'gated' | 'attention' | 'neutral';

interface ProductRow {
  label: string;
  detail: string;
  state: StateKind;
}

interface StoryStep {
  id: string;
  label: string;
  eyebrow: string;
  title: string;
  body: string;
  action: string;
  rows: readonly ProductRow[];
  icon: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>;
}

const STEPS: readonly StoryStep[] = [
  {
    id: 'recognize',
    label: 'Recognize',
    eyebrow: '01 · Identity',
    title: 'Start with one NPI.',
    body: 'VitalCV resolves the public identity and runs the first source checks without asking the clinician to rebuild a profile.',
    action: 'Open readiness snapshot',
    icon: Fingerprint,
    rows: [
      { label: 'Identity', detail: 'NPPES · Source-backed', state: 'source' },
      { label: 'Exclusions', detail: 'OIG / LEIE · Checked', state: 'checked' },
      { label: 'Enrollment', detail: 'PECOS · Needs review', state: 'attention' },
    ],
  },
  {
    id: 'prepare',
    label: 'Prepare',
    eyebrow: '02 · Readiness',
    title: 'See what is ready and what is not.',
    body: 'Every dimension names its source state and the next useful action. Missing access stays visible instead of becoming a green checkmark.',
    action: 'Resolve the next gap',
    icon: ShieldCheck,
    rows: [
      { label: 'Identity', detail: 'Source-backed', state: 'source' },
      { label: 'Exclusions', detail: 'Checked', state: 'checked' },
      { label: 'Licensure', detail: 'Access required', state: 'gated' },
      { label: 'Enrollment', detail: 'Needs review', state: 'attention' },
    ],
  },
  {
    id: 'match',
    label: 'Match',
    eyebrow: '03 · MATCHA',
    title: 'Match evidence to the right opportunity.',
    body: 'MATCHA compares source-backed facts and stated preferences to role requirements, then shows the reasoning behind the match.',
    action: 'See why it matched',
    icon: SearchCheck,
    rows: [
      { label: 'Specialty', detail: 'Meets requirement', state: 'source' },
      { label: 'State license', detail: 'Access required', state: 'gated' },
      { label: 'Location', detail: 'Within preference', state: 'neutral' },
    ],
  },
  {
    id: 'apply',
    label: 'Apply',
    eyebrow: '04 · Proof packet',
    title: 'Apply without starting over.',
    body: 'The clinician chooses what to share. The employer receives a source-attributed packet, and the share leaves a consent receipt.',
    action: 'Share proof packet',
    icon: Send,
    rows: [
      { label: 'Identity', detail: 'Source-backed', state: 'source' },
      { label: 'Exclusions', detail: 'Checked', state: 'checked' },
      { label: 'Licensure', detail: 'Gated · shown as gated', state: 'gated' },
      { label: 'Consent', detail: 'Receipt recorded', state: 'neutral' },
    ],
  },
  {
    id: 'accept',
    label: 'Accept',
    eyebrow: '05 · Recognition',
    title: 'Carry the employer decision forward.',
    body: 'An employer can accept the packet as a head start. VitalCV Recognition records that decision without replacing final institutional review.',
    action: 'View Recognition',
    icon: FileCheck2,
    rows: [
      { label: 'Recognition', detail: 'Employer accepted', state: 'source' },
      { label: 'Decision capsule', detail: 'Audit event written', state: 'checked' },
      { label: 'Credentialing', detail: 'Institution review remains', state: 'neutral' },
    ],
  },
] as const;

const STATE_META: Record<StateKind, { icon: React.ReactNode; className: string }> = {
  source: {
    icon: <CheckCircle2 size={12} aria-hidden="true" />,
    className: 'story-state-source',
  },
  checked: {
    icon: <CheckCircle2 size={12} aria-hidden="true" />,
    className: 'story-state-checked',
  },
  gated: {
    icon: <Lock size={12} aria-hidden="true" />,
    className: 'story-state-gated',
  },
  attention: {
    icon: <AlertTriangle size={12} aria-hidden="true" />,
    className: 'story-state-attention',
  },
  neutral: {
    icon: <Circle size={11} aria-hidden="true" />,
    className: 'story-state-neutral',
  },
};

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function StoryCard({ step, index, progress }: { step: StoryStep; index: number; progress: number }) {
  const offset = index - progress;
  const past = Math.min(0, offset);
  const translate = offset >= 0 ? Math.min(160, offset * 120) : Math.max(-42, offset * 24);
  const scale = 1 + Math.max(-0.1, past * 0.045);
  // Upcoming cards stay a faint whisper (their copy must not read through the
  // active card); they only resolve as they slide into place. Receding cards
  // keep the soft stacked-deck fade.
  const opacity =
    offset >= 0
      ? Math.max(0, 1 - offset * 0.88)
      : offset < -1.4
        ? 0.12
        : 1 - Math.min(0.72, Math.abs(offset) * 0.34);
  const Icon = step.icon;

  return (
    <li
      data-story-card={step.id}
      data-story-card-index={index}
      data-section-observe={step.id === 'match' ? 'matcha' : step.id === 'apply' ? 'apply' : undefined}
      className="story-card"
      style={{
        '--story-translate': `${translate}px`,
        '--story-scale': scale,
        '--story-opacity': opacity,
        '--story-z': Math.round(50 - Math.abs(offset) * 10),
      } as React.CSSProperties}
    >
      <Card className="story-card-shell">
        <div className="story-card-copy">
          <span className="story-card-icon" aria-hidden="true">
            <Icon size={18} />
          </span>
          <p className="story-card-eyebrow">{step.eyebrow}</p>
          <h3>{step.title}</h3>
          <p>{step.body}</p>
        </div>

        <div className="story-product-ui" aria-label={`${step.label} product example`}>
          <div className="story-product-topline">
            <span>{step.label}</span>
            <span>Illustrative</span>
          </div>
          <ul>
            {step.rows.map((row) => (
              <li key={`${step.id}-${row.label}`}>
                <span>{row.label}</span>
                <span className={`story-state ${STATE_META[row.state].className}`}>
                  {STATE_META[row.state].icon}
                  {row.detail}
                </span>
              </li>
            ))}
          </ul>
          <span className="story-product-action">
            {step.action}
            <ArrowRight size={13} aria-hidden="true" />
          </span>
        </div>
      </Card>
    </li>
  );
}

export function StickyProductStory() {
  const rootRef = React.useRef<HTMLElement>(null);
  const [progress, setProgress] = React.useState(0);
  const [active, setActive] = React.useState(0);
  const [reducedMotion, setReducedMotion] = React.useState(false);
  // SSR defaults desktop; the media effect re-syncs before any interaction.
  const [isDesktop, setIsDesktop] = React.useState(true);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const width = window.matchMedia('(min-width: 1024px)');
    const sync = () => {
      setReducedMotion(motion.matches);
      setIsDesktop(width.matches);
    };
    sync();
    motion.addEventListener('change', sync);
    width.addEventListener('change', sync);
    return () => {
      motion.removeEventListener('change', sync);
      width.removeEventListener('change', sync);
    };
  }, []);

  // Desktop driver: page scroll through the pinned stage. Gated to desktop so
  // it never fights the mobile swipe observer below (one driver per mode).
  React.useEffect(() => {
    if (reducedMotion || !isDesktop || typeof window === 'undefined') return;
    let frame = 0;

    const update = () => {
      frame = 0;
      const root = rootRef.current;
      if (!root) return;
      const top = root.getBoundingClientRect().top + window.scrollY;
      const distance = Math.max(1, root.offsetHeight - window.innerHeight);
      const nextProgress = clamp((window.scrollY - top) / distance) * (STEPS.length - 1);
      setProgress(nextProgress);
      setActive(Math.min(STEPS.length - 1, Math.max(0, Math.round(nextProgress))));
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [reducedMotion, isDesktop]);

  // Mobile driver: the cards scroll HORIZONTALLY (scroll-snap), so page scroll
  // says nothing about which card the user swiped to. Observe the cards inside
  // the track (the carousel's pattern) and mirror the most-visible one into the
  // active step, so manual swipes update the progress rail too.
  React.useEffect(() => {
    if (reducedMotion || isDesktop || typeof window === 'undefined') return;
    const root = rootRef.current;
    const track = root?.querySelector('.story-cards');
    if (!root || !track || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const mostVisible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!mostVisible) return;
        const index = Number((mostVisible.target as HTMLElement).dataset.storyCardIndex);
        if (!Number.isFinite(index)) return;
        // Active ONLY — writing progress here would move the cards' transforms,
        // shift the geometry the observer is watching, and feed back (observed:
        // a swipe to card 2 settled on card 1). Off-desktop transforms are
        // neutralized in the render instead.
        setActive(index);
      },
      { root: track, threshold: [0.45, 0.65, 0.85] },
    );
    track.querySelectorAll('[data-story-card-index]').forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [reducedMotion, isDesktop]);

  const selectStep = React.useCallback((index: number) => {
    const root = rootRef.current;
    if (!root || typeof window === 'undefined') return;
    const desktop = window.matchMedia('(min-width: 1024px)').matches && !reducedMotion;

    if (desktop) {
      const top = root.getBoundingClientRect().top + window.scrollY;
      const distance = Math.max(1, root.offsetHeight - window.innerHeight);
      window.scrollTo({
        top: top + (index / (STEPS.length - 1)) * distance,
        behavior: 'smooth',
      });
    } else {
      // Query the DOM directly — the old cardRefs array was never populated
      // (StoryCard takes no ref), so tap-to-jump silently did nothing.
      const cards = root.querySelectorAll<HTMLElement>('[data-story-card-index]');
      cards[index]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      setActive(index);
    }
  }, [reducedMotion]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncHash = () => {
      const hashIndex: Record<string, number> = { '#readiness': 1, '#matcha': 2, '#apply': 3 };
      const next = hashIndex[window.location.hash];
      if (typeof next === 'number') window.requestAnimationFrame(() => selectStep(next));
    };
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, [selectStep]);

  const onRailKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    let next = active;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = Math.min(STEPS.length - 1, active + 1);
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = Math.max(0, active - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = STEPS.length - 1;
    else return;
    event.preventDefault();
    selectStep(next);
  };

  return (
    <section
      ref={rootRef}
      data-home-loop=""
      data-home-sticky-product-story=""
      data-active-step={STEPS[active].id}
      className="sticky-product-story"
      aria-labelledby="product-story-title"
    >
      <span id="readiness" data-section-observe="readiness" className="story-observer story-observer-readiness" />
      <span id="matcha" data-section-observe="matcha" className="story-observer story-observer-matcha" />
      <span id="apply" data-section-observe="apply" className="story-observer story-observer-apply" />

      <div className="story-stage">
        <div className="story-intro">
          <p className="mz-eyebrow">How it moves</p>
          <h2 id="product-story-title" className="mz-h1">
            One identity, carried all the way to <em className="mz-accent">accepted.</em>
          </h2>
          <p className="story-intro-body">
            Scroll the product path. Every step keeps its source state and review boundary attached.
          </p>

          <div
            className="story-progress-rail"
            role="navigation"
            aria-label="VitalCV product story steps"
            onKeyDown={onRailKeyDown}
          >
            {STEPS.map((step, index) => (
              <button
                key={step.id}
                type="button"
                className="story-progress-step"
                data-active={index === active ? 'true' : 'false'}
                aria-current={index === active ? 'step' : undefined}
                onClick={() => selectStep(index)}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                <span>{step.label}</span>
              </button>
            ))}
          </div>
        </div>

        <ol className="story-cards" aria-live="polite">
          {STEPS.map((step, index) => (
            <React.Fragment key={step.id}>
              {/* Off desktop, each card gets its OWN index as progress → offset
                  0 → neutral transforms. The snap track owns mobile layout, and
                  card geometry can never react to the swipe observer (no loop). */}
              <StoryCard
                step={step}
                index={index}
                progress={reducedMotion || !isDesktop ? index : progress}
              />
            </React.Fragment>
          ))}
        </ol>
      </div>

      <p className="story-footnote">
        Product UI is illustrative. Source-backed, checked, gated, and review-required states remain explicit;
        institution review remains the final step.
      </p>
    </section>
  );
}

export default StickyProductStory;
