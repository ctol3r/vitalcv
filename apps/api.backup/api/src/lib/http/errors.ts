/**
 * RFC7807 Error Format (Enhanced)
 * Tagged: cursor-batch-1107 (Task 0014) - UPDATED
 * Agent: CODEX • BACKEND • chai-vc-platform
 *
 * Normalized error payload format for consistent API responses
 * Now includes requestId tracking and documentation links
 */

export interface ProblemDetail {
  /**
   * A URI reference that identifies the problem type
   * This is meant to be machine-readable
   */
  type?: string;

  /**
   * A short, human-readable summary of the problem type
   */
  title: string;

  /**
   * The HTTP status code
   */
  status: number;

  /**
   * A human-readable explanation specific to this occurrence of the problem
   */
  detail?: string;

  /**
   * A URI reference that identifies the specific occurrence of the problem
   * UPDATED: Now includes requestId for troubleshooting
   */
  instance?: string;

  /**
   * Machine-readable error code
   */
  code: string;

  /**
   * Link to documentation for this error code
   * ADDED: Task 0014
   */
  doc_url?: string;

  /**
   * Additional context/metadata about the error
   */
  [key: string]: any;
}

/**
 * Base documentation URL for error codes
 */
const ERROR_DOCS_BASE_URL = process.env.ERROR_DOCS_BASE_URL || 'https://docs.chai.vc/errors';

/**
 * Base error class that produces RFC7807-like responses
 */
export class HttpProblemError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly title: string;
  public readonly detail?: string;
  public readonly instance?: string;
  public readonly type?: string;
  public readonly context?: Record<string, any>;

  constructor(
    status: number,
    code: string,
    title: string,
    detail?: string,
    context?: Record<string, any>,
  ) {
    super(title);
    this.name = 'HttpProblemError';
    this.status = status;
    this.code = code;
    this.title = title;
    this.detail = detail;
    this.context = context;

    Error.captureStackTrace(this, this.constructor);
  }

  toProblemDetail(instance?: string): ProblemDetail {
    const problem: ProblemDetail = {
      code: this.code,
      title: this.title,
      status: this.status,
    };

    if (this.detail) problem.detail = this.detail;

    // Set instance (requestId) for troubleshooting
    if (instance || this.instance) {
      problem.instance = instance || this.instance;
    }

    if (this.type) problem.type = this.type;

    // Add documentation URL based on error code
    problem.doc_url = getErrorDocUrl(this.code);

    // Include context fields
    if (this.context) {
      Object.assign(problem, this.context);
    }

    return problem;
  }
}

// ============================================================================
// SPECIFIC ERROR CODES
// ============================================================================

/**
 * E_DISCLOSURE_MISMATCH - SD-JWT disclosure verification failed
 */
export class DisclosureMismatchError extends HttpProblemError {
  constructor(
    detail?: string,
    context?: { expectedHash?: string; actualHash?: string; claimPath?: string },
  ) {
    super(
      400,
      'E_DISCLOSURE_MISMATCH',
      'Disclosure Verification Failed',
      detail || 'One or more selective disclosures do not match their hash commitments',
      context,
    );
    // type is deprecated in favor of doc_url, but kept for backwards compatibility
    this.type = getErrorDocUrl('E_DISCLOSURE_MISMATCH');
  }
}

/**
 * E_ISSUER_TRUST - Issuer not in trust registry
 */
export class IssuerTrustError extends HttpProblemError {
  constructor(
    detail?: string,
    context?: { issuerDid?: string; schemaType?: string; policyId?: string },
  ) {
    super(
      403,
      'E_ISSUER_TRUST',
      'Issuer Not Trusted',
      detail || 'The credential issuer is not in the trust registry for this schema type',
      context,
    );
    this.type = getErrorDocUrl('E_ISSUER_TRUST');
  }
}

/**
 * E_ISSUER_WARN - Issuer under review (soft warning)
 * ADDED: Task 0005
 */
export class IssuerWarnError extends HttpProblemError {
  constructor(detail?: string, context?: { issuerDid?: string; reason?: string }) {
    super(
      200, // Still success, but with warning
      'E_ISSUER_WARN',
      'Issuer Under Review',
      detail || 'The credential issuer is under review but still operational',
      context,
    );
    this.type = getErrorDocUrl('E_ISSUER_WARN');
  }
}

/**
 * E_ISSUER_BLOCKED - Issuer blocked (hard block)
 * ADDED: Task 0005
 */
export class IssuerBlockedError extends HttpProblemError {
  constructor(
    detail?: string,
    context?: { issuerDid?: string; reason?: string; blockedAt?: string },
  ) {
    super(
      403,
      'E_ISSUER_BLOCKED',
      'Issuer Blocked',
      detail || 'The credential issuer has been blocked from the trust registry',
      context,
    );
    this.type = getErrorDocUrl('E_ISSUER_BLOCKED');
  }
}

/**
 * E_BBS_UNSUPPORTED - BBS+ proof verification not supported
 * ADDED: Task 0003
 */
export class BbsUnsupportedError extends HttpProblemError {
  constructor(detail?: string, context?: { featureFlag?: boolean }) {
    super(
      406,
      'E_BBS_UNSUPPORTED',
      'BBS+ Proof Not Supported',
      detail || 'BBS+ proof verification is not yet supported on this endpoint',
      context,
    );
    this.type = getErrorDocUrl('E_BBS_UNSUPPORTED');
  }
}

