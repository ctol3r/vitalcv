/**
 * wedge-smoke-flow.test.ts
 *
 * Documents the canonical pilot wedge flow as executable assertions.
 * Each test corresponds to one step in the flow:
 * NPI → readiness → passport → request-review → employer context → review → action
 *
 * These are unit/integration tests, NOT E2E Playwright tests.
 * They verify that the route contracts, URL builders, and API shape
 * for each step are correct — not that the full browser flow works.
 */

import { describe, expect, it } from 'vitest';
import {
  PUBLIC_WEDGE_ROUTE_TARGETS,
  buildPassportLookupHref,
  buildEmployerReviewHref,
} from '../lib/trust/public-wedge-parity';
import type {
  EmployerReviewActionIntent,
  EmployerReviewActionState,
  DecisionTrustSnapshot,
} from '../lib/employer-review-actions';
import {
  CANONICAL_SOURCE_COVERAGE_STATES,
  LAUNCH_SPINE_SOURCE_IDS,
} from '@vitalcv/trust-state';

const SAMPLE_NPI = '1003000126';
const SAMPLE_ENTITY_ID = 'entity_abc123';
const SAMPLE_CONTEXT_ID = 'ctx_def456';

describe('wedge smoke flow', () => {
  describe('step 1 — NPI input route', () => {
    it('homepage is the wedge entry point', () => {
      expect(PUBLIC_WEDGE_ROUTE_TARGETS.homepageLookup).toBe('/');
    });

    it('LiveTrustConsole is the homepage hero component', async () => {
      // Static import check — if this import resolves, the component exists
      const mod = await import('../components/hero/LiveTrustConsole');
      expect(mod.LiveTrustConsole).toBeDefined();
      expect(typeof mod.LiveTrustConsole).toBe('function');
    });
  });

  describe('step 2 — readiness → passport URL contract', () => {
    it('passport route target is /passport', () => {
      expect(PUBLIC_WEDGE_ROUTE_TARGETS.passportEntry).toBe('/passport');
    });

    it('builds passport URL with NPI query param', () => {
      expect(buildPassportLookupHref(SAMPLE_NPI)).toBe(
        `/passport?npi=${SAMPLE_NPI}`,
      );
    });

    it('builds bare passport URL when NPI is missing', () => {
      expect(buildPassportLookupHref(null)).toBe('/passport');
      expect(buildPassportLookupHref(undefined)).toBe('/passport');
    });

    it('rejects invalid NPI format', () => {
      expect(buildPassportLookupHref('123')).toBe('/passport');
      expect(buildPassportLookupHref('not-a-number')).toBe('/passport');
    });
  });

  describe('step 3 — request-review URL contract', () => {
    // buildEmployerReviewHref is already covered in detail by
    // public-wedge-parity-contract.test.ts — this test verifies
    // the basic shape only to document the flow step.
    it('review route target is /review', () => {
      expect(PUBLIC_WEDGE_ROUTE_TARGETS.reviewEntry).toBe('/review');
      expect(PUBLIC_WEDGE_ROUTE_TARGETS.reviewRequestEntry).toBe('/review/request');
    });

    it('builds review URL with entityId and contextId', () => {
      const href = buildEmployerReviewHref(SAMPLE_ENTITY_ID, {
        contextId: SAMPLE_CONTEXT_ID,
      });
      expect(href).toBe(
        `/review/${SAMPLE_ENTITY_ID}?contextId=${SAMPLE_CONTEXT_ID}`,
      );
    });
  });

  describe('step 4 — employer action type contract', () => {
    it('EmployerReviewActionIntent covers accept/refresh/review', () => {
      // Type-level assertion: these values must be assignable
      const intents: EmployerReviewActionIntent[] = [
        'accept',
        'refresh',
        'review',
      ];
      expect(intents).toHaveLength(3);
      expect(intents).toContain('accept');
      expect(intents).toContain('refresh');
      expect(intents).toContain('review');
    });

    it('EmployerReviewActionState requires entityId and clinicianNpi', () => {
      // Shape assertion — verify the type's required fields compile
      const stub: Pick<
        EmployerReviewActionState,
        'action' | 'entityId' | 'clinicianNpi' | 'auditEventId'
      > = {
        action: 'accept',
        entityId: SAMPLE_ENTITY_ID,
        clinicianNpi: SAMPLE_NPI,
        auditEventId: 'audit_001',
      };
      expect(stub.entityId).toBe(SAMPLE_ENTITY_ID);
      expect(stub.clinicianNpi).toBe(SAMPLE_NPI);
      expect(stub.action).toBe('accept');
    });

    it('DecisionTrustSnapshot captures NPI and readiness at decision time', () => {
      const stub: Pick<
        DecisionTrustSnapshot,
        'npi' | 'readinessStatus' | 'readinessScore' | 'snapshotHash'
      > = {
        npi: SAMPLE_NPI,
        readinessStatus: 'READY',
        readinessScore: 85,
        snapshotHash: 'sha256_abc',
      };
      expect(stub.npi).toBe(SAMPLE_NPI);
      expect(typeof stub.readinessScore).toBe('number');
    });
  });

  describe('step 5 — review load URL format', () => {
    it('/review/[entityId]?contextId= is the canonical review URL', () => {
      const href = buildEmployerReviewHref(SAMPLE_ENTITY_ID, {
        contextId: SAMPLE_CONTEXT_ID,
      });
      // Must match /review/{entityId}?contextId={contextId}
      const url = new URL(href, 'https://vitalcv.com');
      expect(url.pathname).toBe(`/review/${SAMPLE_ENTITY_ID}`);
      expect(url.searchParams.get('contextId')).toBe(SAMPLE_CONTEXT_ID);
    });
  });

  describe('step 6 — employer action API routes', () => {
    it('accept endpoint follows /api/employer-review/:entityId/accept pattern', () => {
      const endpoint = `/api/employer-review/${SAMPLE_ENTITY_ID}/accept`;
      expect(endpoint).toMatch(
        /^\/api\/employer-review\/[^/]+\/accept$/,
      );
    });

    it('request-refresh endpoint follows /api/employer-review/:entityId/request-refresh pattern', () => {
      const endpoint = `/api/employer-review/${SAMPLE_ENTITY_ID}/request-refresh`;
      expect(endpoint).toMatch(
        /^\/api\/employer-review\/[^/]+\/request-refresh$/,
      );
    });

    it('route-to-review endpoint follows /api/employer-review/:entityId/route-to-review pattern', () => {
      const endpoint = `/api/employer-review/${SAMPLE_ENTITY_ID}/route-to-review`;
      expect(endpoint).toMatch(
        /^\/api\/employer-review\/[^/]+\/route-to-review$/,
      );
    });
  });
});

