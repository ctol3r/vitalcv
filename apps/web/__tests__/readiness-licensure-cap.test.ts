/**
 * readiness-licensure-cap.test.ts
 *
 * Tests the web-side defense-in-depth helper at lib/readiness/licensureCap.ts.
 * Mirrors the backend `applyReadinessLicensureCap` (passportService.ts) and
 * the engine-level `CRS_LICENSURE_UNVERIFIED_CEILING` (CrsEngine.ts).
 *
 * Truth contracts verified:
 *   - Ceiling = 45, identical to the backend constant.
 *   - When licensureStatus === 'verified', passport is returned unchanged.
 *   - When licensureStatus !== 'verified', score is clamped, level
 *     deterministically resolves to L1, readiness_score mirror updated.
 *   - Cap never raises a lower score.
 *   - Source-state distinction is preserved — only readiness fields are
 *     clamped, never sourceCoverage or trustPosture.
 *   - readLicensureUiState surfaces capEngaged + raw + ui-tier strings
 *     for use as data-licensure-state attributes.
 */
import { describe, expect, it } from 'vitest';
import type { PassportData } from '../lib/trust/passport-contract';
import {
  READINESS_LICENSURE_UNVERIFIED_CEILING,
  applyLicensureCapToPassport,
  clampReadinessScore,
  deriveLevelFromScore,
  readLicensureUiState,
} from '../lib/readiness/licensureCap';

function buildPassport(overrides: {
  licensureStatus: PassportData['standing']['licensureStatus'];
  score: number;
  level?: string;
  status?: PassportData['readiness']['status'];
}): PassportData {
  return {
    entityId: 'demo-entity',
    npi: '1003000126',
    identity: {
      displayName: 'Test Clinician',
      specialty: 'Internal Medicine',
      entityType: 'PERSON',
      status: 'ACTIVE',
      npi: '1003000126',
    },
    authority: {
      credentials: [],
      summary: { active: 0, expired: 0, stale: 0, missing: [] },
    },
    training: {
      records: [],
      hasDegree: true,
      degreeVerified: true,
      hasResidency: true,
      fellowshipCount: 0,
    },
    standing: {
      exclusionClear: true,
      exclusionStatus: 'CLEAR',
      licensureStatus: overrides.licensureStatus,
      deaStatus: 'unknown',
      pecosStatus: 'enrolled',
      pecosEnrollmentStatus: 'ENROLLED',
      enrollmentSourceLabel: 'CMS PECOS',
      enrollmentDataFreshness: 'Quarterly',
      enrollmentNote: null,
      negativeFindings: [],
    },
    readiness: {
      status: overrides.status ?? 'PARTIAL',
      score: overrides.score,
      level: overrides.level ?? 'L2',
      blockers: [],
      gaps: [],
      estimatedStartDays: 14,
      nextActions: [],
    },
    sources: { checked: [], lastFetch: {} },
    sourceCoverage: { checks: [] },
    trustPosture: {
      band: 'L2',
      bandLabel: 'Moderate trust',
      score: overrides.score,
      dimensions: [],
      freshness: { state: 'current', label: 'Current', items: [] },
      safeToRelyOnNow: [],
      missingItems: [],
      gatedItems: [],
      reviewRequiredItems: [],
      staleItems: [],
      blockers: [],
    },
    lastCheckedAt: '2026-05-04T00:00:00.000Z',
  };
}

