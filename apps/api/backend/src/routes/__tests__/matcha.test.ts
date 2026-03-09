import express from 'express';
import request from 'supertest';

jest.mock('../../services/employers/employerService', () => ({
  getEmployerBySlug: jest.fn().mockResolvedValue({
    slug: 'bay-area-cardiac-group',
    name: 'Bay Area Cardiac Group',
    trustScore: 94,
    hiringStatus: 'HIRING_NOW',
    timeToStart: '2-3 weeks',
  }),
}));

import { registerMatchaRoutes } from '../matcha';

describe('GET /api/matcha/opportunities/:npi', () => {
  it('returns employer linkage and askContext for each opportunity', async () => {
    const app = express();
    app.use(express.json());
    registerMatchaRoutes(app);

    const response = await request(app)
      .get('/api/matcha/opportunities/1003000126')
      .expect(200);

    expect(response.body.opportunities.length).toBeGreaterThan(0);
    expect(response.body.opportunities[0]).toHaveProperty('employerSlug');
    expect(response.body.opportunities[0]).toHaveProperty('employer.name');
    expect(response.body.opportunities[0]).toHaveProperty('askContext.opportunityId');
    expect(response.body.opportunities[0]).toHaveProperty('askContext.employerSlug');
  });
});
