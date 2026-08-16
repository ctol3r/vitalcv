/**
 * Direction D keeps the process explanation in the record itself. This guard
 * prevents the retired five-chapter story from returning beside the hero and
 * making visitors read the same argument twice.
 */

import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/nextjs', () => ({
  SignedIn: () => null,
  SignedOut: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({ isSignedIn: false }),
}));

import { renderHomepageHtml } from './helpers/render-homepage';

describe('homepage record-first composition', () => {
  it('uses one illustrated record instead of a second five-chapter explainer', () => {
    const html = renderHomepageHtml();
    expect(html).toContain('data-home-register="direction-a"');
    // The hero's idle slot is figure 1, not D.7's frosted folio.
    expect(html).toContain('ezh-fig-hero');
    expect(html).not.toContain('data-home-work-surface');
    expect(html).not.toContain('data-home-process-story');
    expect(html).not.toContain('Chapter 1 of 5');
  });

  /**
   * This assertion is INVERTED from its D.7 form, deliberately.
   *
   * It used to require the string "CV Wallet" in the served homepage. That
   * pinned a noun the customer-language inventory classes as infrastructure
   * vocabulary, and amendment E retires it from `/` outright ("the noun simply
   * no longer appears on `/` once the recomposition lands"). A guard that
   * mandates the banned string is a guard enforcing retired doctrine, so it
   * now asserts the absence it is supposed to protect.
   */
  it('keeps the retired wallet vocabulary off the served homepage', () => {
    const html = renderHomepageHtml();
    expect(html).not.toContain('CV Wallet');
    expect(html).not.toContain('Wallet');
  });

  it('keeps every record row in the server render for no-script visitors', () => {
    const html = renderHomepageHtml();
    // The rows figure 1 actually draws. The figure is complete in the server
    // frame — no script, no reveal, no hydration required to read it.
    for (const line of [
      'Name and specialty',
      'Practice location',
      'State license record',
      'Federal exclusion list',
    ]) {
      expect(html).toContain(line);
    }
  });

  /**
   * The open row is the honest half of figure 1 and the reason it beat a
   * tidier drawing: where no source answered, the profile leaves the row open
   * rather than guessing. Losing it would leave a figure that implies every
   * line gets filled.
   */
  it('draws the row no source answered, instead of a complete-looking record', () => {
    const html = renderHomepageHtml();
    expect(html).toContain('no source answered');
  });

  it('labels the illustration and does not manufacture an employer outcome', () => {
    const html = renderHomepageHtml();
    expect(html).toContain('Illustrative');
    expect(html).toContain('nothing has been sent');
    for (const banned of ['Hired', 'Cleared to start', 'Offer extended', 'You got the job']) {
      expect(html).not.toContain(banned);
    }
  });

  /**
   * Every figure is `aria-hidden` art whose meaning lives in adjacent text
   * (EC-4). If a figure ever ships carrying meaning only inside the drawing,
   * this is the assertion that should fail.
   */
  it('never leaves a figure as the sole carrier of its meaning', () => {
    const html = renderHomepageHtml();
    // Each of the six figures contributes one caption and one sr-only note.
    const captions = html.match(/ezh-fig-cap/g) ?? [];
    expect(captions.length).toBe(6);
    const notes = html.match(/ezh-sr/g) ?? [];
    // Six figure notes plus the payoff line's full-sentence alternative.
    expect(notes.length).toBeGreaterThanOrEqual(7);
  });
});
