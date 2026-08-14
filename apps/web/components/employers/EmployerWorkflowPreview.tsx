'use client';

import * as React from 'react';

import { Icon, type IconName } from '@/components/Icon';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { EMPLOYER_STAGES, type EmployerStage } from './employerWorkflow';

const STAGE_ICON = {
  'request-access': 'building',
  'define-requirements': 'list-checks',
  'receive-packet': 'files',
  'review-coverage': 'search',
  'accept-head-start': 'file-input',
  'reach-start-ready': 'waypoints',
} as const satisfies Record<string, IconName>;

const STAGE_FACTS: Record<EmployerStage['id'], readonly [string, string, string]> = {
  'request-access': ['Organization identity', 'Authority request', 'Separate approval'],
  'define-requirements': ['Role requirements', 'Visible checklist', 'No hidden bar'],
  'receive-packet': ['Submitted version', 'Clinician choice', 'Consent receipt'],
  'review-coverage': ['Named source', 'Observed time', 'Open question'],
  'accept-head-start': ['Exact packet', 'Decision scope', 'Review remains'],
  'reach-start-ready': ['Credentialing start', 'Intended start', 'Actual start'],
};

function StageDiagram({ stage }: { stage: EmployerStage }) {
  const icon = STAGE_ICON[stage.id as keyof typeof STAGE_ICON] ?? 'message-question';
  const facts = STAGE_FACTS[stage.id] ?? ['Known', 'Open', 'Next action'];

  return (
    <div
      aria-hidden="true"
      className="relative min-h-60 overflow-hidden border border-[var(--vt-border)] bg-[var(--vt-surface-subtle)] p-5 sm:min-h-72 sm:p-7"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-[var(--vt-accent-editorial)]" />
      <div className="flex items-center justify-between">
        <span className="inline-flex size-12 items-center justify-center border border-[var(--vt-border)] bg-[var(--vt-surface)] text-[var(--vt-accent-editorial)]">
          <Icon name={icon} className="size-5" strokeWidth={1.5} />
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--vt-text-muted)]">
          Human review
        </span>
      </div>

      <div className="mt-7 grid gap-2.5">
        {facts.map((fact, index) => (
          <div
            key={fact}
            className={cn(
              'flex min-h-11 items-center gap-3 border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3',
              index === 2 && 'ml-6',
            )}
          >
            <span className="size-2 border border-[var(--vt-text-muted)]" />
            <span className="text-xs font-medium text-[var(--vt-text-secondary)]">{fact}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-2 text-[var(--vt-text-muted)]">
        <span className="h-px flex-1 bg-[var(--vt-border)]" />
        <Icon name="arrow-right" className="size-4" strokeWidth={1.25} />
        <span className="h-px w-8 bg-[var(--vt-border)]" />
      </div>
    </div>
  );
}

/**
 * One tactile, native-overflow review rail. Every moment is server-visible and
 * reachable without JavaScript; hydration adds supplementary arrow controls
 * and active narration, not a second content path.
 */
export function EmployerWorkflowPreview() {
  const railRef = React.useRef<HTMLOListElement | null>(null);
  const targetIndexRef = React.useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = React.useState(0);

  const moveTo = React.useCallback((index: number) => {
    const rail = railRef.current;
    if (!rail) return;
    const next = Math.max(0, Math.min(EMPLOYER_STAGES.length - 1, index));
    const item = rail.children.item(next) as HTMLElement | null;
    if (!item) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    targetIndexRef.current = next;
    rail.scrollTo({ left: item.offsetLeft - rail.offsetLeft, behavior: reduce ? 'auto' : 'smooth' });
    setActiveIndex(next);
  }, []);

  React.useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const update = () => {
      const children = Array.from(rail.children) as HTMLElement[];
      const nearest = children.reduce(
        (best, item, index) => {
          const distance = Math.abs(item.offsetLeft - rail.scrollLeft - rail.offsetLeft);
          return distance < best.distance ? { index, distance } : best;
        },
        { index: 0, distance: Number.POSITIVE_INFINITY },
      );
      const target = targetIndexRef.current;
      if (target !== null && nearest.index !== target) return;
      targetIndexRef.current = null;
      setActiveIndex(nearest.index);
    };
    rail.addEventListener('scroll', update, { passive: true });
    return () => rail.removeEventListener('scroll', update);
  }, []);

  return (
    <section
      id="employer-review-journey"
      aria-label="How the employer workflow works"
      data-employer-workflow=""
      className="mt-16 border-y border-[var(--vt-border)] py-10 sm:mt-20 sm:py-14"
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mz-eyebrow">The review journey</p>
          <h2 className="mz-h2 mt-2 max-w-3xl">
            One exact packet. Six visible moments. <span className="mz-accent">No hidden handoff.</span>
          </h2>
          <p className="mz-small mt-3 max-w-2xl">
            Move source-backed evidence from governed organization access to human review without turning an open item into certainty or a head start into credentialing.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <p aria-live="polite" className="mr-2 max-w-48 text-right text-xs text-[var(--vt-text-muted)]">
            {EMPLOYER_STAGES[activeIndex]?.title} in view
          </p>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-12 rounded-none shadow-none duration-150"
            onClick={() => moveTo(activeIndex - 1)}
            disabled={activeIndex === 0}
            aria-label="Previous review moment"
          >
            <Icon name="arrow-left" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-12 rounded-none shadow-none duration-150"
            onClick={() => moveTo(activeIndex + 1)}
            disabled={activeIndex === EMPLOYER_STAGES.length - 1}
            aria-label="Next review moment"
          >
            <Icon name="arrow-right" />
          </Button>
        </div>
      </div>

      <ol
        ref={railRef}
        tabIndex={0}
        aria-label="Employer review moments"
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') {
            event.preventDefault();
            moveTo(activeIndex + 1);
          }
          if (event.key === 'ArrowLeft') {
            event.preventDefault();
            moveTo(activeIndex - 1);
          }
        }}
        className="mt-8 flex list-none snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-5 pr-[12vw] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--vt-focus-ring)] motion-reduce:scroll-auto sm:gap-6 sm:pr-[20vw]"
      >
        {EMPLOYER_STAGES.map((stage, index) => (
          <li
            id={`employer-stage-${stage.id}`}
            key={stage.id}
            data-employer-stage={stage.id}
            data-active={activeIndex === index ? '' : undefined}
            className="grid min-w-[84vw] snap-start gap-6 border border-[var(--vt-border)] bg-[var(--vt-surface)] p-5 sm:min-w-[38rem] sm:grid-cols-[minmax(15rem,0.9fr)_minmax(16rem,1.1fr)] sm:p-7 lg:min-w-[46rem]"
          >
            <StageDiagram stage={stage} />
            <div className="flex flex-col justify-center">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--vt-text-muted)]">
                Review moment
              </p>
              <h3 className="mt-3 text-2xl font-semibold leading-tight text-[var(--vt-text-primary)] sm:text-3xl">
                {stage.title}
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-[var(--vt-text-secondary)]">
                {stage.body}
              </p>
              {stage.boundary ? (
                <p
                  data-stage-boundary=""
                  className="mt-6 border-l-2 border-[var(--vt-accent-editorial)] pl-3 font-mono text-[11px] leading-relaxed text-[var(--vt-text-muted)]"
                >
                  {stage.boundary}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-1 text-xs leading-relaxed text-[var(--vt-text-muted)]">
        Drag, swipe, use the arrow keys, or use the controls. Every moment remains readable without motion or JavaScript.
      </p>
    </section>
  );
}

export default EmployerWorkflowPreview;
