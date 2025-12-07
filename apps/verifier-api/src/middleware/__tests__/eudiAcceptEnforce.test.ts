/**
 * Unit Tests for EUDI Wallet Enforcement Middleware
 * B110B-EUDI-018: Server toggle: Accept EUDI Wallets (hard-enforce)
 *
 * Acceptance criteria:
 * - Non-EUDI blocked
 * - Audit reason logged
 * - Unit tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { eudiAcceptEnforce } from '../eudiAcceptEnforce';
import { resetEudiWalletConfig, updateEudiWalletConfig } from '../../../api/config/eudi-wallet';
import * as auditService from '../../services/audit';

// Mock audit service
vi.mock('../../services/audit', () => ({
  auditLog: vi.fn().mockResolvedValue(undefined),
}));

describe('B110B-EUDI-018: EUDI Accept Enforce Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let statusSpy: ReturnType<typeof vi.fn>;
  let jsonSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset config before each test
    resetEudiWalletConfig();
    vi.clearAllMocks();

    statusSpy = vi.fn().mockReturnThis();
    jsonSpy = vi.fn().mockReturnThis();

    mockResponse = {
      status: statusSpy,
      json: jsonSpy,
    };

    mockNext = vi.fn();
    mockRequest = {
      method: 'POST',
      path: '/oidc4vp/presentation',
      headers: {},
      body: {},
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    resetEudiWalletConfig();
  });

  describe('when EUDI-only mode is disabled', () => {
    it('should allow all requests to pass through', async () => {
      updateEudiWalletConfig({ acceptEudiWalletsOnly: false });

      await eudiAcceptEnforce(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
      expect(auditService.auditLog).not.toHaveBeenCalled();
    });
  });

  describe('when EUDI-only mode is enabled', () => {
    beforeEach(() => {
      updateEudiWalletConfig({ acceptEudiWalletsOnly: true });
    });

    it('should allow EUDI wallet presentations to pass', async () => {
      mockRequest.headers = { 'x-eudi-wallet-provider': 'eudi-wallet-v1' };

      await eudiAcceptEnforce(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(statusSpy).not.toHaveBeenCalled();
      expect(auditService.auditLog).not.toHaveBeenCalled();
    });

    it('should block non-EUDI wallet presentations with 403', async () => {
      mockRequest.headers = { 'x-wallet-type': 'generic' };

      await eudiAcceptEnforce(
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
          reason: expect.stringContaining('Non-EUDI presentation blocked'),
        })
      );
    });

    it('should log audit event when blocking non-EUDI presentation', async () => {
      const userId = 'test-user-123';
      (mockRequest as any).user = { id: userId };
      mockRequest.headers = { 'x-wallet-type': 'non-eudi' };

      await eudiAcceptEnforce(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(auditService.auditLog).toHaveBeenCalledWith(
        'eudi_presentation_blocked',
        expect.objectContaining({
          userId,
          reason: expect.stringContaining('Non-EUDI presentation blocked'),
          path: '/oidc4vp/presentation',
          method: 'POST',
          timestamp: expect.any(String),
        })
      );
    });

    it('should detect EUDI wallet from provider header', async () => {
      mockRequest.headers = { 'x-eudi-wallet-provider': 'eudi-wallet-v1' };

      await eudiAcceptEnforce(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should detect EUDI wallet from alternative provider header', async () => {
      mockRequest.headers = { 'x-eudi-provider': 'eudi-wallet-v2' };

      await eudiAcceptEnforce(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should detect EUDI wallet from presentation body format', async () => {
      mockRequest.body = {
        format: 'eudi',
      };

      await eudiAcceptEnforce(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should detect EUDI wallet from eudiFormat indicator', async () => {
      mockRequest.body = {
        eudiFormat: true,
      };

      await eudiAcceptEnforce(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should detect EUDI wallet from eudiWallet indicator', async () => {
      mockRequest.body = {
        eudiWallet: true,
      };

      await eudiAcceptEnforce(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should detect EUDI wallet from trust registry reference', async () => {
      mockRequest.body = {
        trustRegistry: 'https://eudi.ec.europa.eu/trust-list',
      };

      await eudiAcceptEnforce(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should detect EUDI wallet from credential types', async () => {
      mockRequest.body = {
        credentialTypes: ['VerifiableCredential', 'EUDIWalletCredential'],
      };

      await eudiAcceptEnforce(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should detect EUDI wallet from presentation type', async () => {
      mockRequest.body = {
        presentation: {
          type: ['VerifiablePresentation', 'EUDI'],
        },
      };

      await eudiAcceptEnforce(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should detect EUDI wallet from presentation context', async () => {
      mockRequest.body = {
        presentation: {
          '@context': [
            'https://www.w3.org/2018/credentials/v1',
            'https://eudi.ec.europa.eu/context/v1',
          ],
        },
      };

      await eudiAcceptEnforce(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should detect EUDI wallet from VP token', async () => {
      // Create a mock VP token with EUDI type
      const mockPayload = Buffer.from(
        JSON.stringify({
          vp: {
            type: ['VerifiablePresentation', 'EUDI'],
          },
        })
      ).toString('base64');

      mockRequest.body = {
        vp_token: `header.${mockPayload}.signature`,
      };

      await eudiAcceptEnforce(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should use anonymous userId when user is not authenticated', async () => {
      mockRequest.headers = { 'x-wallet-type': 'non-eudi' };
      delete (mockRequest as any).user;

      await eudiAcceptEnforce(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(auditService.auditLog).toHaveBeenCalledWith(
        'eudi_presentation_blocked',
        expect.objectContaining({
          userId: 'anonymous',
        })
      );
    });

    it('should include user-agent and x-forwarded-for in audit log', async () => {
      mockRequest.headers = {
        'x-wallet-type': 'non-eudi',
        'user-agent': 'TestAgent/1.0',
        'x-forwarded-for': '192.168.1.1',
      };

      await eudiAcceptEnforce(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(auditService.auditLog).toHaveBeenCalledWith(
        'eudi_presentation_blocked',
        expect.objectContaining({
          headers: expect.objectContaining({
            'user-agent': 'TestAgent/1.0',
            'x-forwarded-for': '192.168.1.1',
          }),
        })
      );
    });

    it('should include timestamp in error response', async () => {
      mockRequest.headers = { 'x-wallet-type': 'non-eudi' };

      await eudiAcceptEnforce(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(String),
        })
      );
    });
  });
});

