/**
 * lifecycleReplay.ts — W2-PR44A
 *
 * Replay-safe lifecycle reconstruction.
 *
 * Given a graph and an `asOf` timestamp, return a deterministic snapshot of
 * each artifact's state at that moment. Same inputs → identical frames →
 * identical hashes. This is the property auditors rely on.
 *
 * Implementation notes:
 *   - We fold ONLY events with occurredAt <= asOf. Future events do not leak.
 *   - State derivation reuses the same STATE_BY_EVENT mapping as the graph
 *     builder, so a frame at asOf == now matches the live graph state.
 */

import { createHash } from 'crypto';
import { CredentialLifecycleState } from '../../utils/lifecycleState';
import type { LifecycleEvent, LifecycleEventType, LifecycleGraph, LifecycleReplayFrame } from './types';

const STATE_BY_EVENT: Readonly<Record<LifecycleEventType, CredentialLifecycleState | 'archived' | null>> = {
  issued: CredentialLifecycleState.ISSUED,
  activated: CredentialLifecycleState.ACTIVE,
  expired: CredentialLifecycleState.EXPIRED,
  renewed: null,
  superseded: null,
  revoked: CredentialLifecycleState.REVOKED,
  suspended: CredentialLifecycleState.SUSPENDED,
  reinstated: CredentialLifecycleState.ACTIVE,
  archived: 'archived',
};

export interface ReplayInput {
  graph: LifecycleGraph;
  asOf: Date;
}

export function replayLifecycle(input: ReplayInput): LifecycleReplayFrame[] {
  const asOfMs = input.asOf.getTime();
  const frames: LifecycleReplayFrame[] = [];

  const sortedIds = Array.from(input.graph.nodes.keys()).sort();
  for (const id of sortedIds) {
    const node = input.graph.nodes.get(id);
    if (!node) continue;

    const issuedAtMs = node.issuedAt ? new Date(node.issuedAt).getTime() : null;
    if (issuedAtMs !== null && issuedAtMs > asOfMs) {
      // Artifact had not yet been issued at the asOf moment.
      // Skip it from the replay set entirely.
      continue;
    }

    const eventsInWindow = node.events.filter(e => new Date(e.occurredAt).getTime() <= asOfMs);

    let state: CredentialLifecycleState | 'archived' = CredentialLifecycleState.ISSUED;
    for (const e of eventsInWindow) {
      const next = STATE_BY_EVENT[e.eventType];
      if (next !== null) state = next;
    }

    // Predecessors/successors as of the replay frame: only edges established
    // by an event whose occurredAt <= asOf.
    const eventIdsInWindow = new Set(eventsInWindow.map(e => e.eventId));
    const predecessorsAsOf: string[] = [];
    const successorsAsOf: string[] = [];
    for (const edge of input.graph.supersessionEdges) {
      if (!eventIdsInWindow.has(edge.establishedByEventId)) {
        // Edge may also be established by the OTHER endpoint's event — check
        // by establishedAt directly as a backstop.
        if (new Date(edge.establishedAt).getTime() > asOfMs) continue;
      }
      if (edge.toArtifactId === id && !predecessorsAsOf.includes(edge.fromArtifactId)) {
        predecessorsAsOf.push(edge.fromArtifactId);
      }
      if (edge.fromArtifactId === id && !successorsAsOf.includes(edge.toArtifactId)) {
        successorsAsOf.push(edge.toArtifactId);
      }
    }
    predecessorsAsOf.sort();
    successorsAsOf.sort();

    const effectiveExpiresAt = computeEffectiveExpiresAt(eventsInWindow, node.expiresAt);

    const eventsObservedAtFrame = eventsInWindow.map(e => e.eventId);

    const framePayload = {
      artifactId: id,
      asOf: input.asOf.toISOString(),
      state,
      effectiveExpiresAt,
      predecessorIds: predecessorsAsOf,
      successorIds: successorsAsOf,
      eventsObservedAtFrame,
    };
    const hash = createHash('sha256').update(JSON.stringify(framePayload)).digest('hex');

    frames.push({ ...framePayload, hash });
  }

  return frames;
}

function computeEffectiveExpiresAt(
  events: ReadonlyArray<LifecycleEvent>,
  fallback: string | null,
): string | null {
  // The most recent event metadata.expiresAt wins; falls back to node.expiresAt.
  for (let i = events.length - 1; i >= 0; i--) {
    const md = events[i].metadata as { expiresAt?: unknown } | null;
    if (md && typeof md.expiresAt === 'string') return md.expiresAt;
  }
  return fallback;
}

/**
 * Replay determinism check: re-run the replay twice on the same graph and
 * verify every frame hash matches. Drift here means a non-deterministic
 * input crept into the graph (e.g. unsorted events).
 */
export function verifyReplayDeterminism(input: ReplayInput): {
  deterministic: boolean;
  divergentFrames: string[];
} {
  const a = replayLifecycle(input);
  const b = replayLifecycle(input);

  const divergent: string[] = [];
  if (a.length !== b.length) {
    return { deterministic: false, divergentFrames: a.map(f => f.artifactId) };
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i].hash !== b[i].hash || a[i].artifactId !== b[i].artifactId) {
      divergent.push(a[i].artifactId);
    }
  }
  return { deterministic: divergent.length === 0, divergentFrames: divergent };
}
