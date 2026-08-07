import {
  EMPLOYER_AUDIENCE_BOUNDARY,
  EMPLOYER_ORG_SIZES,
  EMPLOYER_TEAMS,
} from './employerAudience';

/**
 * EmployerAudienceSection (MB1) — names the teams who actually read this page and
 * routes by organization size, closing white-space positions W10 and W11 from the
 * competitive study. See `employerAudience.ts` for the evidence behind the copy.
 *
 * REVISION 2 (founder visual gate, 2026-08-07): recomposed from six bordered
 * cards in two grids — each with its own heading and lede — to two hairline row
 * lists under a single heading. Same distinctions, same routing, same boundary,
 * materially less vertical and cognitive weight on a landing page whose job is
 * the doorway. The Reveal wrapper went with the cards: rows on a landing page
 * do not need entrance motion to be read in order.
 *
 * Calm Wave, employer persona: paper/ink, hairline rules, editorial accent used
 * once, mono for job titles and situations (facts about the reader, not prose).
 * Renders fully without JS and carries no metric, no logo, and no outcome claim.
 */
export function EmployerAudienceSection() {
  return (
    <section aria-label="Who this is for" data-employer-audience="" className="mt-12">
      <p className="mz-eyebrow">Who this is for</p>
      <h2 className="mz-h2" style={{ marginTop: 8, maxWidth: 620 }}>
        Three teams, one record — and a way in at <span className="mz-accent">every size</span>.
      </h2>
      <p className="mz-small" style={{ marginTop: 8, marginBottom: 16, maxWidth: 620 }}>
        Credentialing, recruitment, and HR each need a different thing from the same evidence.
        Nobody re-keys it for the next team.
      </p>

      <ul className="list-none border-t border-[var(--vt-border)]">
        {EMPLOYER_TEAMS.map((team) => (
          <li
            key={team.team}
            className="flex flex-col gap-1 border-b border-[var(--vt-border)] py-3 lg:flex-row lg:items-baseline lg:gap-6"
          >
            <h3 className="shrink-0 text-sm font-semibold leading-snug text-[var(--vt-text-primary)] lg:w-60">
              {team.team}
            </h3>
            <div className="min-w-0">
              <p className="text-[13px] leading-relaxed text-[var(--vt-text-secondary)]">
                {team.body}
              </p>
              <p
                data-employer-team-roles=""
                className="mz-mono mt-1 text-[11px] leading-relaxed text-[var(--vt-text-muted)]"
              >
                {team.roles.join(' · ')}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <ul className="mt-6 list-none border-t border-[var(--vt-border)]">
        {EMPLOYER_ORG_SIZES.map((size) => (
          <li
            key={size.band}
            className="flex flex-col gap-1 border-b border-[var(--vt-border)] py-3 lg:flex-row lg:items-baseline lg:gap-6"
          >
            <h3 className="shrink-0 text-sm font-semibold leading-snug text-[var(--vt-text-primary)] lg:w-60">
              {size.band}
            </h3>
            <div className="min-w-0 flex-1">
              <p className="mz-mono text-[11px] leading-relaxed text-[var(--vt-text-muted)]">
                {size.situation}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--vt-text-secondary)]">
                {size.body}
              </p>
            </div>
            <p className="shrink-0 lg:text-right">
              <a
                href={size.action.href}
                className="text-[13px] font-semibold text-[var(--vt-text-primary)] underline underline-offset-2"
              >
                {size.action.label}
              </a>
            </p>
          </li>
        ))}
      </ul>

      <p
        data-employer-audience-boundary=""
        className="mz-mono mt-5 max-w-[620px] border-l-2 border-[var(--vt-border)] pl-3 text-[12px] leading-relaxed text-[var(--vt-text-muted)]"
      >
        {EMPLOYER_AUDIENCE_BOUNDARY}
      </p>
    </section>
  );
}

export default EmployerAudienceSection;
