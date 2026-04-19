import { beforeEach, describe, expect, it, vi } from 'vitest';
import { writeCapsule } from '@/lib/capsules';
import {
  executePassportAction,
  shouldReleasePassportAction,
} from '@/lib/trust/passport-action-execution';

vi.mock('@/lib/capsules', () => ({
  writeCapsule: vi.fn(),
}));

const writeCapsuleMock = vi.mocked(writeCapsule);

describe('passport action execution', () => {
  beforeEach(() => {
    writeCapsuleMock.mockReset();
  });

  it('logs intent and re-triggers Omega for an allowed blocker', async () => {
    writeCapsuleMock.mockResolvedValue({ ok: true, capsuleId: 'capsule-1' });
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });

    const result = await executePassportAction({
      blocker: 'Medicare enrollment unresolved',
      allowedBlockers: ['Medicare enrollment unresolved', 'On OIG exclusion list'],
      subjectNpi: '1234567890',
      readinessScoreBefore: 61,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(writeCapsuleMock).toHaveBeenCalledWith({
      subjectNpi: '1234567890',
      decisionType: 'DEPLOYMENT',
      triggerEvent: 'start_attestation',
      metadata: {
        source: 'passport.action-panel',
        intent: 'resolve_blocker',
        blocker: 'Medicare enrollment unresolved',
        readinessScoreBefore: 61,
      },
    });
    expect(fetchImpl).toHaveBeenCalledWith('/api/omega', expect.objectContaining({
      method: 'POST',
    }));
    expect(result).toEqual({
      blocker: 'Medicare enrollment unresolved',
      capsuleRecorded: true,
      omegaTriggered: true,
    });
  });

  it('rejects unknown blockers instead of executing an unsafe action', async () => {
    const fetchImpl = vi.fn();

    await expect(executePassportAction({
      blocker: 'Invented blocker',
      allowedBlockers: ['Medicare enrollment unresolved'],
      subjectNpi: '1234567890',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })).rejects.toThrow('Unknown blocker action');

    expect(writeCapsuleMock).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('releases the optimistic action state when recompute completes without score drift', () => {
    expect(shouldReleasePassportAction({
      resolvingBlocker: 'Medicare enrollment unresolved',
      baselineReadinessScore: 61,
      currentReadinessScore: 61,
      phase: 'done',
      isUsable: false,
      completedAt: '2026-04-16T10:00:00.000Z',
      readyAt: null,
    })).toBe(true);
  });

  it('keeps the optimistic action state while recompute is still in flight', () => {
    expect(shouldReleasePassportAction({
      resolvingBlocker: 'Medicare enrollment unresolved',
      baselineReadinessScore: 61,
      currentReadinessScore: 61,
      phase: 'pecos',
      isUsable: false,
      completedAt: null,
      readyAt: null,
    })).toBe(false);
  });
});
