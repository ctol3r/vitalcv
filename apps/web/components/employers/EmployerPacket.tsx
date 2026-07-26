/**
 * EmployerPacket (COMPETE-5) — the object an employer actually receives.
 *
 * The employer page used to open with a form. A form is a cost, not a reason:
 * it asks the buyer to do work before showing them anything worth doing it for.
 * This is the artifact that answers "what do I get?" in the first screen, and
 * it is the demand-side mirror of the clinician's record on `/`.
 *
 * Deliberately UNFILLED. Rendering a populated packet here would mean inventing
 * a clinician, their licences, and their exclusion results — the exact
 * fabrication the truth contract forbids, and the thing that makes a competitor
 * demo worthless the moment a buyer tests it. An empty packet with real
 * structure is both honest and more informative: it shows the shape of the
 * evidence, the states it can carry, and the boundary that never moves.
 */

const REQUESTED_LANES: readonly { name: string; source: string }[] = [
  { name: 'Identity', source: 'NPPES · read per request' },
  { name: 'Exclusions', source: 'OIG LEIE · monthly snapshot' },
  { name: 'State licence', source: 'State medical board · access required' },
  { name: 'Enrolment', source: 'CMS PECOS · quarterly snapshot' },
  { name: 'Employment history', source: 'The Work Number · access required' },
  // Named generically on purpose. The specific certifying-board vendors are on
  // the buyer-banned list because VitalCV does not read them — naming one to a
  // buyer implies coverage that does not exist. "Access required" is the true
  // state, and it is the honest thing to show.
  { name: 'Board certification', source: 'Specialty board · access required' },
];

export function EmployerPacket() {
  return (
    <aside
      data-employer-packet=""
      className="w-full rounded-[3px] border-t-2 border-[var(--vt-text-primary)] bg-[var(--vt-surface)] shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
      aria-label="What a consented packet contains"
    >
      <div className="border-b border-[var(--vt-border)] px-4 py-3 sm:px-5">
        <p className="mz-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--vt-text-muted)]">
          What arrives when a clinician shares
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--vt-text-secondary)]">
          The requirements you already ask for, each naming its own source. Nothing is filled in
          until a clinician shares a packet with you.
        </p>
      </div>

      <ul className="list-none">
        {REQUESTED_LANES.map((lane) => (
          <li
            key={lane.name}
            className="flex items-center justify-between gap-4 border-b border-[var(--vt-border-subtle)] px-4 py-2.5 sm:px-5"
          >
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold leading-tight text-[var(--vt-text-primary)]">
                {lane.name}
              </span>
              <span className="mz-mono mt-0.5 block truncate text-[11px] leading-tight text-[var(--vt-text-muted)]">
                {lane.source}
              </span>
            </span>
            <span className="mz-mono shrink-0 rounded-[2px] border border-[var(--vt-border)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--vt-text-muted)]">
              Awaiting share
            </span>
          </li>
        ))}
      </ul>

      {/* The boundary is part of the artifact, not a footnote under it. An
          employer who mistakes assembled evidence for a clearance decision is
          the single worst failure mode this product has. */}
      <div className="space-y-1.5 px-4 py-3 sm:px-5">
        <p className="text-[12px] leading-relaxed text-[var(--vt-text-secondary)]">
          <span className="font-semibold text-[var(--vt-text-primary)]">What it gives you:</span> a
          head start on requirements that already exist, each one attributable to the source that
          answered it.
        </p>
        <p className="text-[12px] leading-relaxed text-[var(--vt-text-secondary)]">
          <span className="font-semibold text-[var(--vt-text-primary)]">What it does not do:</span>{' '}
          credential, privilege, or clear anyone. Your committee keeps that decision.
        </p>
      </div>
    </aside>
  );
}

export default EmployerPacket;
