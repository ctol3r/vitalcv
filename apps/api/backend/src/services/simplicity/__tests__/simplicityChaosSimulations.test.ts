/**
 * simplicityChaosSimulations.test.ts — W2-PR127A Simplicity Chaos Suite
 *
 * Verifies that simplicity abstractions:
 *   1. Don't collapse under malformed or chaotic inputs
 *   2. Never flatten ambiguity — ambiguous states always surface
 *   3. Fail closed on unknown intents
 *   4. Preserve replay truth even under compression
 *   5. Cognitive friction scores zero (max friction) when evidence is absent
 *   6. Board maturity score is zero when longitudinal data is insufficient
 */

import {
  invokeWorkflow,
  markStepAmbiguous,
  reconstructCanonicalLineage,
} from '../workflowSimplificationLayer';

import { optimizeReplayLegibility } from '../replayAbstractionOptimizer';
import type { DecisionReplay } from '../../audit/replayEngine';

import {
  harmonizeTerms,
  harmonizeTerm,
  measureHarmonizationCoverage,
} from '../institutionalUxHarmonizer';

import {
  openFrictionSession,
  recordFrictionEvent,
  closeFrictionSession,
  computeFrictionBenchmark,
} from '../cognitiveFrictionAnalytics';

import { computeSimplicityCompressionBoard } from '../simplicityScoring';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMinimalReplay(overrides: Partial<DecisionReplay> = {}): DecisionReplay {
  return {
    schema: 'https://vitalcv.com/replay/v1',
    replayVersion: '1.0',
    capsuleId: 'capsule-chaos-001',
    subjectNpi: '1234567890',
    subjectDid: 'did:vitalcv:test',
    decisionType: 'EMPLOYER_ACCEPT',
    decisionTimestamp: '2026-01-01T00:00:00Z',
    status: 'ACTIVE',
    decision: {
      action: 'accept',
      outcome: 'ACCEPTED',
      triggerEvent: null,
      sourceReferenceId: null,
      organizationId: null,
      notes: null,
      deploymentContext: null,
    },
    verifierIdentity: {
      type: 'ORGANIZATION',
      systemId: 'sys-001',
      orgId: 'org-001',
      userId: null,
      confirmedBy: null,
      timestamp: '2026-01-01T00:00:00Z',
    },
    evidenceSnapshot: {
      credentialIds: [],
      evidenceRecords: [],
      sourcesConsulted: [],
      trustStateAtDecision: {
        trustBand: 'HIGH',
        trustScore: 90,
        readinessStatus: 'READY',
        capturedAt: '2026-01-01T00:00:00Z',
        methodology: 'v1',
      },
      anomaliesDetected: [],
    },
    integrity: {
      storedHash: 'abc123',
      recomputedHash: 'abc123',
      hashMatch: true,
      methodology: 'SHA-256',
      methodologyVersion: '1',
      verifiedAt: '2026-01-01T00:00:00Z',
      tamperEvidence: null,
    },
    authorityChain: [],
    relatedDecisions: [],
    replayedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  } as unknown as DecisionReplay;
}

// ── Workflow Simplification Layer ─────────────────────────────────────────────

