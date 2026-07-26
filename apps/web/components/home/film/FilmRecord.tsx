import * as React from 'react';

import { KNOWN_LANES } from '@/components/proof/trust-types';
import { SOURCE_LANE_OPS } from '@/lib/trust/sourceLanes';

/**
 * FilmRecord — the empty record, waiting.
 *
 * The mandate's brief for Arrival is "an empty career core gathers source
 * light", and COMPETE-2 asks every scene for "a large visual event, not a
 * component". The film shipped without one: each scene was a phrase in a narrow
 * left column over an abstract atmosphere, which reads as wordy and empty
 * because there is nothing to look at and nothing that says what you get.
 *
 * This is that visual event, and per CD-14 it is the only image VitalCV
 * publishes: its own artifact. Before a lookup it shows the SHAPE of the record
 * — which sources exist, what each one is, and how fresh a result from it can
 * honestly be — with every lane stamped "Not checked", because for this visitor
 * nothing has been.
 *
 * That is the honest version of a hero visual. It fabricates no clinician, no
 * value, and no percentage (the e2e guard `renders nothing personal or
 * fabricated before a lookup` pins that), while answering the question the old
 * composition left hanging: what am I actually going to get?
 *
 * Every row is derived from `SOURCE_LANE_OPS` + `KNOWN_LANES`, the same
 * registry that drives /status and /api/status. A lane cannot appear here
 * saying something the platform does not already say about itself, and adding
 * a lane to the registry adds it here.
 */

/** The cadence words the registry already publishes, as the reader sees them. */
const CADENCE_WORD: Record<string, string> = {
  per_request: 'read per request',
  monthly_snapshot: 'monthly snapshot',
  quarterly_snapshot: 'quarterly snapshot',
  not_read: 'access required',
};

interface RecordLane {
  id: string;
  name: string;
  source: string;
  cadence: string;
  /** A lane VitalCV cannot read at all is stamped differently from one it can. */
  reachable: boolean;
}

function buildLanes(): RecordLane[] {
  return SOURCE_LANE_OPS.map((ops) => {
    const def = KNOWN_LANES.find((lane) => lane.laneId === ops.laneId);
    return {
      id: ops.laneId,
      name: def?.displayName ?? ops.laneId,
      source: def?.source ?? '',
      cadence: CADENCE_WORD[ops.readCadence] ?? ops.readCadence,
      reachable: ops.readCadence !== 'not_read',
    };
  });
}

export function FilmRecord({ live }: { live: boolean }) {
  const lanes = React.useMemo(buildLanes, []);

  // Framed as a HIRING checklist, not a credentialing inventory. The rows are
  // identical either way — the difference is whether a clinician reads "here are
  // six sources we audit" (someone else's compliance process, which is what a
  // credentialing vendor sells) or "here is what every employer is going to ask
  // you for" (their own hiring queue, which is what this is). The second framing
  // is also the truer one: this list exists because employers ask for it, not
  // because VitalCV audits it.
  return (
    <aside className="film-record" aria-label="What every employer asks for">
      <header className="film-record-head">
        <span className="film-record-kicker">What employers ask for</span>
        <p className="film-record-note">
          The same six every time. Nothing is filled in until you enter an NPI.
        </p>
      </header>

      <ul className="film-record-lanes">
        {lanes.map((lane, i) => (
          <li
            key={lane.id}
            className="film-record-lane"
            /* Source light gathering: a single-shot opacity reveal, staggered
               by row. Opacity-only is CLS-safe and outside WCAG 2.3.3, and the
               stylesheet drops the delay entirely under reduced motion. */
            style={live ? { animationDelay: `${120 + i * 70}ms` } : undefined}
            data-film-record-live={live ? '' : undefined}
          >
            <div className="film-record-lane-id">
              <span className="film-record-lane-name">{lane.name}</span>
              <span className="film-record-lane-src">
                {lane.source}
                {lane.source && lane.cadence ? ' · ' : ''}
                {lane.cadence}
              </span>
            </div>
            <span
              className="film-record-stamp"
              data-reachable={lane.reachable ? '' : undefined}
            >
              <span aria-hidden="true" className="film-record-glyph">
                {lane.reachable ? '○' : '⊘'}
              </span>
              {lane.reachable ? 'Not checked' : 'Access required'}
            </span>
          </li>
        ))}
      </ul>

      <footer className="film-record-foot">
        VitalCV assembles what these sources return. It does not credential,
        privilege, or clear anyone — the institution keeps that decision.
      </footer>
    </aside>
  );
}

export default FilmRecord;
