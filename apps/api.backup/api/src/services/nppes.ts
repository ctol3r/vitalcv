import axios from 'axios';
import { z } from 'zod';

// Simple in-memory cache (replace with Redis for production)
class SimpleCache {
  private cache = new Map<string, { data: any; expiry: number }>();
  private ttl: number;

  constructor(options: { stdTTL: number }) {
    this.ttl = options.stdTTL * 1000; // Convert to milliseconds
  }

  get<T>(key: string): T | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return undefined;
    }
    return item.data as T;
  }

  set<T>(key: string, value: T): void {
    this.cache.set(key, {
      data: value,
      expiry: Date.now() + this.ttl
    });
  }
}

/**
 * Luhn algorithm validation for NPI numbers
 * NPI uses the Luhn check digit algorithm (ISO/IEC 7812-1)
 */
function validateLuhn(npi: string): boolean {
  if (!/^\d{10}$/.test(npi)) return false;

  const digits = npi.split('').map(Number);
  let sum = 0;

  // Double every second digit from right to left, subtract 9 if > 9
  for (let i = digits.length - 2; i >= 0; i -= 2) {
    let doubled = digits[i] * 2;
    if (doubled > 9) doubled -= 9;
    sum += doubled;
  }

  // Add remaining digits
  for (let i = digits.length - 1; i >= 0; i -= 2) {
    sum += digits[i];
  }

  return sum % 10 === 0;
}

// Metrics counters for observability
let npiLookupCount = 0;
let npiCacheHitCount = 0;
let npiLuhnFailCount = 0;

// NPPES API types
const NppesResponseSchema = z.object({
  result_count: z.number(),
  results: z.array(
    z.object({
      number: z.string(),
      enumeration_type: z.string(),
      basic: z.object({
        organization_name: z.string().optional(),
        first_name: z.string().optional(),
        middle_name: z.string().optional(),
        last_name: z.string().optional(),
        credential: z.string().optional(),
        enumeration_date: z.string(),
      }),
      taxonomies: z
        .array(
          z.object({
            desc: z.string(),
            primary: z.boolean(),
            state: z.string().optional(),
            license: z.string().optional(),
          }),
        )
        .optional(),
      addresses: z
        .array(
          z.object({
            country_code: z.string(),
            country_name: z.string(),
            address_1: z.string().optional(),
            address_2: z.string().optional(),
            city: z.string(),
            state: z.string(),
            postal_code: z.string(),
            telephone_number: z.string().optional(),
          }),
        )
        .optional(),
    }),
  ),
});

type NppesProvider = z.infer<typeof NppesResponseSchema>['results'][0];

// Cache for NPI lookups (15 minutes TTL)
const cache = new SimpleCache({ stdTTL: 900 });

export class NppesService {
  private baseUrl = 'https://npiregistry.cms.hhs.gov/api';

  /**
   * Lookup NPI in NPPES registry with caching and Luhn validation
   * Emits audit events and metrics per Strategic Plan
   */
  async lookup(npi: string): Promise<NppesProvider | null> {
    npiLookupCount++;

    // Validate NPI format
    if (!/^\d{10}$/.test(npi)) {
      throw new Error('Invalid NPI format. Must be 10 digits.');
    }

    // Luhn check validation (per v2.1 spec)
    if (!validateLuhn(npi)) {
      npiLuhnFailCount++;
      console.warn(`[NPI] Luhn check failed for NPI: ${npi}`);
      throw new Error('Invalid NPI: Luhn check failed');
    }

    // Check cache first
    const cached = cache.get<NppesProvider>(npi);
    if (cached) {
      npiCacheHitCount++;
      console.debug(`[NPI] Cache hit for NPI: ${npi}`);
      return cached;
    }

    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          version: '2.1',
          number: npi,
        },
        timeout: 10000,
      });

      const parsed = NppesResponseSchema.parse(response.data);

      if (parsed.result_count === 0 || parsed.results.length === 0) {
        return null;
      }

      const provider = parsed.results[0];

      // Cache the result
      cache.set(npi, provider);

      // Audit log per Strategic Plan
      console.info(`[NPI] Successful lookup for NPI: ${npi}, Type: ${provider.enumeration_type}`);

      return provider;
    } catch (error: any) {
      console.error(`[NPI] NPPES lookup failed for ${npi}:`, error.message);
      throw new Error('Failed to lookup NPI from NPPES registry');
    }
  }

  /**
   * Get metrics for observability SLOs
   */
  getMetrics() {
    return {
      lookupCount: npiLookupCount,
      cacheHitCount: npiCacheHitCount,
      cacheHitRate: npiLookupCount > 0 ? npiCacheHitCount / npiLookupCount : 0,
      luhnFailCount: npiLuhnFailCount,
    };
  }

  /**
   * Get provider name from NPPES data
   */
  getProviderName(provider: NppesProvider): string {
    if (provider.enumeration_type === 'NPI-2') {
      return provider.basic.organization_name || 'Unknown';
    } else {
      const parts = [
        provider.basic.first_name,
        provider.basic.middle_name,
        provider.basic.last_name,
      ].filter(Boolean);
      return parts.join(' ') || 'Unknown';
    }
  }

  /**
   * Infer role based on NPI type
   */
  inferRole(provider: NppesProvider): string[] {
    const roles: string[] = ['holder'];

    if (provider.enumeration_type === 'NPI-2') {
      roles.push('verifier');
      // Check if it's a qualifying organization (hospital, clinic, etc.)
      const orgName = provider.basic.organization_name?.toLowerCase() || '';
      if (
        orgName.includes('hospital') ||
        orgName.includes('clinic') ||
        orgName.includes('medical group')
      ) {
        roles.push('issuer');
      }
    }

    return roles;
  }
}

export const nppesService = new NppesService();
