import { canMarkStartReady, canRecordStart, deriveStartState, type StartEvent } from '../startState';

const ev = (type: StartEvent['type'], at: string): StartEvent => ({ type, at });

describe('deriveStartState — folded from the event stream', () => {
  it('is not_ready with no events', () => {
    expect(deriveStartState([])).toBe('not_ready');
  });

  it('follows the happy path ready → started', () => {
    expect(deriveStartState([ev('START_READY', '2026-05-01T00:00:00Z')])).toBe('start_ready');
    expect(
      deriveStartState([ev('START_READY', '2026-05-01T00:00:00Z'), ev('START_RECORDED', '2026-05-02T00:00:00Z')]),
    ).toBe('started');
  });

  it('a cancellation supersedes a prior started (correction, not overwrite)', () => {
    expect(
      deriveStartState([
        ev('START_READY', '2026-05-01T00:00:00Z'),
        ev('START_RECORDED', '2026-05-02T00:00:00Z'),
        ev('START_CANCELLED', '2026-05-03T00:00:00Z'),
      ]),
    ).toBe('cancelled');
  });

  it('re-marking ready after a cancellation returns to start_ready', () => {
    expect(
      deriveStartState([
        ev('START_READY', '2026-05-01T00:00:00Z'),
        ev('START_CANCELLED', '2026-05-02T00:00:00Z'),
        ev('START_READY', '2026-05-03T00:00:00Z'),
      ]),
    ).toBe('start_ready');
  });

  it('folds by timestamp regardless of input order', () => {
    expect(
      deriveStartState([ev('START_RECORDED', '2026-05-02T00:00:00Z'), ev('START_READY', '2026-05-01T00:00:00Z')]),
    ).toBe('started');
  });
});

describe('start transition gates', () => {
  it('a start may only be recorded from start_ready', () => {
    expect(canRecordStart('start_ready')).toBe(true);
    expect(canRecordStart('not_ready')).toBe(false);
    expect(canRecordStart('started')).toBe(false);
    expect(canRecordStart('cancelled')).toBe(false);
  });

  it('start-ready may be marked from not_ready or cancelled, not while already ready/started', () => {
    expect(canMarkStartReady('not_ready')).toBe(true);
    expect(canMarkStartReady('cancelled')).toBe(true);
    expect(canMarkStartReady('start_ready')).toBe(false);
    expect(canMarkStartReady('started')).toBe(false);
  });
});
