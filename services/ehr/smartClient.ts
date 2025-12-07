/**
 * B136A-EHR-002: SMART-on-FHIR Client
 *
 * Implements OAuth2 client credentials flow for confidential client access to EHR FHIR APIs.
 * Handles token exchange, caching, and graceful error handling for 401/403 responses.
 */

import fetch from 'node-fetch';
import { EhrConfig, EHR_DEFAULTS } from './models/EhrConfig.js';

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

interface TokenCacheEntry {
  token: string;
  expiresAt: number;
}

/**
 * SMART-on-FHIR Client for backend-to-backend API access
 */
export class SmartClient {
  private config: EhrConfig;
  private tokenCache: Map<string, TokenCacheEntry> = new Map();

  constructor(config: EhrConfig) {
    this.config = config;
  }

  /**
   * Get access token (from cache or fetch new one)
   */
  async getAccessToken(): Promise<string> {
    const cacheKey = this.config.orgId;
    const cached = this.tokenCache.get(cacheKey);

    // Return cached token if still valid (with 60s buffer)
    if (cached && cached.expiresAt > Date.now() + 60000) {
      return cached.token;
    }

    // Fetch new token
    const token = await this.fetchAccessToken();
    return token;
  }

  /**
   * Fetch new access token from EHR OAuth2 endpoint
   */
  private async fetchAccessToken(): Promise<string> {
    if (this.config.authType === 'client_credentials') {
      return await this.fetchClientCredentialsToken();
    } else if (this.config.authType === 'jwt') {
      throw new Error('JWT auth not yet implemented'); // Future: B136A-EHR-002-JWT
    } else if (this.config.authType === 'basic') {
      throw new Error('Basic auth not supported for SMART-on-FHIR');
    } else {
      throw new Error(`Unsupported auth type: ${this.config.authType}`);
    }
  }

  /**
   * OAuth2 Client Credentials Flow
   */
  private async fetchClientCredentialsToken(): Promise<string> {
    const { clientId, clientSecret, fhirBaseUrl, ehrType } = this.config;

    if (!clientId || !clientSecret) {
      throw new Error('Client ID and secret are required for client_credentials auth');
    }

    // Determine token endpoint based on EHR type
    const tokenEndpoint = this.getTokenEndpoint();
    const scope = EHR_DEFAULTS[ehrType].scope || 'system/*.read';

    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope,
    });

    try {
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token request failed: ${response.status} - ${errorText}`);
      }

      const tokenResponse: TokenResponse = await response.json() as TokenResponse;

      // Cache the token
      const expiresAt = Date.now() + tokenResponse.expires_in * 1000;
      this.tokenCache.set(this.config.orgId, {
        token: tokenResponse.access_token,
        expiresAt,
      });

      return tokenResponse.access_token;
    } catch (error) {
      throw new Error(`Failed to fetch access token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get token endpoint URL based on EHR type
   */
  private getTokenEndpoint(): string {
    const { fhirBaseUrl, ehrType, metadata } = this.config;

    // Allow custom token endpoint in metadata
    if (metadata?.tokenEndpoint) {
      return metadata.tokenEndpoint as string;
    }

    // Use EHR-specific defaults
    const defaultPath = EHR_DEFAULTS[ehrType].tokenEndpoint;
    if (defaultPath) {
      const baseUrl = fhirBaseUrl.replace(/\/$/, '');
      return `${baseUrl}${defaultPath}`;
    }

    // Fallback to metadata endpoint discovery
    return `${fhirBaseUrl}/metadata`;
  }

  /**
   * Make authenticated FHIR API request
   * Handles 401 by clearing cache and retrying once
   */
  async request(path: string, options: RequestInit = {}, retryOn401: boolean = true): Promise<Response> {
    const token = await this.getAccessToken();
    const url = `${this.config.fhirBaseUrl}/${path}`.replace(/([^:]\/)\/+/g, '$1'); // Remove double slashes

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
        Accept: 'application/fhir+json',
      },
    });

    // Handle 401: Token expired, clear cache and retry once
    if (response.status === 401 && retryOn401) {
      // Clear cached token
      this.tokenCache.delete(this.config.orgId);

      // Retry once with fresh token
      const freshToken = await this.getAccessToken();
      const retryResponse = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${freshToken}`,
          Accept: 'application/fhir+json',
        },
      });

      // If retry also fails with 401, throw error
      if (retryResponse.status === 401) {
        throw new Error('Unauthorized: Token expired or invalid after retry');
      }

      // Handle 403 on retry
      if (retryResponse.status === 403) {
        throw new Error('Forbidden: Insufficient permissions for requested resource');
      }

      return retryResponse;
    } else if (response.status === 401) {
      // Already retried or retry disabled
      throw new Error('Unauthorized: Token expired or invalid');
    } else if (response.status === 403) {
      throw new Error('Forbidden: Insufficient permissions for requested resource');
    }

    return response;
  }

  /**
   * Clear cached token (useful for testing or forcing refresh)
   */
  clearTokenCache(): void {
    this.tokenCache.delete(this.config.orgId);
  }
}

/**
 * Test token exchange (for integration testing)
 */
export async function testTokenExchange(config: EhrConfig): Promise<{ success: boolean; error?: string }> {
  try {
    const client = new SmartClient(config);
    const token = await client.getAccessToken();
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

