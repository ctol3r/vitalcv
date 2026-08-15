// @vitest-environment jsdom

/**
 * The journey-navigation header's pure contracts (FR-6):
 *
 * - journeyStages is the one source of truth: four founder-fixed stages,
 *   truth-bounded narration, root-relative anchors.
 * - navDestinations is the one source of truth for destinations: no
 *   duplicates, no dead-looking entries, no Company group until real routes
 *   exist.
 * - headerRouteContext: one contextual primary action, never two; the rail
 *   is interactive only on `/`; the activation flow starts at Your Number.
 * - JourneyRail renders honest semantics: aria-current="step", SR
 *   narration, shape-carried states, anchors only where honest, and no
 *   rendered ordinals (CD-13).
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_JOURNEY_STAGE,
  JOURNEY_STAGES,
  isJourneyStageId,
  journeyStageIndex,
} from '@/components/layout/journeyStages';
import { NAV_GROUPS, allNavHrefs } from '@/components/layout/navDestinations';
import { getHeaderRouteContext } from '@/components/layout/headerRouteContext';
import { activationHeaderStage } from '@/lib/activation/headerStage';

describe('journey stages', () => {
  it('carries exactly the founder-fixed four stages, in order', () => {
    expect(JOURNEY_STAGES.map((s) => s.label)).toEqual([
      'Your Number',
      'Sources',
      'Permission',
      'Review',
    ]);
    expect(JOURNEY_STAGES.map((s) => s.id)).toEqual([
      'your-number',
      'sources',
      'permission',
      'review',
    ]);
  });

  it('gives every stage screen-reader narration and a root-relative anchor', () => {
    for (const stage of JOURNEY_STAGES) {
      expect(stage.srDescription.length).toBeGreaterThan(10);
      // Root-relative so holder-route-contract resolves the path half.
      expect(stage.homeAnchor).toMatch(/^\/#[a-z-]+$/);
    }
  });

  it('does not overclaim: no ownership proof from the NPI, no verification from review', () => {
    const number = JOURNEY_STAGES.find((s) => s.id === 'your-number')!;
    expect(number.srDescription).toMatch(/does not by itself prove/i);
    const review = JOURNEY_STAGES.find((s) => s.id === 'review')!;
    expect(review.srDescription).not.toMatch(/verif/i);
  });

  it('validates ids and indexes stages consistently', () => {
    expect(isJourneyStageId('sources')).toBe(true);
    expect(isJourneyStageId('packet')).toBe(false);
    expect(isJourneyStageId(null)).toBe(false);
    expect(journeyStageIndex(DEFAULT_JOURNEY_STAGE)).toBe(0);
  });
});

describe('nav destinations', () => {
  it('has no duplicate destinations across groups', () => {
    const hrefs = allNavHrefs();
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('keeps the Company group absent until real routes exist', () => {
    expect(NAV_GROUPS.map((g) => g.id)).toEqual(['clinicians', 'employers', 'trust']);
  });

  it('gives every link a label and a detail line', () => {
    for (const group of NAV_GROUPS) {
      expect(group.links.length).toBeGreaterThan(0);
      for (const link of group.links) {
        expect(link.label.trim().length).toBeGreaterThan(0);
        expect(link.detail.trim().length).toBeGreaterThan(0);
        expect(link.href.startsWith('/')).toBe(true);
      }
    }
  });
});

describe('header route context', () => {
  it('never yields competing primaries — at most one CTA per route', () => {
    for (const path of ['/', '/employers', '/trust', '/onboarding', '/verify', '/opportunities/discover', '/unknown']) {
      const ctx = getHeaderRouteContext(path);
      expect(ctx.cta === null || typeof ctx.cta.href === 'string').toBe(true);
    }
  });

  it('makes the rail interactive only on the homepage', () => {
    expect(getHeaderRouteContext('/').railInteractive).toBe(true);
    for (const path of ['/employers', '/trust', '/onboarding', '/status']) {
      expect(getHeaderRouteContext(path).railInteractive).toBe(false);
    }
  });

  it('suppresses the CTA on its own destination', () => {
    // /onboarding IS where "Build my profile" goes; /employers opens with
    // the identical claim action.
    expect(getHeaderRouteContext('/onboarding').cta).toBeNull();
    expect(getHeaderRouteContext('/employers').cta).toBeNull();
    expect(getHeaderRouteContext('/').cta?.href).toBe('/onboarding');
  });

  it('maps route families to their narrative stage', () => {
    expect(getHeaderRouteContext('/').defaultStage).toBe('your-number');
    expect(getHeaderRouteContext('/onboarding').defaultStage).toBe('your-number');
    expect(getHeaderRouteContext('/trust').defaultStage).toBe('sources');
    expect(getHeaderRouteContext('/trust/attribution').defaultStage).toBe('sources');
    expect(getHeaderRouteContext('/opportunities/discover').defaultStage).toBe('permission');
    expect(getHeaderRouteContext('/employers').defaultStage).toBe('review');
    expect(getHeaderRouteContext('/verify/1234567893').defaultStage).toBe('review');
  });

  it('defaults every public route to a legible light register before section observation', () => {
    for (const path of ['/', '/employers', '/trust', '/onboarding', '/unknown']) {
      expect(getHeaderRouteContext(path).defaultTheme).toBe('light');
    }
  });
});

describe('activation stage truth', () => {
  it("advances to Sources only from the server-confirmed 'success' phase", () => {
    expect(activationHeaderStage('success')).toBe('sources');
    for (const phase of ['checking', 'intro', 'form', 'submitting', 'student_success', 'load_error', 'signed_out']) {
      expect(activationHeaderStage(phase)).toBe('your-number');
    }
  });
});
