import express from 'express';
import request from 'supertest';

jest.mock('../../services/providers/providerDirectory', () => ({
  generateDirectory: jest.fn(),
  exportFHIRDirectory: jest.fn(),
  exportCSVDirectory: jest.fn(),
  getDirectorySnapshot: jest.fn(),
  listDirectorySnapshots: jest.fn(),
  verifyDirectoryIntegrity: jest.fn(),
  generateSignedDirectory: jest.fn(),
}));

import { registerProviderDirectoryRoutes } from '../providerDirectory';

function buildApp() {
  const app = express();
  app.use(express.json());
  registerProviderDirectoryRoutes(app);
  return app;
}

describe('provider directory publish route', () => {
  it('does not expose a public snapshot-publishing write', async () => {
    await request(buildApp())
      .post('/api/directory/publish')
      .send({ publishedBy: 'attacker-controlled' })
      .expect(404);
  });
});
