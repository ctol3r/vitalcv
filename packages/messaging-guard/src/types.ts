/**
 * Message-level intent binding types for allowed_sinks and signature verification
 */

export interface SinkConfig {
  /** Allowed sink IDs for this service */
  allowedSinks: string[];
  /** Public key for signature verification (JWK format) */
  publicKey?: string | object;
  /** Whether signature verification is required */
  requireSignature?: boolean;
  /** Whether audience claim is required (default: true, fail closed) */
  requireAudience?: boolean;
}

export interface MessageEnvelope {
  /** Intended sink ID */
  sink: string;
  /** Detached JWS signature */
  signature?: string;
  /** Message payload */
  payload: unknown;
  /** Timestamp */
  timestamp?: number;
  /** Allowed sinks for this message (producer-specified) */
  allowed_sinks?: string[];
  /** Audience claim (must match environment) */
  audience?: string | string[];
}

export interface GuardResult {
  allowed: boolean;
  reason?: string;
  sink?: string;
}

export interface AuditEvent {
  type: 'MESSAGE_ALLOWED' | 'MESSAGE_DENIED' | 'SIGNATURE_INVALID' | 'SINK_NOT_ALLOWED';
  sink: string;
  reason?: string;
  timestamp: number;
  requestId?: string;
}

