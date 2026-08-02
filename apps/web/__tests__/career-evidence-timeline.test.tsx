/**
 * CareerEvidenceTimeline — the contracts that matter, not the coordinates.
 *
 * Asserted as OUTCOMES rather than mechanism: nothing here names a viewBox, an
 * x, or a class that only exists today. A better-looking timeline should be
 * free; a dishonest one should be red.
 *
 * The load-bearing one is the illustrative note. `MatchaHub` previously
 * rendered a constellation under the comment "built from your real evidence"
 * while passing it no events at all, so the drawing showed a fixed illustrative
 * sky with three labels swapped. That is not catchable by reading the call
 * site — the comment looked right. It is catchable here.
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  CareerEvidenceTimeline,
  type CareerEvidenceEntry,
} from '@/components/artifacts/CareerEvidenceTimeline';

const render = (el: React.ReactElement) => renderToStaticMarkup(el);

/** Visible text only — strip tags, decode what React escapes on the way out. */
const textOf = (markup: string) =>
  markup
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&rsquo;|&#x27;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

const REAL: CareerEvidenceEntry[] = [
  { id: 'a', label: 'Residency', band: 'began' },
  { id: 'b', label: 'State license', band: 'now' },
  { id: 'c', label: 'Projected: next role', band: 'headed', projected: true },
];

describe('CareerEvidenceTimeline — honesty', () => {
  it('says it is illustrative when given no entries', () => {
    expect(textOf(render(<CareerEvidenceTimeline />))).toContain('Illustrative');
  });

  it('says it is illustrative when given an EMPTY list', () => {
    // The failure mode is a caller that fetches, gets nothing, and passes the
    // empty array through believing it has supplied real data.
    expect(textOf(render(<CareerEvidenceTimeline entries={[]} />))).toContain('Illustrative');
  });

  it('drops the illustrative note only when real entries arrive', () => {
    expect(textOf(render(<CareerEvidenceTimeline entries={REAL} />))).not.toContain('Illustrative');
  });

  it('has no prop that can suppress the note — the API cannot be talked out of it', () => {
    // Belt and braces on the above: a future `illustrative={false}` escape
    // hatch would reopen exactly the hole this component was built to close.
    const loophole = { entries: undefined, illustrative: false, showNote: false } as never;
    expect(textOf(render(<CareerEvidenceTimeline {...(loophole as object)} />))).toContain(
      'Illustrative',
    );
  });
});

describe('CareerEvidenceTimeline — geometry carries the claim (CD-10)', () => {
  it('gives a recorded row a source line and a projected row none', () => {
    const markup = render(<CareerEvidenceTimeline entries={REAL} />);
    // One recorded row in `began`, one in `now`, none in `headed`.
    const recorded = REAL.filter((e) => !e.projected).length;
    const sourceLines = markup.match(/ask-art-rule/g) ?? [];
    expect(sourceLines).toHaveLength(recorded);
  });

  it('draws projected rows open and recorded rows closed', () => {
    const markup = render(<CareerEvidenceTimeline entries={REAL} />);
    expect((markup.match(/ask-art-slot-open/g) ?? []).length).toBe(1);
    // `ask-art-slot-open` contains `ask-art-slot`, so count whole-word matches.
    expect((markup.match(/ask-art-slot(?!-)/g) ?? []).length).toBe(2);
  });

  it('treats anything in the headed band as projected even if the flag is missing', () => {
    // A caller that forgets `projected: true` must not thereby promote a
    // projection into a row that looks recorded.
    const sloppy: CareerEvidenceEntry[] = [{ id: 'x', label: 'Next role', band: 'headed' }];
    const markup = render(<CareerEvidenceTimeline entries={sloppy} />);
    expect(markup).toContain('ask-art-slot-open');
    expect(markup).not.toContain('ask-art-rule');
  });
});

describe('CareerEvidenceTimeline — the retired mechanism stays retired (CD-13)', () => {
  it('renders on the server with no client directive and no canvas', () => {
    const markup = render(<CareerEvidenceTimeline entries={REAL} />);
    expect(markup).toContain('<svg');
    expect(markup).not.toContain('<canvas');
  });

  it('carries no drag, scrub, orbit or twinkle affordance', () => {
    const markup = render(<CareerEvidenceTimeline entries={REAL} />).toLowerCase();
    for (const retired of ['constellation', 'drag', 'scrub', 'orbit', 'twinkle', 'rotate']) {
      expect(markup, `${retired} is retired by CD-13`).not.toContain(retired);
    }
  });

  it('is complete without JS — every entry is in the served markup', () => {
    // The base composition IS the final frame; motion only replays assembly.
    const markup = render(<CareerEvidenceTimeline entries={REAL} />);
    for (const entry of REAL) expect(markup).toContain(entry.label);
  });
});

describe('CareerEvidenceTimeline — labels name parts, never sources or states', () => {
  it('does not emit a source, freshness or status word of its own', () => {
    const text = textOf(render(<CareerEvidenceTimeline />)).toLowerCase();
    // Caller labels are the caller's business; these are the words the
    // component itself contributes.
    for (const banned of ['verified', 'nppes', 'oig', 'live', 'real-time', 'up to date']) {
      expect(text, `${banned} must not appear in artifact chrome`).not.toContain(banned);
    }
  });
});
