/**
 * S72-STRETCH-C-002: CAQH profile field mapper → Enrollment draft prefill
 *
 * Maps CAQH profile JSON into enrollment fields (addresses, specialties, practice locations);
 * unit tests with sample profile.
 */

import type { CaqhProfile } from './caqhClient.js';
import type { CreatePayerEnrollment } from './models/PayerEnrollment.js';

export interface EnrollmentDraftPrefill {
  addresses: Array<{
    type: 'practice' | 'mailing' | 'billing';
    street: string;
    city: string;
    state: string;
    zip: string;
    country?: string;
  }>;
  specialties: Array<{
    taxonomyCode: string;
    specialty: string;
    boardCertified: boolean;
    certificationNumber?: string;
  }>;
  practiceLocations: Array<{
    name: string;
    address: {
      street: string;
      city: string;
      state: string;
      zip: string;
    };
    startDate?: string;
    endDate?: string;
    position?: string;
  }>;
  licenses: Array<{
    licenseNumber: string;
    state: string;
    licenseType: string;
    issueDate: string;
    expirationDate: string;
    status: 'Active' | 'Inactive' | 'Expired';
  }>;
  metadata?: {
    education?: Array<{
      degree: string;
      school: string;
      graduationDate: string;
      specialty?: string;
    }>;
    malpracticeInsurance?: {
      carrier: string;
      policyNumber: string;
      coverageAmount: number;
      expirationDate: string;
    };
  };
}

/**
 * Maps CAQH profile to enrollment draft prefill data
 *
 * @param caqhProfile - CAQH profile from API
 * @returns Enrollment draft prefill data
 */
export function mapCaqhProfileToEnrollmentDraft(
  caqhProfile: CaqhProfile
): EnrollmentDraftPrefill {
  const prefill: EnrollmentDraftPrefill = {
    addresses: [],
    specialties: [],
    practiceLocations: [],
    licenses: [],
    metadata: {},
  };

  // Map licenses
  if (caqhProfile.profile.licenses) {
    prefill.licenses = caqhProfile.profile.licenses.map((lic) => ({
      licenseNumber: lic.licenseNumber,
      state: lic.state,
      licenseType: lic.licenseType,
      issueDate: lic.issueDate,
      expirationDate: lic.expirationDate,
      status: lic.status,
    }));
  }

  // Extract addresses from licenses (practice locations)
  const stateSet = new Set<string>();
  caqhProfile.profile.licenses?.forEach((lic) => {
    if (lic.state && !stateSet.has(lic.state)) {
      stateSet.add(lic.state);
      // Create a practice address entry for each licensed state
      // Note: CAQH profile may not have full addresses, so we use state info
      prefill.addresses.push({
        type: 'practice',
        street: '', // CAQH may not provide full address
        city: '', // Will need to be filled by user
        state: lic.state,
        zip: '', // Will need to be filled by user
        country: 'US',
      });
    }
  });

  // Map board certifications to specialties
  if (caqhProfile.profile.boardCertifications) {
    prefill.specialties = caqhProfile.profile.boardCertifications
      .filter((cert) => cert.status === 'Active')
      .map((cert) => {
        // Map specialty name to taxonomy code (simplified mapping)
        const taxonomyCode = mapSpecialtyToTaxonomyCode(cert.specialty);
        return {
          taxonomyCode,
          specialty: cert.specialty,
          boardCertified: true,
          certificationNumber: cert.certificationNumber,
        };
      });
  }

  // If no board certifications, try to infer from education
  if (prefill.specialties.length === 0 && caqhProfile.profile.education) {
    caqhProfile.profile.education.forEach((edu) => {
      if (edu.specialty) {
        const taxonomyCode = mapSpecialtyToTaxonomyCode(edu.specialty);
        prefill.specialties.push({
          taxonomyCode,
          specialty: edu.specialty,
          boardCertified: false,
        });
      }
    });
  }

  // Map work history to practice locations
  if (caqhProfile.profile.workHistory) {
    prefill.practiceLocations = caqhProfile.profile.workHistory.map((work) => ({
      name: work.facilityName,
      address: {
        street: '', // CAQH work history may not include full address
        city: '', // Will need to be filled by user
        state: '', // Will need to be filled by user
        zip: '', // Will need to be filled by user
      },
      startDate: work.startDate,
      endDate: work.endDate,
      position: work.position,
    }));
  }

  // Store additional metadata
  prefill.metadata = {
    education: caqhProfile.profile.education?.map((edu) => ({
      degree: edu.degree,
      school: edu.school,
      graduationDate: edu.graduationDate,
      specialty: edu.specialty,
    })),
    malpracticeInsurance: caqhProfile.profile.malpracticeInsurance
      ? {
          carrier: caqhProfile.profile.malpracticeInsurance.carrier,
          policyNumber: caqhProfile.profile.malpracticeInsurance.policyNumber,
          coverageAmount: caqhProfile.profile.malpracticeInsurance.coverageAmount,
          expirationDate: caqhProfile.profile.malpracticeInsurance.expirationDate,
        }
      : undefined,
  };

  return prefill;
}

