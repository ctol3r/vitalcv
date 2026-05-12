/**
 * actorAttributionSurvivability.test.ts
 *
 * Invariant: actor_id set on a LearningEvent write is persisted to the DB
 * (via metadata.actor_id) and survives a simulated runtime restart.
 *
 * Strategy: mock Prisma so no real DB is required, then exercise the
 * emitLearningEvent → prisma.learningEvent.upsert path and assert that
 * the actor_id is present in the persisted metadata after restart.
 */

// ── Prisma mock (must be declared before any imports that pull prisma) ─────────

const captured: Array<Record<string, unknown>> = [];

const mockUpsert = jest.fn(async (args: { create?: Record<string, unknown> }) => {
  if (args.create) {
    captured.push(args.create);
  }
  return args.create ?? {};
});

jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    learningEvent: {
      upsert: mockUpsert,
    },
  },
}));

// ── Import after mock registration ────────────────────────────────────────────

import { emitLearningEvent } from '../../feedback/prismaEventStore';

// ── Helpers ───────────────────────────────────────────────────────────────────

function drainCaptures(): Array<Record<string, unknown>> {
  const out = [...captured];
  captured.length = 0;
  return out;
}

/** Flush all pending microtasks (fire-and-forget upsert completes). */
async function flushAsync(): Promise<void> {
  await new Promise<void>((r) => setTimeout(r, 10));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('actor_id attribution survivability', () => {
  beforeEach(() => {
    captured.length = 0;
    mockUpsert.mockClear();
  });

  it('persists actor_id in metadata.actor_id on LearningEvent upsert', async () => {
    const actorId = 'user_clerk_abc123';

    emitLearningEvent({
      type: 'NPI_CHECKED',
      providerId: 'provider-001',
      timestamp: new Date('2024-01-15T10:00:00Z'),
      metadata: { actor_id: actorId },
      payload: { actor_id: actorId },
    });

    await flushAsync();

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const persisted = drainCaptures()[0];
    expect(persisted).toBeDefined();

    const meta = persisted['metadata'] as Record<string, unknown>;
    expect(meta).toBeDefined();
    expect(meta['actor_id']).toBe(actorId);
  });

  it('actor_id survives simulated restart: second emit for same event is deduped, first actor_id wins', async () => {
    const actorId1 = 'user_clerk_first';
    const actorId2 = 'user_clerk_second';

    // First write (pre-restart)
    emitLearningEvent({
      type: 'PROFILE_VIEWED',
      providerId: 'provider-002',
      timestamp: new Date('2024-01-15T11:00:00Z'),
      metadata: { actor_id: actorId1 },
      payload: { actor_id: actorId1 },
    });

    await flushAsync();

    const firstCaptures = drainCaptures();
    expect(firstCaptures).toHaveLength(1);
    const firstMeta = firstCaptures[0]['metadata'] as Record<string, unknown>;
    expect(firstMeta['actor_id']).toBe(actorId1);

    // Simulate restart: same event re-emitted (upsert contract: update: {} means no-op on conflict)
    emitLearningEvent({
      type: 'PROFILE_VIEWED',
      providerId: 'provider-002',
      timestamp: new Date('2024-01-15T11:00:00Z'),
      metadata: { actor_id: actorId2 },
      payload: { actor_id: actorId2 },
    });

    await flushAsync();

    // Upsert was called again but update: {} means first write wins
    expect(mockUpsert).toHaveBeenCalledTimes(2);
    const secondCall = mockUpsert.mock.calls[1] as [{ update: Record<string, unknown> }];
    const updateArg = secondCall[0]['update'];
    // Verify the upsert update block is empty (no-op on restart replay)
    expect(Object.keys(updateArg)).toHaveLength(0);
  });

  it('actor_id is absent from persisted record when not provided (unauthenticated path rejected upstream)', async () => {
    // This test documents the invariant: if no actor_id is in metadata,
    // the learningTrack route would have rejected the call (401).
    // Here we verify the store does NOT invent an actor_id.
    emitLearningEvent({
      type: 'JOB_CLICKED',
      providerId: 'provider-003',
      timestamp: new Date('2024-01-15T12:00:00Z'),
      metadata: {},
      payload: {},
    });

    await flushAsync();

    const captures = drainCaptures();
    expect(captures).toHaveLength(1);
    const meta = captures[0]['metadata'] as Record<string, unknown>;
    expect(meta['actor_id']).toBeUndefined();
  });

  it('multiple actors writing concurrent events each carry their own actor_id', async () => {
    const actors = ['user_a', 'user_b', 'user_c'];

    for (const actor of actors) {
      emitLearningEvent({
        type: 'NPI_CHECKED',
        providerId: `provider-${actor}`,
        timestamp: new Date(),
        metadata: { actor_id: actor },
        payload: { actor_id: actor },
      });
    }

    await flushAsync();

    const captures = drainCaptures();
    expect(captures).toHaveLength(3);

    for (let i = 0; i < actors.length; i++) {
      const meta = captures[i]?.['metadata'] as Record<string, unknown>;
      expect(meta?.['actor_id']).toBe(actors[i]);
    }
  });
});
