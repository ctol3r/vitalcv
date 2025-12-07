/**
 * Unit tests for SMART-on-FHIR client
 * S72-STRETCH-C-005: Tests for OAuth2 client-credentials, token caching, 401 retry logic
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import fetch from 'node-fetch';
import { SmartClient, testTokenExchange } from '../smartClient.js';
import type { EhrConfig } from '../models/EhrConfig.js';

// Mock node-fetch
jest.mock('node-fetch');
const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('SmartClient', () => {
  const mockConfig: EhrConfig = {
    orgId: 'test-org-123',
    ehrType: 'epic',
    fhirBaseUrl: 'https://fhir.epic.com/interconnect-fhir-oauth',
    authType: 'client_credentials',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    isActive: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedFetch.mockClear();
  });

  describe('Token Exchange', () => {
    it('should fetch access token using client credentials', async () => {
      const mockTokenResponse = {
        access_token: 'test-access-token-123',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      } as Response);

      const client = new SmartClient(mockConfig);
      const token = await client.getAccessToken();

      expect(token).toBe('test-access-token-123');
      expect(mockedFetch).toHaveBeenCalledTimes(1);
    });

    it('should cache token and reuse it', async () => {
      const mockTokenResponse = {
        access_token: 'cached-token-456',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      } as Response);

      const client = new SmartClient(mockConfig);
      const token1 = await client.getAccessToken();
      const token2 = await client.getAccessToken(); // Should use cache

      expect(token1).toBe('cached-token-456');
      expect(token2).toBe('cached-token-456');
      expect(mockedFetch).toHaveBeenCalledTimes(1); // Only one fetch
    });

    it('should refresh token when expired', async () => {
      const mockTokenResponse1 = {
        access_token: 'old-token',
        token_type: 'Bearer',
        expires_in: 60, // 60 seconds
      };

      const mockTokenResponse2 = {
        access_token: 'new-token',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      mockedFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTokenResponse1,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTokenResponse2,
        } as Response);

      const client = new SmartClient(mockConfig);
      const token1 = await client.getAccessToken();

      // Wait for token to expire (simulate by manually clearing cache after time)
      // In real scenario, token would expire naturally
      client.clearTokenCache();
      const token2 = await client.getAccessToken();

      expect(token1).toBe('old-token');
      expect(token2).toBe('new-token');
      expect(mockedFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle token fetch errors', async () => {
      mockedFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Invalid client credentials',
      } as Response);

      const client = new SmartClient(mockConfig);

      await expect(client.getAccessToken()).rejects.toThrow();
    });
  });

  describe('401 Retry Logic', () => {
    it('should retry once on 401 error', async () => {
      const mockTokenResponse = {
        access_token: 'fresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      // First request returns 401
      mockedFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTokenResponse,
        } as Response) // Token fetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
        } as Response) // First API request fails
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTokenResponse,
        } as Response) // Token refresh
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ resourceType: 'Bundle' }),
        } as Response); // Retry succeeds

      const client = new SmartClient(mockConfig);
      const response = await client.request('PractitionerRole');

      expect(response.status).toBe(200);
      expect(mockedFetch).toHaveBeenCalledTimes(4); // Token fetch, request, token refresh, retry
    });

    it('should throw error if retry also fails with 401', async () => {
      const mockTokenResponse = {
        access_token: 'token',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      mockedFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTokenResponse,
        } as Response) // Token fetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
        } as Response) // First request fails
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTokenResponse,
        } as Response) // Token refresh
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
        } as Response); // Retry also fails

      const client = new SmartClient(mockConfig);

      await expect(client.request('PractitionerRole')).rejects.toThrow(
        'Unauthorized: Token expired or invalid after retry'
      );
    });

    it('should not retry if retryOn401 is false', async () => {
      const mockTokenResponse = {
        access_token: 'token',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      mockedFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTokenResponse,
        } as Response) // Token fetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
        } as Response); // Request fails

      const client = new SmartClient(mockConfig);

      await expect(client.request('PractitionerRole', {}, false)).rejects.toThrow(
        'Unauthorized: Token expired or invalid'
      );

      expect(mockedFetch).toHaveBeenCalledTimes(2); // Token fetch + request (no retry)
    });

    it('should handle 403 errors without retry', async () => {
      const mockTokenResponse = {
        access_token: 'token',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      mockedFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTokenResponse,
        } as Response) // Token fetch
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
        } as Response); // Request fails with 403

      const client = new SmartClient(mockConfig);

      await expect(client.request('PractitionerRole')).rejects.toThrow(
        'Forbidden: Insufficient permissions for requested resource'
      );

      expect(mockedFetch).toHaveBeenCalledTimes(2); // Token fetch + request (no retry for 403)
    });
  });

  describe('Token Caching', () => {
    it('should clear token cache', async () => {
      const mockTokenResponse = {
        access_token: 'token-1',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      } as Response);

      const client = new SmartClient(mockConfig);
      await client.getAccessToken();
      client.clearTokenCache();

      // Next call should fetch new token
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockTokenResponse, access_token: 'token-2' }),
      } as Response);

      const token = await client.getAccessToken();
      expect(token).toBe('token-2');
    });
  });

  describe('testTokenExchange', () => {
    it('should return success on valid token exchange', async () => {
      const mockTokenResponse = {
        access_token: 'test-token',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTokenResponse,
      } as Response);

      const result = await testTokenExchange(mockConfig);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return error on failed token exchange', async () => {
      mockedFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Invalid credentials',
      } as Response);

      const result = await testTokenExchange(mockConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});

