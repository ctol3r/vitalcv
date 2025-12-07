/**
 * TEFCA Directory & FHIR R6 Adapter
 * Implements QTF v2.1 directory hooks → FHIR R6 Practitioner/Endpoint map
 * Supports Provenance + security metadata
 * Aligns with Sequoia Project RCE comment deadlines Nov 7 & 21 2025
 */

import { pool } from '../db';

export interface TEFCADirectoryEntry {
  npi: string;
  organizationName?: string;
  practitioner?: {
    resourceType: 'Practitioner';
    id: string;
    identifier: Array<{
      system: string;
      value: string;
    }>;
    name: Array<{
      family: string;
      given: string[];
    }>;
    qualification?: Array<{
      code: {
        coding: Array<{
          system: string;
          code: string;
        }>;
      };
      issuer: {
        display: string;
      };
      period?: {
        start: string;
        end?: string;
      };
    }>;
  };
  endpoint?: {
    resourceType: 'Endpoint';
    id: string;
    status: 'active' | 'suspended' | 'error' | 'off' | 'entered-in-error' | 'test';
    connectionType: {
      system: string;
      code: string;
    };
    address: string;
    payloadType: Array<{
      coding: Array<{
        system: string;
        code: string;
      }>;
    }>;
  };
  provenance?: {
    resourceType: 'Provenance';
    target: Array<{
      reference: string;
    }>;
    recorded: string;
    agent: Array<{
      who: {
        reference: string;
      };
      role: Array<{
        coding: Array<{
          system: string;
          code: string;
        }>;
      }>;
    }>;
  };
}

/**
 * Map NPI data to FHIR R6 Practitioner resource
 */
export function mapToFHIRR6Practitioner(npiData: any): TEFCADirectoryEntry['practitioner'] {
  return {
    resourceType: 'Practitioner',
    id: `practitioner-${npiData.npi}`,
    identifier: [
      {
        system: 'http://hl7.org/fhir/sid/us-npi',
        value: npiData.npi,
      },
    ],
    name: npiData.basic?.organizationName
      ? [
          {
            family: npiData.basic.organizationName,
            given: [],
          },
        ]
      : [
          {
            family: npiData.basic?.lastName || '',
            given: [npiData.basic?.firstName || ''],
          },
        ],
    qualification: npiData.taxonomies?.map((tax: any) => ({
      code: {
        coding: [
          {
            system: 'http://nucc.org/provider-taxonomy',
            code: tax.code,
          },
        ],
      },
      issuer: {
        display: tax.license || 'Unknown',
      },
    })),
  };
}

/**
 * Map endpoint data to FHIR R6 Endpoint resource
 */
export function mapToFHIRR6Endpoint(
  endpointData: any,
  npi: string
): TEFCADirectoryEntry['endpoint'] {
  return {
    resourceType: 'Endpoint',
    id: `endpoint-${npi}`,
    status: 'active',
    connectionType: {
      system: 'http://terminology.hl7.org/CodeSystem/endpoint-connection-type',
      code: 'hl7-fhir-rest',
    },
    address: endpointData.url || endpointData.endpoint || '',
    payloadType: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/endpoint-payload-type',
            code: 'application/fhir+json',
          },
        ],
      },
    ],
  };
}

/**
 * Store TEFCA directory entry with FHIR R6 resources
 */
export async function storeTEFCADirectoryEntry(entry: TEFCADirectoryEntry): Promise<void> {
  // Create or update directory entry
  await pool.query(
    `INSERT INTO "TEFCADirectory" (npi, practitioner, endpoint, provenance, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (npi) DO UPDATE
     SET practitioner = EXCLUDED.practitioner,
         endpoint = EXCLUDED.endpoint,
         provenance = EXCLUDED.provenance,
         updated_at = NOW()`,
    [
      entry.npi,
      JSON.stringify(entry.practitioner),
      JSON.stringify(entry.endpoint),
      JSON.stringify(entry.provenance),
    ]
  );
}

/**
 * Query TEFCA directory by NPI
 */
export async function queryTEFCADirectory(npi: string): Promise<TEFCADirectoryEntry | null> {
  const result = await pool.query('SELECT * FROM "TEFCADirectory" WHERE npi = $1', [npi]);
  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    npi: row.npi,
    practitioner: row.practitioner,
    endpoint: row.endpoint,
    provenance: row.provenance,
  };
}

