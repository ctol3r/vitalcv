import * as React from 'react';

/**
 * FilmFit — how a role gets measured against a record.
 *
 * The "better opportunities" scene needs a subject, and the mandate is strict
 * about what it may be: "Before lookup: render only abstract, non-personal
 * choreography. No fake clinician, job, employer, readiness score, or number."
 *
 * So this shows the MECHANISM, not a match. No role is named, no employer is
 * named, no score and no percentage appear (the e2e guard pins the absence of
 * `\d+%`). What it shows is the honest shape of the answer a clinician gets:
 * every requirement resolves to one of three places, and the third one is the
 * boundary VitalCV never crosses.
 *
 * That boundary is the reason this scene is worth a frame at all. Every
 * competitor's matching story ends at "we matched you". VitalCV's ends at "and
 * here is the part we do not decide", which is what makes the first two
 * believable.
 */

interface FitRow {
  requirement: string;
  /** Where the answer comes from. Three, and only three. */
  resolution: 'record' | 'gap' | 'employer';
  detail: string;
}

const FIT_ROWS: readonly FitRow[] = [
  {
    requirement: 'Identity and taxonomy',
    resolution: 'record',
    detail: 'answered from your record',
  },
  {
    requirement: 'Federal exclusion screen',
    resolution: 'record',
    detail: 'answered from your record',
  },
  {
    requirement: 'State licensure',
    resolution: 'gap',
    detail: 'needs source access',
  },
  {
    requirement: 'Role-specific requirements',
    resolution: 'employer',
    detail: 'the employer decides',
  },
];

const RESOLUTION_LABEL: Record<FitRow['resolution'], string> = {
  record: 'From your record',
  gap: 'Still open',
  employer: 'Employer decides',
};

const RESOLUTION_GLYPH: Record<FitRow['resolution'], string> = {
  record: '●',
  gap: '○',
  employer: '⌁',
};

export function FilmFit() {
  return (
    <aside className="film-record" aria-label="How a role is measured against your record">
      <header className="film-record-head">
        <span className="film-record-kicker">Any role</span>
        <p className="film-record-note">
          Every requirement lands in one of three places. No role is shown here
          until you are signed in.
        </p>
      </header>

      <ul className="film-record-lanes">
        {FIT_ROWS.map((row) => (
          <li className="film-record-lane" key={row.requirement}>
            <div className="film-record-lane-id">
              <span className="film-record-lane-name">{row.requirement}</span>
              <span className="film-record-lane-src">{row.detail}</span>
            </div>
            <span
              className="film-record-stamp"
              data-reachable={row.resolution === 'record' ? '' : undefined}
            >
              <span aria-hidden="true" className="film-record-glyph">
                {RESOLUTION_GLYPH[row.resolution]}
              </span>
              {RESOLUTION_LABEL[row.resolution]}
            </span>
          </li>
        ))}
      </ul>

      <footer className="film-record-foot">
        VitalCV shows what your record already answers and what it does not. The
        last line is never ours to answer — the employer keeps that decision.
      </footer>
    </aside>
  );
}

export default FilmFit;
