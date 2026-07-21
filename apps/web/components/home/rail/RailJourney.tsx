'use client';

import * as React from 'react';

import { JOURNEY_CHAPTER_IDS, JOURNEY_CHAPTERS } from '@/components/home/journey';
import { useChapterProgressPublisher } from '@/components/home/scene/ChapterProgress';
import { railChapterProgress } from '@/components/home/scene/progress';
import { HorizontalStoryRail } from './HorizontalStoryRail';
import { JourneyCard } from './JourneyCard';

/**
 * RailJourney (W2.1) — the live homepage's career-journey section: the four
 * shared chapters mounted through HorizontalStoryRail, with the rail's
 * continuous progress bridged into the ChapterProgress driver so the ambient
 * scene follows the SAME single model through the pin (one motion driver per
 * story — audit master rule 3).
 *
 * On unpin (resize below threshold, reduced-motion flip) the bridge hands the
 * model back to the scroll-derived driver by publishing null.
 */
export function RailJourney() {
  const publish = useChapterProgressPublisher();

  const onProgress = React.useCallback(
    (progress01: number) => {
      publish(railChapterProgress(JOURNEY_CHAPTER_IDS, progress01));
    },
    [publish],
  );

  const onPinnedChange = React.useCallback(
    (pinned: boolean) => {
      if (!pinned) publish(null);
    },
    [publish],
  );

  const chapters = React.useMemo(
    () =>
      JOURNEY_CHAPTERS.map((chapter) => ({
        id: chapter.id,
        label: chapter.label,
        node: <JourneyCard chapter={chapter} />,
      })),
    [],
  );

  return (
    <section aria-labelledby="journey-rail-title" data-home-journey="" className="mz pt-14">
      <div className="mx-auto w-full max-w-[1320px]">
        <p className="mz-eyebrow"><span className="mz-eyebrow-index" aria-hidden="true">03</span>How you get hired faster</p>
        <h2 id="journey-rail-title" className="mz-h1 mt-3 max-w-[18ch]">
          One record, carried from ready to started.
        </h2>
        {/* The category statement lives HERE — below the fold, in the story,
            exactly once (role-doors contract carried over from the retired
            vertical product story). */}
        <p className="mz-body mt-3 max-w-2xl text-[var(--vt-text-secondary)]">
          The clinician career evidence network: see what employers can confirm, fix what is
          missing, and reuse your proof for every move.
        </p>
      </div>
      <HorizontalStoryRail
        chapters={chapters}
        skipTargetId="employers"
        onProgress={onProgress}
        onPinnedChange={onPinnedChange}
      />
      <p className="mx-auto mt-3 w-full max-w-[1320px] text-[12px] leading-relaxed text-[var(--vt-text-muted)]">
        Illustrative UI — states stay explicit; institution review remains the final step.
      </p>
    </section>
  );
}

export default RailJourney;
