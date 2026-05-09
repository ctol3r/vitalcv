/**
 * integrityGates.ts — W2-PR44A
 *
 * Aggregates all lifecycle integrity checks into a single pass/fail report
 * suitable for CI gating.
 *
 * Gate composition:
 *   - Hash integrity: every event's stored hash must match its recomputed hash
 *   - Continuity invariants: every node passes checkArtifactContinuity
 *   - Dangling supersession edges: must be empty
 *   - Renewal ambiguity: no flattened renewals
 *   - Archival lineage: archived artifacts must have reconstructable predecessor chain
 *   - Replay determinism: replay must be stable across runs
 */

import type {
  LifecycleGraph,
  LifecycleIntegrityReport,
  RenewalInterpretation,
} from './types';
import { computeEventHash } from './lifecycleGraph';
import { checkAllContinuity } from './artifactContinuity';
import { detectFlattenedAmbiguity } from './renewalSemantics';
import { findDanglingSupersessionEdges, reconstructLineage } from './supersessionLineage';
import { replayLifecycle, verifyReplayDeterminism } from './lifecycleReplay';

export interface IntegrityGateInput {
  graph: LifecycleGraph;
  renewalInterpretations: ReadonlyArray<RenewalInterpretation>;
  asOf?: Date;
}

export function runLifecycleIntegrityGate(
  input: IntegrityGateInput,
): LifecycleIntegrityReport {
  const generatedAt = new Date().toISOString();
  const asOf = input.asOf ?? new Date();

  const invariantsViolated: LifecycleIntegrityReport['invariantsViolated'] = [];
  const hashMismatches: LifecycleIntegrityReport['hashMismatches'] = [];
  const archivalLineageBroken: string[] = [];

  let eventCount = 0;

  // ── Continuity ────────────────────────────────────────────────
  const continuityReports = checkAllContinuity(input.graph);
  for (const r of continuityReports) {
    for (const inv of r.invariantsViolated) {
      invariantsViolated.push({
        artifactId: r.artifactId,
        invariant: inv,
        detail: `continuity invariant violated: ${inv}`,
      });
    }
  }

  // ── Hash integrity ────────────────────────────────────────────
  for (const node of input.graph.nodes.values()) {
    eventCount += node.events.length;
    for (const event of node.events) {
      const { eventHash, ...rest } = event;
      const recomputed = computeEventHash(rest);
      if (recomputed !== eventHash) {
        hashMismatches.push({
          artifactId: node.artifactId,
          eventId: event.eventId,
          storedHash: eventHash,
          recomputedHash: recomputed,
        });
      }
    }
  }

  // ── Dangling supersession edges ───────────────────────────────
  const dangling = findDanglingSupersessionEdges(input.graph);
  for (const d of dangling) {
    invariantsViolated.push({
      artifactId: d.edgeKey,
      invariant: 'supersession_edge_endpoint_present',
      detail: `dangling endpoint: ${d.missingEndpoint}`,
    });
  }

  // ── Renewal ambiguity preservation ────────────────────────────
  const ambiguousRenewalsFlattened = detectFlattenedAmbiguity(input.renewalInterpretations);

  // ── Archival lineage reconstructability ───────────────────────
  for (const node of input.graph.nodes.values()) {
    if (node.state !== 'archived') continue;
    const lineage = reconstructLineage(input.graph, node.artifactId);
    const expectsAncestors = node.events.some(
      e => (e.eventType === 'renewed' || e.eventType === 'superseded') && e.predecessorArtifactId !== null,
    );
    if (expectsAncestors && lineage.ancestors.length === 0) {
      archivalLineageBroken.push(node.artifactId);
    }
    // Lineage is also broken if ANY ancestor in the chain references an
    // artifact that is not present in the node set. The chain can be
    // walked but it points into a void.
    const ghostAncestors = lineage.ancestors.filter(a => !input.graph.nodes.has(a.artifactId));
    if (ghostAncestors.length > 0 && !archivalLineageBroken.includes(node.artifactId)) {
      archivalLineageBroken.push(node.artifactId);
    }
    if (lineage.cycleDetected) {
      invariantsViolated.push({
        artifactId: node.artifactId,
        invariant: 'archival_lineage_acyclic',
        detail: 'cycle detected in archival lineage',
      });
    }
  }

  // ── Replay determinism ────────────────────────────────────────
  const det = verifyReplayDeterminism({ graph: input.graph, asOf });
  if (!det.deterministic) {
    for (const id of det.divergentFrames) {
      invariantsViolated.push({
        artifactId: id,
        invariant: 'replay_determinism',
        detail: 'replay frame hash diverged across runs',
      });
    }
  }

  // Confirm replay covers a non-zero set when artifacts exist (catches
  // "replay returned nothing" silently passing).
  const frames = replayLifecycle({ graph: input.graph, asOf });
  if (input.graph.nodes.size > 0 && frames.length === 0) {
    invariantsViolated.push({
      artifactId: '*',
      invariant: 'replay_non_empty_when_artifacts_present',
      detail: 'replay produced no frames despite non-empty graph',
    });
  }

  const passed =
    invariantsViolated.length === 0 &&
    hashMismatches.length === 0 &&
    ambiguousRenewalsFlattened.length === 0 &&
    archivalLineageBroken.length === 0;

  return {
    organizationId: input.graph.organizationId,
    generatedAt,
    artifactCount: input.graph.nodes.size,
    eventCount,
    supersessionEdgeCount: input.graph.supersessionEdges.length,
    invariantsViolated,
    hashMismatches,
    ambiguousRenewalsFlattened,
    archivalLineageBroken,
    passed,
  };
}

/**
 * Format the report as a single-line JSON summary suitable for stdout in CI.
 * Returns the JSON string and an exit code (0 = pass, 1 = fail).
 */
export function formatGateOutput(report: LifecycleIntegrityReport): {
  json: string;
  exitCode: 0 | 1;
} {
  return {
    json: JSON.stringify({
      gate: 'lifecycle-integrity',
      passed: report.passed,
      generatedAt: report.generatedAt,
      organizationId: report.organizationId,
      artifactCount: report.artifactCount,
      eventCount: report.eventCount,
      supersessionEdgeCount: report.supersessionEdgeCount,
      invariantsViolatedCount: report.invariantsViolated.length,
      hashMismatchCount: report.hashMismatches.length,
      ambiguousRenewalsFlattened: report.ambiguousRenewalsFlattened.length,
      archivalLineageBroken: report.archivalLineageBroken.length,
    }),
    exitCode: report.passed ? 0 : 1,
  };
}
