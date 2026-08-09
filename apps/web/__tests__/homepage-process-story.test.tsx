/**
 * Process story gates — pointed at the ROUTE (see render-homepage.tsx for why:
 * component-pointed homepage tests went green for weeks describing a page no
 * visitor could reach).
 *
 * What is pinned here and why:
 *  - The five chapters exist in EC-27 beat order with their owner vocabulary —
 *    the section's whole job is the process, so losing a chapter is a defect.
 *  - EC-25 scene truth: every scene labels itself illustrative, the seed
 *    carries no digit run, and chapter five ends at review — the employer
 *    decides; no scene resolves the decision for them.
 *  - The house SSR architecture: the server ships every chapter COMPLETE
 *    (`is-play` present before any script runs), so no-JS and reduced-motion
 *    visitors get the whole meaning. A refactor that makes the story
 *    JS-dependent goes red here, not in a design review.
 */

import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/nextjs', () => ({
  SignedIn: () => null,
  SignedOut: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({ isSignedIn: false }),
}));

import { renderHomepageHtml } from './helpers/render-homepage';

function storySection(): string {
  const html = renderHomepageHtml();
  const start = html.indexOf('data-home-process-story');
  expect(start, 'the process story section renders on /').toBeGreaterThan(-1);
  // The section closes where the next sibling section (ownership) opens.
  const end = html.indexOf('ezh-own', start);
  return end === -1 ? html.slice(start) : html.slice(start, end);
}

describe('homepage process story — composition', () => {
  it('tells all five chapters, in beat order', () => {
    const story = storySection();
    for (const n of [1, 2, 3, 4, 5]) {
      expect(story, `chapter ${n} missing`).toContain(`data-chapter="${n}"`);
    }
    const order = [
      'Start with the number you already have',
      'builds itself from named sources',
      'exactly one owner',
      'stops at your approval',
      'travels with you',
    ].map((t) => story.indexOf(t));
    expect(order.every((i) => i > -1), 'a chapter title is missing').toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('ships every chapter complete in the server render (no-JS gets the meaning)', () => {
    const story = storySection();
    const played = story.match(/ezh-st-ch is-play/g) ?? [];
    expect(played.length, 'all five chapters must SSR in the finished state').toBe(5);
  });

  it('names only integrated sources beside facts', () => {
    const story = storySection();
    expect(story).toContain('NPPES');
    expect(story).toContain('exclusion list');
    expect(story).toContain('State board record');
    // The gap is shown, never papered over.
    expect(story).toContain('No answer yet');
  });

  it('labels the owner lanes with the four-owner vocabulary', () => {
    const story = storySection();
    for (const owner of ['VitalCV handles', 'Your approval', 'Only you', 'The employer decides']) {
      expect(story, `owner lane "${owner}" missing`).toContain(owner);
    }
  });
});

describe('homepage process story — EC-25 scene truth', () => {
  it('labels every scene illustrative in its own chrome', () => {
    const story = storySection();
    const labels = story.match(/Illustrative — not a live result/g) ?? [];
    expect(labels.length, 'each of the five scenes carries its own label').toBeGreaterThanOrEqual(5);
  });

  it('carries no digit run that could read as a real identifier', () => {
    const story = storySection();
    expect(story).not.toMatch(/\d{6,}/);
    expect(story).toContain('masked · illustrative');
  });

  it('ends at review — the employer decides, and nothing resolves it for them', () => {
    const story = storySection();
    expect(story).toContain('The employer decides');
    for (const banned of ['Hired', 'Cleared to start', 'Offer extended', 'You got the job']) {
      expect(story, `scene resolves the employer's decision: "${banned}"`).not.toContain(banned);
    }
  });

  it('makes no claim the truth contract bans', () => {
    const story = storySection();
    expect(story).not.toMatch(/\bverified\b/i);
    expect(story).not.toMatch(/\binstant\b/i);
    expect(story).not.toMatch(/\bguaranteed\b/i);
  });
});

describe('homepage process story — controls', () => {
  it('gives every chapter an explicit replay control', () => {
    const story = storySection();
    const replays = story.match(/ezh-st-replay/g) ?? [];
    expect(replays.length).toBeGreaterThanOrEqual(5);
  });
});
