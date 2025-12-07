import { JWK, jwtVerify, importJWK } from 'jose';
import { ZodError } from 'zod';
import { emitMetric } from '@chai-vc/metrics-core';
import { formatZodError, validateGuardConfig, validateMessageEnvelope } from './schema';
import { SinkConfig, MessageEnvelope, GuardResult, AuditEvent } from './types';
import {
  getPrimaryAudience,
  isValidAudienceForEnvironment,
  normalizeEnvironment,
  isValidAudienceFormat,
  type Environment
} from './audience-registry';
import {
  getSinkById,
  type SinkRegistryEntry
} from './sink-registry';

const PACKAGE_NAME = 'messaging-guard';
const METRIC_NAME = 'messaging_guard.verify';

/**
 * Core guard logic for message-level intent binding
 */
export class MessagingGuard {
  private config: SinkConfig;
  private publicKey?: JWK;
  private environment: Environment;
  private envScopedSinks: Set<string>;
  private requireAudience: boolean;

  constructor(configInput: SinkConfig & { environment?: string; requireAudience?: boolean }) {
    const config = validateGuardConfig(configInput);
    this.config = config;
    this.environment = normalizeEnvironment(
      config.environment || process.env.NODE_ENV || 'development'
    );
    this.requireAudience = config.requireAudience !== false; // Default to true (fail closed)

    if (config.publicKey) {
      this.publicKey = typeof config.publicKey === 'string'
        ? JSON.parse(config.publicKey)
        : config.publicKey;
    }

    // B98B-SEC-001: Build environment-scoped sink allowlist from registry
    this.envScopedSinks = this.buildEnvironmentScopedSinks(config.allowedSinks);
  }

  /**
   * Build environment-scoped sink allowlist
   * Only includes sinks that are registered for the current environment
   */
  private buildEnvironmentScopedSinks(requestedSinks: string[]): Set<string> {
    const envSinks = new Set<string>();

    for (const sinkId of requestedSinks) {
      const registryEntry = getSinkById(sinkId);

      if (registryEntry) {
        // Sink is in registry - check if it's available in current environment
        if (registryEntry.environments.includes(this.environment)) {
          envSinks.add(sinkId);
        }
        // If not available in current environment, silently exclude (fail closed)
      } else {
        // Sink not in registry - include if explicitly requested (backward compat)
        // But log warning in production
        if (this.environment === 'production') {
          console.warn(`[MessagingGuard] Sink '${sinkId}' not in registry - allowing but consider registering`);
        }
        envSinks.add(sinkId);
      }
    }

    return envSinks;
  }

