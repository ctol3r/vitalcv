/**
 * Router Deny Reason Catalog
 *
 * Standardized error codes for router denial reasons.
 * All codes follow the format: ROUTER_DENY_<CATEGORY>_<SPECIFIC>
 *
 * Categories:
 * - MISSING: Required fields/claims missing
 * - INVALID: Invalid format or value
 * - MISMATCH: Value mismatch (audience, environment, etc.)
 * - UNAUTHORIZED: Authorization failures
 * - SIGNATURE: Signature verification failures
 * - SYSTEM: System/configuration errors
 */

export enum RouterDenyCode {
  // Missing fields/claims
  MISSING_SINK_ID = 'ROUTER_DENY_MISSING_SINK_ID',
  MISSING_SIGNATURE = 'ROUTER_DENY_MISSING_SIGNATURE',
  MISSING_AUDIENCE = 'ROUTER_DENY_MISSING_AUDIENCE',
  MISSING_ALLOWED_SINKS = 'ROUTER_DENY_MISSING_ALLOWED_SINKS',

  // Invalid format/values
  INVALID_SINK_FORMAT = 'ROUTER_DENY_INVALID_SINK_FORMAT',
  INVALID_SIGNATURE_FORMAT = 'ROUTER_DENY_INVALID_SIGNATURE_FORMAT',
  INVALID_PAYLOAD_FORMAT = 'ROUTER_DENY_INVALID_PAYLOAD_FORMAT',
  INVALID_TIMESTAMP = 'ROUTER_DENY_INVALID_TIMESTAMP',

  // Mismatch errors
  AUDIENCE_MISMATCH = 'ROUTER_DENY_AUDIENCE_MISMATCH',
  ENVIRONMENT_MISMATCH = 'ROUTER_DENY_ENVIRONMENT_MISMATCH',
  SINK_NOT_IN_ALLOWED_SINKS = 'ROUTER_DENY_SINK_NOT_IN_ALLOWED_SINKS',

  // Authorization failures
  SINK_NOT_ALLOWED = 'ROUTER_DENY_SINK_NOT_ALLOWED',
  PRODUCER_SINK_NOT_ALLOWED = 'ROUTER_DENY_PRODUCER_SINK_NOT_ALLOWED',

  // Signature verification failures
  SIGNATURE_INVALID = 'ROUTER_DENY_SIGNATURE_INVALID',
  SIGNATURE_VERIFICATION_FAILED = 'ROUTER_DENY_SIGNATURE_VERIFICATION_FAILED',
  SIGNATURE_KEY_MISSING = 'ROUTER_DENY_SIGNATURE_KEY_MISSING',
  SIGNATURE_ALGORITHM_MISMATCH = 'ROUTER_DENY_SIGNATURE_ALGORITHM_MISMATCH',

  // System/configuration errors
  CONFIGURATION_ERROR = 'ROUTER_DENY_CONFIGURATION_ERROR',
  PUBLIC_KEY_NOT_CONFIGURED = 'ROUTER_DENY_PUBLIC_KEY_NOT_CONFIGURED',
  ROUTER_ERROR = 'ROUTER_DENY_ROUTER_ERROR',
}

/**
 * Deny reason metadata
 */
export interface DenyReasonMetadata {
  code: RouterDenyCode;
  message: string;
  description: string;
  httpStatus: number;
  category: 'missing' | 'invalid' | 'mismatch' | 'unauthorized' | 'signature' | 'system';
  retryable: boolean;
  clientActionable: boolean;
}

/**
 * Deny reason catalog
 */
