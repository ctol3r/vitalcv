/**
 * The "How VitalCV works" walkthrough (2026-08-07 eyebrow wave).
 *
 * The section's promise: a visitor can understand NPI → Sources →
 * Permission → Review without entering an NPI or loading the illustrative
 * example. These guards pin the properties that make that promise honest:
 *
 * 1. Vocabulary is DERIVED — stage ids, labels and descriptions come from
 *    JOURNEY_STAGES (the header rail's single source), and the Sources
 *    vignette derives its rows from SOURCE_LANE_OPS, so neither the
 *    journey wording nor lane cadence can drift from the chrome or /status.
 * 2. The server render is complete — all four vignettes present at rest,
 *    exactly one active stage. Emphasis moves; content never hides.
 * 3. Truth boundaries hold — no ten-digit number anywhere (a rendered NPI
 *    shape would read as a real one), no bare "Verified", an explicit
 *    illustrative disclosure, and no duplicate journey anchor ids that
 *    would hijack the header rail's homepage anchors.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { HowItWorks } from '@/components/home/career-loop/HowItWorks';
import { JOURNEY_STAGES } from '@/components/layout/journeyStages';
import { getReadinessDimensionLanes } from '@/lib/trust/sourceLanes';
import { renderHomepageHtml } from './helpers/render-homepage';

const componentHtml = () => renderToStaticMarkup(React.createElement(HowItWorks));

describe('How VitalCV works — presence on /', () => {
  it('the shipping homepage renders the walkthrough section', () => {
    const html = renderHomepageHtml();
    expect(html).toContain('data-home-how-it-works');
    expect(html).toContain('How VitalCV works');
  });

  it('adds no duplicate journey anchor id — each header anchor still lands once', () => {
    const html = renderHomepageHtml();
    for (const id of ['your-number', 'sources', 'permission', 'review']) {
      expect((html.match(new RegExp(`id="${id}"`, 'g')) ?? []).length).toBe(1);
    }
  });
});

describe('How VitalCV works — derived journey vocabulary', () => {
  it('renders every stage from JOURNEY_STAGES: id, label, and description', () => {
    const html = componentHtml();
    for (const stage of JOURNEY_STAGES) {
      expect(html).toContain(`data-how-stage="${stage.id}"`);
      expect(html).toContain(stage.label);
      expect(html).toContain(stage.srDescription);
    }
  });

  it('derives the Sources vignette from the lane registry, cadence and all', () => {
    const html = componentHtml();
    for (const lane of getReadinessDimensionLanes()) {
      expect(html).toContain(lane.marketingShortName);
      expect(html).toContain(lane.cadenceLabel);
    }
  });

  it('declares the your-number scene for the header, on a light room', () => {
    const html = componentHtml();
    expect(html).toContain('data-header-stage="your-number"');
    expect(html).toContain('data-header-theme="light"');
    expect(html).toContain('id="how-it-works"');
  });
});

describe('How VitalCV works — complete at rest, honest throughout', () => {
  it('server-renders all four vignettes with exactly one active stage', () => {
    const html = componentHtml();
    expect((html.match(/clh-how-plate/g) ?? []).length).toBe(4);
    expect((html.match(/aria-current="step"/g) ?? []).length).toBe(1);
    // The resting active stage is the journey's first.
    expect(html).toMatch(/data-how-stage="your-number"[^>]*data-active/);
  });

  it('never renders a ten-digit number — nothing that could read as a real NPI', () => {
    expect(componentHtml()).not.toMatch(/\d{10}/);
  });

  it('stays inside the truth contract', () => {
    const html = componentHtml();
    expect(html).not.toMatch(/\bverified\b/i);
    expect(html).toMatch(/illustrative/i);
    // The walkthrough explains; it must not claim completion or delivery.
    for (const banned of ['Start confirmed', 'Delivered', 'Sent', 'Cleared', 'Approved']) {
      expect(html).not.toContain(banned);
    }
  });
});
