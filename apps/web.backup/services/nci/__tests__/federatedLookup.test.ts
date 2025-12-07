import axios from 'axios';
import { runFederatedLookup } from '../federatedLookup';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('runFederatedLookup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty aggregate when no nodes configured', async () => {
    const result = await runFederatedLookup({ npi: '12345' });

    expect(result.nodes).toHaveLength(0);
    expect(result.aggregated.licenseRecords).toHaveLength(0);
  });

  it('aggregates successful node responses', async () => {
    mockedAxios.request.mockResolvedValueOnce({
      status: 200,
      data: {
        licenseRecords: [
          {
            state: 'CA',
            licenseNumber: 'A1',
            status: 'ACTIVE',
          },
        ],
        trustAnchors: [
          {
            type: 'STATE_BOARD',
            source: 'CA Board',
            referenceId: 'A1',
          },
        ],
      },
    });

    const result = await runFederatedLookup({
      npi: '123',
      nodes: [
        {
          id: 'node-1',
          endpoint: 'https://example.org/nci',
        },
      ],
    });

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].status).toBe('ok');
    expect(result.aggregated.licenseRecords).toHaveLength(1);
    expect(result.aggregated.trustAnchors).toHaveLength(1);
  });
});

