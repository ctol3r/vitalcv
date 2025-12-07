/**
 * OIDC4VCI Issuer Discovery Client
 * Task: 1106-frontend-0001
 *
 * Fetches and caches /.well-known/openid-credential-issuer metadata
 */

export interface CredentialIssuerMetadata {
  credential_issuer: string;
  authorization_servers?: string[];
  credential_endpoint: string;
  deferred_credential_endpoint?: string;
  display?: Array<{
    name?: string;
    locale?: string;
    logo?: {
      url?: string;
      alt_text?: string;
    };
  }>;
  credentials_supported: Array<{
    format: string;
    id?: string;
    types?: string[];
    cryptographic_binding_methods_supported?: string[];
    cryptographic_suites_supported?: string[];
    display?: Array<{
      name?: string;
      locale?: string;
      logo?: {
        url?: string;
        alt_text?: string;
      };
      background_color?: string;
      text_color?: string;
    }>;
  }>;
}

export interface DiscoveryResult {
  metadata: CredentialIssuerMetadata;
  cached: boolean;
  fetchedAt: Date;
  expiresAt: Date;
}

export interface DiscoveryError {
  code: 'NETWORK_ERROR' | 'PARSE_ERROR' | 'NOT_FOUND' | 'INVALID_METADATA';
  message: string;
  details?: string;
}

const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour
const DISCOVERY_PATH = '/.well-known/openid-credential-issuer';

class IssuerDiscoveryClient {
  private cache: Map<string, DiscoveryResult> = new Map();

  /**
   * Discover issuer metadata from /.well-known endpoint
   * @param issuerUrl - Base URL of the credential issuer
   * @param bustCache - Force refresh from server
   */
  async discover(
    issuerUrl: string,
    bustCache: boolean = false
  ): Promise<DiscoveryResult> {
    const normalizedUrl = this.normalizeIssuerUrl(issuerUrl);
    const cacheKey = normalizedUrl;

    // Check cache first
    if (!bustCache) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > new Date()) {
        console.debug('[IssuerDiscovery] Cache hit for', normalizedUrl);
        return { ...cached, cached: true };
      }
    }

    console.debug('[IssuerDiscovery] Fetching metadata for', normalizedUrl);

    try {
      const discoveryUrl = `${normalizedUrl}${DISCOVERY_PATH}`;
      const response = await fetch(discoveryUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        // No credentials for public discovery endpoint
        credentials: 'omit',
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw {
            code: 'NOT_FOUND',
            message: 'Issuer metadata not found',
            details: `No discovery document found at ${discoveryUrl}`,
          } as DiscoveryError;
        }
        throw {
          code: 'NETWORK_ERROR',
          message: `HTTP ${response.status}: ${response.statusText}`,
          details: await response.text().catch(() => 'No response body'),
        } as DiscoveryError;
      }

      const metadata: CredentialIssuerMetadata = await response.json();

      // Validate required fields
      this.validateMetadata(metadata);

      const fetchedAt = new Date();
      const expiresAt = new Date(fetchedAt.getTime() + CACHE_DURATION_MS);

      const result: DiscoveryResult = {
        metadata,
        cached: false,
        fetchedAt,
        expiresAt,
      };

      // Cache the result
      this.cache.set(cacheKey, result);

      return result;
    } catch (error: any) {
      if (error.code) {
        throw error; // Already a DiscoveryError
      }

      if (error instanceof SyntaxError) {
        throw {
          code: 'PARSE_ERROR',
          message: 'Invalid JSON response',
          details: error.message,
        } as DiscoveryError;
      }

      throw {
        code: 'NETWORK_ERROR',
        message: 'Failed to fetch issuer metadata',
        details: error.message || String(error),
      } as DiscoveryError;
    }
  }

  /**
   * Validate issuer metadata structure
   */
  private validateMetadata(metadata: any): asserts metadata is CredentialIssuerMetadata {
    if (!metadata.credential_issuer) {
      throw {
        code: 'INVALID_METADATA',
        message: 'Missing required field: credential_issuer',
      } as DiscoveryError;
    }

    if (!metadata.credential_endpoint) {
      throw {
        code: 'INVALID_METADATA',
        message: 'Missing required field: credential_endpoint',
      } as DiscoveryError;
    }

    if (!Array.isArray(metadata.credentials_supported) || metadata.credentials_supported.length === 0) {
      throw {
        code: 'INVALID_METADATA',
        message: 'Missing or empty credentials_supported array',
      } as DiscoveryError;
    }
  }

  /**
   * Normalize issuer URL (remove trailing slash, ensure https)
   */
  private normalizeIssuerUrl(url: string): string {
    let normalized = url.trim();

    // Remove trailing slash
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }

    // Ensure protocol
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = `https://${normalized}`;
    }

    return normalized;
  }

  /**
   * Clear cache for specific issuer or all issuers
   */
  clearCache(issuerUrl?: string): void {
    if (issuerUrl) {
      const normalized = this.normalizeIssuerUrl(issuerUrl);
      this.cache.delete(normalized);
      console.debug('[IssuerDiscovery] Cache cleared for', normalized);
    } else {
      this.cache.clear();
      console.debug('[IssuerDiscovery] All cache cleared');
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.entries()).map(([url, result]) => ({
        url,
        fetchedAt: result.fetchedAt,
        expiresAt: result.expiresAt,
        expired: result.expiresAt < new Date(),
      })),
    };
  }

  /**
   * Get supported credential types from metadata
   */
  getSupportedCredentials(metadata: CredentialIssuerMetadata): string[] {
    return metadata.credentials_supported
      .flatMap((cred) => cred.types || [])
      .filter((type) => type !== 'VerifiableCredential'); // Filter out base type
  }

  /**
   * Get supported cryptographic suites
   */
  getSupportedAlgorithms(metadata: CredentialIssuerMetadata): string[] {
    const algs = new Set<string>();

    metadata.credentials_supported.forEach((cred) => {
      cred.cryptographic_suites_supported?.forEach((alg) => algs.add(alg));
    });

    return Array.from(algs);
  }
}

// Singleton instance
export const issuerDiscovery = new IssuerDiscoveryClient();

export default issuerDiscovery;

