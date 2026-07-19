'use client';

import * as React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Circle,
  Lock,
} from 'lucide-react';
import {
  motion,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';

import { Card } from '@/components/ui/card';
import { ScrollScrubHeading } from '@/components/motion/ScrollScrubHeading';
import { StoryIcon, type StoryIconName } from '@/components/home/StoryIcon';
import { ROLODEX_OPACITY_OFFSETS, ROLODEX_OPACITY_VALUES } from '@/lib/home/rolodex';

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
  icon: StoryIconName;
}

const STEPS: readonly StoryStep[] = [
  {
    id: 'recognize',
    label: 'Recognize',
    eyebrow: '01 · Identity',
    title: 'Start with one NPI.',
    body: 'One NPI resolves your identity and starts the source checks. Nothing to rebuild.',
    action: 'Open readiness snapshot',
    icon: 'identity',
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
    body: 'Every item names its source, its state, and the next action.',
    action: 'Resolve the next gap',
    icon: 'readiness',
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
    body: 'MATCHA matches evidence to role requirements — reasoning visible.',
    action: 'See why it matched',
    icon: 'match',
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
    body: 'Share one attributed packet. Keep the consent receipt.',
    action: 'Share proof packet',
    icon: 'apply',
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
    body: 'VitalCV Recognition records the acceptance. Institution review remains.',
    action: 'View Recognition',
    icon: 'recognition',
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

const STORY_TRANSITION_SECONDS = 1.05;

function StoryCard({ step, index, progress }: { step: StoryStep; index: number; progress: MotionValue<number> }) {
  const offset = useTransform(progress, (latest) => index - latest);
  // ROTARY FILE (SHD-3.2). Cards flip around a horizontal spindle below the
  // stack (transform-origin 50% 116% in CSS), so rotation reads as a wheel turn.
  // Unlike the earlier curve — which faded neighbours to a whisper and hid the
  // card-file mechanic — at least TWO leaves each side now stay visibly fanned
  // with real depth: completed leaves fan UP + back (recede), upcoming leaves
  // fan DOWN + slightly forward (anticipation), and the active card is centred,
  // front-most, and fully legible. Depth is translateZ + scale, not opacity.
  // Derived MotionValues, so scroll never re-renders.
  const rotateX = useTransform(offset, [-2.4, -2, -1, 0, 1, 2, 2.4], [90, 76, 48, 0, -48, -76, -90]);
  const y = useTransform(offset, [-2.4, -1, 0, 1, 2.4], [-86, -34, 0, 36, 90]);
  const z = useTransform(offset, [-2.4, -1, 0, 1, 2.4], [-172, -48, 46, -6, -104]);
  const scale = useTransform(offset, [-2.4, -1, 0, 1, 2.4], [0.8, 0.92, 1, 0.93, 0.83]);
  // Two leaves each side stay readable; cull only beyond the fan. Curve lives in
  // lib/home/rolodex.ts so the "≥2 visible leaves" contract is unit-locked.
  const opacity = useTransform(offset, ROLODEX_OPACITY_OFFSETS, ROLODEX_OPACITY_VALUES);
  const zIndex = useTransform(offset, (latest) => Math.round(60 - Math.abs(latest) * 8));

  return (
    <motion.li
      data-story-card={step.id}
      data-story-card-index={index}
      data-section-observe={step.id === 'match' ? 'matcha' : step.id === 'apply' ? 'apply' : undefined}
      className="story-card"
      style={{ rotateX, y, z, scale, opacity, zIndex }}
    >
      <Card className="story-card-shell">
        <div className="story-card-copy">
          <span className="story-card-icon" aria-hidden="true">
            <StoryIcon name={step.icon} size={40} />
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
    </motion.li>
  );
}

export function StickyProductStory() {
  const rootRef = React.useRef<HTMLElement>(null);
  const [active, setActive] = React.useState(0);
  const [reducedMotion, setReducedMotion] = React.useState(false);
  // SSR defaults desktop; the media effect re-syncs before any interaction.
  const [isDesktop, setIsDesktop] = React.useState(true);
  const { scrollYProgress } = useScroll({
    target: rootRef,
    offset: ['start start', 'end end'],
  });
  const rawProgress = useTransform(scrollYProgress, [0, 1], [0, STEPS.length - 1]);
  const settledProgress = useSpring(rawProgress, {
    bounce: 0,
    duration: STORY_TRANSITION_SECONDS,
  });

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

  // The MotionValue updates every animation frame, but React state changes only
  // when the rounded step boundary changes (at most four times per traversal).
  useMotionValueEvent(settledProgress, 'change', (latest) => {
    if (reducedMotion || !isDesktop) return;
    const next = Math.min(STEPS.length - 1, Math.max(0, Math.round(latest)));
    setActive((current) => (current === next ? current : next));
  });

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
      data-pin-container=""
      data-active-step={STEPS[active].id}
      data-story-motion="motion-values"
      data-story-effect="rolodex"
      data-story-transition-ms={Math.round(STORY_TRANSITION_SECONDS * 1000)}
      className="sticky-product-story"
      aria-labelledby="product-story-title"
    >
      <span id="readiness" data-section-observe="readiness" className="story-observer story-observer-readiness" />
      <span id="matcha" data-section-observe="matcha" className="story-observer story-observer-matcha" />
      <span id="apply" data-section-observe="apply" className="story-observer story-observer-apply" />

      <div className="story-stage">
        <div className="story-intro">
          <p className="mz-eyebrow">How it moves</p>
          <ScrollScrubHeading
            id="product-story-title"
            as="h2"
            className="mz-h1"
            text="One identity, carried all the way to accepted."
            accentWords={['accepted.']}
            startOffset="90%"
            endOffset="45%"
          />
          <p className="story-intro-body">
            Scroll the path. Every step keeps its source state.
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
            <StoryCard key={step.id} step={step} index={index} progress={settledProgress} />
          ))}
        </ol>
      </div>

      <p className="story-footnote">
        Illustrative UI — states stay explicit; institution review remains the final step.
      </p>
    </section>
  );
}

export default StickyProductStory;
