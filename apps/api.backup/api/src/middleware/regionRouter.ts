/**
 * B139A-INTL-003: Region Routing Middleware
 *
 * Routes requests to the correct regional cluster based on tenant homeRegion.
 * Adds X-VitalCV-Region header and redirects if necessary.
 *
 * Flow:
 * 1. Extract tenant ID from JWT or subdomain
 * 2. Look up tenant's homeRegion from tenant registry
 * 3. Add X-VitalCV-Region header
 * 4. If current cluster != homeRegion, redirect to correct regional endpoint
 * 5. Otherwise, proceed with request
 */

import { Request, Response, NextFunction } from 'express';
import { Region, getRegionalEndpoint, canAccessRegion } from '../../../../services/org/models/TenantRegion';

/**
 * Region header name
 */
export const REGION_HEADER = 'x-vitalcv-region';

/**
 * Current cluster region (set via environment variable)
 */
export const CURRENT_CLUSTER_REGION: Region = (process.env.CLUSTER_REGION as Region) || Region.US;

/**
 * Tenant metadata interface (minimal)
 */
interface TenantMetadata {
  tenantId: string;
  homeRegion: Region;
  allowedRegions: Region[];
}

/**
 * In-memory tenant registry cache
 * In production, this would be backed by DynamoDB Global Table or similar
 */
const tenantRegistryCache = new Map<string, TenantMetadata>();

/**
 * TTL for cache entries (5 minutes)
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Cache entry with expiration
 */
interface CacheEntry {
  tenant: TenantMetadata;
  expiresAt: number;
}

const cacheEntries = new Map<string, CacheEntry>();

/**
 * Get tenant metadata from global registry
 * In production, this would query DynamoDB Global Table
 */
