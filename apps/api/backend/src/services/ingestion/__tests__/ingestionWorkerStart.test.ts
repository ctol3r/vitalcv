jest.mock('../../../graphql/prisma_client', () => ({ __esModule: true, default: {} }));
// Partial mock: the real connectors, but a mutable array one case can empty.
jest.mock('../ingestionRunner', () => ({
  ...jest.requireActual('../ingestionRunner'),
  FEED_CONNECTORS: [...jest.requireActual('../ingestionRunner').FEED_CONNECTORS],
}));

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

  it('still schedules with USAJOBS unset, because Greenhouse needs no credential', () => {
    /*
     * This case used to assert the opposite. Deleting the USAJOBS variables
     * WAS "no feed is configured", because USAJOBS was the only connector.
     * The Greenhouse boards endpoint is public, so that connector reports
     * configured with nothing set — and a deployment that has added no
     * credentials now ingests real clinical listings instead of staying dark.
     *
     * The invariant the old assertion protected — an unconfigured deployment
     * must not spin a timer — is still real, and is asserted below against a
     * connector set where genuinely nothing is configured.
     */
    delete process.env.USAJOBS_API_KEY;
    delete process.env.USAJOBS_USER_AGENT;

    const timeout = jest.spyOn(global, 'setTimeout');
    const interval = jest.spyOn(global, 'setInterval');

    startIngestionWorker();

    expect(timeout).toHaveBeenCalled();
    expect(interval).toHaveBeenCalled();

    timeout.mockRestore();
    interval.mockRestore();
  });

  it('schedules NOTHING when no connector is configured at all', () => {
    // An unconfigured deployment must stay silent, not fail on a timer. With a
    // credential-free connector in the roster this can no longer be produced by
    // unsetting env vars, so the connector list itself is emptied.
    delete process.env.USAJOBS_API_KEY;
    delete process.env.USAJOBS_USER_AGENT;

    const runner = jest.requireMock('../ingestionRunner') as { FEED_CONNECTORS: unknown[] };
    const saved = [...runner.FEED_CONNECTORS];
    runner.FEED_CONNECTORS.length = 0;

    const timeout = jest.spyOn(global, 'setTimeout');
    const interval = jest.spyOn(global, 'setInterval');

    startIngestionWorker();

    expect(timeout).not.toHaveBeenCalled();
    expect(interval).not.toHaveBeenCalled();

    runner.FEED_CONNECTORS.push(...saved);
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
