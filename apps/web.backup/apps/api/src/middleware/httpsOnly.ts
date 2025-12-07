/**
 * HTTPS-only enforcement middleware
 *
 * B165B-TLS-001: Enforce HTTPS-only mode on API
 * - Rejects any non-HTTPS requests in production or staging
 * - Allows HTTP in demo/local environments to preserve DX
 * - Logs violations for compliance trail
 *
 * Usage:
 * ```ts
 * import { httpsOnly } from './middleware/httpsOnly';
 * app.use(httpsOnly());
 * ```
 */

import { Request, Response, NextFunction } from 'express';
import { isDemo } from '../config/demo';

export interface HttpsOnlyOptions {
  /**
   * Custom logger (defaults to console)
   */
  logger?: Pick<typeof console, 'warn'>;

  /**
   * Additional paths that should be allowed over HTTP
   * Useful for Kubernetes health probes that never traverse the ingress
   */
  allowHttpPaths?: RegExp[];

  /**
   * Environment names that should enforce HTTPS
   */
  enforceEnvironments?: string[];
}

const DEFAULT_ENFORCED_ENVIRONMENTS = ['production', 'prod', 'staging', 'stage'];
const DEFAULT_ALLOW_HTTP_PATHS = [
  /^\/healthz/i,
  /^\/health/i,
  /^\/readyz/i,
  /^\/livez/i,
  /^\/metrics/i,
];

function normalizeHeaderValue(header: string | string[] | undefined): string {
  if (!header) {
    return '';
  }

  if (Array.isArray(header)) {
    return header[0]?.toLowerCase() ?? '';
  }

  return header.toLowerCase();
}

function isSecureRequest(req: Request): boolean {
  if (req.secure) {
    return true;
  }

  const forwardedProto = normalizeHeaderValue(req.headers?.['x-forwarded-proto']);
  if (forwardedProto.startsWith('https')) {
    return true;
  }

  const forwardedHeader = normalizeHeaderValue(req.headers?.forwarded as any);
  if (forwardedHeader.includes('proto=https')) {
    return true;
  }

  return false;
}

function resolveEnvironment(): string {
  const candidates = [
    process.env.APP_ENV,
    process.env.DEPLOY_ENV,
    process.env.RUNTIME_ENV,
    process.env.NODE_ENV,
  ];

  return (
    candidates
      .map(env => env?.toLowerCase())
      .find(env => typeof env === 'string' && env.length > 0) ?? 'development'
  );
}

function shouldEnforceHttps(environments: string[]): boolean {
  if (process.env.HTTPS_ONLY_DISABLE === 'true') {
    return false;
  }

  if (isDemo()) {
    return false;
  }

  const currentEnv = resolveEnvironment();
  return environments.includes(currentEnv);
}

export function httpsOnly(options: HttpsOnlyOptions = {}) {
  const {
    logger = console,
    allowHttpPaths = DEFAULT_ALLOW_HTTP_PATHS,
    enforceEnvironments = DEFAULT_ENFORCED_ENVIRONMENTS,
  } = options;

  const enforcementEnabled = shouldEnforceHttps(
    enforceEnvironments.map(env => env.toLowerCase())
  );

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!enforcementEnabled) {
      return next();
    }

    const pathAllowed = allowHttpPaths.some(pattern => pattern.test(req.path));
    if (pathAllowed || isSecureRequest(req)) {
      return next();
    }

    logger.warn(
      `[HTTPS_ONLY] Blocked insecure request ${req.method} ${req.originalUrl} from ${req.ip}`
    );

    res.status(403).json({
      error: 'https_required',
      error_description: 'HTTPS is required for this environment. Retry over TLS.',
    });
  };
}

export default httpsOnly;

