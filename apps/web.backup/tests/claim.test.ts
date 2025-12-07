/**
 * Unit tests for claim route
 */

import { Request, Response } from 'express';
import request from 'supertest';
import express from 'express';
import claimRouter from '../src/routes/claim';
import * as npiLookupService from '../src/services/npiLookupService';
import { NpiType } from '../lib/npi-types';

// Mock the NPI lookup service
jest.mock('../src/services/npiLookupService');

const app = express();
app.use(express.json());
app.use('/api/claim', claimRouter);

describe('POST /api/claim/basic', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockRequest = {
      body: {},
      headers: {
        'x-request-id': 'test-request-id',
      },
      ip: '127.0.0.1',
    };

    // Setup console.log spy to capture audit logs
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Success path', () => {
    it('should create a claim successfully with valid NPI and email', async () => {
      const mockNpiRecord = {
        npi: '1234567890',
        type: 1 as NpiType,
        name: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
        taxonomyCode: '208D00000X',
        taxonomyDescription: 'General Practice',
        addresses: [],
        isOrganization: false,
      };

      (npiLookupService.lookupByNpi as jest.Mock).mockResolvedValue(mockNpiRecord);

      const response = await request(app)
        .post('/api/claim/basic')
        .send({
          npi: '1234567890',
          email: 'test@example.com',
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Claim started successfully. Please check your email for OTP.',
        npi: '1234567890',
        npiType: 1,
        email: 'test@example.com',
      });

      expect(response.body.claimId).toBeDefined();
      expect(response.body.expiresAt).toBeDefined();
      expect(npiLookupService.lookupByNpi).toHaveBeenCalledWith('1234567890');
      expect(npiLookupService.lookupByNpi).toHaveBeenCalledTimes(1);
    });

    it('should log audit trail before NPI lookup', async () => {
      const mockNpiRecord = {
        npi: '1234567890',
        type: 1 as NpiType,
        name: 'John Doe',
        taxonomyCode: '208D00000X',
        taxonomyDescription: 'General Practice',
        addresses: [],
        isOrganization: false,
      };

      (npiLookupService.lookupByNpi as jest.Mock).mockResolvedValue(mockNpiRecord);

      await request(app)
        .post('/api/claim/basic')
        .send({
          npi: '1234567890',
          email: 'test@example.com',
        })
        .expect(200);

      // Verify audit logs were called
      expect(console.log).toHaveBeenCalled();
      const logCalls = (console.log as jest.Mock).mock.calls;
      const auditLogs = logCalls.map(call => JSON.parse(call[0]));
      
      // Should have START log before lookup
      const startLog = auditLogs.find(log => log.action === 'CLAIM_BASIC_START');
      expect(startLog).toBeDefined();
      expect(startLog.stage).toBe('pre_npi_lookup');
    });
  });

  describe('Validation errors', () => {
    it('should return 400 when NPI is missing', async () => {
      const response = await request(app)
        .post('/api/claim/basic')
        .send({
          email: 'test@example.com',
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Missing required fields: npi and email are required',
      });

      expect(npiLookupService.lookupByNpi).not.toHaveBeenCalled();
    });

    it('should return 400 when email is missing', async () => {
      const response = await request(app)
        .post('/api/claim/basic')
        .send({
          npi: '1234567890',
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Missing required fields: npi and email are required',
      });

      expect(npiLookupService.lookupByNpi).not.toHaveBeenCalled();
    });

    it('should return 400 when NPI format is invalid (not 10 digits)', async () => {
      const response = await request(app)
        .post('/api/claim/basic')
        .send({
          npi: '12345',
          email: 'test@example.com',
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid NPI format. NPI must be exactly 10 digits.',
      });

      expect(npiLookupService.lookupByNpi).not.toHaveBeenCalled();
    });

    it('should return 400 when NPI contains non-digits', async () => {
      const response = await request(app)
        .post('/api/claim/basic')
        .send({
          npi: '123456789a',
          email: 'test@example.com',
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid NPI format. NPI must be exactly 10 digits.',
      });

      expect(npiLookupService.lookupByNpi).not.toHaveBeenCalled();
    });

    it('should return 400 when email format is invalid', async () => {
      const response = await request(app)
        .post('/api/claim/basic')
        .send({
          npi: '1234567890',
          email: 'invalid-email',
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Invalid email format',
      });

      expect(npiLookupService.lookupByNpi).not.toHaveBeenCalled();
    });
  });

  describe('NPI lookup errors', () => {
    it('should return 404 when NPI is not found', async () => {
      const errorMessage = 'NPI 1234567890 not found in NPPES registry';
      (npiLookupService.lookupByNpi as jest.Mock).mockRejectedValue(new Error(errorMessage));

      const response = await request(app)
        .post('/api/claim/basic')
        .send({
          npi: '1234567890',
          email: 'test@example.com',
        })
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: errorMessage,
      });

      expect(npiLookupService.lookupByNpi).toHaveBeenCalledWith('1234567890');
      
      // Verify error was logged
      const logCalls = (console.log as jest.Mock).mock.calls;
      const auditLogs = logCalls.map(call => JSON.parse(call[0]));
      const errorLog = auditLogs.find(log => log.action === 'CLAIM_BASIC_NPI_LOOKUP_ERROR');
      expect(errorLog).toBeDefined();
      expect(errorLog.error).toBe(errorMessage);
    });

    it('should return 404 when NPI lookup service throws generic error', async () => {
      const errorMessage = 'Network error';
      (npiLookupService.lookupByNpi as jest.Mock).mockRejectedValue(new Error(errorMessage));

      const response = await request(app)
        .post('/api/claim/basic')
        .send({
          npi: '1234567890',
          email: 'test@example.com',
        })
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: errorMessage,
      });
    });

    it('should handle non-Error objects thrown by service', async () => {
      (npiLookupService.lookupByNpi as jest.Mock).mockRejectedValue('String error');

      const response = await request(app)
        .post('/api/claim/basic')
        .send({
          npi: '1234567890',
          email: 'test@example.com',
        })
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: 'NPI lookup failed',
      });
    });
  });

  describe('Server errors', () => {
    it('should return 500 when unexpected error occurs', async () => {
      // Mock lookup to succeed but then throw an error during claim creation
      const mockNpiRecord = {
        npi: '1234567890',
        type: 1 as NpiType,
        name: 'John Doe',
        taxonomyCode: '208D00000X',
        taxonomyDescription: 'General Practice',
        addresses: [],
        isOrganization: false,
      };

      (npiLookupService.lookupByNpi as jest.Mock).mockResolvedValue(mockNpiRecord);
      
      // Force an error by corrupting Math.random (simulating an unexpected error)
      const originalRandom = Math.random;
      Math.random = jest.fn(() => {
        throw new Error('Unexpected error');
      });

      const response = await request(app)
        .post('/api/claim/basic')
        .send({
          npi: '1234567890',
          email: 'test@example.com',
        })
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Failed to start claim. Please try again later.',
      });

      // Restore Math.random
      Math.random = originalRandom;

      // Verify error was logged
      const logCalls = (console.log as jest.Mock).mock.calls;
      const auditLogs = logCalls.map(call => JSON.parse(call[0]));
      const errorLog = auditLogs.find(log => log.action === 'CLAIM_BASIC_ERROR');
      expect(errorLog).toBeDefined();
    });
  });

  describe('Audit trail logging', () => {
    it('should log CLAIM_BASIC_START before NPI lookup', async () => {
      const mockNpiRecord = {
        npi: '1234567890',
        type: 1 as NpiType,
        name: 'John Doe',
        taxonomyCode: '208D00000X',
        taxonomyDescription: 'General Practice',
        addresses: [],
        isOrganization: false,
      };

      (npiLookupService.lookupByNpi as jest.Mock).mockResolvedValue(mockNpiRecord);

      await request(app)
        .post('/api/claim/basic')
        .set('x-request-id', 'test-id-123')
        .set('x-forwarded-for', '192.168.1.1')
        .send({
          npi: '1234567890',
          email: 'test@example.com',
        })
        .expect(200);

      const logCalls = (console.log as jest.Mock).mock.calls;
      const auditLogs = logCalls.map(call => JSON.parse(call[0]));
      
      const startLog = auditLogs.find(log => log.action === 'CLAIM_BASIC_START');
      expect(startLog).toBeDefined();
      expect(startLog.level).toBe('AUDIT');
      expect(startLog.requestId).toBe('test-id-123');
      expect(startLog.npi).toBe('1234567890');
      expect(startLog.email).toContain('@***'); // Email should be sanitized
      expect(startLog.stage).toBe('pre_npi_lookup');
    });

    it('should log CLAIM_BASIC_NPI_LOOKUP_SUCCESS after successful lookup', async () => {
      const mockNpiRecord = {
        npi: '1234567890',
        type: 2 as NpiType,
        name: 'Test Organization',
        taxonomyCode: '208D00000X',
        taxonomyDescription: 'General Practice',
        addresses: [],
        isOrganization: true,
      };

      (npiLookupService.lookupByNpi as jest.Mock).mockResolvedValue(mockNpiRecord);

      await request(app)
        .post('/api/claim/basic')
        .send({
          npi: '1234567890',
          email: 'test@example.com',
        })
        .expect(200);

      const logCalls = (console.log as jest.Mock).mock.calls;
      const auditLogs = logCalls.map(call => JSON.parse(call[0]));
      
      const successLog = auditLogs.find(log => log.action === 'CLAIM_BASIC_NPI_LOOKUP_SUCCESS');
      expect(successLog).toBeDefined();
      expect(successLog.npi).toBe('1234567890');
      expect(successLog.npiType).toBe(2);
      expect(successLog.npiName).toBe('Test Organization');
    });

    it('should log CLAIM_BASIC_PRE_API_CALL before downstream API call', async () => {
      const mockNpiRecord = {
        npi: '1234567890',
        type: 1 as NpiType,
        name: 'John Doe',
        taxonomyCode: '208D00000X',
        taxonomyDescription: 'General Practice',
        addresses: [],
        isOrganization: false,
      };

      (npiLookupService.lookupByNpi as jest.Mock).mockResolvedValue(mockNpiRecord);

      await request(app)
        .post('/api/claim/basic')
        .send({
          npi: '1234567890',
          email: 'test@example.com',
        })
        .expect(200);

      const logCalls = (console.log as jest.Mock).mock.calls;
      const auditLogs = logCalls.map(call => JSON.parse(call[0]));
      
      const preApiLog = auditLogs.find(log => log.action === 'CLAIM_BASIC_PRE_API_CALL');
      expect(preApiLog).toBeDefined();
      expect(preApiLog.stage).toBe('pre_downstream_api');
      expect(preApiLog.npiType).toBe(1);
    });

    it('should log CLAIM_BASIC_SUCCESS with claimId and duration', async () => {
      const mockNpiRecord = {
        npi: '1234567890',
        type: 1 as NpiType,
        name: 'John Doe',
        taxonomyCode: '208D00000X',
        taxonomyDescription: 'General Practice',
        addresses: [],
        isOrganization: false,
      };

      (npiLookupService.lookupByNpi as jest.Mock).mockResolvedValue(mockNpiRecord);

      await request(app)
        .post('/api/claim/basic')
        .send({
          npi: '1234567890',
          email: 'test@example.com',
        })
        .expect(200);

      const logCalls = (console.log as jest.Mock).mock.calls;
      const auditLogs = logCalls.map(call => JSON.parse(call[0]));
      
      const successLog = auditLogs.find(log => log.action === 'CLAIM_BASIC_SUCCESS');
      expect(successLog).toBeDefined();
      expect(successLog.claimId).toBeDefined();
      expect(successLog.duration).toBeGreaterThanOrEqual(0);
      expect(successLog.npi).toBe('1234567890');
      expect(successLog.npiType).toBe(1);
    });
  });
});