export const DENY_REASON_CATALOG: Record<RouterDenyCode, DenyReasonMetadata> = {
  [RouterDenyCode.MISSING_SINK_ID]: {
    code: RouterDenyCode.MISSING_SINK_ID,
    message: 'Missing sink ID',
    description: 'The message envelope does not contain a sink identifier. All messages must specify their intended destination sink.',
    httpStatus: 400,
    category: 'missing',
    retryable: false,
    clientActionable: true,
  },

  [RouterDenyCode.MISSING_SIGNATURE]: {
    code: RouterDenyCode.MISSING_SIGNATURE,
    message: 'Detached JWS signature required but not provided',
    description: 'Signature verification is required for this router, but the message does not include a detached JWS signature.',
    httpStatus: 401,
    category: 'missing',
    retryable: false,
    clientActionable: true,
  },

  [RouterDenyCode.MISSING_AUDIENCE]: {
    code: RouterDenyCode.MISSING_AUDIENCE,
    message: 'Audience claim required but not provided',
    description: 'The message must include an audience claim matching the router environment (dev/staging/prod).',
    httpStatus: 400,
    category: 'missing',
    retryable: false,
    clientActionable: true,
  },

  [RouterDenyCode.MISSING_ALLOWED_SINKS]: {
    code: RouterDenyCode.MISSING_ALLOWED_SINKS,
    message: 'Producer allowed_sinks claim required but not provided',
    description: 'The message must include an allowed_sinks claim specifying which sinks the producer authorizes.',
    httpStatus: 400,
    category: 'missing',
    retryable: false,
    clientActionable: true,
  },

  [RouterDenyCode.INVALID_SINK_FORMAT]: {
    code: RouterDenyCode.INVALID_SINK_FORMAT,
    message: 'Invalid sink ID format',
    description: 'The sink ID does not match the expected format (e.g., svc.service-name or etl.pipeline-name).',
    httpStatus: 400,
    category: 'invalid',
    retryable: false,
    clientActionable: true,
  },

  [RouterDenyCode.INVALID_SIGNATURE_FORMAT]: {
    code: RouterDenyCode.INVALID_SIGNATURE_FORMAT,
    message: 'Invalid signature format',
    description: 'The signature is not a valid JWT or detached JWS format.',
    httpStatus: 400,
    category: 'invalid',
    retryable: false,
    clientActionable: true,
  },

  [RouterDenyCode.INVALID_PAYLOAD_FORMAT]: {
    code: RouterDenyCode.INVALID_PAYLOAD_FORMAT,
    message: 'Invalid payload format',
    description: 'The message payload is malformed or does not match the expected schema.',
    httpStatus: 400,
    category: 'invalid',
    retryable: false,
    clientActionable: true,
  },

  [RouterDenyCode.INVALID_TIMESTAMP]: {
    code: RouterDenyCode.INVALID_TIMESTAMP,
    message: 'Invalid timestamp',
    description: 'The message timestamp is missing, invalid, or outside acceptable range.',
    httpStatus: 400,
    category: 'invalid',
    retryable: false,
    clientActionable: true,
  },

  [RouterDenyCode.AUDIENCE_MISMATCH]: {
    code: RouterDenyCode.AUDIENCE_MISMATCH,
    message: 'Audience mismatch',
    description: 'The message audience claim does not match the router environment. Expected audience for current environment does not match provided audience.',
    httpStatus: 403,
    category: 'mismatch',
    retryable: false,
    clientActionable: true,
  },

  [RouterDenyCode.ENVIRONMENT_MISMATCH]: {
    code: RouterDenyCode.ENVIRONMENT_MISMATCH,
    message: 'Environment mismatch',
    description: 'The message environment claim does not match the router environment (dev/staging/prod).',
    httpStatus: 403,
    category: 'mismatch',
    retryable: false,
    clientActionable: true,
  },

  [RouterDenyCode.SINK_NOT_IN_ALLOWED_SINKS]: {
    code: RouterDenyCode.SINK_NOT_IN_ALLOWED_SINKS,
    message: 'Sink not in producer allowed_sinks',
    description: 'The target sink is not included in the producer\'s allowed_sinks claim, indicating the producer did not authorize routing to this sink.',
    httpStatus: 403,
    category: 'mismatch',
    retryable: false,
    clientActionable: true,
  },

  [RouterDenyCode.SINK_NOT_ALLOWED]: {
    code: RouterDenyCode.SINK_NOT_ALLOWED,
    message: 'Sink not in router allowed_sinks',
    description: 'The target sink is not in the router\'s configured allowed_sinks list. This sink is not permitted by router policy.',
    httpStatus: 403,
    category: 'unauthorized',
    retryable: false,
    clientActionable: false,
  },

  [RouterDenyCode.PRODUCER_SINK_NOT_ALLOWED]: {
    code: RouterDenyCode.PRODUCER_SINK_NOT_ALLOWED,
    message: 'Producer sink not authorized',
    description: 'The producer\'s allowed_sinks claim does not include the target sink, indicating unauthorized routing intent.',
    httpStatus: 403,
    category: 'unauthorized',
    retryable: false,
    clientActionable: false,
  },

  [RouterDenyCode.SIGNATURE_INVALID]: {
    code: RouterDenyCode.SIGNATURE_INVALID,
    message: 'Detached JWS signature invalid',
    description: 'The detached JWS signature is malformed or cannot be parsed.',
    httpStatus: 401,
    category: 'signature',
    retryable: false,
    clientActionable: true,
  },

  [RouterDenyCode.SIGNATURE_VERIFICATION_FAILED]: {
    code: RouterDenyCode.SIGNATURE_VERIFICATION_FAILED,
    message: 'Signature verification failed',
    description: 'The signature verification failed. The signature may be invalid, expired, or signed with a different key.',
    httpStatus: 401,
    category: 'signature',
    retryable: false,
    clientActionable: true,
  },

  [RouterDenyCode.SIGNATURE_KEY_MISSING]: {
    code: RouterDenyCode.SIGNATURE_KEY_MISSING,
    message: 'Public key not configured for signature verification',
    description: 'Signature verification is required but the router does not have a public key configured.',
    httpStatus: 500,
    category: 'signature',
    retryable: true,
    clientActionable: false,
  },

  [RouterDenyCode.SIGNATURE_ALGORITHM_MISMATCH]: {
    code: RouterDenyCode.SIGNATURE_ALGORITHM_MISMATCH,
    message: 'Signature algorithm mismatch',
    description: 'The signature uses an algorithm that does not match the expected algorithm (expected EdDSA).',
    httpStatus: 400,
    category: 'signature',
    retryable: false,
    clientActionable: true,
  },

  [RouterDenyCode.CONFIGURATION_ERROR]: {
    code: RouterDenyCode.CONFIGURATION_ERROR,
    message: 'Router configuration error',
    description: 'The router has a configuration error that prevents message processing.',
    httpStatus: 500,
    category: 'system',
    retryable: true,
    clientActionable: false,
  },

  [RouterDenyCode.PUBLIC_KEY_NOT_CONFIGURED]: {
    code: RouterDenyCode.PUBLIC_KEY_NOT_CONFIGURED,
    message: 'Public key not configured',
    description: 'Signature verification is required but no public key is configured in the router.',
    httpStatus: 500,
    category: 'system',
    retryable: true,
    clientActionable: false,
  },

  [RouterDenyCode.ROUTER_ERROR]: {
    code: RouterDenyCode.ROUTER_ERROR,
    message: 'Router processing error',
    description: 'An internal error occurred while processing the message. This is a system error, not a message validation failure.',
    httpStatus: 500,
    category: 'system',
    retryable: true,
    clientActionable: false,
  },
};