describe('workflowSimplificationLayer — chaos', () => {
  it('fails closed on unknown intent', () => {
    const result = invokeWorkflow('destroy_everything', { entityId: 'e1', actorId: 'a1', orgId: null });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/unknown workflow intent/i);
    }
  });

  it('emits a trace with steps for known intent', () => {
    const result = invokeWorkflow('accept', { entityId: 'e2', actorId: 'a2', orgId: 'org-1' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.trace.steps.length).toBeGreaterThan(0);
      expect(result.trace.ambiguityPreserved).toBe(true);
    }
  });

  it('skips validatable steps when prior context is established', () => {
    const result = invokeWorkflow('accept', { entityId: 'e3', actorId: 'a3', orgId: null }, true);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const skipped = result.trace.steps.filter(s => s.status === 'skipped');
      expect(skipped.length).toBeGreaterThan(0);
      // Simplification gain must be positive when steps are skipped
      expect(result.trace.simplificationGain).toBeGreaterThan(0);
    }
  });

  it('does NOT skip steps without prior context — full canonical sequence', () => {
    const result = invokeWorkflow('accept', { entityId: 'e4', actorId: 'a4', orgId: null }, false);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const skipped = result.trace.steps.filter(s => s.status === 'skipped');
      expect(skipped.length).toBe(0);
    }
  });

  it('markStepAmbiguous surfaces ambiguity without discarding the step', () => {
    const result = invokeWorkflow('route_to_review', { entityId: 'e5', actorId: 'a5', orgId: null });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const updated = markStepAmbiguous(result.trace, 'classify_review_priority', 'Priority unclear: conflicting signals');
    const ambiguousStep = updated.steps.find(s => s.canonicalAction === 'classify_review_priority');

    expect(ambiguousStep).toBeDefined();
    expect(ambiguousStep?.status).toBe('ambiguous');
    expect(ambiguousStep?.ambiguityReason).toMatch(/conflicting signals/i);
    expect(updated.ambiguityPreserved).toBe(true);
  });

  it('reconstructs canonical lineage from a simplified trace', () => {
    const result = invokeWorkflow('accept', { entityId: 'e6', actorId: 'a6', orgId: null }, true);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const lineage = reconstructCanonicalLineage(result.trace);
    expect(lineage.length).toBeGreaterThan(0);
    // Must include emit_audit_event — always part of accept canonical chain
    expect(lineage).toContain('emit_audit_event');
  });

  it('handles empty entityId without throwing', () => {
    expect(() =>
      invokeWorkflow('accept', { entityId: '', actorId: 'a7', orgId: null }),
    ).not.toThrow();
  });
});

// ── Replay Abstraction Optimizer ───────────────────────────────────────────────

describe('replayAbstractionOptimizer — chaos', () => {
  it('produces a legibility score from a clean replay', () => {
    const replay = makeMinimalReplay();
    const optimized = optimizeReplayLegibility(replay);
    expect(optimized.legibilityScore.score).toBeGreaterThan(0);
    expect(optimized.verdict).toBe('clean_pass');
  });

  it('surfaces hash_mismatch verdict — does not hide integrity failure', () => {
    const replay = makeMinimalReplay({
      integrity: {
        storedHash: 'abc123',
        recomputedHash: 'deadbeef',
        hashMatch: false,
        methodology: 'SHA-256',
        methodologyVersion: '1',
        verifiedAt: '2026-01-01T00:00:00Z',
        tamperEvidence: 'computed hash differs',
      },
    });
    const optimized = optimizeReplayLegibility(replay);
    expect(optimized.verdict).toBe('hash_mismatch');
    // Legibility capped low on tamper
    expect(optimized.legibilityScore.score).toBeLessThanOrEqual(30);
    // Canonical bundle ALWAYS preserved
    expect(optimized.canonicalBundle.integrity.hashMatch).toBe(false);
  });

  it('detects stale_evidence and does not suppress it', () => {
    const replay = makeMinimalReplay({
      evidenceSnapshot: {
        credentialIds: [],
        sourcesConsulted: [],
        trustStateAtDecision: { trustBand: 'HIGH', trustScore: 90, readinessStatus: 'READY', capturedAt: null, methodology: 'v1' },
        anomaliesDetected: [],
        evidenceRecords: [
          {
            artifactId: 'art-001',
            source: 'NURSYS',
            sourceLabel: 'Nursys',
            status: 'EXPIRED',
            verifiedAt: '2025-01-01T00:00:00Z',
            expiresAt: '2026-01-01T00:00:00Z',
            credentialType: 'RN_LICENSE',
            jurisdiction: 'TX',
            sanitizedPayload: {},
          },
        ],
      },
    } as Partial<DecisionReplay>);
    const optimized = optimizeReplayLegibility(replay);
    expect(optimized.verdict).toBe('stale_evidence');
    // The expired artifact must appear as a retained narrative line
    const expiredLine = optimized.narrative.find(l => l.value.includes('EXPIRED'));
    expect(expiredLine).toBeDefined();
    expect(expiredLine?.retained).toBe(true);
  });

  it('attaches canonical bundle even when compressed heavily', () => {
    const replay = makeMinimalReplay({
      evidenceSnapshot: {
        credentialIds: [],
        sourcesConsulted: [],
        trustStateAtDecision: { trustBand: 'HIGH', trustScore: 90, readinessStatus: 'READY', capturedAt: null, methodology: 'v1' },
        anomaliesDetected: [],
        evidenceRecords: Array.from({ length: 20 }, (_, i) => ({
          artifactId: `art-${i}`,
          source: 'NURSYS',
          sourceLabel: 'Nursys',
          status: 'ACTIVE',
          verifiedAt: '2026-01-01T00:00:00Z',
          expiresAt: null,
          credentialType: 'RN_LICENSE',
          jurisdiction: 'TX',
          sanitizedPayload: {},
        })),
      },
    } as Partial<DecisionReplay>);
    const optimized = optimizeReplayLegibility(replay);
    expect(optimized.canonicalBundle.evidenceSnapshot?.evidenceRecords?.length).toBe(20);
    // Compressed should fold most active lines
    const retainedEvidence = optimized.narrative.filter(l => l.kind === 'evidence' && l.retained);
    expect(retainedEvidence.length).toBeLessThan(20);
  });
});