/**
 * Maps specialty name to taxonomy code (simplified mapping)
 * In production, this would use a comprehensive specialty taxonomy database
 *
 * @param specialtyName - Specialty name from CAQH
 * @returns Taxonomy code (e.g., '207R00000X' for Internal Medicine)
 */
function mapSpecialtyToTaxonomyCode(specialtyName: string): string {
  const specialtyMap: Record<string, string> = {
    'Internal Medicine': '207R00000X',
    'Family Medicine': '208D00000X',
    'Emergency Medicine': '207P00000X',
    'Pediatrics': '208000000X',
    'Psychiatry': '2084P0800X',
    'Cardiology': '207RC0000X',
    'Dermatology': '207N00000X',
    'Orthopedic Surgery': '207X00000X',
    'General Surgery': '208600000X',
    'Obstetrics and Gynecology': '207V00000X',
    'Anesthesiology': '207L00000X',
    'Radiology': '2085R0001X',
    'Pathology': '207ZP0102X',
    'Neurology': '2084N0400X',
    'Oncology': '207RX0202X',
  };

  // Try exact match first
  if (specialtyMap[specialtyName]) {
    return specialtyMap[specialtyName];
  }

  // Try case-insensitive match
  const lowerSpecialty = specialtyName.toLowerCase();
  for (const [key, code] of Object.entries(specialtyMap)) {
    if (key.toLowerCase() === lowerSpecialty) {
      return code;
    }
  }

  // Try partial match
  for (const [key, code] of Object.entries(specialtyMap)) {
    if (lowerSpecialty.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerSpecialty)) {
      return code;
    }
  }

  // Default to Internal Medicine if no match
  return '207R00000X';
}

/**
 * Creates enrollment draft data from CAQH profile prefill
 *
 * @param prefill - Enrollment draft prefill data
 * @param baseEnrollment - Base enrollment data (orgId, payerId, clinicianDid)
 * @returns Enrollment draft data ready for creation
 */
export function createEnrollmentDraftFromPrefill(
  prefill: EnrollmentDraftPrefill,
  baseEnrollment: {
    orgId: string;
    payerId: string;
    clinicianDid: string;
    caqhId?: string;
  }
): Partial<CreatePayerEnrollment> {
  return {
    orgId: baseEnrollment.orgId,
    payerId: baseEnrollment.payerId,
    clinicianDid: baseEnrollment.clinicianDid,
    caqhId: baseEnrollment.caqhId,
    evidenceBundle: {
      addresses: prefill.addresses,
      specialties: prefill.specialties,
      practiceLocations: prefill.practiceLocations,
      licenses: prefill.licenses,
      metadata: prefill.metadata,
      source: 'CAQH',
      mappedAt: new Date().toISOString(),
    },
    metadata: {
      prefillSource: 'CAQH',
      prefillDate: new Date().toISOString(),
      specialties: prefill.specialties.map((s) => s.specialty),
      licensedStates: prefill.licenses.map((l) => l.state),
    },
  };
}

/**
 * Validates that prefill data has minimum required fields
 *
 * @param prefill - Enrollment draft prefill data
 * @returns Validation result
 */
export function validateEnrollmentPrefill(prefill: EnrollmentDraftPrefill): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (prefill.licenses.length === 0) {
    errors.push('At least one license is required');
  }

  const activeLicenses = prefill.licenses.filter(
    (l) => l.status === 'Active' && new Date(l.expirationDate) > new Date()
  );
  if (activeLicenses.length === 0) {
    errors.push('At least one active license is required');
  }

  if (prefill.specialties.length === 0) {
    errors.push('At least one specialty is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

