import { initDetailAgents, shutdownDetailAgents } from '../detailAgentEngine';

describe('detailAgentEngine', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    shutdownDetailAgents();
    jest.restoreAllMocks();
  });

  it('does not start background intervals in test mode', () => {
    process.env.NODE_ENV = 'test';
    const setIntervalSpy = jest.spyOn(global, 'setInterval');

    initDetailAgents();

    expect(setIntervalSpy).not.toHaveBeenCalled();
  });
});
