'use client';

/**
 * StoryRailHarness (dev) — exercises HorizontalStoryRail with the real VitalCV
 * chapters so the pin, native-scroll → translateX driver, keyboard path,
 * skip-story control, deep links, and the vertical fallback can be verified in
 * a real browser and by Playwright, without the homepage's surrounding page.
 *
 * Chapters come from `components/home/journey` — the SAME model `RailJourney`
 * mounts on the homepage. This harness previously hardcoded its own six-chapter
 * list including `evidence` and `recognition`, neither of which exists in the
 * shipped four-chapter journey, so the harness was exercising a rail shape the
 * product no longer has. Importing the shared source is what stops that drift
 * recurring; the bodies stay lightweight placeholders on purpose (the rail
 * SHELL is what this harness tests, not the JourneyCard content).
 */

import * as React from 'react';

import { JOURNEY_CHAPTERS } from '@/components/home/journey';
import { HorizontalStoryRail, type RailChapter } from '@/components/home/rail/HorizontalStoryRail';
import { SceneProvider } from '@/components/home/scene/SceneProvider';

const CHAPTERS = JOURNEY_CHAPTERS.map((chapter) => ({
  id: chapter.id,
  label: chapter.label,
  blurb: chapter.body,
  accent: 'var(--vt-accent-emerald)',
}));

function ChapterBody({ index, label, blurb, accent }: { index: number; label: string; blurb: string; accent: string }) {
  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col justify-center px-8">
      <p className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: accent }}>
        {String(index + 1).padStart(2, '0')} / {String(CHAPTERS.length).padStart(2, '0')}
      </p>
      <h2 className="text-[clamp(2rem,5vw,3.6rem)] font-light leading-[1.05] text-[var(--vt-text-primary)]">
        {label}
      </h2>
      <p className="mt-4 max-w-xl text-[18px] leading-[1.5] text-[var(--vt-text-secondary)]">{blurb}</p>
      <div className="mt-6">
        {/* A real focusable control per chapter to prove keyboard focus pulls
            an off-screen chapter into the pin. */}
        <button
          type="button"
          data-chapter-cta={CHAPTERS[index].id}
          className="rounded-full border border-[var(--vt-border)] px-4 py-2 text-[13px] font-semibold text-[var(--vt-text-primary)]"
        >
          Chapter {index + 1} action
        </button>
      </div>
    </div>
  );
}

export function StoryRailHarness() {
  const [active, setActive] = React.useState(0);
  const chapters: RailChapter[] = CHAPTERS.map((c, i) => ({
    id: c.id,
    label: c.label,
    node: <ChapterBody index={i} label={c.label} blurb={c.blurb} accent={c.accent} />,
  }));

  return (
    <SceneProvider>
      <div className="mz mz-paper min-h-screen bg-[var(--vt-bg)] text-[var(--vt-text-primary)]">
        {/* A fixed progress read-out so tests can assert the active chapter. */}
        <div className="fixed right-4 top-4 z-[70] rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-1 text-[12px] font-medium" data-rail-active-index={active}>
          {active + 1} / {CHAPTERS.length} · {CHAPTERS[active].label}
        </div>

        <HorizontalStoryRail
          chapters={chapters}
          onActiveChange={setActive}
          skipTargetId="rail-end"
        />

        {/* Footer / legal live OUTSIDE the rail in normal vertical flow. */}
        <footer id="rail-end" className="border-t border-[var(--vt-border-subtle)] px-8 py-16">
          <p className="text-[13px] text-[var(--vt-text-secondary)]">
            Trust footer / legal — always vertical, always reachable past the rail.
          </p>
        </footer>
      </div>
    </SceneProvider>
  );
}

export default StoryRailHarness;
