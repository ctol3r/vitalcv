/**
 * B137A-CAQH-004: CAQH profile fetch stub
 *
 * Simulates CAQH ProView export API for provider credentialing data.
 * In production, this would integrate with the real CAQH ProView DirectAssure API.
 *
 * Real integration TODO:
 * - Implement OAuth 2.0 authentication with CAQH
 * - Use actual CAQH ProView API endpoints
 * - Handle rate limiting and pagination
 * - Implement webhook for profile updates
 */

export interface CaqhProfile {
  caqhId: string;
  providerId: string; // NPI
  status: 'Active' | 'Inactive' | 'Pending' | 'Expired';
  lastUpdateDate: string; // ISO date
  attestationDate: string;
  expirationDate: string;
  profile: {
    personalInfo: {
      firstName: string;
      lastName: string;
      middleName?: string;
      dateOfBirth: string;
      ssn?: string; // Masked, last 4 digits only
    };
    licenses: Array<{
      licenseNumber: string;
      state: string;
      licenseType: string;
      issueDate: string;
      expirationDate: string;
      status: 'Active' | 'Inactive' | 'Expired';
    }>;
    education: Array<{
      degree: string;
      school: string;
      graduationDate: string;
      specialty?: string;
    }>;
    boardCertifications: Array<{
      board: string;
      specialty: string;
      certificationNumber: string;
      issueDate: string;
      expirationDate: string;
      status: 'Active' | 'Expired';
    }>;
    workHistory: Array<{
      facilityName: string;
      startDate: string;
      endDate?: string;
      position: string;
    }>;
    malpracticeInsurance: {
      carrier: string;
      policyNumber: string;
      coverageAmount: number;
      expirationDate: string;
    };
  };
}

export interface CaqhFetchOptions {
  caqhId: string;
  includeHistory?: boolean;
}

export interface CaqhFetchResult {
  success: boolean;
  profile?: CaqhProfile;
  error?: string;
  lastCheckedAt: Date;
}

/**
 * Fetches a provider's CAQH profile (MOCKED for demo/testing)
 *
 * @param options - Fetch options including CAQH ID
 * @returns Mocked CAQH profile data
 */
export async function fetchCaqhProfile(
  options: CaqhFetchOptions
): Promise<CaqhFetchResult> {
  const { caqhId } = options;

  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Mock successful response
  const mockProfile: CaqhProfile = {
    caqhId,
    providerId: '1234567890', // Mock NPI
    status: 'Active',
    lastUpdateDate: new Date().toISOString(),
    attestationDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days ago
    expirationDate: new Date(Date.now() + 275 * 24 * 60 * 60 * 1000).toISOString(), // 275 days from now
    profile: {
      personalInfo: {
        firstName: 'Jane',
        lastName: 'Smith',
        middleName: 'Marie',
        dateOfBirth: '1985-06-15',
        ssn: '****-1234', // Masked
      },
      licenses: [
        {
          licenseNumber: 'A123456',
          state: 'CA',
          licenseType: 'MD',
          issueDate: '2015-01-15',
          expirationDate: '2026-01-15',
          status: 'Active',
        },
        {
          licenseNumber: 'NY789012',
          state: 'NY',
          licenseType: 'MD',
          issueDate: '2016-03-20',
          expirationDate: '2026-03-20',
          status: 'Active',
        },
        {
          licenseNumber: 'DEA1234567',
          state: 'FED',
          licenseType: 'DEA',
          issueDate: '2014-01-01',
          expirationDate: '2027-12-31',
          status: 'Active',
        },
      ],
      education: [
        {
          degree: 'MD',
          school: 'Stanford University School of Medicine',
          graduationDate: '2012-06-01',
          specialty: 'Internal Medicine',
        },
      ],
      boardCertifications: [
        {
          board: 'American Board of Internal Medicine',
          specialty: 'Internal Medicine',
          certificationNumber: 'ABIM12345',
          issueDate: '2015-01-01',
          expirationDate: '2025-12-31',
          status: 'Active',
        },
      ],
      workHistory: [
        {
          facilityName: 'Stanford Health Care',
          startDate: '2015-07-01',
          position: 'Attending Physician',
        },
      ],
      malpracticeInsurance: {
        carrier: 'The Doctors Company',
        policyNumber: 'TDC-987654321',
        coverageAmount: 1000000,
        expirationDate: '2025-12-31',
      },
    },
  };

  // Simulate occasional errors (10% chance)
  if (Math.random() < 0.1) {
    return {
      success: false,
      error: 'CAQH ProView API temporarily unavailable',
      lastCheckedAt: new Date(),
    };
  }

  return {
    success: true,
    profile: mockProfile,
    lastCheckedAt: new Date(),
  };
}

/**
 * Validates if a CAQH profile is active and current
 *
 * @param profile - CAQH profile to validate
 * @returns Validation result with details
 */
export function validateCaqhProfile(profile: CaqhProfile): {
  isValid: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];

  // Check profile status
  if (profile.status !== 'Active') {
    reasons.push(`CAQH profile status is ${profile.status}, must be Active`);
  }

  // Check if profile is expired
  const expirationDate = new Date(profile.expirationDate);
  if (expirationDate < new Date()) {
    reasons.push('CAQH profile has expired');
  }

  // Check if attestation is recent (within 120 days)
  const attestationDate = new Date(profile.attestationDate);
  const daysSinceAttestation =
    (Date.now() - attestationDate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceAttestation > 120) {
    reasons.push('CAQH attestation is more than 120 days old');
  }

  // Check for active licenses
  const activeLicenses = profile.profile.licenses.filter(
    (lic) => lic.status === 'Active' && new Date(lic.expirationDate) > new Date()
  );
  if (activeLicenses.length === 0) {
    reasons.push('No active licenses found in CAQH profile');
  }

  return {
    isValid: reasons.length === 0,
    reasons,
  };
}

/**
 * Checks if CAQH profile needs renewal soon
 *
 * @param profile - CAQH profile
 * @param daysThreshold - Days before expiration to trigger warning
 * @returns True if renewal is needed soon
 */
export function needsCaqhRenewal(
  profile: CaqhProfile,
  daysThreshold: number = 60
): boolean {
  const expirationDate = new Date(profile.expirationDate);
  const daysUntilExpiration =
    (expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return daysUntilExpiration <= daysThreshold && daysUntilExpiration >= 0;
}

// Mock CAQH profile for unit tests
export const MOCK_CAQH_PROFILE: CaqhProfile = {
  caqhId: 'CAQH123456',
  providerId: '1234567890',
  status: 'Active',
  lastUpdateDate: new Date().toISOString(),
  attestationDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  expirationDate: new Date(Date.now() + 300 * 24 * 60 * 60 * 1000).toISOString(),
  profile: {
    personalInfo: {
      firstName: 'Test',
      lastName: 'Provider',
      dateOfBirth: '1980-01-01',
      ssn: '****-0000',
    },
    licenses: [
      {
        licenseNumber: 'TEST123',
        state: 'CA',
        licenseType: 'MD',
        issueDate: '2010-01-01',
        expirationDate: '2025-12-31',
        status: 'Active',
      },
    ],
    education: [
      {
        degree: 'MD',
        school: 'Test Medical School',
        graduationDate: '2009-06-01',
      },
    ],
    boardCertifications: [],
    workHistory: [],
    malpracticeInsurance: {
      carrier: 'Test Insurance',
      policyNumber: 'TEST-001',
      coverageAmount: 1000000,
      expirationDate: '2025-12-31',
    },
  },
};

