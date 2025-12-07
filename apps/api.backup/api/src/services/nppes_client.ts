import axios from 'axios';

interface NppesResponse {
  result_count: number;
  results: NppesProvider[];
}

interface NppesProvider {
  number: string;
  enumeration_type: string; // "NPI-1" (Individual) or "NPI-2" (Organization)
  basic: {
    first_name?: string;
    last_name?: string;
    organization_name?: string;
    credential?: string;
    sole_proprietor?: string;
    gender?: string;
    enumeration_date?: string;
    last_updated?: string;
    status?: string;
    name_prefix?: string;
    name_suffix?: string;
  };
  taxonomies: Array<{
    code: string;
    desc?: string;
    primary: boolean;
    state?: string;
    license?: string;
  }>;
  addresses: Array<{
    address_1?: string;
    address_2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country_code?: string;
    telephone_number?: string;
    fax_number?: string;
    address_type?: string;
    address_purpose?: string;
  }>;
  other_names?: Array<{
    type?: string;
    first_name?: string;
    last_name?: string;
    organization_name?: string;
  }>;
}

export interface NpiDetails {
  npi: string;
  type: 1 | 2; // 1 = Individual, 2 = Organization
  basic: {
    firstName?: string;
    lastName?: string;
    organizationName?: string;
    credential?: string;
    gender?: string;
    status?: string;
  };
  taxonomies: Array<{
    code: string;
    description?: string;
    primary: boolean;
    license?: string;
  }>;
  addresses: Array<{
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    telephoneNumber?: string;
    addressType?: string;
  }>;
}

/**
 * NppesClient fetches NPI data from the NPPES registry.
 * In production, this should use Redis for caching with 15-60 min TTL.
 */
export class NppesClient {
  private cache: Map<string, { data: NpiDetails; timestamp: number }> = new Map();
  private readonly ttlMs: number;
  private readonly baseUrl = 'https://npiregistry.cms.hhs.gov/api';

  constructor(ttlMinutes: number = 30) {
    this.ttlMs = ttlMinutes * 60 * 1000;
  }

  /**
   * Fetch NPI details from NPPES registry with caching.
   */
  async fetch(npi: string): Promise<NpiDetails | null> {
    // Check cache
    const cached = this.cache.get(npi);
    if (cached && Date.now() - cached.timestamp < this.ttlMs) {
      return cached.data;
    }

    try {
      const response = await axios.get<NppesResponse>(
        `${this.baseUrl}/?version=2.1&number=${npi}`,
        {
          timeout: 10000,
        },
      );

      if (response.data.result_count === 0) {
        return null;
      }

      const provider = response.data.results[0];
      const details = this.transformProvider(provider);

      // Cache the result
      this.cache.set(npi, { data: details, timestamp: Date.now() });

      return details;
    } catch (error: any) {
      console.error(`Failed to fetch NPI ${npi}:`, error);
      // Return cached data if available, even if expired
      if (cached) {
        console.log(`Returning cached data for NPI ${npi}`);
        return cached.data;
      }

      // Provide more detailed error information
      const errorDetails = error.message || 'Unknown error';
      const errorCode = error.code || 'NPPES_ERROR';
      throw new Error(`Failed to fetch NPI data for ${npi}: ${errorCode} - ${errorDetails}`);
    }
  }

  private transformProvider(provider: NppesProvider): NpiDetails {
    const type = provider.enumeration_type === 'NPI-1' ? 1 : 2;

    return {
      npi: provider.number,
      type,
      basic: {
        firstName: provider.basic.first_name,
        lastName: provider.basic.last_name,
        organizationName: provider.basic.organization_name,
        credential: provider.basic.credential,
        gender: provider.basic.gender,
        status: provider.basic.status,
      },
      taxonomies: provider.taxonomies.map((tax) => ({
        code: tax.code,
        description: tax.desc,
        primary: tax.primary,
        license: tax.license,
      })),
      addresses: provider.addresses.map((addr) => ({
        address1: addr.address_1,
        address2: addr.address_2,
        city: addr.city,
        state: addr.state,
        postalCode: addr.postal_code,
        telephoneNumber: addr.telephone_number,
        addressType: addr.address_type,
      })),
    };
  }

  /**
   * Clear cache for a specific NPI or all NPIs.
   */
  clearCache(npi?: string): void {
    if (npi) {
      this.cache.delete(npi);
    } else {
      this.cache.clear();
    }
  }
}

// Singleton instance
export const nppesClient = new NppesClient(30);
