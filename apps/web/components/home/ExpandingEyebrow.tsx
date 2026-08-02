'use client';

import * as React from 'react';

/**
 * A small piece of editorial chrome for the homepage hero.
 *
 * The label remains complete without JavaScript. Expanding it only adds a
 * concise orientation cue; it never carries an evidence or product claim.
 */
export function ExpandingEyebrow({
  label,
  detail,
}: {
  label: string;
  detail: string;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);
  const detailId = React.useId();

  React.useEffect(() => {
    setHydrated(true);
  }, []);

  return (
    <div
      className="ask-eyebrow ask-eyebrow--expandable"
      data-expanded={expanded ? 'true' : 'false'}
      data-hydrated={hydrated ? 'true' : 'false'}
    >
      <button
        type="button"
        className="ask-eyebrow__trigger"
        aria-expanded={expanded}
        aria-controls={detailId}
        onClick={() => setExpanded((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setExpanded(false);
            event.currentTarget.blur();
          }
        }}
      >
        <span>{label}</span>
        <span className="ask-eyebrow__cue" aria-hidden="true">
          +
        </span>
      </button>
      <span id={detailId} className="ask-eyebrow__detail">
        {detail}
      </span>
    </div>
  );
}
