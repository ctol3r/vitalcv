jest.mock('../../../graphql/prisma_client', () => ({ __esModule: true, default: {} }));

import { startIngestionWorker, stopIngestionWorker } from '../../../workers/ingestionWorker';

/**
 * The worker schedules a run shortly after boot, then on the interval.
 *
 * Without the boot run, configuring a feed produced nothing for six hours —
 * and the admin HTTP trigger is no escape hatch, because every /api/admin
 * route sits behind the org-context middleware and is unreachable from
 * outside the service. Setting the credentials has to be sufficient on its own.
 *
 * startIngestionWorker returns early under NODE_ENV=test (so suites never open
 * timers), so these cases move it aside deliberately and restore it after.
 */
describe('startIngestionWorker scheduling', () => {
  const savedEnv = {
    nodeEnv: process.env.NODE_ENV,
    key: process.env.USAJOBS_API_KEY,
    agent: process.env.USAJOBS_USER_AGENT,
  };

  beforeEach(() => {
    jest.useFakeTimers();
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
  });

  afterEach(() => {
    stopIngestionWorker();
    jest.useRealTimers();
    (process.env as Record<string, string | undefined>).NODE_ENV = savedEnv.nodeEnv;
    process.env.USAJOBS_API_KEY = savedEnv.key;
    process.env.USAJOBS_USER_AGENT = savedEnv.agent;
  });

  it('schedules BOTH a boot run and a recurring interval once a feed is configured', () => {
    process.env.USAJOBS_API_KEY = 'test-key';
    process.env.USAJOBS_USER_AGENT = 'ops@example.com';

    const timeout = jest.spyOn(global, 'setTimeout');
    const interval = jest.spyOn(global, 'setInterval');

    startIngestionWorker(6 * 60 * 60 * 1000);

    // The boot run — the whole point of this change.
    expect(timeout).toHaveBeenCalledWith(expect.any(Function), 60_000);
    expect(interval).toHaveBeenCalledWith(expect.any(Function), 6 * 60 * 60 * 1000);

    timeout.mockRestore();
    interval.mockRestore();
  });

  it('schedules NOTHING when no feed is configured', () => {
    // An unconfigured deployment must stay silent, not fail on a timer.
    delete process.env.USAJOBS_API_KEY;
    delete process.env.USAJOBS_USER_AGENT;

    const timeout = jest.spyOn(global, 'setTimeout');
    const interval = jest.spyOn(global, 'setInterval');

    startIngestionWorker();

    expect(timeout).not.toHaveBeenCalled();
    expect(interval).not.toHaveBeenCalled();

    timeout.mockRestore();
    interval.mockRestore();
  });

  it('does not stack timers when called twice', () => {
    process.env.USAJOBS_API_KEY = 'test-key';
    process.env.USAJOBS_USER_AGENT = 'ops@example.com';

    startIngestionWorker();
    const interval = jest.spyOn(global, 'setInterval');
    startIngestionWorker();

    expect(interval).not.toHaveBeenCalled();
    interval.mockRestore();
  });
});