// ── Institutional UX Harmonizer ───────────────────────────────────────────────

describe('institutionalUxHarmonizer — chaos', () => {
  it('blocks banned terms and returns ok=false', () => {
    const result = harmonizeTerms(['automatically verified'], 'employer');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.bannedTerms.length).toBeGreaterThan(0);
    }
  });

  it('harmonizes "verified" differently per surface — no ambiguity flattening', () => {
    const employer = harmonizeTerm('verified', 'employer');
    const verifier = harmonizeTerm('verified', 'verifier');
    const issuer = harmonizeTerm('verified', 'issuer');
    // All three must produce distinct labels
    expect(employer?.harmonizedLabel).not.toBe(verifier?.harmonizedLabel);
    expect(employer?.harmonizedLabel).not.toBe(issuer?.harmonizedLabel);
  });

  it('passes through unknown terms unchanged without error', () => {
    const result = harmonizeTerms(['some_exotic_term_99'], 'employer');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.terms[0]?.harmonizedLabel).toBe('some_exotic_term_99');
      expect(result.terms[0]?.normalized).toBe(false);
    }
  });

  it('measureHarmonizationCoverage returns 1 for empty array', () => {
    expect(measureHarmonizationCoverage([], 'employer')).toBe(1);
  });

  it('measureHarmonizationCoverage is 0 when banned terms present', () => {
    expect(measureHarmonizationCoverage(['HIPAA compliant'], 'verifier')).toBe(0);
  });
});

// ── Cognitive Friction Analytics ───────────────────────────────────────────────

describe('cognitiveFrictionAnalytics — chaos', () => {
  it('returns null for events on non-existent session', () => {
    const event = recordFrictionEvent('ghost-session', 'escalation', {
      workflowIntent: 'accept',
      description: 'Stale session',
    });
    expect(event).toBeNull();
  });

  it('returns null when closing non-existent session', () => {
    expect(closeFrictionSession('ghost-session-2')).toBeNull();
  });

  it('scores 100 for a session with no friction events', () => {
    const sessionId = openFrictionSession('entity-001', 'actor-001');
    const summary = closeFrictionSession(sessionId);
    expect(summary?.frictionScore).toBe(100);
  });

  it('retries reduce friction score below 100', () => {
    const sessionId = openFrictionSession('entity-002', 'actor-002');
    recordFrictionEvent(sessionId, 'retry', { workflowIntent: 'accept', description: 'Network timeout retry' });
    recordFrictionEvent(sessionId, 'data_gap', { workflowIntent: 'accept', description: 'License not found in NURSYS' });
    const summary = closeFrictionSession(sessionId);
    expect(summary?.frictionScore).toBeLessThan(100);
  });

  it('computeFrictionBenchmark returns zero delta when no sessions', () => {
    const benchmark = computeFrictionBenchmark(80, []);
    expect(benchmark.deltaScore).toBe(0);
    expect(benchmark.currentScore).toBe(80);
  });
});