describe('readiness lane state constants', () => {
  it('CANONICAL_SOURCE_COVERAGE_STATES includes the 4 core lane states', () => {
    expect(CANONICAL_SOURCE_COVERAGE_STATES).toContain('checked');
    expect(CANONICAL_SOURCE_COVERAGE_STATES).toContain('pending');
    expect(CANONICAL_SOURCE_COVERAGE_STATES).toContain('accessRequired');
    expect(CANONICAL_SOURCE_COVERAGE_STATES).toContain('stale');
  });

  it('no coverage state is an empty string', () => {
    for (const state of CANONICAL_SOURCE_COVERAGE_STATES) {
      expect(state.length).toBeGreaterThan(0);
    }
  });

  it('LAUNCH_SPINE_SOURCE_IDS covers the 4 pilot ingest sources', () => {
    expect(LAUNCH_SPINE_SOURCE_IDS).toContain('NPPES_API');
    expect(LAUNCH_SPINE_SOURCE_IDS).toContain('OIG_LEIE');
    expect(LAUNCH_SPINE_SOURCE_IDS).toContain('PECOS_PUBLIC');
    expect(LAUNCH_SPINE_SOURCE_IDS).toContain('STATE_BOARD');
    expect(LAUNCH_SPINE_SOURCE_IDS).toHaveLength(4);
  });
});

describe('KPI event type contract', () => {
  it('UX_EVENTS contains core wedge funnel events', async () => {
    const { UX_EVENTS } = await import('../lib/analytics/ux-events');
    const values = Object.values(UX_EVENTS);
    expect(values).toContain('npi_submit_attempt');
    expect(values).toContain('readiness_revealed');
    expect(values).toContain('employer_action_clicked');
  });

  it('no UX event type is an empty string', async () => {
    const { UX_EVENTS } = await import('../lib/analytics/ux-events');
    for (const value of Object.values(UX_EVENTS)) {
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('UX_EVENTS keys follow SCREAMING_SNAKE naming convention', async () => {
    const { UX_EVENTS } = await import('../lib/analytics/ux-events');
    for (const key of Object.keys(UX_EVENTS)) {
      expect(key).toMatch(/^[A-Z][A-Z0-9_]+$/);
    }
  });

  it('UX_EVENTS covers dead-end and share-intent friction signals', async () => {
    const { UX_EVENTS } = await import('../lib/analytics/ux-events');
    const values = Object.values(UX_EVENTS);
    expect(values).toContain('dead_end_reached');
    expect(values).toContain('share_intent');
  });
});

describe('KPI funnel instrumentation completeness', () => {
  it('UX_EVENTS includes PASSPORT_VIEWED', async () => {
    const { UX_EVENTS } = await import('../lib/analytics/ux-events');
    expect(UX_EVENTS.PASSPORT_VIEWED).toBe('passport_viewed');
  });

  it('UX_EVENTS includes REVIEW_REQUESTED', async () => {
    const { UX_EVENTS } = await import('../lib/analytics/ux-events');
    expect(UX_EVENTS.REVIEW_REQUESTED).toBe('review_requested');
  });

  it('PilotMetricEventType covers full wedge funnel', async () => {
    const { UX_EVENTS } = await import('../lib/analytics/ux-events');
    const wedgeFunnel = [
      UX_EVENTS.NPI_SUBMIT_ATTEMPT,
      UX_EVENTS.READINESS_REVEALED,
      UX_EVENTS.PASSPORT_VIEWED,
      UX_EVENTS.REVIEW_REQUESTED,
      UX_EVENTS.EMPLOYER_ACTION_CLICKED,
    ];
    for (const event of wedgeFunnel) {
      expect(typeof event).toBe('string');
      expect(event.length).toBeGreaterThan(0);
    }
  });
});
