const log = getServiceLogger('logging/sandboxChannel');
/**
 * B133B-LOG-009: Sandbox-only logging channel for partner debugging
 *
 * Detailed request/response logging for sandbox environment only.
 * Never logs PHI. Automatically disabled in production.
 * Helps partners debug their integrations.
 */

import { Request, Response } from 'express';
import { isSandboxMode } from '../../apps/api/src/config/env';
import crypto from 'crypto';
import { getServiceLogger } from './serviceLogger';

export interface SandboxLogEntry {
  id: string;
  timestamp: Date;
  partnerId: string;
  apiKeyPrefix: string;
  request: {
    method: string;
    path: string;
    headers: Record<string, string>;
    query: Record<string, any>;
    body?: any;
  };
  response: {
    statusCode: number;
    headers: Record<string, string>;
    body?: any;
    duration: number; // milliseconds
  };
  metadata?: {
    ip?: string;
    userAgent?: string;
    rateLimitRemaining?: number;
  };
}

// In-memory log storage (in production, use proper logging service)
const sandboxLogs: SandboxLogEntry[] = [];
const MAX_LOGS = 1000; // Keep last 1000 logs

/**
 * Fields that should never be logged (PHI/sensitive data)
 */
const REDACTED_FIELDS = [
  'ssn',
  'social_security',
  'date_of_birth',
  'dob',
  'password',
  'token',
  'secret',
  'api_key',
  'authorization',
  'credit_card',
  'bank_account',
];

/**
 * Check if a field name suggests PHI or sensitive data
 */
function isSensitiveField(fieldName: string): boolean {
  const lowerField = fieldName.toLowerCase();
  return REDACTED_FIELDS.some(redacted => lowerField.includes(redacted));
}

/**
 * Recursively redact sensitive fields from an object
 */
function redactSensitiveData(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitiveData(item));
  }

  if (typeof obj === 'object') {
    const redacted: any = {};

    for (const [key, value] of Object.entries(obj)) {
      if (isSensitiveField(key)) {
        redacted[key] = '[REDACTED]';
      } else if (typeof value === 'object') {
        redacted[key] = redactSensitiveData(value);
      } else {
        redacted[key] = value;
      }
    }

    return redacted;
  }

  return obj;
}

/**
 * Extract API key prefix for logging (safe to log)
 */
function extractApiKeyPrefix(req: Request): string {
  const apiKey = req.get('x-api-key') || req.get('authorization')?.replace('Bearer ', '');
  if (!apiKey) {
    return 'none';
  }

  // Only log prefix
  return apiKey.substring(0, 15) + '...';
}

/**
 * Extract partner ID from request
 */
function extractPartnerId(req: Request): string {
  // Check if partner info was set by auth middleware
  const partner = (req as any).partner;
  if (partner && partner.id) {
    return partner.id;
  }

  // Otherwise, use API key hash as identifier
  const apiKey = req.get('x-api-key') || req.get('authorization')?.replace('Bearer ', '');
  if (apiKey) {
    return crypto.createHash('sha256').update(apiKey).digest('hex').substring(0, 16);
  }

  return 'anonymous';
}

/**
 * Sanitize headers for logging
 */
function sanitizeHeaders(headers: Record<string, any>): Record<string, string> {
  const sanitized: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();

    if (lowerKey === 'authorization' || lowerKey === 'x-api-key') {
      // Only log that these headers exist, not their values
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = String(value);
    }
  }

  return sanitized;
}

/**
 * Create a log entry for a request/response pair
 */
function createLogEntry(
  req: Request,
  res: Response,
  responseBody: any,
  duration: number
): SandboxLogEntry {
  const logEntry: SandboxLogEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date(),
    partnerId: extractPartnerId(req),
    apiKeyPrefix: extractApiKeyPrefix(req),
    request: {
      method: req.method,
      path: req.path,
      headers: sanitizeHeaders(req.headers as Record<string, any>),
      query: redactSensitiveData(req.query),
      body: redactSensitiveData(req.body),
    },
    response: {
      statusCode: res.statusCode,
      headers: sanitizeHeaders(res.getHeaders() as Record<string, any>),
      body: redactSensitiveData(responseBody),
      duration,
    },
    metadata: {
      ip: req.ip,
      userAgent: req.get('user-agent'),
      rateLimitRemaining: res.get('x-ratelimit-remaining-minute')
        ? parseInt(res.get('x-ratelimit-remaining-minute') || '0')
        : undefined,
    },
  };

  return logEntry;
}

/**
 * Add log entry to storage
 */
function storeLogEntry(entry: SandboxLogEntry): void {
  sandboxLogs.push(entry);

  // Keep only last MAX_LOGS entries
  if (sandboxLogs.length > MAX_LOGS) {
    sandboxLogs.shift();
  }
}

/**
 * Middleware to log sandbox requests/responses
 */
