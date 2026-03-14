jest.mock('../greenhouse', () => ({
  addGreenhouseNote: jest.fn(),
  tagGreenhouseCandidate: jest.fn(),
}));

jest.mock('../lever', () => ({
  addLeverNote: jest.fn(),
  addLeverTag: jest.fn(),
}));

jest.mock('../workday', () => ({
  getWorkdayAccessToken: jest.fn(),
  updateWorkdayWorkerNote: jest.fn(),
}));

jest.mock('../icims', () => ({
  addICIMSNote: jest.fn(),
}));

import { addGreenhouseNote } from '../greenhouse';
import { notifyAts } from '../atsRegistry';

const addGreenhouseNoteMock = addGreenhouseNote as jest.MockedFunction<
  typeof addGreenhouseNote
>;

const originalEnv = process.env;

describe('atsRegistry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.GREENHOUSE_API_KEY;
    delete process.env.LEVER_API_KEY;
    delete process.env.WORKDAY_TENANT;
    delete process.env.WORKDAY_CLIENT_ID;
    delete process.env.WORKDAY_SECRET;
    delete process.env.ICIMS_CUSTOMER_ID;
    delete process.env.ICIMS_USERNAME;
    delete process.env.ICIMS_PASSWORD;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('skips silently when required env vars are not set', async () => {
    const result = await notifyAts({
      type: 'greenhouse',
      candidateId: 'cand-1',
      action: 'add_note',
      value: 'VitalCV verified this candidate.',
    });

    expect(result).toEqual({ notified: false, skipped: true });
    expect(addGreenhouseNoteMock).not.toHaveBeenCalled();
  });

  it('routes add_note calls to the configured greenhouse adapter', async () => {
    process.env.GREENHOUSE_API_KEY = 'gh-api-key';
    addGreenhouseNoteMock.mockResolvedValue(true);

    const result = await notifyAts({
      type: 'greenhouse',
      candidateId: 'cand-2',
      action: 'add_note',
      value: 'VitalCV passport verified.',
    });

    expect(addGreenhouseNoteMock).toHaveBeenCalledWith(
      'cand-2',
      'VitalCV passport verified.',
      'gh-api-key',
    );
    expect(result).toEqual({ notified: true, skipped: false });
  });
});
