import express from 'express';
import request from 'supertest';

jest.mock('../../services/detailAgents/detailAgentEngine', () => ({
  getSystemHealthSummary: jest.fn(),
  getRecentReports: jest.fn(),
  getDetailAgentConfigs: jest.fn(),
  runAllDetailAgents: jest.fn(),
  runDetailAgent: jest.fn(),
}));

jest.mock('../../services/system/pulseService', () => ({
  generateSystemPulse: jest.fn(),
}));

import { getSystemHealthSummary } from '../../services/detailAgents/detailAgentEngine';
import { generateSystemPulse } from '../../services/system/pulseService';
import { registerDetailAgentRoutes } from '../detailAgents';

const getSystemHealthSummaryMock =
  getSystemHealthSummary as jest.MockedFunction<typeof getSystemHealthSummary>;
const generateSystemPulseMock =
  generateSystemPulse as jest.MockedFunction<typeof generateSystemPulse>;

function buildApp() {
  const app = express();
  app.use(express.json());
  registerDetailAgentRoutes(app);
  return app;
}

describe('detail agent routes', () => {
  beforeEach(() => {
    getSystemHealthSummaryMock.mockReset();
    generateSystemPulseMock.mockReset();
  });

  it('includes system pulse counts in the system health payload', async () => {
    getSystemHealthSummaryMock.mockReturnValue({
      agents: [{
        id: 'data-sanity',
        name: 'Data Sanity Agent',
        enabled: true,
        lastRun: null,
        lastIssueCount: 0,
      }],
      totalIssues: 0,
      totalAutoRepaired: 0,
      totalSurfaced: 0,
    });
    generateSystemPulseMock.mockResolvedValue({
      providers: 5,
      findings: 39,
      storylines: 9,
      lastEventAt: '2026-03-17T10:46:18.000Z',
      systemState: 'ALIVE',
    });

    const response = await request(buildApp())
      .get('/api/system-health')
      .expect(200);

    expect(response.body).toMatchObject({
      schema: 'https://vitalcv.com/system-health/v1',
      agents: [{
        id: 'data-sanity',
        name: 'Data Sanity Agent',
      }],
      providers: 5,
      findings: 39,
      storylines: 9,
      status: 'HEALTHY',
      systemState: 'ALIVE',
      lastEventAt: '2026-03-17T10:46:18.000Z',
    });
  });

  it('keeps the canonical warming state when counts are still incomplete', async () => {
    getSystemHealthSummaryMock.mockReturnValue({
      agents: [],
      totalIssues: 0,
      totalAutoRepaired: 0,
      totalSurfaced: 0,
    });
    generateSystemPulseMock.mockResolvedValue({
      providers: 5,
      findings: 2,
      storylines: 0,
      lastEventAt: null,
      systemState: 'WARMING',
    });

    const response = await request(buildApp())
      .get('/api/system-health')
      .expect(200);

    expect(response.body).toMatchObject({
      providers: 5,
      findings: 2,
      storylines: 0,
      status: 'WARMING',
      systemState: 'WARMING',
      lastEventAt: null,
    });
  });
});