export function sandboxLoggingMiddleware(req: Request, res: Response, next: Function) {
  // Only log in sandbox mode with detailed logging enabled
  if (!isSandboxMode() || process.env.SANDBOX_DETAILED_LOGGING !== 'true') {
    return next();
  }

  // Skip logging for health checks
  if (req.path === '/health' || req.path === '/healthz') {
    return next();
  }

  const startTime = Date.now();

  // Capture response body
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  let responseBody: any;

  res.json = function(body: any) {
    responseBody = body;
    return originalJson(body);
  };

  res.send = function(body: any) {
    if (!responseBody) {
      responseBody = body;
    }
    return originalSend(body);
  };

  // Log after response is sent
  res.on('finish', () => {
    const duration = Date.now() - startTime;

    try {
      const logEntry = createLogEntry(req, res, responseBody, duration);
      storeLogEntry(logEntry);

      // Console log for real-time debugging
      log.info(`\n[SANDBOX] ${req.method} ${req.path}`);
      log.info(`  Partner: ${logEntry.partnerId}`);
      log.info(`  Status: ${res.statusCode}`);
      log.info(`  Duration: ${duration}ms`);
      log.info(`  API Key: ${logEntry.apiKeyPrefix}`);

      if (res.statusCode >= 400) {
        log.info(`  ⚠️  Error Response:`, JSON.stringify(responseBody, null, 2));
      }
    } catch (error) {
      log.error('[sandboxLogging] Error creating log entry:', error);
    }
  });

  next();
}

/**
 * Get sandbox logs for a specific partner
 */
export function getSandboxLogs(options: {
  partnerId?: string;
  apiKeyPrefix?: string;
  limit?: number;
  statusCode?: number;
  method?: string;
  pathPattern?: string;
} = {}): SandboxLogEntry[] {
  if (!isSandboxMode()) {
    throw new Error('Sandbox logs are only available in sandbox mode');
  }

  let filtered = [...sandboxLogs];

  if (options.partnerId) {
    filtered = filtered.filter(log => log.partnerId === options.partnerId);
  }

  if (options.apiKeyPrefix) {
    filtered = filtered.filter(log => log.apiKeyPrefix === options.apiKeyPrefix);
  }

  if (options.statusCode) {
    filtered = filtered.filter(log => log.response.statusCode === options.statusCode);
  }

  if (options.method) {
    filtered = filtered.filter(log => log.request.method === options.method.toUpperCase());
  }

  if (options.pathPattern) {
    const pattern = new RegExp(options.pathPattern);
    filtered = filtered.filter(log => pattern.test(log.request.path));
  }

  // Sort by timestamp (newest first)
  filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  // Limit results
  if (options.limit) {
    filtered = filtered.slice(0, options.limit);
  }

  return filtered;
}

/**
 * Get sandbox log statistics
 */
export function getSandboxLogStats(partnerId?: string): {
  totalRequests: number;
  successRate: number;
  averageDuration: number;
  errorCount: number;
  statusCodes: Record<number, number>;
  topPaths: Array<{ path: string; count: number }>;
} {
  if (!isSandboxMode()) {
    throw new Error('Sandbox logs are only available in sandbox mode');
  }

  let logs = partnerId
    ? sandboxLogs.filter(log => log.partnerId === partnerId)
    : sandboxLogs;

  const totalRequests = logs.length;
  const successCount = logs.filter(log => log.response.statusCode < 400).length;
  const errorCount = logs.filter(log => log.response.statusCode >= 400).length;
  const successRate = totalRequests > 0 ? (successCount / totalRequests) * 100 : 0;

  const totalDuration = logs.reduce((sum, log) => sum + log.response.duration, 0);
  const averageDuration = totalRequests > 0 ? totalDuration / totalRequests : 0;

  // Count status codes
  const statusCodes: Record<number, number> = {};
  for (const log of logs) {
    const code = log.response.statusCode;
    statusCodes[code] = (statusCodes[code] || 0) + 1;
  }

  // Count paths
  const pathCounts = new Map<string, number>();
  for (const log of logs) {
    const path = log.request.path;
    pathCounts.set(path, (pathCounts.get(path) || 0) + 1);
  }

  const topPaths = Array.from(pathCounts.entries())
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalRequests,
    successRate: Math.round(successRate * 100) / 100,
    averageDuration: Math.round(averageDuration * 100) / 100,
    errorCount,
    statusCodes,
    topPaths,
  };
}

/**
 * Clear sandbox logs (for testing or cleanup)
 */
export function clearSandboxLogs(): void {
  if (!isSandboxMode()) {
    throw new Error('Cannot clear logs outside of sandbox mode');
  }

  sandboxLogs.length = 0;
  log.info('🗑️  Sandbox logs cleared');
}

/**
 * Export logs as JSON (for partner download)
 */
export function exportSandboxLogs(partnerId: string): string {
  if (!isSandboxMode()) {
    throw new Error('Cannot export logs outside of sandbox mode');
  }

  const partnerLogs = getSandboxLogs({ partnerId });

  return JSON.stringify({
    exported: new Date().toISOString(),
    partnerId,
    totalLogs: partnerLogs.length,
    logs: partnerLogs,
  }, null, 2);
}

// Test function to verify PHI redaction
export function testRedaction(): void {
  const testData = {
    name: 'Test User',
    ssn: '123-45-6789',
    email: 'test@example.com',
    date_of_birth: '1990-01-01',
    medical_info: {
      password: 'secret123',
      diagnosis: 'Test diagnosis',
    },
    token: 'abc123',
  };

  const redacted = redactSensitiveData(testData);
  log.info('Original:', testData);
  log.info('Redacted:', redacted);

  // Verify sensitive fields are redacted
  if (redacted.ssn !== '[REDACTED]' ||
      redacted.date_of_birth !== '[REDACTED]' ||
      redacted.medical_info.password !== '[REDACTED]' ||
      redacted.token !== '[REDACTED]') {
    throw new Error('PHI redaction test failed!');
  }

  log.info('✅ PHI redaction test passed');
}

