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
    expect(html).toContain('data-home-work-surface');
    expect(html).toContain('data-motion="static"');
    expect(html).toContain('CV Wallet');
    expect(html).not.toContain('data-home-process-story');
    expect(html).not.toContain('Chapter 1 of 5');
  });

  it('keeps all record rows in the server render for no-script visitors', () => {
    const html = renderHomepageHtml();
    for (const line of ['Identity', 'Practice history', 'License record', 'Career evidence']) {
      expect(html).toContain(line);
    }
  });

  it('labels the illustration and does not manufacture an employer outcome', () => {
    const html = renderHomepageHtml();
    expect(html).toContain('Illustrative');
    expect(html).toContain('nothing has been sent');
    for (const banned of ['Hired', 'Cleared to start', 'Offer extended', 'You got the job']) {
      expect(html).not.toContain(banned);
    }
  });
});
