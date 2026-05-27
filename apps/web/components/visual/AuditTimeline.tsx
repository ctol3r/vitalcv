import * as React from 'react';

export type AuditEvent = {
  /** Date / time tag (e.g. "May 26" or "09:14"). */
  date: React.ReactNode;
  /** Event label (e.g. "NPPES re-read"). */
  label: React.ReactNode;
  /** One-line detail (e.g. "address changed → Parnassus"). */
  detail?: React.ReactNode;
  /** Mark this row as the "now" point — accent dot. */
  now?: boolean;
};

/**
 * Real timeline — dots + connecting line + now-marker.
 *
 * chat22 fix #11: the prototype had this rendered as a text list. This
 * component is the actual timeline (border-left as the line, ::before
 * pseudo-elements as the dots, `.now` variant for the current event).
 *
 * chat22 fix #4: the date / label / detail rows stack vertically with
 * an explicit 4px gap; they cannot collapse onto each other regardless
 * of label length.
 */
export function AuditTimeline({ events }: { events: AuditEvent[] }) {
  return (
    <ol className="vs-timeline" aria-label="Source timeline">
      {events.map((event, index) => (
        <li key={index} className={`vs-tl${event.now ? ' now' : ''}`}>
          <span className="vs-k">{event.date}</span>
          <span className="vs-v">{event.label}</span>
          {event.detail ? <span className="vs-t">{event.detail}</span> : null}
        </li>
      ))}
    </ol>
  );
}
