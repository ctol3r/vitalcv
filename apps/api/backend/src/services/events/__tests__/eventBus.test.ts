import { emit, on, __resetEventBusForTests } from '../eventBus';

jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
}));

describe('eventBus', () => {
  beforeEach(() => {
    __resetEventBusForTests();
  });

  it('fires registered handlers for the matching type', async () => {
    const handler = jest.fn();
    on('FOO', handler);
    await emit({ type: 'FOO', timestamp: '2026-04-14T00:00:00.000Z' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('does not fire handlers for other types', async () => {
    const foo = jest.fn();
    const bar = jest.fn();
    on('FOO', foo);
    on('BAR', bar);
    await emit({ type: 'FOO', timestamp: '2026-04-14T00:00:00.000Z' });
    expect(foo).toHaveBeenCalledTimes(1);
    expect(bar).not.toHaveBeenCalled();
  });

  it('continues firing other handlers when one throws', async () => {
    const boom = jest.fn(() => {
      throw new Error('boom');
    });
    const fine = jest.fn();
    on('FOO', boom);
    on('FOO', fine);
    await expect(
      emit({ type: 'FOO', timestamp: '2026-04-14T00:00:00.000Z' }),
    ).resolves.toBeUndefined();
    expect(boom).toHaveBeenCalled();
    expect(fine).toHaveBeenCalled();
  });

  it('unsubscribe removes the handler', async () => {
    const handler = jest.fn();
    const off = on('FOO', handler);
    off();
    await emit({ type: 'FOO', timestamp: '2026-04-14T00:00:00.000Z' });
    expect(handler).not.toHaveBeenCalled();
  });
});