describe('readiness licensure cap (web-side, W1.1b defense-in-depth)', () => {
  it('ceiling constant matches backend (45)', () => {
    expect(READINESS_LICENSURE_UNVERIFIED_CEILING).toBe(45);
  });

  describe('clampReadinessScore', () => {
    it("returns score unchanged for 'verified'", () => {
      expect(clampReadinessScore(100, 'verified')).toBe(100);
      expect(clampReadinessScore(45, 'verified')).toBe(45);
      expect(clampReadinessScore(0, 'verified')).toBe(0);
    });

    it("caps score at 45 for 'pending' / 'expired' / 'unknown'", () => {
      expect(clampReadinessScore(100, 'pending')).toBe(45);
      expect(clampReadinessScore(80, 'expired')).toBe(45);
      expect(clampReadinessScore(60, 'unknown')).toBe(45);
    });

    it('never raises a lower score', () => {
      expect(clampReadinessScore(20, 'pending')).toBe(20);
      expect(clampReadinessScore(0, 'pending')).toBe(0);
    });
  });

  describe('deriveLevelFromScore', () => {
    it('returns L0 for BLOCKED status regardless of score', () => {
      expect(deriveLevelFromScore(100, 'BLOCKED')).toBe('L0');
    });

    it('returns L1 for capped score (45) with non-BLOCKED status', () => {
      expect(deriveLevelFromScore(45, 'PARTIAL')).toBe('L1');
      expect(deriveLevelFromScore(45, 'CHECKING')).toBe('L1');
    });

    it('returns L3 only for score >= 80 AND DECISION_GRADE', () => {
      expect(deriveLevelFromScore(80, 'DECISION_GRADE')).toBe('L3');
      expect(deriveLevelFromScore(95, 'DECISION_GRADE')).toBe('L3');
      // 80 + non-DECISION_GRADE → L2 (still source-backed, not decision-grade)
      expect(deriveLevelFromScore(80, 'PARTIAL')).toBe('L2');
    });

    it('returns L2 for score in [60, 80) regardless of status', () => {
      expect(deriveLevelFromScore(60, 'PARTIAL')).toBe('L2');
      expect(deriveLevelFromScore(79, 'CHECKING')).toBe('L2');
    });
  });

  describe('readLicensureUiState', () => {
    it("returns capEngaged: false + uiState 'verified' for verified", () => {
      const passport = buildPassport({ licensureStatus: 'verified', score: 87 });
      const ui = readLicensureUiState(passport);
      expect(ui.capEngaged).toBe(false);
      expect(ui.uiState).toBe('verified');
      expect(ui.rawStatus).toBe('verified');
    });

    it("returns capEngaged: true + uiState 'unverified' for pending and expired", () => {
      for (const status of ['pending', 'expired'] as const) {
        const passport = buildPassport({ licensureStatus: status, score: 87 });
        const ui = readLicensureUiState(passport);
        expect(ui.capEngaged).toBe(true);
        expect(ui.uiState).toBe('unverified');
        expect(ui.rawStatus).toBe(status);
      }
    });

    it("returns capEngaged: true + uiState 'unknown' for unknown", () => {
      const passport = buildPassport({ licensureStatus: 'unknown', score: 87 });
      const ui = readLicensureUiState(passport);
      expect(ui.capEngaged).toBe(true);
      expect(ui.uiState).toBe('unknown');
    });
  });

  describe('applyLicensureCapToPassport', () => {
    it('returns the same passport object when cap not engaged (verified)', () => {
      const passport = buildPassport({ licensureStatus: 'verified', score: 87 });
      const result = applyLicensureCapToPassport(passport);
      // Identity-equal — no copy needed when cap is a no-op
      expect(result).toBe(passport);
    });

    it('returns the same passport object when cap engaged but score already below ceiling', () => {
      const passport = buildPassport({ licensureStatus: 'pending', score: 30 });
      const result = applyLicensureCapToPassport(passport);
      expect(result).toBe(passport);
      expect(result.readiness.score).toBe(30);
    });

    it('clamps score and re-derives level when cap fires', () => {
      const passport = buildPassport({
        licensureStatus: 'pending',
        score: 87,
        level: 'L3',
        status: 'DECISION_GRADE',
      });
      const result = applyLicensureCapToPassport(passport);
      expect(result.readiness.score).toBe(45);
      expect(result.readiness.readiness_score).toBe(45);
      expect(result.readiness.level).toBe('L1');
      // DECISION_GRADE label survives — only score/level change. The
      // backend may re-derive ReadinessState elsewhere; this rim helper
      // only guarantees no L2+ is rendered.
      expect(result.readiness.status).toBe('DECISION_GRADE');
    });

    it('does NOT mutate the input passport', () => {
      const passport = buildPassport({
        licensureStatus: 'pending',
        score: 87,
        level: 'L3',
      });
      const result = applyLicensureCapToPassport(passport);
      expect(passport.readiness.score).toBe(87);
      expect(passport.readiness.level).toBe('L3');
      expect(result).not.toBe(passport);
    });

    it('preserves source-state distinction — only readiness fields are touched', () => {
      const passport = buildPassport({
        licensureStatus: 'pending',
        score: 87,
        level: 'L3',
      });
      const result = applyLicensureCapToPassport(passport);
      expect(result.standing).toBe(passport.standing);
      expect(result.sourceCoverage).toBe(passport.sourceCoverage);
      expect(result.trustPosture).toBe(passport.trustPosture);
      expect(result.identity).toBe(passport.identity);
    });

    it('cap composes with BLOCKED — BLOCKED stays BLOCKED, level stays L0', () => {
      const passport = buildPassport({
        licensureStatus: 'pending',
        score: 12,
        status: 'BLOCKED',
        level: 'L0',
      });
      const result = applyLicensureCapToPassport(passport);
      // Score already below ceiling → no-op
      expect(result).toBe(passport);
      expect(result.readiness.level).toBe('L0');
    });
  });
});
