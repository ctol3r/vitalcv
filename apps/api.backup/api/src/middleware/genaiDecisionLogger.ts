/**
 * B131F-GENAI-005: DecisionLog writer middleware for AI-assisted endpoints
 *
 * Middleware that wraps AI-powered endpoints to log inputs/outputs (hashed),
 * modelId, risk categories, and human overrides.
 */

import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

// Use singleton pattern for Prisma client
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export interface DecisionLogOptions {
  modelId: string; // Model identifier (e.g., 'gpt-4', 'claude-3-opus')
  endpoint: string; // API endpoint name
  hashInput?: (req: Request) => string; // Custom function to hash input
  hashOutput?: (res: Response, body: any) => string; // Custom function to hash output
  extractRiskTags?: (req: Request, res: Response, body: any) => string[]; // Extract risk tags
  extractUserId?: (req: Request) => string | undefined; // Extract user ID
  extractOrgId?: (req: Request) => string | undefined; // Extract org ID
  extractMetadata?: (req: Request, res: Response, body: any) => any; // Extract metadata
}

/**
 * Default hash function - strips PHI and hashes JSON body
 */
function defaultHashInput(req: Request): string {
  // Extract request body, headers, and query params (excluding sensitive data)
  const inputData = {
    method: req.method,
    path: req.path,
    query: req.query,
    body: redactPHI(req.body || {}),
    headers: redactHeaders(req.headers),
  };

  const jsonString = JSON.stringify(inputData);
  return crypto.createHash('sha256').update(jsonString).digest('hex');
}

/**
 * Default hash function for output
 */
function defaultHashOutput(res: Response, body: any): string {
  const outputData = redactPHI(body || {});
  const jsonString = JSON.stringify(outputData);
  return crypto.createHash('sha256').update(jsonString).digest('hex');
}

/**
 * Redact PHI (Protected Health Information) from data
 */
function redactPHI(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => redactPHI(item));
  }

  const redacted: any = {};
  const phiPatterns = [
    /ssn|social.security/i,
    /npi/i,
    /date.of.birth|dob|birthdate/i,
    /phone|mobile|cell/i,
    /email/i,
    /address/i,
    /name/i,
    /patient/i,
    /mrn|medical.record/i,
  ];

  for (const [key, value] of Object.entries(data)) {
    const isPHI = phiPatterns.some((pattern) => pattern.test(key));

    if (isPHI) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactPHI(value);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

/**
 * Redact sensitive headers
 */
function redactHeaders(headers: any): any {
  const sensitiveHeaders = [
    'authorization',
    'cookie',
    'x-api-key',
    'x-auth-token',
    'x-access-token',
  ];

  const redacted: any = {};
  for (const [key, value] of Object.entries(headers)) {
    if (sensitiveHeaders.some((h) => key.toLowerCase().includes(h.toLowerCase()))) {
      redacted[key] = '[REDACTED]';
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

/**
 * Create decision log entry
 */
async function createDecisionLog(
  options: DecisionLogOptions,
  req: Request,
  res: Response,
  responseBody: any
): Promise<void> {
  try {
    const inputHash = options.hashInput ? options.hashInput(req) : defaultHashInput(req);
    const outputHash = options.hashOutput
      ? options.hashOutput(res, responseBody)
      : defaultHashOutput(res, responseBody);
    const riskTags = options.extractRiskTags
      ? options.extractRiskTags(req, res, responseBody)
      : [];
    const userId = options.extractUserId ? options.extractUserId(req) : undefined;
    const orgId = options.extractOrgId ? options.extractOrgId(req) : undefined;
    const metadata = options.extractMetadata ? options.extractMetadata(req, res, responseBody) : undefined;

    // Get model card ID if model exists
    const modelCard = await prisma.modelCard.findUnique({
      where: { modelId: options.modelId },
    });

    // Create decision log entry
    await prisma.decisionLog.create({
      data: {
        modelCardId: modelCard?.id,
        modelId: options.modelId,
        endpoint: options.endpoint,
        inputHash,
        outputHash,
        riskTags,
        humanOverride: false, // Default to false, can be updated if human override detected
        userId,
        orgId,
        metadata,
        timestamp: new Date(),
      },
    });

    console.log(`[DecisionLog] Logged decision for model ${options.modelId} on endpoint ${options.endpoint}`);
  } catch (error) {
    // Don't fail the request if logging fails
    console.error('[DecisionLog] Failed to log decision:', error);
  }
}

/**
 * Middleware factory to create decision logger middleware
 */
export function createDecisionLogger(options: DecisionLogOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Store original response.json method
    const originalJson = res.json.bind(res);

    // Override response.json to capture response body
    res.json = function (body: any) {
      // Call original json method
      const result = originalJson(body);

      // Log decision asynchronously (don't wait for it)
      createDecisionLog(options, req, res, body).catch((error) => {
        console.error('[DecisionLog] Async logging failed:', error);
      });

      return result;
    };

    next();
  };
}

/**
 * Helper function to mark decision as human override
 */
export async function markDecisionAsOverride(
  decisionLogId: string,
  reason: string,
  userId?: string
): Promise<void> {
  try {
    await prisma.decisionLog.update({
      where: { id: decisionLogId },
      data: {
        humanOverride: true,
        overrideReason: reason,
        userId: userId || undefined,
      },
    });
  } catch (error) {
    console.error('[DecisionLog] Failed to mark decision as override:', error);
  }
}

/**
 * Helper function to update risk tags for a decision
 */
export async function updateDecisionRiskTags(
  decisionLogId: string,
  riskTags: string[]
): Promise<void> {
  try {
    await prisma.decisionLog.update({
      where: { id: decisionLogId },
      data: {
        riskTags,
      },
    });
  } catch (error) {
    console.error('[DecisionLog] Failed to update risk tags:', error);
  }
}

