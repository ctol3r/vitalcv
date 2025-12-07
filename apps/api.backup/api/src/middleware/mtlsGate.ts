/**
 * mTLS Gate Middleware
 *
 * B165B-TLS-004: Enforce optional mTLS per-organization requirements.
 * Enterprise customers upload their CA certificate; requests for those orgs
 * must present a client certificate signed by the org CA.
 */

import { Request, Response, NextFunction } from 'express';
import { X509Certificate } from 'crypto';

export interface MtlsGateOptions {
  headerName?: string;
  logger?: Pick<typeof console, 'warn' | 'error' | 'info'>;
  orgIdExtractor?: (req: Request) => string | undefined;
  bypassPaths?: RegExp[];
}

const DEFAULT_HEADER = 'x-client-cert';
const DEFAULT_BYPASS = [/^\/healthz/i, /^\/health/i, /^\/readyz/i, /^\/livez/i];

/**
 * Middleware factory
 */
export function mtlsGate(options: MtlsGateOptions = {}) {
  const {
    headerName = DEFAULT_HEADER,
    logger = console,
    orgIdExtractor = defaultOrgIdExtractor,
    bypassPaths = DEFAULT_BYPASS,
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    if (bypassPaths.some(pattern => pattern.test(req.path))) {
      return next();
    }

    const orgId = orgIdExtractor(req);

    if (!orgId || !isMtlsRequired(orgId)) {
      return next();
    }

    const caPem = getOrgCaCertificate(orgId);
    if (!caPem) {
      logger.warn(`[MTLS_GATE] Org ${orgId} marked as mTLS-required but no CA configured`);
      return res.status(503).json({
        error: 'mtls_configuration_error',
        error_description: 'mTLS is required for this organization but no CA certificate is configured',
      });
    }

    const clientPem = extractClientCertificate(req, headerName);
    if (!clientPem) {
      logger.warn(`[MTLS_GATE] Missing client certificate for org ${orgId}`);
      return res.status(403).json({
        error: 'mtls_required',
        error_description: 'Client certificate required. Retry request over mutual TLS.',
      });
    }

    try {
      const certificate = new X509Certificate(clientPem);
      const caCertificate = new X509Certificate(caPem);
      validateCertificate(certificate, caCertificate);

      (req as any).mtlsClient = {
        orgId,
        subject: certificate.subject,
        issuer: certificate.issuer,
        validTo: certificate.validTo,
      };
      (req as any).mtlsValidated = true;

      logger.info?.(`[MTLS_GATE] mTLS validated for org ${orgId} (${certificate.subject})`);
      return next();
    } catch (error) {
      const description = error instanceof Error ? error.message : 'Client certificate validation failed';
      logger.warn(`[MTLS_GATE] Invalid client certificate for org ${orgId}: ${description}`);
      return res.status(403).json({
        error: 'invalid_client_certificate',
        error_description: description,
      });
    }
  };
}

/**
 * Determine if org requires mTLS.
 * Controlled via ORG_MTLS_REQUIRED or MTLS_REQUIRED_ORGS env vars (comma-delimited).
 */
function isMtlsRequired(orgId: string): boolean {
  const candidates = process.env.ORG_MTLS_REQUIRED || process.env.MTLS_REQUIRED_ORGS || '';
  const requiredSet = new Set(
    candidates
      .split(',')
      .map(value => value.trim().toLowerCase())
      .filter(Boolean)
  );
  return requiredSet.has(orgId.toLowerCase());
}

/**
 * Load CA certificate for an org.
 * Priority:
 * 1. ORG_MTLS_CA_JSON (map of orgId -> PEM or base64)
 * 2. ENV var ORG_MTLS_CA_<ORG_ID> (normalized to uppercase + underscores)
 */
function getOrgCaCertificate(orgId: string): string | undefined {
  const normalized = orgId.toLowerCase();
  const map = parseOrgCaJson();

  if (map[normalized]) {
    return normalizePem(map[normalized]);
  }

  const envKey = `ORG_MTLS_CA_${normalized.replace(/[^a-z0-9]/gi, '_').toUpperCase()}`;
  const envValue = process.env[envKey];

  if (envValue) {
    return normalizePem(envValue);
  }

  return undefined;
}