// ── Simplicity Compression Board ──────────────────────────────────────────────

describe('computeSimplicityCompressionBoard — chaos', () => {
  it('returns all zeros when all inputs are empty', () => {
    const board = computeSimplicityCompressionBoard(
      { traces: [] },
      { optimizedReplays: [] },
      { tracesWithAmbiguity: 0, tracesAmbiguitySurfaced: 0, replaysWithAmbiguousVerdict: 0, replaysAmbiguityRetained: 0 },
      { frictionSummaries: [], frictionBenchmark: null, harmonizationCoverage: 0 },
      { historicalWorkflowSimplicity: [], historicalReplayLegibility: [], historicalFrictionScore: [] },
    );
    expect(board.workflowSimplicity).toBe(0);
    expect(board.replayLegibility).toBe(0);
    expect(board.simplicityCompressionMaturity).toBe(0);
    expect(board.insights.verdict).toBe('INSUFFICIENT_DATA');
  });

  it('ambiguityPreservation is 100 when no ambiguity was encountered', () => {
    const board = computeSimplicityCompressionBoard(
      { traces: [] },
      { optimizedReplays: [] },
      { tracesWithAmbiguity: 0, tracesAmbiguitySurfaced: 0, replaysWithAmbiguousVerdict: 0, replaysAmbiguityRetained: 0 },
      { frictionSummaries: [], frictionBenchmark: null, harmonizationCoverage: 1 },
      { historicalWorkflowSimplicity: [], historicalReplayLegibility: [], historicalFrictionScore: [] },
    );
    expect(board.ambiguityPreservation).toBe(100);
  });

  it('ambiguityPreservation drops when ambiguity is flattened', () => {
    const board = computeSimplicityCompressionBoard(
      { traces: [] },
      { optimizedReplays: [] },
      {
        tracesWithAmbiguity: 10,
        tracesAmbiguitySurfaced: 3,  // 7 flattened
        replaysWithAmbiguousVerdict: 0,
        replaysAmbiguityRetained: 0,
      },
      { frictionSummaries: [], frictionBenchmark: null, harmonizationCoverage: 1 },
      { historicalWorkflowSimplicity: [], historicalReplayLegibility: [], historicalFrictionScore: [] },
    );
    expect(board.ambiguityPreservation).toBe(30);
  });

  it('derives COMPRESSING verdict when all dimensions are high', () => {
    const result = invokeWorkflow('accept', { entityId: 'e-board', actorId: 'a-board', orgId: null }, true);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const replay = optimizeReplayLegibility(makeMinimalReplay());
    const sessionId = openFrictionSession('e-board', 'a-board');
    const summary = closeFrictionSession(sessionId)!;

    const board = computeSimplicityCompressionBoard(
      { traces: [result.trace] },
      { optimizedReplays: [replay] },
      { tracesWithAmbiguity: 0, tracesAmbiguitySurfaced: 0, replaysWithAmbiguousVerdict: 0, replaysAmbiguityRetained: 0 },
      { frictionSummaries: [summary], frictionBenchmark: null, harmonizationCoverage: 1 },
      {
        historicalWorkflowSimplicity: [80, 82, 85],
        historicalReplayLegibility: [70, 72, 75],
        historicalFrictionScore: [88, 90, 91],
      },
    );

    expect(board.insights.verdict).toBe('COMPRESSING');
    expect(board.workflowSimplicity).toBeGreaterThan(0);
    expect(board.replayLegibility).toBeGreaterThan(0);
    expect(board.simplicityCompressionMaturity).toBeGreaterThan(0);
  });
});
