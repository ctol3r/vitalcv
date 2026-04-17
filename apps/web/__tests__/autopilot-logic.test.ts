import { describe, expect, it } from 'vitest';
import {
  deriveAutopilotSteps,
  deriveBlockers,
} from '../components/passport/StartabilityCard';
import type { IngestStreamState } from '../hooks/useIngestStream';

describe('autopilot logic', () => {
  it('handles sparse state safely with fallback defaults', () => {
    const sparseState = {
      readiness: undefined,
      sources: undefined,
      standing: undefined,
    } as unknown as IngestStreamState;

    expect(() => deriveBlockers(sparseState)).not.toThrow();
    expect(() => deriveAutopilotSteps(sparseState)).not.toThrow();
    expect(deriveBlockers(sparseState)).toEqual(['Medicare enrollment unresolved']);
    // deriveAutopilotSteps now renders owner-prefixed lines from the
    // actor-ownership contract (action-owner.ts), not bare "Fix PECOS"
    // imperatives. The sparse-state blocker ("Medicare enrollment
    // unresolved") is SOURCE-owned — PECOS refreshes quarterly — so the
    // autopilot line names the owner, not the clinician.
    expect(deriveAutopilotSteps(sparseState)).toEqual(['CMS PECOS is refreshing']);
  });

  it('keeps blocker and directive order deterministic while surfacing per-owner directives', () => {
    const state = {
      phase: 'done',
      identity: { authoritative: true },
      standing: {
        exclusionChecked: true,
        exclusionClear: false,
        enrollmentChecked: true,
        enrollmentStatus: 'not_enrolled',
      },
      readiness: {
        status: 'INCOMPLETE',
        blockerCount: 3,
      },
      sources: {
        nppes: 'done',
        oig: 'error',
        pecos: 'checking',
      },
      events: [],
      isUsable: true,
      disconnected: false,
      completedAt: '2026-04-16T12:00:00.000Z',
    } as IngestStreamState;

    expect(deriveBlockers(state)).toEqual([
      'Exclusion check failed',
      'On OIG exclusion list',
      'Medicare enrollment unresolved',
      'Not enrolled in Medicare',
    ]);

    // Each blocker resolves through resolveBlockerOwnership → ownerPrefix.
    // "Medicare enrollment unresolved" and "Not enrolled in Medicare" are
    // separate owners (SOURCE vs USER), so they render as distinct lines —
    // the prior "Fix PECOS" dedupe was collapsing a truthful ownership
    // distinction into a single imperative. State board is institution-
    // owned and tacked on once the run completes.
    expect(deriveAutopilotSteps(state)).toEqual([
      'VitalCV is retrying the OIG check',
      'You need to resolve this exclusion with the OIG',
      'CMS PECOS is refreshing',
      'You need to enroll in Medicare through PECOS',
      'Your employer or institution covers state-board verification for now',
    ]);
  });
});
