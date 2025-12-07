/**
 * Unit Tests for EUDI Wallet Enforcement
 * B104C-EUDI-045: Server toggle: Accept EUDI Wallets (policy enforced)
 */

import { Request, Response, NextFunction } from 'express';
import { eudiAcceptEnforce } from '../eudiAcceptEnforce';
import { resetEudiWalletConfig, updateEudiWalletConfig } from '../../../apps/api/config/eudi-wallet';
import { auditLog } from '../../controllers/audit';

// Mock auditLog
jest.mock('../../controllers/audit', () => ({
  auditLog: jest.fn().mockResolvedValue(undefined),
}));

describe('EUDI Accept Enforce Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let statusSpy: jest.Mock;
  let jsonSpy: jest.Mock;

  beforeEach(() => {
    // Reset config before each test
    resetEudiWalletConfig();

    statusSpy = jest.fn().mockReturnThis();
    jsonSpy = jest.fn().mockReturnThis();

    mockResponse = {
      status: statusSpy,
      json: jsonSpy,
    };

    mockNext = jest.fn();
    mockRequest = {
      method: 'POST',
      path: '/verifier/presentation',
      headers: {},
      body: {},
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
    resetEudiWalletConfig();
  });

  describe('when EUDI-only mode is disabled', () => {
    it('should allow all requests to pass through', () => {
      updateEudiWalletConfig({ acceptEudiWalletsOnly: false });

      eudiAcceptEnforce(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });
  });

  describe('when EUDI-only mode is enabled', () => {
    beforeEach(() => {
      updateEudiWalletConfig({ acceptEudiWalletsOnly: true });
    });

    it('should allow EUDI wallet presentations to pass', () => {
      mockRequest.headers = { 'x-eudi-wallet-provider': 'eudi-wallet-v1' };

      eudiAcceptEnforce(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should block non-EUDI wallet presentations with 403', () => {
      mockRequest.headers = { 'x-wallet-type': 'generic' };

      eudiAcceptEnforce(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusSpy).toHaveBeenCalledWith(403);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'eudi_only_mode',
          message: expect.stringContaining('Only EUDI wallet presentations'),
        })
      );
    });

    it('should detect EUDI wallet from provider header', () => {
      mockRequest.headers = { 'x-eudi-wallet-provider': 'eudi-wallet-v1' };

      eudiAcceptEnforce(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should detect EUDI wallet from presentation body', () => {
      mockRequest.body = {
        presentation: {
          type: ['VerifiablePresentation', 'EUDI'],
        },
      };

      eudiAcceptEnforce(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should detect EUDI wallet from format indicator', () => {
      mockRequest.body = {
        format: 'eudi',
      };

      eudiAcceptEnforce(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should skip enforcement for non-presentation routes', () => {
      mockRequest.path = '/api/npi/lookup';

      eudiAcceptEnforce(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
    });

    it('should log audit event when blocking non-EUDI presentation', async () => {
      mockRequest.headers = { 'x-wallet-type': 'non-eudi' };
      (mockRequest as any).user = { id: 'test-user' };
      mockRequest.path = '/verifier/presentation';

      eudiAcceptEnforce(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Wait for async audit logging
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(statusSpy).toHaveBeenCalledWith(403);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'eudi_only_mode',
          message: expect.stringContaining('Only EUDI wallet presentations'),
          reason: expect.stringContaining('Non-EUDI presentation blocked'),
        })
      );

      // Verify audit log was called
      expect(auditLog).toHaveBeenCalledWith(
        'test-user',
        'eudi_presentation_blocked',
        expect.objectContaining({
          reason: expect.stringContaining('Non-EUDI presentation blocked'),
          path: '/verifier/presentation',
          method: 'POST',
        })
      );
    });
  });
});