function parseOrgCaJson(): Record<string, string> {
  const json = process.env.ORG_MTLS_CA_JSON || process.env.MTLS_CA_JSON;
  if (!json) {
    return {};
  }

  try {
    const parsed = JSON.parse(json) as Record<string, string>;
    return Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [key.toLowerCase(), value])
    );
  } catch (error) {
    console.warn('[MTLS_GATE] Failed to parse ORG_MTLS_CA_JSON:', error);
    return {};
  }
}

/**
 * Extract client certificate from header or TLS socket.
 */
function extractClientCertificate(req: Request, headerName: string): string | undefined {
  const headerValue = req.headers[headerName] || req.headers[headerName.toLowerCase()];
  const candidate = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (candidate) {
    return normalizePem(candidate);
  }

  const socketPeer = (req.socket as any)?.getPeerCertificate?.(true);
  if (socketPeer) {
    if (socketPeer.raw && socketPeer.raw.length > 0) {
      const cert = new X509Certificate(socketPeer.raw);
      return cert.toString();
    }
    if (socketPeer.pemEncoded) {
      return normalizePem(socketPeer.pemEncoded);
    }
    if (socketPeer.certificate) {
      return normalizePem(socketPeer.certificate);
    }
  }

  return undefined;
}

/**
 * Normalize PEM payloads coming from headers (URI encoded, base64, or newline-stripped).
 */
function normalizePem(value: string): string {
  if (!value) {
    return value;
  }

  let decoded = value.trim();

  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // ignore decoding failures
  }

  decoded = decoded.replace(/\\n/g, '\n');

  if (decoded.includes('-----BEGIN CERTIFICATE-----')) {
    return decoded;
  }

  // Headers from nginx may replace newlines with spaces
  if (decoded.includes('BEGIN CERTIFICATE') === false && decoded.includes('END CERTIFICATE') === false) {
    decoded = decoded.replace(/ /g, '\n');
  }

  if (decoded.includes('-----BEGIN CERTIFICATE-----')) {
    return decoded;
  }

  // Treat as base64 payload
  const base64 = decoded.replace(/\s+/g, '');
  try {
    const pem = Buffer.from(base64, 'base64').toString('utf8');
    if (pem.includes('-----BEGIN CERTIFICATE-----')) {
      return pem;
    }
  } catch {
    // ignore
  }

  return [
    '-----BEGIN CERTIFICATE-----',
    base64,
    '-----END CERTIFICATE-----',
    '',
  ].join('\n');
}

/**
 * Validate certificate chain + validity window.
 */
function validateCertificate(clientCertificate: X509Certificate, caCertificate: X509Certificate): void {
  const issued = clientCertificate.checkIssued(caCertificate);
  if (!issued) {
    throw new Error('Client certificate not issued by configured CA');
  }

  const now = Date.now();
  const notBefore = Date.parse(clientCertificate.validFrom);
  const notAfter = Date.parse(clientCertificate.validTo);

  if (isNaN(notBefore) || isNaN(notAfter)) {
    throw new Error('Unable to parse client certificate validity window');
  }

  if (now < notBefore) {
    throw new Error(`Client certificate not valid before ${clientCertificate.validFrom}`);
  }

  if (now > notAfter) {
    throw new Error(`Client certificate expired on ${clientCertificate.validTo}`);
  }

  const verified = clientCertificate.verify(caCertificate.publicKey);
  if (!verified) {
    throw new Error('Client certificate signature did not verify against CA public key');
  }
}

function defaultOrgIdExtractor(req: Request): string | undefined {
  return (
    (req.headers['x-org-id'] as string) ||
    (req.headers['x-organization-id'] as string) ||
    (req.headers['x-tenant-id'] as string) ||
    (req as any).user?.orgId
  );
}

export default mtlsGate;

