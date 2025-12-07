import express from 'express';
import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { NCINodeType, NCIVerifiableProofType } from '@prisma/client';

const registerNodeMock = jest.fn();
const verifyAttestationMock = jest.fn();
const recordProofMock = jest.fn();

jest.mock('../../../../../../services/nci/models/NCINode.js', () => ({
  NCINodeService: jest.fn().mockImplementation(() => ({
    registerNode: registerNodeMock,
  })),
}));

jest.mock('../../../../../../services/nci/models/NCITrustAnchor.js', () => ({
  NCITrustAnchorService: jest.fn().mockImplementation(() => ({
    verifyAttestation: verifyAttestationMock,
  })),
}));

jest.mock('../../../../../../services/nci/verifiableProofRegistry.js', () => ({
  VerifiableProofRegistry: jest.fn().mockImplementation(() => ({
    recordProof: recordProofMock,
  })),
}));

jest.mock('@prisma/client', () => {
  const actual = jest.requireActual('@prisma/client');
  return {
    ...actual,
    PrismaClient: jest.fn().mockImplementation(() => ({})),
  };
});

import nciRegisterRouter from '../register.js';

describe('NCI register route', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/nci/register', nciRegisterRouter);

  beforeEach(() => {
    jest.clearAllMocks();
    verifyAttestationMock.mockResolvedValue(true);
    registerNodeMock.mockResolvedValue({
      nodeId: 'node-1',
      did: 'did:example:123',
      nodeType: NCINodeType.CLINICIAN,
      jurisdiction: 'CA',
      trustAnchorId: 'anchor-1',
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    recordProofMock.mockResolvedValue({
      id: 'proof-1',
      did: 'did:example:123',
      proofType: NCIVerifiableProofType.ISSUANCE,
      eventType: 'VC_ISSUED',
    });
  });

  it('registers DIDs via trust anchors', async () => {
    const response = await request(app).post('/api/nci/register').send({
      did: 'did:example:123',
      nodeType: NCINodeType.CLINICIAN,
      trustAnchorId: 'anchor-1',
      attestation: {
        message: { did: 'did:example:123' },
        signature: 'base64sig',
      },
      proof: {
        eventType: 'VC_ISSUED',
        payload: { vcId: 'vc-1' },
      },
    });

    expect(response.status).toBe(201);
    expect(registerNodeMock).toHaveBeenCalledWith(
      expect.objectContaining({ did: 'did:example:123', trustAnchorId: 'anchor-1' })
    );
    expect(recordProofMock).toHaveBeenCalledWith(
      expect.objectContaining({ did: 'did:example:123', eventType: 'VC_ISSUED' })
    );
  });

  it('rejects invalid payloads', async () => {
    const response = await request(app).post('/api/nci/register').send({
      nodeType: NCINodeType.CLINICIAN,
      trustAnchorId: 'anchor-1',
      attestation: { signature: 'sig', message: 'msg' },
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('nci_registration_failed');
  });
});
import express from 'express';
import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { NCINodeType, NCIVerifiableProofType } from '@prisma/client';

const registerNodeMock = jest.fn();
const verifyAttestationMock = jest.fn();
const recordProofMock = jest.fn();

jest.mock('../../../../../../services/nci/models/NCINode.js', () => ({
  NCINodeService: jest.fn().mockImplementation(() => ({
    registerNode: registerNodeMock,
  })),
}));

jest.mock('../../../../../../services/nci/models/NCITrustAnchor.js', () => ({
  NCITrustAnchorService: jest.fn().mockImplementation(() => ({
    verifyAttestation: verifyAttestationMock,
  })),
}));

jest.mock('../../../../../../services/nci/verifiableProofRegistry.js', () => ({
  VerifiableProofRegistry: jest.fn().mockImplementation(() => ({
    recordProof: recordProofMock,
  })),
}));

jest.mock('@prisma/client', () => {
  const actual = jest.requireActual('@prisma/client');
  return {
    ...actual,
    PrismaClient: jest.fn().mockImplementation(() => ({})),
  };
});

import nciRegisterRouter from '../register.js';

describe('NCI register route', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/nci/register', nciRegisterRouter);

  beforeEach(() => {
    jest.clearAllMocks();
    verifyAttestationMock.mockResolvedValue(true);
    registerNodeMock.mockResolvedValue({
      nodeId: 'node-1',
      did: 'did:example:123',
      nodeType: NCINodeType.CLINICIAN,
      jurisdiction: 'CA',
      trustAnchorId: 'anchor-1',
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    recordProofMock.mockResolvedValue({
      id: 'proof-1',
      did: 'did:example:123',
      proofType: NCIVerifiableProofType.ISSUANCE,
      eventType: 'VC_ISSUED',
    });
  });

  it('registers DIDs via trust anchors', async () => {
    const response = await request(app).post('/api/nci/register').send({
      did: 'did:example:123',
      nodeType: NCINodeType.CLINICIAN,
      trustAnchorId: 'anchor-1',
      attestation: {
        message: { did: 'did:example:123' },
        signature: 'base64sig',
      },
      proof: {
        eventType: 'VC_ISSUED',
        payload: { vcId: 'vc-1' },
      },
    });

    expect(response.status).toBe(201);
    expect(registerNodeMock).toHaveBeenCalledWith(
      expect.objectContaining({ did: 'did:example:123', trustAnchorId: 'anchor-1' })
    );
    expect(recordProofMock).toHaveBeenCalledWith(
      expect.objectContaining({ did: 'did:example:123', eventType: 'VC_ISSUED' })
    );
  });

  it('rejects invalid payloads', async () => {
    const response = await request(app).post('/api/nci/register').send({
      nodeType: NCINodeType.CLINICIAN,
      trustAnchorId: 'anchor-1',
      attestation: { signature: 'sig', message: 'msg' },
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('nci_registration_failed');
  });
});

