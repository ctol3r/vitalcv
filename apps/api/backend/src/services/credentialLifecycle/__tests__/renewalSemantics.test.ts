import { detectFlattenedAmbiguity, interpretRenewal } from '../renewalSemantics';
import { sealEvent } from '../lifecycleGraph';
import type { LifecycleEvent, LifecycleNode, RenewalInterpretation } from '../types';
import { CredentialLifecycleState } from '../../../utils/lifecycleState';

function makeNode(overrides: Partial<LifecycleNode>): LifecycleNode {
  return {
    artifactId: overrides.artifactId ?? 'a',
    artifactType: overrides.artifactType ?? 'license',
    organizationId: overrides.organizationId ?? 'org-1',
    state: overrides.state ?? CredentialLifecycleState.ACTIVE,
    issuedAt: overrides.issuedAt ?? null,
    expiresAt: overrides.expiresAt ?? null,
    archivedAt: overrides.archivedAt ?? null,
    events: overrides.events ?? [],
    predecessorIds: overrides.predecessorIds ?? [],
    successorIds: overrides.successorIds ?? [],
  };
}

function makeRenewalEvent(overrides: Partial<LifecycleEvent> = {}): LifecycleEvent {
  return sealEvent({
    eventId: overrides.eventId ?? 'r1',
    artifactId: overrides.artifactId ?? 'a',
    eventType: 'renewed',
    occurredAt: overrides.occurredAt ?? '2026-02-01T00:00:00.000Z',
    recordedAt: overrides.recordedAt ?? '2026-02-01T00:00:00.000Z',
    cause: overrides.cause ?? null,
    predecessorArtifactId: overrides.predecessorArtifactId ?? null,
    successorArtifactId: overrides.successorArtifactId ?? null,
    correctsEventId: null,
    metadata: overrides.metadata ?? {},
  });
}

describe('renewalSemantics', () => {
  describe('interpretRenewal', () => {
    it('preserves ambiguity literal — both branches present', () => {
      const interp = interpretRenewal({
        predecessor: makeNode({ artifactId: 'v1', artifactType: 'license', organizationId: 'org-1', expiresAt: '2026-06-01T00:00:00.000Z' }),
        successor: makeNode({ artifactId: 'v2', artifactType: 'license', organizationId: 'org-1', issuedAt: '2026-06-01T00:00:00.000Z' }),
        renewalEvent: makeRenewalEvent(),
      });

      expect(interp.ambiguityPreserved).toBe(true);
      expect(interp.asContinuation).toBeDefined();
      expect(interp.asFreshIssue).toBeDefined();
    });

    it('scores continuation high when type/issuer match and gap is short', () => {
      const interp = interpretRenewal({
        predecessor: makeNode({ artifactId: 'v1', artifactType: 'license', organizationId: 'org-1', expiresAt: '2026-06-01T00:00:00.000Z' }),
        successor: makeNode({ artifactId: 'v2', artifactType: 'license', organizationId: 'org-1', issuedAt: '2026-06-15T00:00:00.000Z' }),
        renewalEvent: makeRenewalEvent(),
      });

      expect(interp.asContinuation.confidence).toBeGreaterThanOrEqual(0.5);
      expect(interp.asContinuation.plausible).toBe(true);
    });

    it('scores fresh-issue high when issuer changed', () => {
      const interp = interpretRenewal({
        predecessor: makeNode({ artifactId: 'v1', artifactType: 'license', organizationId: 'org-A', expiresAt: '2026-06-01T00:00:00.000Z' }),
        successor: makeNode({ artifactId: 'v2', artifactType: 'license', organizationId: 'org-B', issuedAt: '2026-06-15T00:00:00.000Z' }),
        renewalEvent: makeRenewalEvent(),
      });

      expect(interp.asFreshIssue.confidence).toBeGreaterThanOrEqual(0.3);
      expect(interp.asFreshIssue.plausible).toBe(true);
    });

    it('does not collapse to a single answer with zero signal — emits floor confidence', () => {
      const interp = interpretRenewal({
        predecessor: makeNode({ artifactId: 'v1', artifactType: 'license', organizationId: null, expiresAt: null }),
        successor: makeNode({ artifactId: 'v2', artifactType: 'license', organizationId: null, issuedAt: null }),
        renewalEvent: makeRenewalEvent(),
      });

      expect(interp.asContinuation.confidence).toBeGreaterThan(0);
      expect(interp.asFreshIssue.confidence).toBeGreaterThan(0);
    });

    it('clamps confidence to [0, 1]', () => {
      const interp = interpretRenewal({
        predecessor: makeNode({ artifactId: 'v1', artifactType: 'license', organizationId: 'org-1', expiresAt: '2020-01-01T00:00:00.000Z' }),
        successor: makeNode({ artifactId: 'v2', artifactType: 'cert', organizationId: 'org-2', issuedAt: '2026-01-01T00:00:00.000Z' }),
        renewalEvent: makeRenewalEvent({ cause: 'completely fresh issue' }),
      });

      expect(interp.asContinuation.confidence).toBeGreaterThanOrEqual(0);
      expect(interp.asContinuation.confidence).toBeLessThanOrEqual(1);
      expect(interp.asFreshIssue.confidence).toBeGreaterThanOrEqual(0);
      expect(interp.asFreshIssue.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('detectFlattenedAmbiguity', () => {
    it('returns empty array for properly preserved interpretations', () => {
      const interp = interpretRenewal({
        predecessor: makeNode({ artifactId: 'v1', artifactType: 'license', organizationId: 'org-1', expiresAt: '2026-06-01T00:00:00.000Z' }),
        successor: makeNode({ artifactId: 'v2', artifactType: 'license', organizationId: 'org-1', issuedAt: '2026-06-15T00:00:00.000Z' }),
        renewalEvent: makeRenewalEvent(),
      });
      expect(detectFlattenedAmbiguity([interp])).toEqual([]);
    });

    it('flags interpretations where ambiguityPreserved is not the literal true', () => {
      const bad: RenewalInterpretation = {
        renewalEventId: 'r1',
        asContinuation: { plausible: true, confidence: 0.8, rationale: '' },
        asFreshIssue: { plausible: true, confidence: 0.8, rationale: '' },
        ambiguityPreserved: false as unknown as true,
      };
      expect(detectFlattenedAmbiguity([bad])).toEqual(['r1']);
    });

    it('flags when both branches are strong but only one is plausible', () => {
      const bad: RenewalInterpretation = {
        renewalEventId: 'r2',
        asContinuation: { plausible: true, confidence: 0.7, rationale: '' },
        asFreshIssue: { plausible: false, confidence: 0.6, rationale: '' },
        ambiguityPreserved: true,
      };
      expect(detectFlattenedAmbiguity([bad])).toEqual(['r2']);
    });
  });
});
