/**
 * B235A-API-008: APIVersioningStrategy
 *
 * Implements versioning via URL path or header.
 * Supports v1 and future versions.
 * Adds deprecation warnings.
 */

import { Request, Response, NextFunction } from 'express';

export type APIVersion = 'v1' | 'v2';

export interface VersionedRequest extends Request {
  apiVersion?: APIVersion;
}

/**
 * Default API version
 */
const DEFAULT_VERSION: APIVersion = 'v1';

/**
 * Supported API versions
 */
const SUPPORTED_VERSIONS: APIVersion[] = ['v1'];

/**
 * Deprecated versions (with deprecation dates)
 */
const DEPRECATED_VERSIONS: Record<string, { deprecatedAt: Date; sunsetAt?: Date }> = {
  // Example: v1 will be deprecated in the future
  // v1: { deprecatedAt: new Date('2026-01-01'), sunsetAt: new Date('2026-07-01') }
};

/**
 * Extract API version from request
 */
export function extractApiVersion(req: Request): APIVersion {
  // Check URL path: /api/public/v1/...
  const pathMatch = req.path.match(/\/api\/public\/(v\d+)/);
  if (pathMatch) {
    const version = pathMatch[1] as APIVersion;
    if (SUPPORTED_VERSIONS.includes(version)) {
      return version;
    }
  }

  // Check Accept header: application/vnd.chai-vc.v1+json
  const acceptHeader = req.headers.accept;
  if (acceptHeader) {
    const versionMatch = acceptHeader.match(/application\/vnd\.chai-vc\.(v\d+)\+json/);
    if (versionMatch) {
      const version = versionMatch[1] as APIVersion;
      if (SUPPORTED_VERSIONS.includes(version)) {
        return version;
      }
    }
  }

  // Check custom header: X-API-Version
  const versionHeader = req.headers['x-api-version'];
  if (versionHeader && typeof versionHeader === 'string') {
    const version = versionHeader as APIVersion;
    if (SUPPORTED_VERSIONS.includes(version)) {
      return version;
    }
  }

  // Default to v1
  return DEFAULT_VERSION;
}

/**
 * Check if version is deprecated
 */
export function isVersionDeprecated(version: APIVersion): boolean {
  return version in DEPRECATED_VERSIONS;
}

/**
 * Get deprecation info for version
 */
export function getDeprecationInfo(version: APIVersion) {
  return DEPRECATED_VERSIONS[version];
}

/**
 * Add deprecation warning headers
 */
export function addDeprecationHeaders(res: Response, version: APIVersion) {
  const deprecationInfo = getDeprecationInfo(version);
  if (deprecationInfo) {
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', deprecationInfo.sunsetAt?.toISOString() || '');

    const warning = `API version ${version} is deprecated. Deprecated at: ${deprecationInfo.deprecatedAt.toISOString()}`;
    if (deprecationInfo.sunsetAt) {
      res.setHeader('Warning', `299 - "${warning}. Sunset date: ${deprecationInfo.sunsetAt.toISOString()}"`);
    } else {
      res.setHeader('Warning', `299 - "${warning}"`);
    }
  }
}

/**
 * Middleware to extract and validate API version
 */
export function apiVersionMiddleware(
  req: VersionedRequest,
  res: Response,
  next: NextFunction
) {
  const version = extractApiVersion(req);
  req.apiVersion = version;

  // Add version to response headers
  res.setHeader('X-API-Version', version);

  // Add deprecation warnings if applicable
  if (isVersionDeprecated(version)) {
    addDeprecationHeaders(res, version);
  }

  // Check if version is supported
  if (!SUPPORTED_VERSIONS.includes(version)) {
    return res.status(400).json({
      error: 'Unsupported API Version',
      message: `API version ${version} is not supported`,
      supportedVersions: SUPPORTED_VERSIONS,
    });
  }

  next();
}

/**
 * Get API version from request (helper function)
 */
export function getApiVersion(req: Request): APIVersion {
  return extractApiVersion(req);
}

/**
 * Format API path with version
 */
export function formatVersionedPath(path: string, version: APIVersion = DEFAULT_VERSION): string {
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;

  // Don't add version if it's already in the path
  if (cleanPath.startsWith(`api/public/${version}/`)) {
    return `/${cleanPath}`;
  }

  return `/api/public/${version}/${cleanPath}`;
}

