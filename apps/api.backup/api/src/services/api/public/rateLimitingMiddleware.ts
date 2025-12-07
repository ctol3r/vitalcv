// B235B-API-017: RateLimitingMiddleware - Applies request rate limits

import { Request, Response, NextFunction } from 'express';
import { APIQuotaService, UsageUpdate } from './apiQuotaService';
import { extractAPIKeyFromHeader } from './models/APIKey';
import { APIKeyManagementService } from './apiKeyService';

export interface RateLimitRequest extends Request {
  apiKeyId?: string;
  apiKeyOwnerOrgId?: string;
}

/**
 * Middleware that applies rate limits based on API quotas
 */
export function createRateLimitingMiddleware(
  quotaService: APIQuotaService,
  apiKeyService: APIKeyManagementService
) {
  return async (
    req: RateLimitRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    // Extract API key from Authorization header
    const authHeader = req.headers.authorization;
    const plaintextKey = extractAPIKeyFromHeader(authHeader);

    if (!plaintextKey) {
      // No API key provided, continue (other auth middleware will handle)
      return next();
    }

    // Verify API key
    const apiKey = await apiKeyService.verifyAPIKey(plaintextKey);
    if (!apiKey) {
      res.status(401).json({
        error: 'Invalid API key',
        code: 'INVALID_API_KEY',
      });
      return;
    }

    // Store API key info in request
    req.apiKeyId = apiKey.id;
    req.apiKeyOwnerOrgId = apiKey.ownerOrgId;

    // Check quota before processing request
    const usage: UsageUpdate = {
      requests: 1,
      // We'll update data transfer after we know the response size
    };

    const quotaCheck = await quotaService.checkQuota(apiKey.id, usage);

    if (!quotaCheck.allowed) {
      res.status(429).json({
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        exceededQuotas: quotaCheck.exceededQuotas,
        message: `Quota exceeded for: ${quotaCheck.exceededQuotas.join(', ')}`,
      });
      return;
    }

    // Record start time for latency calculation
    const startTime = Date.now();

    // Override res.json to capture response size
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      // Calculate data transfer (approximate)
      const responseSize = JSON.stringify(body).length;
      const dataTransfer = Buffer.byteLength(JSON.stringify(body), 'utf8');

      // Record usage asynchronously (don't block response)
      quotaService
        .recordUsage(apiKey.id, {
          requests: 1,
          dataTransferBytes: dataTransfer,
        })
        .catch((err) => {
          console.error('Failed to record API usage:', err);
        });

      return originalJson(body);
    };

    // Continue to next middleware
    next();
  };
}

/**
 * Middleware for checking special operation quotas
 */
export function createSpecialOpRateLimitMiddleware(
  quotaService: APIQuotaService
) {
  return async (
    req: RateLimitRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!req.apiKeyId) {
      return next(); // No API key, skip
    }

    const usage: UsageUpdate = {
      isSpecialOp: true,
    };

    const quotaCheck = await quotaService.checkQuota(req.apiKeyId, usage);

    if (!quotaCheck.allowed) {
      res.status(429).json({
        error: 'Special operation quota exceeded',
        code: 'SPECIAL_OP_QUOTA_EXCEEDED',
        exceededQuotas: quotaCheck.exceededQuotas,
      });
      return;
    }

    // Record usage
    await quotaService.recordUsage(req.apiKeyId, usage);

    next();
  };
}

