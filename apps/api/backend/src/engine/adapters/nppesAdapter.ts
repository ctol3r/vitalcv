import type {
  NormalizedCredentialPayload,
  Provider,
  Credential,
  CompactName,
  RetrievalEvent,
  EnrollmentContext,
  CredentialStatus,
} from '../types/psv';
import type { PsvAdapter } from './types';

export const NPPES_API_URL = 'https://npiregistry.cms.hhs.gov/api/?version=2.1';
const AGENT_VERSION = '1.0.0';

// ── NPPES API response shapes (minimal, only what we use) ────

interface NppesResult {
  result_count: number;
  results: NppesRecord[];
}

interface NppesRecord {
  number: number;
  enumeration_type: string;
  basic: {
    first_name?: string;
    last_name?: string;
    middle_name?: string;
    name_prefix?: string;
    name_suffix?: string;
    credential?: string;
    organization_name?: string;
    enumeration_date?: string;
    last_updated?: string;
    status: string;
    gender?: string;
  };
  taxonomies: NppesTaxonomy[];
  addresses: NppesAddress[];
  identifiers: NppesIdentifier[];
  other_names: unknown[];
  practice_locations: unknown[];
  endpoints: unknown[];
}

interface NppesTaxonomy {
  code: string;
  taxonomy_group?: string;
  desc: string;
  state: string;
  license: string;
  primary: boolean;
}

interface NppesAddress {
  country_code: string;
  country_name: string;
  address_purpose: string;
  address_type: string;
  address_1: string;
  city: string;
  state: string;
  postal_code: string;
  telephone_number: string;
}

interface NppesIdentifier {
  code: string;
  desc: string;
  identifier: string;
  state: string;
  issuer: string;
}

// ── Adapter Implementation ───────────────────────────────────

export class NppesAdapter implements PsvAdapter {
  readonly providerType = 'INDIVIDUAL' as const;
  readonly credentialType = 'NPI_ENROLLMENT' as const;

  async verify(npi: string): Promise<NormalizedCredentialPayload> {
    const url = `${NPPES_API_URL}&number=${encodeURIComponent(npi)}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`NPPES API returned ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as NppesResult;

    if (!data.results || data.result_count === 0) {
      throw new Error(`NPI ${npi} not found in NPPES registry`);
    }

    const record = data.results[0];
    const retrievedAt = new Date().toISOString();

    const provider = this.extractProvider(record);
    const credentials = this.extractCredentials(record);
    const retrieval = this.buildRetrievalEvent(retrievedAt);
    const enrollment = this.buildEnrollmentContext(record);

    return {
      provider,
      credentials,
      retrieval,
      enrollment,
      rawPayload: data as unknown as Record<string, unknown>,
    };
  }

  private extractProvider(record: NppesRecord): Provider {
    const basic = record.basic;
    const isOrg = record.enumeration_type === 'NPI-2';

    const name: CompactName = {
      first: basic.first_name ?? '',
      last: isOrg ? (basic.organization_name ?? '') : (basic.last_name ?? ''),
      middle: basic.middle_name ?? '',
      suffix: basic.name_suffix ?? '',
      credential: basic.credential ?? '',
    };

    return {
      npi: String(record.number),
      type: isOrg ? 'ORGANIZATION' : 'INDIVIDUAL',
      name,
      enumerationDate: basic.enumeration_date ?? '',
      lastUpdated: basic.last_updated ?? '',
      status: basic.status === 'A' ? 'ACTIVE' : 'DEACTIVATED',
    };
  }

  private extractCredentials(record: NppesRecord): Credential[] {
    return record.taxonomies.map((tax) => ({
      credentialType: 'STATE_LICENSE' as const,
      status: this.mapTaxonomyStatus(tax),
      issuer: tax.desc,
      issuingStateOrBody: tax.state,
      credentialIdentifier: tax.license || tax.code,
      issueDate: '',
      expirationDate: '',
      compactStatus: tax.primary ? 'PRIMARY' : 'SECONDARY',
    }));
  }

  private mapTaxonomyStatus(tax: NppesTaxonomy): CredentialStatus {
    if (tax.license && tax.state) return 'ACTIVE';
    if (tax.license) return 'ACTIVE';
    return 'UNKNOWN';
  }

  private buildRetrievalEvent(retrievedAt: string): RetrievalEvent {
    return {
      method: 'API',
      retrievedAt,
      agent: {
        system: 'vitalcv-engine',
        version: AGENT_VERSION,
      },
      source: {
        sourceType: 'NPPES',
        sourceName: 'CMS National Plan & Provider Enumeration System',
        sourceUrl: 'https://npiregistry.cms.hhs.gov',
        authoritative: true,
      },
    };
  }

  private buildEnrollmentContext(record: NppesRecord): EnrollmentContext {
    // NPPES doesn't directly provide Medicare/Medicaid enrollment
    // Those come from PECOS/state Medicaid APIs in future adapters
    return {
      medicareEnrollment: {
        enrollmentType: 'MEDICARE',
        status: 'UNKNOWN',
        effectiveDate: '',
        terminationDate: '',
      },
      medicaidEnrollment: {
        enrollmentType: 'MEDICAID',
        status: 'UNKNOWN',
        effectiveDate: '',
        terminationDate: '',
      },
      stateSpecific: this.extractStateInfo(record),
    };
  }

  private extractStateInfo(record: NppesRecord): Record<string, string> {
    const states: Record<string, string> = {};
    for (const tax of record.taxonomies) {
      if (tax.state) {
        states[tax.state] = tax.license || 'enrolled';
      }
    }
    return states;
  }
}
