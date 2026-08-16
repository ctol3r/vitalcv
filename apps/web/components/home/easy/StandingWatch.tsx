import StandingWatchFigure from '@/components/home/easy/figures/StandingWatchFigure';

/**
 * StandingWatch — the clinician-does-nothing thesis (amendment E, composition
 * row), stated to the limit of what the product truthfully does: watch,
 * refresh, flag. Never a credentialing outcome.
 */
export default function StandingWatch() {
  return (
    <section
      className="ezh-watch"
      data-home-standing-watch=""
      data-header-theme="light"
      aria-labelledby="ezh-watch-h"
    >
      <div className="ezh-wrap">
        <div className="ezh-sec-head">
          <span className="ezh-k">While you work</span>
          <h2 id="ezh-watch-h">Most weeks, you do nothing.</h2>
        </div>
        <p className="ezh-sec-sub">
          VitalCV watches renewal dates, refreshes your record from its public sources, and
          stays quiet while nothing changes. When something genuinely needs you &mdash; an
          approval, a signature, an expiring license &mdash; it says so plainly, once. So when
          the right role opens, your record is already today&rsquo;s.
        </p>
        <StandingWatchFigure />
      </div>
    </section>
  );
}
