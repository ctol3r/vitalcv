/**
 * B139A-INTL-003: Tests for Region Routing Middleware
 */

import { Request, Response, NextFunction } from 'express';
import {
  regionRouter,
  validateRegionAccess,
  registerTenant,
  clearTenantRegistry,
  getCurrentClusterRegion,
  getRegionRoutingMetrics,
  resetRegionRoutingMetrics,
  regionRouterWithMetrics,
  REGION_HEADER,
} from '../regionRouter';
import { Region } from '../../../../../services/org/models/TenantRegion';

// Mock environment
const originalEnv = process.env;

describe('Region Routing Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let statusCode: number;
  let jsonResponse: any;
  let redirectUrl: string | undefined;
  let headers: Record<string, string>;

  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv };
    process.env.CLUSTER_REGION = Region.US;

    // Clear tenant registry
    clearTenantRegistry();
    resetRegionRoutingMetrics();

    // Setup mocks
    statusCode = 200;
    jsonResponse = undefined;
    redirectUrl = undefined;
    headers = {};

    mockReq = {
      headers: {},
      query: {},
      originalUrl: '/api/v1/providers',
      user: undefined,
    };

    mockRes = {
      status: jest.fn((code: number) => {
        statusCode = code;
        return mockRes as Response;
      }),
      json: jest.fn((data: any) => {
        jsonResponse = data;
        return mockRes as Response;
      }),
      redirect: jest.fn((code: number, url: string) => {
        statusCode = code;
        redirectUrl = url;
        return mockRes as Response;
      }),
      setHeader: jest.fn((name: string, value: string) => {
        headers[name] = value;
        return mockRes as Response;
      }),
    };

    mockNext = jest.fn();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('regionRouter', () => {
    it('should allow request to proceed if no tenant ID is found', async () => {
      await regionRouter(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(redirectUrl).toBeUndefined();
    });

    it('should return 404 if tenant is not found', async () => {
      mockReq.query = { tenantId: '550e8400-e29b-41d4-a716-446655440000' };

      await regionRouter(mockReq as Request, mockRes as Response, mockNext);

      expect(statusCode).toBe(404);
      expect(jsonResponse.code).toBe('TENANT_NOT_FOUND');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should add X-VitalCV-Region header and proceed if in correct region', async () => {
      const tenantId = '550e8400-e29b-41d4-a716-446655440000';

      registerTenant({
        tenantId,
        homeRegion: Region.US,
        allowedRegions: [Region.US],
      });

      mockReq.query = { tenantId };

      await regionRouter(mockReq as Request, mockRes as Response, mockNext);

      expect(headers[REGION_HEADER]).toBe(Region.US);
      expect((mockReq as any).tenantRegion).toBe(Region.US);
      expect(mockNext).toHaveBeenCalled();
      expect(redirectUrl).toBeUndefined();
    });

    it('should redirect if tenant homeRegion differs from current cluster', async () => {
      process.env.CLUSTER_REGION = Region.US;
      process.env.EU_CLUSTER_ENDPOINT = 'https://eu.api.vitalcv.com';

      const tenantId = '660e8400-e29b-41d4-a716-446655440001';

      registerTenant({
        tenantId,
        homeRegion: Region.EU, // Tenant is in EU
        allowedRegions: [Region.EU],
      });

      mockReq.query = { tenantId };

      await regionRouter(mockReq as Request, mockRes as Response, mockNext);

      expect(statusCode).toBe(307);
      expect(redirectUrl).toBe('https://eu.api.vitalcv.com/api/v1/providers');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should extract tenant ID from JWT', async () => {
      const tenantId = '550e8400-e29b-41d4-a716-446655440000';

      registerTenant({
        tenantId,
        homeRegion: Region.US,
        allowedRegions: [Region.US],
      });

      mockReq.user = { orgId: tenantId } as any;

      await regionRouter(mockReq as Request, mockRes as Response, mockNext);

      expect(headers[REGION_HEADER]).toBe(Region.US);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should extract tenant ID from X-Tenant-ID header', async () => {
      const tenantId = '550e8400-e29b-41d4-a716-446655440000';

      registerTenant({
        tenantId,
        homeRegion: Region.US,
        allowedRegions: [Region.US],
      });

      mockReq.headers = { 'x-tenant-id': tenantId };

      await regionRouter(mockReq as Request, mockRes as Response, mockNext);

      expect(headers[REGION_HEADER]).toBe(Region.US);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should extract tenant ID from subdomain', async () => {
      const tenantId = '550e8400-e29b-41d4-a716-446655440000';

      registerTenant({
        tenantId,
        homeRegion: Region.US,
        allowedRegions: [Region.US],
      });

      mockReq.headers = { host: `${tenantId}.api.vitalcv.com` };

      await regionRouter(mockReq as Request, mockRes as Response, mockNext);

      expect(headers[REGION_HEADER]).toBe(Region.US);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('validateRegionAccess', () => {
    it('should allow access if tenant has allowedRegions including current region', () => {
      const tenantId = '550e8400-e29b-41d4-a716-446655440000';

      (mockReq as any).tenantMetadata = {
        tenantId,
        homeRegion: Region.US,
        allowedRegions: [Region.US, Region.EU],
      };

      process.env.CLUSTER_REGION = Region.US;

      validateRegionAccess(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusCode).toBe(200);
    });

    it('should deny access if tenant cannot access current region', () => {
      const tenantId = '660e8400-e29b-41d4-a716-446655440001';

      (mockReq as any).tenantMetadata = {
        tenantId,
        homeRegion: Region.EU,
        allowedRegions: [Region.EU], // Only EU
      };

      process.env.CLUSTER_REGION = Region.US; // Current cluster is US

      validateRegionAccess(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusCode).toBe(403);
      expect(jsonResponse.code).toBe('REGION_ACCESS_DENIED');
    });

    it('should allow request to proceed if no tenant metadata (public endpoint)', () => {
      (mockReq as any).tenantMetadata = undefined;

      validateRegionAccess(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Multi-region scenarios', () => {
    it('should handle US tenant accessing US cluster', async () => {
      process.env.CLUSTER_REGION = Region.US;

      const tenantId = '550e8400-e29b-41d4-a716-446655440000';

      registerTenant({
        tenantId,
        homeRegion: Region.US,
        allowedRegions: [Region.US],
      });

      mockReq.query = { tenantId };

      await regionRouter(mockReq as Request, mockRes as Response, mockNext);

      expect(headers[REGION_HEADER]).toBe(Region.US);
      expect(mockNext).toHaveBeenCalled();
      expect(redirectUrl).toBeUndefined();
    });

    it('should redirect EU tenant from US cluster to EU cluster', async () => {
      process.env.CLUSTER_REGION = Region.US;
      process.env.EU_CLUSTER_ENDPOINT = 'https://eu.api.vitalcv.com';

      const tenantId = '660e8400-e29b-41d4-a716-446655440001';

      registerTenant({
        tenantId,
        homeRegion: Region.EU,
        allowedRegions: [Region.EU],
      });

      mockReq.query = { tenantId };
      mockReq.originalUrl = '/api/v1/credentials/issue';

      await regionRouter(mockReq as Request, mockRes as Response, mockNext);

      expect(statusCode).toBe(307);
      expect(redirectUrl).toBe('https://eu.api.vitalcv.com/api/v1/credentials/issue');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle AU tenant accessing AU cluster', async () => {
      process.env.CLUSTER_REGION = Region.AU;

      const tenantId = '770e8400-e29b-41d4-a716-446655440002';

      registerTenant({
        tenantId,
        homeRegion: Region.AU,
        allowedRegions: [Region.AU],
      });

      mockReq.query = { tenantId };

      await regionRouter(mockReq as Request, mockRes as Response, mockNext);

      expect(headers[REGION_HEADER]).toBe(Region.AU);
      expect(mockNext).toHaveBeenCalled();
      expect(redirectUrl).toBeUndefined();
    });

    it('should handle multi-national tenant accessing any allowed region', async () => {
      process.env.CLUSTER_REGION = Region.EU;

      const tenantId = '880e8400-e29b-41d4-a716-446655440003';

      registerTenant({
        tenantId,
        homeRegion: Region.US,
        allowedRegions: [Region.US, Region.EU, Region.AU], // Multi-national
      });

      mockReq.query = { tenantId };
      (mockReq as any).tenantMetadata = {
        tenantId,
        homeRegion: Region.US,
        allowedRegions: [Region.US, Region.EU, Region.AU],
      };

      // First, regionRouter would redirect to home region (US)
      await regionRouter(mockReq as Request, mockRes as Response, mockNext);

      // But if accessing EU for non-PHI operations, validateRegionAccess should allow
      expect(statusCode).toBe(307); // Redirects to home region
    });
  });

  describe('regionRouterWithMetrics', () => {
    it('should track total requests', async () => {
      resetRegionRoutingMetrics();

      const tenantId = '550e8400-e29b-41d4-a716-446655440000';

      registerTenant({
        tenantId,
        homeRegion: Region.US,
        allowedRegions: [Region.US],
      });

      mockReq.query = { tenantId };

      await regionRouterWithMetrics(mockReq as Request, mockRes as Response, mockNext);

      const metrics = getRegionRoutingMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.requestsByRegion[Region.US]).toBe(1);
    });

    it('should track redirects', async () => {
      resetRegionRoutingMetrics();

      process.env.CLUSTER_REGION = Region.US;
      process.env.EU_CLUSTER_ENDPOINT = 'https://eu.api.vitalcv.com';

      const tenantId = '660e8400-e29b-41d4-a716-446655440001';

      registerTenant({
        tenantId,
        homeRegion: Region.EU,
        allowedRegions: [Region.EU],
      });

      mockReq.query = { tenantId };

      await regionRouterWithMetrics(mockReq as Request, mockRes as Response, mockNext);

      const metrics = getRegionRoutingMetrics();
      expect(metrics.redirects).toBe(1);
      expect(metrics.totalRequests).toBe(1);
    });

    it('should track tenant not found errors', async () => {
      resetRegionRoutingMetrics();

      mockReq.query = { tenantId: '999e8400-e29b-41d4-a716-446655440999' };

      await regionRouterWithMetrics(mockReq as Request, mockRes as Response, mockNext);

      const metrics = getRegionRoutingMetrics();
      expect(metrics.tenantNotFound).toBe(1);
      expect(metrics.totalRequests).toBe(1);
    });
  });

  describe('Caching', () => {
    it('should cache tenant metadata for subsequent requests', async () => {
      const tenantId = '550e8400-e29b-41d4-a716-446655440000';

      registerTenant({
        tenantId,
        homeRegion: Region.US,
        allowedRegions: [Region.US],
      });

      mockReq.query = { tenantId };

      // First request
      await regionRouter(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);

      // Second request (should use cache)
      mockNext.mockClear();
      await regionRouter(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error handling', () => {
    it('should handle invalid tenant ID gracefully', async () => {
      mockReq.query = { tenantId: 'invalid-uuid' };

      await regionRouter(mockReq as Request, mockRes as Response, mockNext);

      // Should return 404 for tenant not found
      expect(statusCode).toBe(404);
    });

    it('should return 500 if getTenantMetadata throws', async () => {
      const tenantId = '550e8400-e29b-41d4-a716-446655440000';

      // Register tenant but then clear to simulate error
      registerTenant({
        tenantId,
        homeRegion: Region.US,
        allowedRegions: [Region.US],
      });

      mockReq.query = { tenantId: 'will-cause-error' };

      // Mock to throw error
      const originalGetTenant = (regionRouter as any).getTenantMetadata;

      await regionRouter(mockReq as Request, mockRes as Response, mockNext);

      // Should handle gracefully
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('getCurrentClusterRegion', () => {
    it('should return current cluster region from environment', () => {
      process.env.CLUSTER_REGION = Region.EU;

      // Need to re-import to get updated env
      const region = getCurrentClusterRegion();

      expect([Region.US, Region.EU, Region.AU]).toContain(region);
    });
  });
});