async function getTenantMetadata(tenantId: string): Promise<TenantMetadata | null> {
  // Check cache first
  const cached = cacheEntries.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.tenant;
  }

  // In production, query DynamoDB Global Table
  // For now, simulate with environment-based lookup or database query
  try {
    // This would be replaced with actual DynamoDB query:
    // const result = await dynamoDB.getItem({ TableName: 'tenant-registry', Key: { tenantId } });

    // Simulate with in-memory registry for testing
    const tenant = tenantRegistryCache.get(tenantId);
    if (!tenant) {
      return null;
    }

    // Cache for TTL
    cacheEntries.set(tenantId, {
      tenant,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return tenant;
  } catch (error) {
    console.error(`Failed to fetch tenant metadata for ${tenantId}:`, error);
    return null;
  }
}

/**
 * Extract tenant ID from request
 * Supports multiple methods:
 * - JWT claim (req.user.orgId)
 * - Subdomain (tenant-id.api.vitalcv.com)
 * - Header (X-Tenant-ID)
 * - Query parameter (?tenantId=...)
 */
function extractTenantId(req: Request): string | null {
  // 1. Check JWT (most common in authenticated requests)
  if (req.user && (req.user as any).orgId) {
    return (req.user as any).orgId;
  }

  // 2. Check custom header
  const headerTenantId = req.headers['x-tenant-id'] as string;
  if (headerTenantId) {
    return headerTenantId;
  }

  // 3. Check subdomain (e.g., mayo-clinic.api.vitalcv.com)
  const host = req.headers.host;
  if (host) {
    const subdomain = host.split('.')[0];
    // In production, you'd resolve subdomain -> tenantId
    // For now, treat subdomain as tentantId if it's a UUID format
    if (subdomain && /^[0-9a-f-]{36}$/i.test(subdomain)) {
      return subdomain;
    }
  }

  // 4. Check query parameter (least secure, only for testing)
  if (req.query.tenantId && typeof req.query.tenantId === 'string') {
    return req.query.tenantId;
  }

  return null;
}

/**
 * Build regional endpoint URL for redirect
 */
function buildRegionalUrl(region: Region, originalUrl: string): string {
  const regionEndpoint = process.env[`${region.toUpperCase()}_CLUSTER_ENDPOINT`] ||
                         `https://${region}.api.vitalcv.com`;
  return `${regionEndpoint}${originalUrl}`;
}

/**
 * Region routing middleware
 *
 * Usage:
 * ```typescript
 * import { regionRouter } from './middleware/regionRouter';
 * app.use(regionRouter);
 * ```
 */
export async function regionRouter(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract tenant ID
    const tenantId = extractTenantId(req);

    if (!tenantId) {
      // No tenant ID found - could be public endpoint or unauthenticated request
      // Allow to proceed without region routing
      console.warn('Region router: No tenant ID found in request');
      return next();
    }

    // Fetch tenant metadata
    const tenant = await getTenantMetadata(tenantId);

    if (!tenant) {
      // Tenant not found in registry
      return res.status(404).json({
        error: 'Tenant not found',
        code: 'TENANT_NOT_FOUND',
        tenantId,
      });
    }

    // Add region header
    const homeRegion = tenant.homeRegion;
    res.setHeader(REGION_HEADER, homeRegion);
    (req as any).tenantRegion = homeRegion; // Attach to request for downstream use
    (req as any).tenantMetadata = tenant;

    // Check if current cluster matches homeRegion
    if (CURRENT_CLUSTER_REGION !== homeRegion) {
      console.log(
        `Region router: Redirecting tenant ${tenantId} from ${CURRENT_CLUSTER_REGION} to ${homeRegion}`
      );

      // Redirect to correct regional cluster
      const targetUrl = buildRegionalUrl(homeRegion, req.originalUrl);

      // Use 307 to preserve method and body
      return res.redirect(307, targetUrl);
    }

    // Request is already in correct region
    console.debug(`Region router: Request for tenant ${tenantId} in correct region ${homeRegion}`);
    next();
  } catch (error) {
    console.error('Region router error:', error);
    return res.status(500).json({
      error: 'Region routing failed',
      code: 'REGION_ROUTING_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Middleware to validate region access
 * Use this AFTER regionRouter to ensure tenant can access requested resources in this region
 */
export function validateRegionAccess(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const tenant = (req as any).tenantMetadata as TenantMetadata | undefined;

  if (!tenant) {
    // No tenant metadata (likely public endpoint or regionRouter not run)
    return next();
  }

  const currentRegion = CURRENT_CLUSTER_REGION;

  if (!canAccessRegion(tenant, currentRegion)) {
    console.warn(
      `Region access denied: Tenant ${tenant.tenantId} cannot access region ${currentRegion}. Allowed: [${tenant.allowedRegions.join(', ')}]`
    );
    return res.status(403).json({
      error: 'Region access denied',
      code: 'REGION_ACCESS_DENIED',
      tenantId: tenant.tenantId,
      requestedRegion: currentRegion,
      allowedRegions: tenant.allowedRegions,
    });
  }

  next();
}

/**
 * Register a tenant in the in-memory registry (for testing/development)
 * In production, tenants are registered in DynamoDB Global Table
 */
export function registerTenant(tenant: TenantMetadata): void {
  tenantRegistryCache.set(tenant.tenantId, tenant);
  console.log(
    `Tenant registered: ${tenant.tenantId} (homeRegion: ${tenant.homeRegion}, allowedRegions: [${tenant.allowedRegions.join(', ')}])`
  );
}

/**
 * Clear tenant registry cache (for testing)
 */
export function clearTenantRegistry(): void {
  tenantRegistryCache.clear();
  cacheEntries.clear();
}

/**
 * Get current cluster region
 */
export function getCurrentClusterRegion(): Region {
  return CURRENT_CLUSTER_REGION;
}

/**
 * Check if current cluster is in a specific region
 */
export function isRegion(region: Region): boolean {
  return CURRENT_CLUSTER_REGION === region;
}

/**
 * Metrics for region routing
 */
export interface RegionRoutingMetrics {
  totalRequests: number;
  redirects: number;
  errors: number;
  tenantNotFound: number;
  regionAccessDenied: number;
  requestsByRegion: Record<Region, number>;
}

const metrics: RegionRoutingMetrics = {
  totalRequests: 0,
  redirects: 0,
  errors: 0,
  tenantNotFound: 0,
  regionAccessDenied: 0,
  requestsByRegion: {
    [Region.US]: 0,
    [Region.EU]: 0,
    [Region.AU]: 0,
  },
};

/**
 * Get region routing metrics
 */
export function getRegionRoutingMetrics(): RegionRoutingMetrics {
  return { ...metrics };
}

/**
 * Reset region routing metrics (for testing)
 */
export function resetRegionRoutingMetrics(): void {
  metrics.totalRequests = 0;
  metrics.redirects = 0;
  metrics.errors = 0;
  metrics.tenantNotFound = 0;
  metrics.regionAccessDenied = 0;
  Object.keys(metrics.requestsByRegion).forEach((region) => {
    metrics.requestsByRegion[region as Region] = 0;
  });
}

/**
 * Increment metrics
 */
function incrementMetric(metric: keyof RegionRoutingMetrics): void {
  if (typeof metrics[metric] === 'number') {
    (metrics[metric] as number)++;
  }
}

/**
 * Enhanced region router with metrics
 */
export async function regionRouterWithMetrics(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  incrementMetric('totalRequests');

  try {
    const tenantId = extractTenantId(req);

    if (!tenantId) {
      console.warn('Region router: No tenant ID found in request');
      return next();
    }

    const tenant = await getTenantMetadata(tenantId);

    if (!tenant) {
      incrementMetric('tenantNotFound');
      return res.status(404).json({
        error: 'Tenant not found',
        code: 'TENANT_NOT_FOUND',
        tenantId,
      });
    }

    const homeRegion = tenant.homeRegion;
    metrics.requestsByRegion[homeRegion]++;

    res.setHeader(REGION_HEADER, homeRegion);
    (req as any).tenantRegion = homeRegion;
    (req as any).tenantMetadata = tenant;

    if (CURRENT_CLUSTER_REGION !== homeRegion) {
      incrementMetric('redirects');
      console.log(
        `Region router: Redirecting tenant ${tenantId} from ${CURRENT_CLUSTER_REGION} to ${homeRegion}`
      );

      const targetUrl = buildRegionalUrl(homeRegion, req.originalUrl);
      return res.redirect(307, targetUrl);
    }

    console.debug(`Region router: Request for tenant ${tenantId} in correct region ${homeRegion}`);
    next();
  } catch (error) {
    incrementMetric('errors');
    console.error('Region router error:', error);
    return res.status(500).json({
      error: 'Region routing failed',
      code: 'REGION_ROUTING_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Example configuration for different clusters
 */
export const CLUSTER_CONFIGS = {
  /**
   * US Cluster Configuration
   */
  US: {
    clusterRegion: Region.US,
    endpoints: {
      primary: 'https://us-east-1.api.vitalcv.com',
      secondary: 'https://us-west-2.api.vitalcv.com',
    },
    database: {
      host: 'us-primary.rds.amazonaws.com',
      port: 5432,
      database: 'vitalcv_us',
    },
  },

  /**
   * EU Cluster Configuration
   */
  EU: {
    clusterRegion: Region.EU,
    endpoints: {
      primary: 'https://eu-central-1.api.vitalcv.com',
      secondary: 'https://eu-west-1.api.vitalcv.com',
    },
    database: {
      host: 'eu-primary.rds.amazonaws.com',
      port: 5432,
      database: 'vitalcv_eu',
    },
  },

  /**
   * AU Cluster Configuration
   */
  AU: {
    clusterRegion: Region.AU,
    endpoints: {
      primary: 'https://ap-southeast-2.api.vitalcv.com',
    },
    database: {
      host: 'au-primary.rds.amazonaws.com',
      port: 5432,
      database: 'vitalcv_au',
    },
  },
};