/**
 * Get deny reason metadata by code
 */
export function getDenyReason(code: RouterDenyCode): DenyReasonMetadata {
  return DENY_REASON_CATALOG[code];
}

/**
 * Get deny reason by message string (for backward compatibility)
 */
export function getDenyReasonByMessage(message: string): DenyReasonMetadata | null {
  for (const reason of Object.values(DENY_REASON_CATALOG)) {
    if (reason.message === message || reason.description.includes(message)) {
      return reason;
    }
  }
  return null;
}

/**
 * Map guard result reason to standardized deny code
 */
export function mapReasonToCode(reason: string | undefined): RouterDenyCode {
  if (!reason) {
    return RouterDenyCode.ROUTER_ERROR;
  }

  const lowerReason = reason.toLowerCase();

  if (lowerReason.includes('missing sink id') || lowerReason.includes('missing sink')) {
    return RouterDenyCode.MISSING_SINK_ID;
  }
  if (lowerReason.includes('signature required') || lowerReason.includes('signature not provided')) {
    return RouterDenyCode.MISSING_SIGNATURE;
  }
  if (lowerReason.includes('audience mismatch')) {
    return RouterDenyCode.AUDIENCE_MISMATCH;
  }
  if (lowerReason.includes('environment mismatch')) {
    return RouterDenyCode.ENVIRONMENT_MISMATCH;
  }
  if (lowerReason.includes('not in allowed_sinks') || lowerReason.includes('not in producer')) {
    return RouterDenyCode.SINK_NOT_IN_ALLOWED_SINKS;
  }
  if (lowerReason.includes('not in allowed') && !lowerReason.includes('producer')) {
    return RouterDenyCode.SINK_NOT_ALLOWED;
  }
  if (lowerReason.includes('signature verification failed') || lowerReason.includes('signature invalid')) {
    return RouterDenyCode.SIGNATURE_VERIFICATION_FAILED;
  }
  if (lowerReason.includes('public key') && lowerReason.includes('not configured')) {
    return RouterDenyCode.PUBLIC_KEY_NOT_CONFIGURED;
  }

  return RouterDenyCode.ROUTER_ERROR;
}

