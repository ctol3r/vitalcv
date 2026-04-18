import { describe, expect, it } from 'vitest';
import {
  ACTION_OWNER,
  resolveBlockerOwnership,
  resolveOmegaRecomputeFailureOwnership,
  resolveStateBoardOwnership,
} from '@/lib/trust/action-owner';

// Doctrine-level tests. These guard the four invariants the wedge
// depends on:
//   1. System failure is never assigned to USER.
//   2. Access-required is never a clinician defect.
//   3. Stale source is not equivalent to user missing data.
//   4. No ownerless blockers on live wedge surfaces.
describe('resolveBlockerOwnership', () => {
  const KNOWN_BLOCKERS = [
    'On OIG exclusion list',
    'Exclusion check failed',
    'Medicare enrollment unresolved',
    'Not enrolled in Medicare',
  ] as const;

  it('never returns ActionOwner.UNKNOWN for a known blocker string', () => {
    for (const blocker of KNOWN_BLOCKERS) {
      const ownership = resolveBlockerOwnership(blocker);
      expect(ownership.owner).not.toBe(ACTION_OWNER.UNKNOWN);
    }
  });

  it('never returns the generic "Take Action" CTA — every label is a concrete verb', () => {
    for (const blocker of KNOWN_BLOCKERS) {
      const ownership = resolveBlockerOwnership(blocker);
      expect(ownership.actionLabel.toLowerCase()).not.toBe('take action');
      expect(ownership.actionLabel.length).toBeGreaterThan(0);
    }
  });

  it('supplies a non-empty owner-prefixed line for every known blocker', () => {
    for (const blocker of KNOWN_BLOCKERS) {
      const ownership = resolveBlockerOwnership(blocker);
      expect(ownership.ownerPrefix.length).toBeGreaterThan(0);
      expect(ownership.plainLabel.length).toBeGreaterThan(0);
    }
  });

  it('never assigns a source-unavailable (VitalCV retry) scenario to USER', () => {
    const retryOwnership = resolveBlockerOwnership('Exclusion check failed');
    expect(retryOwnership.owner).toBe(ACTION_OWNER.VITALCV);
    expect(retryOwnership.canProceed).toBe(true);
  });

  it('marks an active OIG exclusion as USER-owned and non-continuable', () => {
    const exclusion = resolveBlockerOwnership('On OIG exclusion list');
    expect(exclusion.owner).toBe(ACTION_OWNER.USER);
    expect(exclusion.canProceed).toBe(false);
  });

  it('marks PECOS unresolved (quarterly refresh lag) as SOURCE-owned, not USER-owned', () => {
    const unresolved = resolveBlockerOwnership('Medicare enrollment unresolved');
    expect(unresolved.owner).toBe(ACTION_OWNER.SOURCE);
    expect(unresolved.canProceed).toBe(true);
  });

  it('marks a definitive not-enrolled status as USER-owned (clinician submits PECOS enrollment)', () => {
    const notEnrolled = resolveBlockerOwnership('Not enrolled in Medicare');
    expect(notEnrolled.owner).toBe(ACTION_OWNER.USER);
  });

  it('falls back to UNKNOWN with plainLabel carrying the raw blocker for unclassified strings', () => {
    const unclassified = resolveBlockerOwnership('Some future blocker we have not classified');
    expect(unclassified.owner).toBe(ACTION_OWNER.UNKNOWN);
    expect(unclassified.plainLabel).toBe('Some future blocker we have not classified');
  });

  it('treats "N unresolved readiness items" as UNKNOWN but provides a passport-detail next step', () => {
    const aggregated = resolveBlockerOwnership('3 unresolved readiness items');
    expect(aggregated.owner).toBe(ACTION_OWNER.UNKNOWN);
    expect(aggregated.actionLabel.toLowerCase()).not.toBe('take action');
    expect(aggregated.plainLabel).toContain('unresolved readiness items');
  });
});

describe('resolveStateBoardOwnership', () => {
  it('assigns state-board access to INSTITUTION, never to USER', () => {
    const ownership = resolveStateBoardOwnership();
    expect(ownership.owner).toBe(ACTION_OWNER.INSTITUTION);
    expect(ownership.owner).not.toBe(ACTION_OWNER.USER);
  });

  it('allows provisional continuation (canProceed) — state-board gap is not a clinician defect', () => {
    const ownership = resolveStateBoardOwnership();
    expect(ownership.canProceed).toBe(true);
  });

  it('names the institution in the owner prefix, not the clinician', () => {
    const ownership = resolveStateBoardOwnership();
    expect(ownership.ownerPrefix.toLowerCase()).toMatch(/employer|institution/);
    expect(ownership.ownerPrefix.toLowerCase()).not.toMatch(/^you /);
  });
});

describe('resolveOmegaRecomputeFailureOwnership', () => {
  it('assigns recompute failure to VITALCV, never to USER', () => {
    const ownership = resolveOmegaRecomputeFailureOwnership();
    expect(ownership.owner).toBe(ACTION_OWNER.VITALCV);
    expect(ownership.owner).not.toBe(ACTION_OWNER.USER);
  });

  it('carries an ETA so the user sees when the retry will land', () => {
    const ownership = resolveOmegaRecomputeFailureOwnership();
    expect(ownership.etaOrDependency).not.toBeNull();
    expect((ownership.etaOrDependency ?? '').length).toBeGreaterThan(0);
  });

  it('permits continuation — the local action was recorded; only the upstream recompute lagged', () => {
    const ownership = resolveOmegaRecomputeFailureOwnership();
    expect(ownership.canProceed).toBe(true);
  });
});
