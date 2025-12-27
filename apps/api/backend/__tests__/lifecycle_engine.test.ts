import * as auditEvents from '../src/api/audit/lifecycle-events';
import { LifecycleEngine, PulseEvent } from '../src/api/lifecycle/engine';
import { LifecycleScheduler } from '../src/api/lifecycle/scheduler';
import { lifecyclePhase, renewalWindowOpensAt } from '../src/api/lifecycle/rules';

const baseLifecycle = {
  expiresAt: new Date('2024-02-15T00:00:00.000Z'),
  renewalWindowDays: 10,
  renewalSteps: [],
};

const authority = {
  id: 'state-medical-board',
  name: 'State Medical Board',
};

describe('lifecycle rules', () => {
  it('computes ACTIVE, RENEWAL_WINDOW, EXPIRED based on asOf date', () => {
    const windowStart = renewalWindowOpensAt(baseLifecycle);
    expect(lifecyclePhase(baseLifecycle, new Date('2024-01-20T00:00:00Z'))).toBe('ACTIVE');
    expect(lifecyclePhase(baseLifecycle, windowStart)).toBe('RENEWAL_WINDOW');
    expect(lifecyclePhase(baseLifecycle, new Date('2024-02-16T00:00:00Z'))).toBe('EXPIRED');
  });
});

describe('LifecycleEngine', () => {
  it('emits renewal window events once when entering the window', async () => {
    const emitted: PulseEvent[] = [];
    const engine = new LifecycleEngine({
      clock: () => new Date('2024-02-08T00:00:00Z'),
      pulseEmitter: { emit: (evt) => emitted.push(evt) },
    });

    const result = await engine.evaluate(
      { credentialId: 'cred-123', authority, lifecycle: baseLifecycle },
      'ACTIVE',
    );

    expect(result.status).toBe('RENEWAL_WINDOW');
    expect(emitted.map((e) => e.type).sort()).toEqual([
      'CREDENTIAL_EXPIRING_SOON',
      'RENEWAL_WINDOW_OPEN',
    ]);
  });

  it('emits expiration event when transitioning to expired', async () => {
    const emitted: PulseEvent[] = [];
    const engine = new LifecycleEngine({
      clock: () => new Date('2024-02-20T00:00:00Z'),
      pulseEmitter: { emit: (evt) => emitted.push(evt) },
    });

    const result = await engine.evaluate(
      { credentialId: 'cred-456', authority, lifecycle: baseLifecycle },
      'RENEWAL_WINDOW',
    );

    expect(result.status).toBe('EXPIRED');
    expect(emitted.map((e) => e.type)).toEqual(['CREDENTIAL_EXPIRED']);
  });
});

describe('LifecycleScheduler', () => {
  it('runs evaluations deterministically and calls onEvaluation', async () => {
    const emitted: PulseEvent[] = [];
    const engine = new LifecycleEngine({
      clock: () => new Date('2024-02-08T00:00:00Z'),
      pulseEmitter: { emit: (evt) => emitted.push(evt) },
    });

    const evaluations: string[] = [];
    const scheduler = new LifecycleScheduler({
      engine,
      loadSubjects: async () => [
        { credentialId: 'cred-1', authority, lifecycle: baseLifecycle, previousStatus: 'ACTIVE' },
        { credentialId: 'cred-2', authority, lifecycle: baseLifecycle, previousStatus: 'ACTIVE' },
      ],
      onEvaluation: (result) => {
        evaluations.push(`${result.credentialId}:${result.status}`);
      },
    });

    const results = await scheduler.runCycle();

    expect(results).toHaveLength(2);
    expect(evaluations).toEqual(['cred-1:RENEWAL_WINDOW', 'cred-2:RENEWAL_WINDOW']);
    expect(emitted.filter((e) => e.type === 'RENEWAL_WINDOW_OPEN')).toHaveLength(2);
  });

  it('can be wired with the audit pulse emitter for persistence', async () => {
    const auditSpy = jest
      .spyOn(auditEvents, 'recordLifecyclePulseEvent')
      .mockResolvedValue({ hash: 'test-hash', recordedAt: new Date().toISOString() });
    const emitter = new auditEvents.AuditPulseEmitter();
    const engine = new LifecycleEngine({
      clock: () => new Date('2024-02-20T00:00:00Z'),
      pulseEmitter: emitter,
    });

    const scheduler = new LifecycleScheduler({
      engine,
      loadSubjects: async () => [
        { credentialId: 'cred-3', authority, lifecycle: baseLifecycle, previousStatus: 'RENEWAL_WINDOW' },
      ],
    });

    const results = await scheduler.runCycle();
    expect(results[0].status).toBe('EXPIRED');
    expect(auditSpy).toHaveBeenCalled();
    auditSpy.mockRestore();
  });
});
