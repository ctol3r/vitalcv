import axios from 'axios';
import type { NPIDataResponse, SourceStatus } from '@/components/sandbox/types/npi';

/**
 * VitalCV NPI Ingestion Service (production).
 *
 * Fetches real data from the VitalCV backend via the Next.js API proxies,
 * then maps it to the sandbox's NPIDataResponse shape.
 */
export async function fetchNPIData(npi: string): Promise<NPIDataResponse> {
  const npiRegex = /^\d{10}$/;
  if (!npiRegex.test(npi)) {
    throw new Error('Invalid NPI format. Must be exactly 10 digits.');
  }

  try {
    const { data: passport } = await axios.get(`/api/passport/entity/${npi}`);

    if (!passport || passport.error) {
      throw new Error(passport?.error || 'Passport not available.');
    }

    return mapPassportToSandboxShape(npi, passport);
  } catch (error: any) {
    if (error.response?.status === 404) {
      throw new Error('No public record found for this NPI.');
    }
    throw new Error(error?.response?.data?.error || error?.message || 'Failed to fetch primary source data.');
  }
}

function mapPassportToSandboxShape(npi: string, passport: any): NPIDataResponse {
  const identity = passport?.identity ?? {};
  const standing = passport?.standing ?? {};
  const readiness = passport?.readiness ?? {};
  const credentials: any[] = passport?.authority?.credentials ?? [];

  const firstName = (identity.displayName || '').split(' ')[0] || '';
  const lastName = (identity.displayName || '').split(' ').slice(1, -1).join(' ') || '';

  const nppesStatus: SourceStatus = identity.status === 'ACTIVE' ? 'Checked' : 'Pending';
  const sanctionsStatus: SourceStatus = standing.sanctionsStatus === 'CLEAR' ? 'Checked' : 'Pending';
  const licenseCred = credentials.find((c) => c.type === 'STATE_LICENSE');
  const licenseStatus: SourceStatus = licenseCred ? 'Checked' : 'Access Required';
  const pecosStatus: SourceStatus = standing.medicareEnrolled ? 'Checked' : 'Pending';

  return {
    npi,
    timestamp: passport?.meta?.computedAt || new Date().toISOString(),
    identity: {
      firstName,
      lastName,
      enumerationDate: identity.enumerationDate || 'Unknown',
      specialty: identity.specialty || 'Unknown',
      status: nppesStatus,
    },
    sanctions: {
      exclusionStatus: standing.sanctionsStatus !== 'CLEAR',
      lastChecked: standing.sanctionsCheckedAt || new Date().toISOString(),
      status: sanctionsStatus,
    },
    licensure: {
      licenseNumber: licenseCred?.jurisdiction || '—',
      state: licenseCred?.jurisdiction || '—',
      expirationDate: licenseCred?.expiresAt || '—',
      status: licenseStatus,
    },
    pecos: {
      enrolled: Boolean(standing.medicareEnrolled),
      status: pecosStatus,
    },
    readinessScore: Number(readiness.score ?? 0),
  };
}

export async function fetchReadinessSnapshot(npi: string) {
  const response = await axios.get(`/api/passport/entity/${npi}`);
  return response.data;
}

export async function fetchPassportStatus(npi: string) {
  const response = await axios.get(`/api/passport/${npi}`);
  return response.data;
}