  /**
   * Verify if a message envelope is allowed
   */
  async verify(envelopeInput: MessageEnvelope): Promise<GuardResult> {
    let envelope: MessageEnvelope;
    const fallbackSink = typeof (envelopeInput as any)?.sink === 'string' ? (envelopeInput as any).sink : undefined;

    try {
      envelope = validateMessageEnvelope(envelopeInput);
    } catch (error) {
      if (error instanceof ZodError) {
        const reason = formatZodError(error);
        await emitMetric(METRIC_NAME, {
          package: PACKAGE_NAME,
          environment: this.environment,
          sink: fallbackSink,
          status: 'invalid',
          reason,
        });
        return {
          allowed: false,
          reason: `Invalid message envelope: ${reason}`,
          sink: fallbackSink,
        };
      }
      throw error;
    }

    const metricBase = {
      package: PACKAGE_NAME,
      environment: this.environment,
      sink: envelope.sink,
    };

    const deny = async (reason: string, status: 'denied' | 'invalid' = 'denied'): Promise<GuardResult> => {
      await emitMetric(METRIC_NAME, {
        ...metricBase,
        status,
        reason,
      });
      return {
        allowed: false,
        reason,
        sink: envelope.sink,
      };
    };

    // B98B-SEC-001: Environment-scoped enforcement: check envelope environment matches service environment
    const envelopeEnv = (envelope.payload as any)?.environment || (envelope.payload as any)?.env;
    if (envelopeEnv) {
      const normalizedEnvelopeEnv = normalizeEnvironment(envelopeEnv);
      if (normalizedEnvelopeEnv !== this.environment) {
        return deny(`Environment mismatch: envelope env '${normalizedEnvelopeEnv}' does not match service env '${this.environment}'`);
      }
    }

    // B98B-SEC-001: Audience claim enforcement (fail closed)
    if (this.requireAudience) {
      if (!envelope.audience) {
        return deny(`Audience claim required but not provided (environment: ${this.environment})`, 'invalid');
      }

      // Validate audience format
      const audiences = Array.isArray(envelope.audience) ? envelope.audience : [envelope.audience];
      for (const aud of audiences) {
        if (!isValidAudienceFormat(aud)) {
          return deny(`Invalid audience claim format: '${aud}' (expected format: {env}.vitalcv.com or vitalcv.com)`, 'invalid');
        }
      }

      // Validate audience matches environment
      if (!isValidAudienceForEnvironment(envelope.audience, this.environment)) {
        const expectedAudience = getPrimaryAudience(this.environment);
        return deny(`Audience mismatch: envelope audience '${audiences.join(', ')}' does not match expected '${expectedAudience}' for environment '${this.environment}'`);
      }
    } else if (envelope.audience) {
      // Optional audience validation (backward compatibility mode)
      const audiences = Array.isArray(envelope.audience) ? envelope.audience : [envelope.audience];
      if (!isValidAudienceForEnvironment(envelope.audience, this.environment)) {
        const expectedAudience = getPrimaryAudience(this.environment);
        return deny(`Audience mismatch: envelope audience '${audiences.join(', ')}' does not match expected '${expectedAudience}' for environment '${this.environment}'`);
      }
    }

    // If envelope has allowed_sinks, verify sink is in producer's allowed list
    if (envelope.allowed_sinks && envelope.allowed_sinks.length > 0) {
      if (!envelope.allowed_sinks.includes(envelope.sink)) {
        return deny(`Sink '${envelope.sink}' not in producer's allowed_sinks`);
      }
    }

    // B98B-SEC-001: Check if sink is in environment-scoped allowed list
    if (!this.envScopedSinks.has(envelope.sink)) {
      const registryEntry = getSinkById(envelope.sink);
      if (registryEntry && !registryEntry.environments.includes(this.environment)) {
        return deny(`Sink '${envelope.sink}' not available in environment '${this.environment}' (available in: ${registryEntry.environments.join(', ')})`);
      }
      return deny(`Sink '${envelope.sink}' not in environment-scoped allowed_sinks for '${this.environment}'`);
    }

    // B97A-SEC-001: Enforce detached JWS verification
    // Verify signature if required
    if (this.config.requireSignature !== false) {
      if (!envelope.signature) {
        return deny('Detached JWS signature required but not provided', 'invalid');
      }

      if (!this.publicKey) {
        return deny('Signature verification required but no public key configured');
      }

      try {
        const key = await importJWK(this.publicKey, 'EdDSA');

        // Verify detached JWS signature
        await jwtVerify(envelope.signature, key, {
          algorithms: ['EdDSA'],
        });
      } catch (error) {
        return deny(`Detached JWS signature verification failed: ${error instanceof Error ? error.message : 'unknown error'}`);
      }
    }

    await emitMetric(METRIC_NAME, {
      ...metricBase,
      status: 'allowed',
    });

    return {
      allowed: true,
      sink: envelope.sink,
    };
  }

  /**
   * Get expected audience for current environment
   * @deprecated Use getPrimaryAudience from audience-registry instead
   */
  private getExpectedAudience(): string {
    return getPrimaryAudience(this.environment);
  }

  /**
   * Create audit event for guard decision
   */
  createAuditEvent(result: GuardResult, requestId?: string): AuditEvent {
    const eventType = result.allowed
      ? 'MESSAGE_ALLOWED'
      : result.reason?.includes('signature')
        ? 'SIGNATURE_INVALID'
        : 'SINK_NOT_ALLOWED';

    return {
      type: eventType,
      sink: result.sink || 'unknown',
      reason: result.reason,
      timestamp: Date.now(),
      requestId,
    };
  }
}