/**
 * E_NPI_INVALID - NPI validation failed
 */
export class NpiInvalidError extends HttpProblemError {
  constructor(
    detail?: string,
    context?: {
      npi?: string;
      reason?: 'checksum' | 'length' | 'not-found' | 'format' | 'inactive';
      expected?: string;
      actual?: string;
    },
  ) {
    super(400, 'E_NPI_INVALID', 'Invalid NPI', detail || 'The provided NPI is invalid', context);
    this.type = getErrorDocUrl('E_NPI_INVALID');
  }
}

/**
 * E_REVOKED - Credential has been revoked
 */
export class CredentialRevokedError extends HttpProblemError {
  constructor(detail?: string, context?: { credentialId?: string; revokedAt?: string }) {
    super(
      403,
      'E_REVOKED',
      'Credential Revoked',
      detail || 'This credential has been revoked',
      context,
    );
    this.type = getErrorDocUrl('E_REVOKED');
  }
}

/**
 * E_EXPIRED - Credential has expired
 */
export class CredentialExpiredError extends HttpProblemError {
  constructor(
    detail?: string,
    context?: { credentialId?: string; expiresAt?: string; now?: string },
  ) {
    super(403, 'E_EXPIRED', 'Credential Expired', detail || 'This credential has expired', context);
    this.type = getErrorDocUrl('E_EXPIRED');
  }
}

/**
 * E_SIGNATURE_INVALID - Cryptographic signature verification failed
 */
export class SignatureInvalidError extends HttpProblemError {
  constructor(detail?: string, context?: { algorithm?: string; keyId?: string }) {
    super(
      401,
      'E_SIGNATURE_INVALID',
      'Invalid Signature',
      detail || 'Cryptographic signature verification failed',
      context,
    );
    this.type = getErrorDocUrl('E_SIGNATURE_INVALID');
  }
}

/**
 * E_SCHEMA_INVALID - JSON Schema validation failed
 */
export class SchemaValidationError extends HttpProblemError {
  constructor(
    detail?: string,
    context?: {
      schemaId?: string;
      errors?: Array<{ path?: string; message: string; instancePath?: string }>;
    },
  ) {
    super(
      422,
      'E_SCHEMA_INVALID',
      'Schema Validation Failed',
      detail || 'Request payload does not match the required schema',
      context,
    );
    this.type = getErrorDocUrl('E_SCHEMA_INVALID');
  }
}

/**
 * E_SOURCE_TIMEOUT - External source timed out
 */
export class SourceTimeoutError extends HttpProblemError {
  constructor(detail?: string, context?: { source?: string; timeoutMs?: number }) {
    super(
      504,
      'E_SOURCE_TIMEOUT',
      'External Source Timeout',
      detail || 'External data source request timed out',
      context,
    );
    this.type = getErrorDocUrl('E_SOURCE_TIMEOUT');
  }
}

/**
 * E_SOURCE_BLOCKED - External source blocked/unavailable
 */
export class SourceBlockedError extends HttpProblemError {
  constructor(detail?: string, context?: { source?: string; reason?: string }) {
    super(
      503,
      'E_SOURCE_BLOCKED',
      'External Source Blocked',
      detail || 'External data source is currently unavailable',
      context,
    );
    this.type = getErrorDocUrl('E_SOURCE_BLOCKED');
  }
}

/**
 * E_SOURCE_CHANGED - External source schema/format changed
 */
export class SourceChangedError extends HttpProblemError {
  constructor(
    detail?: string,
    context?: { source?: string; expectedFormat?: string; actualFormat?: string },
  ) {
    super(
      502,
      'E_SOURCE_CHANGED',
      'External Source Format Changed',
      detail || 'External data source format has changed unexpectedly',
      context,
    );
    this.type = getErrorDocUrl('E_SOURCE_CHANGED');
  }
}

/**
 * E_WEBHOOK_SIG_INVALID - Webhook HMAC signature invalid
 */
export class WebhookSignatureError extends HttpProblemError {
  constructor(detail?: string, context?: { timestamp?: string; skew?: number }) {
    super(
      401,
      'E_WEBHOOK_SIG_INVALID',
      'Webhook Signature Invalid',
      detail || 'Webhook HMAC signature verification failed',
      context,
    );
    this.type = getErrorDocUrl('E_WEBHOOK_SIG_INVALID');
  }
}

/**
 * Get documentation URL for an error code
 */
export function getErrorDocUrl(code: string): string {
  // Convert error code to URL slug
  // E_DISCLOSURE_MISMATCH -> disclosure-mismatch
  const slug = code.replace(/^E_/, '').toLowerCase().replace(/_/g, '-');
  return `${ERROR_DOCS_BASE_URL}/${slug}`;
}

/**
 * Helper to create a problem detail response with full RFC7807 compliance
 * UPDATED: Now includes requestId and doc_url
 */
export function createProblemDetail(
  status: number,
  code: string,
  title: string,
  detail?: string,
  context?: Record<string, any>,
): ProblemDetail {
  const problem: ProblemDetail = {
    code,
    title,
    status,
  };

  if (detail) problem.detail = detail;

  // Add documentation URL
  problem.doc_url = getErrorDocUrl(code);

  // Add instance (requestId) if provided in context
  if (context?.requestId) {
    problem.instance = context.requestId;
    // Remove from context to avoid duplication
    const { requestId, ...restContext } = context;
    Object.assign(problem, restContext);
  } else if (context) {
    Object.assign(problem, context);
  }

  return problem;
}
