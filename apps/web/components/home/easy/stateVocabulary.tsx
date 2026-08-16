/**
 * stateVocabulary — the homepage v4 five-state grammar (amendment F).
 *
 * Five states, no others. Each renders as GLYPH + WORD in ink (EC-4): the hue
 * only ever carries the glyph and a left rule, never the meaning. The set maps
 * 1:1 onto states the product actually produces — there is no "adverse" row
 * and no "under dispute" row because the product produces neither (the
 * founder's v4 legend carried one; it was dropped under the standing rule
 * that the homepage never teaches a state word the product cannot produce).
 *
 *   confirmed  ● Source-confirmed — a named source answered
 *   snapshot   ◐ Snapshot — true as of a dated file (monthly / quarterly)
 *   attention  ▲ Needs you — yours to act, with an owner
 *   access     ⊘ Access required — a source we may not read
 *   unchecked  ○ Not checked — the default, stated instead of hidden
 *
 * The glyphs are aria-hidden; the word beside them is the accessible meaning.
 */

export type HomeState = 'confirmed' | 'snapshot' | 'attention' | 'access' | 'unchecked';

export const STATE_GLYPH: Record<HomeState, string> = {
  confirmed: '●',
  snapshot: '◐',
  attention: '▲',
  access: '⊘',
  unchecked: '○',
};

/** Stamp: glyph + word, mono, hue on the glyph only. */
export function StateStamp({
  state,
  children,
  className,
}: {
  state: HomeState;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`ezh-stamp is-${state}${className ? ` ${className}` : ''}`} data-home-state={state}>
      <i className="ezh-stamp-g" aria-hidden="true">
        {STATE_GLYPH[state]}
      </i>
      {children}
    </span>
  );
}
