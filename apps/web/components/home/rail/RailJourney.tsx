import { JOURNEY_CHAPTERS } from '@/components/home/journey';
import { JourneyCard } from './JourneyCard';

/**
 * Career journey — the visible product story in ordinary document flow.
 *
 * The four chapters are deliberately a static grid, not a pinned rail or
 * carousel: each step is visible, linkable, and reachable by normal scrolling
 * at every viewport and motion preference.
 */
export function RailJourney() {
  return (
    <section aria-labelledby="journey-title" data-home-journey="" className="mz pt-14">
      <div className="mx-auto w-full max-w-[1320px]">
        <p className="mz-eyebrow">How you get hired on evidence</p>
        <h2 id="journey-title" className="mz-h1 mt-3 max-w-[18ch]">
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
      <div className="mx-auto mt-8 grid w-full max-w-[1320px] gap-4 lg:grid-cols-2" data-home-journey-grid="">
        {JOURNEY_CHAPTERS.map((chapter) => (
          <section id={chapter.id} key={chapter.id} className="scroll-mt-24">
            <JourneyCard chapter={chapter} />
          </section>
        ))}
      </div>
      <p className="mx-auto mt-3 w-full max-w-[1320px] text-[12px] leading-relaxed text-[var(--vt-text-muted)]">
        Illustrative UI — states stay explicit; institution review remains the final step.
      </p>
    </section>
  );
}

export default RailJourney;
