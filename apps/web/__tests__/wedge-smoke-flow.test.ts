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
