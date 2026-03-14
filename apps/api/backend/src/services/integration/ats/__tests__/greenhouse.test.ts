jest.mock('../../../../obs/logger', () => ({
  log: jest.fn(),
}));

import {
  addGreenhouseNote,
  getGreenhouseCandidate,
} from '../greenhouse';

const fetchMock = jest.fn();

describe('greenhouse adapter', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('uses Harvest basic auth with apiKey colon for candidate reads', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ id: 42 }),
    });

    await getGreenhouseCandidate('42', 'gh-secret');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;

    expect(headers.Authorization).toBe(
      `Basic ${Buffer.from('gh-secret:').toString('base64')}`,
    );
  });

  it('uses the same auth header when posting greenhouse notes', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 201,
    });

    await addGreenhouseNote('42', 'passport verified', 'gh-secret');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;

    expect(url).toBe(
      'https://harvest.greenhouse.io/v1/candidates/42/activity_feed/notes',
    );
    expect(headers.Authorization).toBe(
      `Basic ${Buffer.from('gh-secret:').toString('base64')}`,
    );
  });
});
