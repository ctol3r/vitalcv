/**
 * Router Client Example
 *
 * This example demonstrates how to:
 * 1. Send messages to the router with proper envelope format
 * 2. Handle deny responses with standardized error codes
 * 3. Retry logic based on error metadata
 * 4. Fetch deny reason catalog for error handling
 */

import { SignJWT, importJWK } from 'jose';

interface RouterEnvelope {
  sink: string;
  signature?: string;
  payload: unknown;
  timestamp?: number;
  allowed_sinks?: string[];
  audience?: string | string[];
}

interface RouterResponse {
  status?: 'routed';
  error?: 'ROUTER_DENY';
  code?: string;
  reason?: string;
  description?: string;
  sink?: string;
  requestId?: string;
  hashAnchor?: string;
  retryable?: boolean;
  clientActionable?: boolean;
  details?: string;
}

interface DenyReasonMetadata {
  code: string;
  message: string;
  description: string;
  httpStatus: number;
  category: string;
  retryable: boolean;
  clientActionable: boolean;
}

class RouterClient {
  private baseUrl: string;
  private privateKey?: JWK;
  private allowedSinks: string[];
  private environment: string;

  constructor(config: {
    baseUrl: string;
    privateKey?: JWK;
    allowedSinks: string[];
    environment: 'development' | 'staging' | 'production';
  }) {
    this.baseUrl = config.baseUrl;
    this.privateKey = config.privateKey;
    this.allowedSinks = config.allowedSinks;
    this.environment = config.environment;
  }

  /**
   * Get the expected audience for the current environment
   */
  private getAudience(): string {
    const envMap: Record<string, string> = {
      development: 'dev.vitalcv.com',
      dev: 'dev.vitalcv.com',
      staging: 'staging.vitalcv.com',
      production: 'vitalcv.com',
      prod: 'vitalcv.com',
    };
    return envMap[this.environment] || 'dev.vitalcv.com';
  }

  /**
   * Sign a message envelope with detached JWS
   */
  private async signEnvelope(envelope: RouterEnvelope): Promise<string> {
    if (!this.privateKey) {
      throw new Error('Private key not configured');
    }

    const key = await importJWK(this.privateKey, 'EdDSA');
    const payload = JSON.stringify({
      sink: envelope.sink,
      payload: envelope.payload,
      timestamp: envelope.timestamp,
      allowed_sinks: envelope.allowed_sinks,
      audience: envelope.audience,
    });

    const jwt = await new SignJWT({ payload })
      .setProtectedHeader({ alg: 'EdDSA' })
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(key);

    return jwt;
  }

  /**
   * Send a message to the router
   */
  async routeMessage(
    sink: string,
    payload: unknown,
    options: {
      requestId?: string;
      retries?: number;
    } = {}
  ): Promise<RouterResponse> {
    const requestId = options.requestId || `req-${Date.now()}`;
    const maxRetries = options.retries || 3;

    const envelope: RouterEnvelope = {
      sink,
      payload,
      timestamp: Date.now(),
      allowed_sinks: this.allowedSinks,
      audience: this.getAudience(),
    };

    // Sign the envelope if private key is configured
    if (this.privateKey) {
      envelope.signature = await this.signEnvelope(envelope);
    }

    let lastError: RouterResponse | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/route`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Request-Id': requestId,
          },
          body: JSON.stringify(envelope),
        });

        const result: RouterResponse = await response.json();

        if (response.ok && result.status === 'routed') {
          return result;
        }

        // Handle deny response
        if (result.error === 'ROUTER_DENY') {
          lastError = result;

          // If not retryable, throw immediately
          if (!result.retryable) {
            throw new RouterDenyError(result);
          }

          // If retryable and not last attempt, wait and retry
          if (attempt < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // Exponential backoff, max 10s
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }

          // Last attempt failed
          throw new RouterDenyError(result);
        }

        // Unexpected response
        throw new Error(`Unexpected response: ${response.status}`);
      } catch (error) {
        if (error instanceof RouterDenyError) {
          throw error;
        }

        // Network error - retry if attempts remaining
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        throw error;
      }
    }

    throw lastError || new Error('Failed to route message');
  }

  /**
   * Fetch the deny reason catalog
   */
  async getDenyReasonCatalog(): Promise<Record<string, DenyReasonMetadata>> {
    const response = await fetch(`${this.baseUrl}/router/deny-reasons`);
    if (!response.ok) {
      throw new Error(`Failed to fetch deny reason catalog: ${response.status}`);
    }
    const data = await response.json();
    return data.catalog;
  }

  /**
   * Get metadata for a specific deny reason code
   */
  async getDenyReason(code: string): Promise<DenyReasonMetadata> {
    const response = await fetch(`${this.baseUrl}/router/deny-reasons/${code}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch deny reason: ${response.status}`);
    }
    return await response.json();
  }
}

/**
 * Custom error class for router deny responses
 */
class RouterDenyError extends Error {
  public code: string;
  public reason: string;
  public description: string;
  public sink?: string;
  public requestId?: string;
  public hashAnchor?: string;
  public retryable: boolean;
  public clientActionable: boolean;

  constructor(response: RouterResponse) {
    super(response.reason || 'Router denied message');
    this.name = 'RouterDenyError';
    this.code = response.code || 'UNKNOWN';
    this.reason = response.reason || 'Unknown error';
    this.description = response.description || '';
    this.sink = response.sink;
    this.requestId = response.requestId;
    this.hashAnchor = response.hashAnchor;
    this.retryable = response.retryable || false;
    this.clientActionable = response.clientActionable || false;
  }

  /**
   * Check if this error can be fixed by the client
   */
  canFix(): boolean {
    return this.clientActionable;
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    if (this.clientActionable) {
      return `${this.reason}. ${this.description}`;
    }
    return `${this.reason}. Please contact support if this persists.`;
  }
}

// Example usage
async function example() {
  const client = new RouterClient({
    baseUrl: 'http://localhost:4002',
    allowedSinks: ['svc.issuer-api', 'svc.verifier-api'],
    environment: 'development',
    // privateKey: yourJWK, // Optional: for signature
  });

  try {
    // Send a message
    const result = await client.routeMessage('svc.issuer-api', {
      type: 'issue_credential',
      credential: { /* ... */ },
    });

    console.log('Message routed:', result);
  } catch (error) {
    if (error instanceof RouterDenyError) {
      console.error('Router denied message:');
      console.error('  Code:', error.code);
      console.error('  Reason:', error.reason);
      console.error('  Description:', error.description);
      console.error('  Retryable:', error.retryable);
      console.error('  Client Actionable:', error.clientActionable);

      if (error.canFix()) {
        console.log('You can fix this error:', error.getUserMessage());
      } else {
        console.log('This error requires router configuration changes');
      }

      // Fetch detailed metadata for the error code
      try {
        const metadata = await client.getDenyReason(error.code);
        console.log('Error metadata:', metadata);
      } catch (e) {
        console.error('Failed to fetch error metadata:', e);
      }
    } else {
      console.error('Unexpected error:', error);
    }
  }

  // Fetch the complete deny reason catalog
  try {
    const catalog = await client.getDenyReasonCatalog();
    console.log('Available deny codes:', Object.keys(catalog));
  } catch (error) {
    console.error('Failed to fetch catalog:', error);
  }
}

export { RouterClient, RouterDenyError };

