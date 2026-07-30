import { Reveal } from '@/components/motion/Reveal';
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
 * Calm Wave, employer persona: paper/ink, 3px document radius, hairline rules,
 * editorial indigo accent, mono for job titles (they are facts about the reader, not
 * prose), single-shot Reveal. Renders fully without JS and carries no metric,
 * no logo, and no outcome claim.
 */
export function EmployerAudienceSection() {
  return (
    <section aria-label="Who this is for" data-employer-audience="" className="mt-12">
      <p className="mz-eyebrow">Who this is for</p>
      <h2 className="mz-h2" style={{ marginTop: 8, maxWidth: 620 }}>
        Three teams read this record. It is built for <span className="mz-accent">all three</span>.
      </h2>
      <p className="mz-small" style={{ marginTop: 8, marginBottom: 20, maxWidth: 620 }}>
        Credentialing, recruitment, and HR each need a different thing from the same evidence.
        Nobody has to re-key it for the next team.
      </p>

      <ul className="grid list-none grid-cols-1 gap-3 lg:grid-cols-3">
        {EMPLOYER_TEAMS.map((team, i) => (
          <Reveal
            key={team.team}
            as="li"
            delay={i * 70}
            className="flex flex-col rounded-[3px] border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4"
          >
            <h3 className="text-sm font-semibold leading-snug text-[var(--vt-text-primary)]">
              {team.team}
            </h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--vt-text-secondary)]">
              {team.body}
            </p>
            <p
              data-employer-team-roles=""
              className="mz-mono mt-3 border-t border-[var(--vt-border)] pt-2.5 text-[11px] leading-relaxed text-[var(--vt-text-muted)]"
            >
              {team.roles.join(' · ')}
            </p>
          </Reveal>
        ))}
      </ul>

      <h3 className="mz-h2" style={{ marginTop: 40, maxWidth: 620 }}>
        Where you start depends on <span className="mz-accent">your size</span>.
      </h3>
      <p className="mz-small" style={{ marginTop: 8, marginBottom: 20, maxWidth: 620 }}>
        A four-provider clinic and a health system are not doing the same job. The record is the
        same; the way in is not.
      </p>

      <ul className="grid list-none grid-cols-1 gap-3 lg:grid-cols-3">
        {EMPLOYER_ORG_SIZES.map((size, i) => (
          <Reveal
            key={size.band}
            as="li"
            delay={i * 70}
            className="flex flex-col rounded-[3px] border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4"
          >
            <h4 className="text-sm font-semibold leading-snug text-[var(--vt-text-primary)]">
              {size.band}
            </h4>
            <p
              className="mz-mono mt-2 border-l-2 border-[var(--vt-accent-editorial)] pl-2.5 text-[11px] leading-relaxed text-[var(--vt-text-muted)]"
            >
              {size.situation}
            </p>
            <p className="mt-2.5 flex-1 text-[13px] leading-relaxed text-[var(--vt-text-secondary)]">
              {size.body}
            </p>
            <p className="mt-3">
              <a
                href={size.action.href}
                className="text-[13px] font-semibold text-[var(--vt-text-primary)] underline underline-offset-2"
              >
                {size.action.label}
              </a>
            </p>
          </Reveal>
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
