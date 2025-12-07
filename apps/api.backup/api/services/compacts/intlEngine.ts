/**
 * B113A-COMPACT-012: Cross-Border License Rule Engine
 *
 * Encodes telehealth rules across US, Canada, and Australia.
 * Determines if cross-border practice is allowed.
 */

/**
 * Country codes
 */
export enum Country {
  US = 'US',
  CA = 'CA', // Canada
  AU = 'AU', // Australia
}

/**
 * Profession type
 */
export enum Profession {
  PHYSICIAN = 'physician',
  NURSE = 'nurse',
  PSYCHOLOGIST = 'psychologist',
  PHARMACIST = 'pharmacist',
}

/**
 * Practice modality
 */
export enum Modality {
  TELEHEALTH = 'telehealth',
  IN_PERSON = 'in_person',
}

/**
 * License check request
 */
export interface LicenseCheckRequest {
  providerCountry: Country;
  providerLicense: string;
  patientCountry: Country;
  patientState?: string; // US state, Canadian province, or AU state
  profession: Profession;
  modality: Modality;
}

/**
 * License check result
 */
export interface LicenseCheckResult {
  allowed: boolean;
  reasons: string[];
  requiresAdditionalLicense: boolean;
  additionalLicenseInfo?: string;
  compactApplicable?: string;
}

/**
 * Check if cross-border practice is allowed
 */
export function checkCrossBorderLicense(request: LicenseCheckRequest): LicenseCheckResult {
  const { providerCountry, patientCountry, profession, modality } = request;

  // Same country - generally allowed (subject to state/provincial rules)
  if (providerCountry === patientCountry) {
    return {
      allowed: true,
      reasons: ['Same country practice'],
      requiresAdditionalLicense: false,
    };
  }

  // Cross-border rules
  return evaluateCrossBorderRules(request);
}

/**
 * Evaluate cross-border practice rules
 */
function evaluateCrossBorderRules(request: LicenseCheckRequest): LicenseCheckResult {
  const { providerCountry, patientCountry, profession, modality } = request;

  // US → Canada
  if (providerCountry === Country.US && patientCountry === Country.CA) {
    return checkUsToCa(request);
  }

  // Canada → US
  if (providerCountry === Country.CA && patientCountry === Country.US) {
    return checkCaToUs(request);
  }

  // US → Australia
  if (providerCountry === Country.US && patientCountry === Country.AU) {
    return checkUsToAu(request);
  }

  // Australia → US
  if (providerCountry === Country.AU && patientCountry === Country.US) {
    return checkAuToUs(request);
  }

  // Canada → Australia
  if (providerCountry === Country.CA && patientCountry === Country.AU) {
    return checkCaToAu(request);
  }

  // Australia → Canada
  if (providerCountry === Country.AU && patientCountry === Country.CA) {
    return checkAuToCa(request);
  }

  // Default deny
  return {
    allowed: false,
    reasons: ['No cross-border agreement between countries'],
    requiresAdditionalLicense: true,
  };
}

/**
 * US → Canada telehealth rules
 */
function checkUsToCa(request: LicenseCheckRequest): LicenseCheckResult {
  if (request.modality === Modality.TELEHEALTH) {
    if (request.profession === Profession.PHYSICIAN) {
      return {
        allowed: false,
        reasons: [
          'Canadian patients must be treated by Canadian-licensed providers',
          'Telehealth across US-Canada border requires Canadian provincial license',
        ],
        requiresAdditionalLicense: true,
        additionalLicenseInfo: `Obtain license in ${request.patientState || 'patient province'}`,
      };
    }
  }

  return {
    allowed: false,
    reasons: ['In-person cross-border practice requires host country license'],
    requiresAdditionalLicense: true,
  };
}

/**
 * Canada → US telehealth rules
 */
function checkCaToUs(request: LicenseCheckRequest): LicenseCheckResult {
  if (request.modality === Modality.TELEHEALTH) {
    if (request.profession === Profession.PHYSICIAN && request.patientState) {
      // Check if state allows telehealth from Canadian providers
      const permissiveStates = ['AK', 'WA', 'MT', 'ND', 'MN']; // Border states with some agreements

      if (permissiveStates.includes(request.patientState)) {
        return {
          allowed: true,
          reasons: [
            `${request.patientState} allows limited telehealth from Canadian providers`,
            'Subject to state medical board approval',
          ],
          requiresAdditionalLicense: true,
          additionalLicenseInfo: `Register with ${request.patientState} medical board`,
        };
      }
    }
  }

  return {
    allowed: false,
    reasons: ['US state license required for telehealth to US patients'],
    requiresAdditionalLicense: true,
  };
}

/**
 * US → Australia telehealth rules
 */
function checkUsToAu(request: LicenseCheckRequest): LicenseCheckResult {
  if (request.modality === Modality.TELEHEALTH) {
    return {
      allowed: false,
      reasons: [
        'Australian patients must be treated by AHPRA-registered practitioners',
        'No reciprocal telehealth agreement between US and Australia',
      ],
      requiresAdditionalLicense: true,
      additionalLicenseInfo: 'Obtain AHPRA registration',
    };
  }

  return {
    allowed: false,
    reasons: ['In-person practice requires AHPRA registration'],
    requiresAdditionalLicense: true,
  };
}

/**
 * Australia → US telehealth rules
 */
function checkAuToUs(request: LicenseCheckRequest): LicenseCheckResult {
  return {
    allowed: false,
    reasons: ['US state medical license required'],
    requiresAdditionalLicense: true,
    additionalLicenseInfo: 'Obtain US state medical license',
  };
}

/**
 * Canada → Australia telehealth rules
 */
function checkCaToAu(request: LicenseCheckRequest): LicenseCheckResult {
  return {
    allowed: false,
    reasons: ['Australian registration required'],
    requiresAdditionalLicense: true,
  };
}

/**
 * Australia → Canada telehealth rules
 */
function checkAuToCa(request: LicenseCheckRequest): LicenseCheckResult {
  return {
    allowed: false,
    reasons: ['Canadian provincial license required'],
    requiresAdditionalLicense: true,
  };
}

/**
 * Batch check multiple requests
 */
export function batchCheckCrossBorderLicenses(
  requests: LicenseCheckRequest[]
): Map<string, LicenseCheckResult> {
  const results = new Map<string, LicenseCheckResult>();

  for (const request of requests) {
    const key = `${request.providerCountry}-${request.patientCountry}-${request.profession}-${request.modality}`;
    results.set(key, checkCrossBorderLicense(request));
  }

  return results;
}

