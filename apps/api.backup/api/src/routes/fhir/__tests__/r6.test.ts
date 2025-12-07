import request from 'supertest';
import express from 'express';
import router from '..';
import { validateResource } from '../../../../../../services/fhir/validator';

jest.mock('../../../../../../services/fhir/validator', () => ({
  validateResource: jest.fn(() => ({ valid: true, errors: [] })),
}));

const mockPrisma = {
  user: { findUnique: jest.fn() },
  jobPosting: { findUnique: jest.fn() },
  orgProfile: { findUnique: jest.fn() },
  ehrConfig: { findUnique: jest.fn() },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

describe('FHIR R6 router', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/fhir/R6', router);
    jest.clearAllMocks();
    (validateResource as jest.Mock).mockReturnValue({ valid: true, errors: [] });
  });

  it('returns Practitioner resource', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      name: 'Casey Doe',
      email: 'casey@example.org',
      phone: null,
      clinicianProfile: {
        npi: '1234567890',
        specialty: '207R00000X',
        state: 'CA',
      },
    });

    const response = await request(app).get('/fhir/R6/Practitioner/user-1');
    expect(response.status).toBe(200);
    expect(response.body.resourceType).toBe('Practitioner');
  });

  it('returns OperationOutcome when Practitioner not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const response = await request(app).get('/fhir/R6/Practitioner/unknown');
    expect(response.status).toBe(404);
    expect(response.body.resourceType).toBe('OperationOutcome');
  });

  it('surfaces validation failures as 400', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      name: 'Casey Doe',
      email: 'casey@example.org',
      phone: null,
      clinicianProfile: {
        npi: '1234567890',
        specialty: '207R00000X',
        state: 'CA',
      },
    });
    (validateResource as jest.Mock).mockReturnValueOnce({
      valid: false,
      errors: [{ message: 'broken', path: '/name' }],
    });

    const response = await request(app).get('/fhir/R6/Practitioner/user-1');
    expect(response.status).toBe(400);
    expect(response.body.resourceType).toBe('OperationOutcome');
  });

  it('returns PractitionerRole resource', async () => {
    mockPrisma.jobPosting.findUnique.mockResolvedValue({
      id: 'job-1',
      title: 'Hospitalist',
      partnerId: 'org-1',
      specialty: '207R00000X',
      requiredStates: ['CA'],
      status: 'active',
      telehealth: true,
      modality: 'telehealth',
      location: { state: 'CA' },
      fhirMetadata: { telehealthUrl: 'https://tele.example.org' },
    });

    const response = await request(app).get('/fhir/R6/PractitionerRole/job-1');
    expect(response.status).toBe(200);
    expect(response.body.resourceType).toBe('PractitionerRole');
  });

  it('returns Organization resource', async () => {
    mockPrisma.orgProfile.findUnique.mockResolvedValue({
      orgId: 'org-1',
      name: 'Org One',
      contactEmail: 'it@orgone.org',
      address: { state: 'CA' },
    });

    const response = await request(app).get('/fhir/R6/Organization/org-1');
    expect(response.status).toBe(200);
    expect(response.body.resourceType).toBe('Organization');
  });

  it('returns Endpoint resource', async () => {
    mockPrisma.ehrConfig.findUnique.mockResolvedValue({
      orgId: 'org-1',
      ehrType: 'generic',
      fhirBaseUrl: 'https://ehr.example.org/fhir',
      authType: 'client_credentials',
      clientId: 'client',
      clientSecret: 'secret',
      metadata: {},
      isActive: true,
    });
    mockPrisma.orgProfile.findUnique.mockResolvedValue({
      orgId: 'org-1',
      name: 'Org One',
      contactEmail: 'it@orgone.org',
      address: { state: 'CA' },
    });

    const response = await request(app).get('/fhir/R6/Endpoint/org-1');
    expect(response.status).toBe(200);
    expect(response.body.resourceType).toBe('Endpoint');
  });
});


