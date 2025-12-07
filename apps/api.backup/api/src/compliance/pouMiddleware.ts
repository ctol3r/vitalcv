/**
 * COMP-002: Purpose of Use and Minimum Necessary Enforcement Middleware
 *
 * Reads PoU and role claims from auth token, consults policy table
 * (role × PoU × resource → allowed attributes), and filters response
 * payloads accordingly before JSON serialization.
 */

import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type PurposeOfUse = 'TREATMENT' | 'OPERATIONS' | 'RESEARCH' | 'PAYMENT' | 'DIRECTORY' | 'PUBLIC_HEALTH';
export type ResourceType = 'Credential' | 'Candidate' | 'ProviderDirectory' | 'AuditEvent';

export interface PouRequest extends Request {
  user?: {
    id: string;
    role: string;
    pou?: PurposeOfUse;
  };
  pouContext?: {
    purposeOfUse: PurposeOfUse;
    role: string;
    allowedAttributes?: string[];
  };
}

/**
 * Extract Purpose of Use from request
 * Checks: JWT claim, header, query param (in that order)
 */
function extractPurposeOfUse(req: PouRequest): PurposeOfUse | null {
  // 1. Check JWT claim
  if (req.user?.pou) {
    return req.user.pou as PurposeOfUse;
  }

  // 2. Check header
  const headerPou = req.headers['x-purpose-of-use'] as string;
  if (headerPou) {
    return headerPou as PurposeOfUse;
  }

  // 3. Check query param
  const queryPou = req.query.purposeOfUse as string;
  if (queryPou) {
    return queryPou as PurposeOfUse;
  }

  return null;
}

/**
 * Infer resource type from request path
 */
function inferResourceType(req: Request): ResourceType | null {
  const path = req.path.toLowerCase();

  if (path.includes('/credential') || path.includes('/credentials')) {
    return 'Credential';
  }
  if (path.includes('/candidate') || path.includes('/candidates')) {
    return 'Candidate';
  }
  if (path.includes('/provider') || path.includes('/directory')) {
    return 'ProviderDirectory';
  }
  if (path.includes('/audit') || path.includes('/auditevent')) {
    return 'AuditEvent';
  }

  return null;
}

/**
 * Get allowed attributes from policy table
 */
async function getAllowedAttributes(
  role: string,
  purposeOfUse: PurposeOfUse,
  resourceType: ResourceType
): Promise<string[] | null> {
  const policy = await prisma.pouPolicy.findUnique({
    where: {
      role_purposeOfUse_resourceType: {
        role,
        purposeOfUse,
        resourceType,
      },
    },
  });

  return policy?.allowedAttributes || null;
}

/**
 * Filter object to only include allowed attributes
 */
function filterAttributes<T extends Record<string, any>>(
  obj: T,
  allowedAttributes: string[]
): Partial<T> {
  const filtered: Partial<T> = {};

  for (const attr of allowedAttributes) {
    if (attr in obj) {
      filtered[attr as keyof T] = obj[attr];
    }
  }

  return filtered;
}

/**
 * Recursively filter nested objects/arrays
 */
function filterResponsePayload(
  payload: any,
  allowedAttributes: string[]
): any {
  if (payload === null || payload === undefined) {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map(item => filterResponsePayload(item, allowedAttributes));
  }

  if (typeof payload === 'object') {
    const filtered: any = {};

    for (const attr of allowedAttributes) {
      if (attr in payload) {
        filtered[attr] = filterResponsePayload(payload[attr], allowedAttributes);
      }
    }

    return filtered;
  }

  return payload;
}

/**
 * PoU Middleware - Main middleware function
 *
 * Usage:
 *   app.use('/api/credentials', pouMiddleware);
 *   app.use('/api/candidates', pouMiddleware);
 *   app.use('/api/provider-directory', pouMiddleware);
 */
export function pouMiddleware(req: PouRequest, res: Response, next: NextFunction) {
  // Skip if no user authenticated
  if (!req.user) {
    return next();
  }

  // Extract PoU
  const purposeOfUse = extractPurposeOfUse(req);
  if (!purposeOfUse) {
    // If PoU is required but missing, reject (can be made optional via config)
    // For now, allow through without filtering if PoU not specified
    return next();
  }

  // Infer resource type
  const resourceType = inferResourceType(req);
  if (!resourceType) {
    // No resource type inferred, skip filtering
    return next();
  }

  // Get role from user
  const role = req.user.role || 'user';

  // Look up policy asynchronously (non-blocking)
  getAllowedAttributes(role, purposeOfUse, resourceType)
    .then(allowedAttributes => {
      if (allowedAttributes) {
        // Store in request context
        req.pouContext = {
          purposeOfUse,
          role,
          allowedAttributes,
        };

        // Intercept response.json to filter payload
        const originalJson = res.json.bind(res);
        res.json = function(body: any) {
          const filtered = filterResponsePayload(body, allowedAttributes);
          return originalJson(filtered);
        };
      }

      next();
    })
    .catch(err => {
      console.error('Error fetching PouPolicy:', err);
      // On error, allow through without filtering (fail open for availability)
      next();
    });
}

/**
 * Helper function to manually filter a payload
 * Useful for service-layer filtering
 */
export async function applyMinimumNecessary(
  payload: any,
  role: string,
  purposeOfUse: PurposeOfUse,
  resourceType: ResourceType
): Promise<any> {
  const allowedAttributes = await getAllowedAttributes(role, purposeOfUse, resourceType);

  if (!allowedAttributes) {
    // No policy found, return as-is (or throw error if strict mode)
    return payload;
  }

  return filterResponsePayload(payload, allowedAttributes);
}

/**
 * Create or update a PoU policy
 */
export async function upsertPouPolicy(
  role: string,
  purposeOfUse: PurposeOfUse,
  resourceType: ResourceType,
  allowedAttributes: string[]
): Promise<void> {
  await prisma.pouPolicy.upsert({
    where: {
      role_purposeOfUse_resourceType: {
        role,
        purposeOfUse,
        resourceType,
      },
    },
    create: {
      role,
      purposeOfUse,
      resourceType,
      allowedAttributes,
    },
    update: {
      allowedAttributes,
    },
  });
}

