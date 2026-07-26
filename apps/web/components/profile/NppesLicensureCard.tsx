import * as React from 'react';

/**
 * NppesLicensureCard — lists the state license number(s) on file with NPPES.
 *
 * Honesty contract (mirrors public NPI directories, but labels what they
 * don't): NPPES stores the license number a provider self-reported at
 * enumeration. It is identity-grade only — NPPES does not check it against
 * the state board, so this card NEVER renders a license status. Status
 * (active / expired / disciplined) is owned by the Verification section,
 * which only shows it when a state-board source is fresh and decision-grade.
 * A stale self-reported number must never read as "active."
 *
 * Also surfaces the clinician's optional self-reported Doximity link.
 */

export interface NppesLicensureRecord {
  state: string | null;
  licenseNumber: string;
}

export interface NppesLicensureCardProps {
  licenses: readonly NppesLicensureRecord[];
  doximityUrl?: string | null;
  className?: string;
}

function licenseLabel(record: NppesLicensureRecord): string {
  return record.state ? `${record.licenseNumber} · ${record.state}` : record.licenseNumber;
}

export function NppesLicensureCard({
  licenses,
  doximityUrl,
  className,
}: NppesLicensureCardProps): React.ReactElement | null {
  const hasLicenses = licenses.length > 0;
  const hasDoximity = Boolean(doximityUrl);

  // Nothing self-reported to show — render nothing rather than an empty card.
  if (!hasLicenses && !hasDoximity) return null;

  const base = 'rounded-xl border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface,_white)] p-4 sm:p-5';
  const rootClass = className ? `${base} ${className}` : base;

  return (
    <section
      className={rootClass}
      aria-labelledby="nppes-licensure-heading"
      data-testid="nppes-licensure-card"
    >
      {hasLicenses && (
        <>
          <h2 id="nppes-licensure-heading" className="text-base font-semibold sm:text-lg">
            State licensure on file
          </h2>
          <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
            Self-reported to NPPES · not board-verified
          </p>
          <ul className="mt-3 space-y-2">
            {licenses.map((record) => (
              <li
                key={`${record.state ?? ''}:${record.licenseNumber}`}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-[var(--vt-border,_rgba(0,0,0,0.06))] px-3 py-2"
              >
                <span className="font-mono text-sm">{licenseLabel(record)}</span>
                <span className="text-[11px] text-muted-foreground">On file with NPPES</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            This is the license number the provider recorded with NPPES. Current
            license status appears in your Verification section only when a state
            board source confirms it.
          </p>
        </>
      )}

      {hasDoximity && (
        <div className={hasLicenses ? 'mt-4 border-t border-[var(--vt-border,_rgba(0,0,0,0.06))] pt-4' : ''}>
          <h3 className="text-sm font-semibold">Doximity profile</h3>
          <p className="mt-1">
            <a
              href={doximityUrl as string}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-sm underline underline-offset-2 break-all"
              data-testid="doximity-link"
            >
              {doximityUrl}
            </a>
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Self-reported link · not a verification.
          </p>
        </div>
      )}
    </section>
  );
}

export default NppesLicensureCard;
