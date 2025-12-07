const log = getServiceLogger('fhir/rolesForPrivileges');
/**
 * FHIR PractitionerRole Retrieval Service for Privilege Criteria
 * B134C-FHIR-003
 *
 * Retrieves and verifies practitioner license, certification, and role information
 * from FHIR-compliant systems to support privileging decisions.
 *
 * FHIR Resources Used:
 * - PractitionerRole: Current roles, locations, specialties, qualifications
 * - Practitioner: Basic practitioner information
 * - Qualification: Educational and certification details
 * - Organization: Healthcare organization affiliations
 */

import { LicenseStatus } from '@domain-common/credentialingContracts';
import { getServiceLogger } from '../logging/serviceLogger';

export interface FHIRPractitionerRole {
  id: string;
  resourceType: 'PractitionerRole';
  active: boolean;
  practitioner: {
    reference: string;
    display?: string;
  };
  organization?: {
    reference: string;
    display?: string;
  };
  code?: Array<{
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text?: string;
  }>;
  specialty?: Array<{
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text?: string;
  }>;
  location?: Array<{
    reference: string;
    display?: string;
  }>;
  period?: {
    start?: string;
    end?: string;
  };
}

export interface FHIRQualification {
  identifier?: Array<{
    system: string;
    value: string;
  }>;
  code: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text?: string;
  };
  issuer?: {
    reference?: string;
    display?: string;
  };
  period?: {
    start?: string;
    end?: string;
  };
}

export interface LicenseInfo {
  licenseNumber: string;
  state: string;
  status: LicenseStatus;
  issueDate: string;
  expirationDate?: string;
  licenseType: string;
  disciplinaryActions?: string[];
  verified: boolean;
  verificationDate: string;
  source: 'fhir' | 'manual' | 'state_board';
}

export interface CertificationInfo {
  certificationId: string;
  boardName: string;
  specialty: string;
  status: 'current' | 'expired' | 'suspended';
  certificationDate: string;
  expirationDate?: string;
  recertificationDate?: string;
  verified: boolean;
  verificationDate: string;
}

export interface PrivilegeCriteriaResult {
  ok: boolean;
  npi: string;
  practitionerId: string;
  licenses: LicenseInfo[];
  certifications: CertificationInfo[];
  roles: FHIRPractitionerRole[];
  specialties: string[];
  activeOrganizations: string[];
  eligibleForPrivileging: boolean;
  warnings: string[];
  errors: string[];
  retrievalDate: string;
  dataSource: 'fhir' | 'fallback' | 'mixed';
}

export interface FHIRConfig {
  baseUrl: string;
  authToken?: string;
  timeout?: number;
  retryAttempts?: number;
}

/**
 * FHIR PractitionerRole Service
 * Retrieves practitioner information for privileging decisions
 */
export class FHIRRolesForPrivilegesService {
  private config: FHIRConfig;
  private cache: Map<string, { result: PrivilegeCriteriaResult; expiresAt: Date }> = new Map();
  private readonly cacheTTLMinutes = 60;

  constructor(config?: Partial<FHIRConfig>) {
    this.config = {
      baseUrl: config?.baseUrl || process.env.FHIR_BASE_URL || 'http://localhost:8080/fhir',
      authToken: config?.authToken || process.env.FHIR_AUTH_TOKEN,
      timeout: config?.timeout || 10000,
      retryAttempts: config?.retryAttempts || 3
    };
  }

  /**
   * Retrieve privilege criteria for a practitioner by NPI
   * Includes license, certification, and role information
   */
  async getPrivilegeCriteria(npi: string): Promise<PrivilegeCriteriaResult> {
    // Check cache first
    const cached = this.getCached(npi);
    if (cached) {
      return cached;
    }

    const result: PrivilegeCriteriaResult = {
      ok: false,
      npi,
      practitionerId: '',
      licenses: [],
      certifications: [],
      roles: [],
      specialties: [],
      activeOrganizations: [],
      eligibleForPrivileging: false,
      warnings: [],
      errors: [],
      retrievalDate: new Date().toISOString(),
      dataSource: 'fhir'
    };

    try {
      // Step 1: Find PractitionerRole resources by NPI
      const roles = await this.searchPractitionerRolesByNPI(npi);

      if (roles.length === 0) {
        result.warnings.push('No PractitionerRole resources found in FHIR system - using fallback');
        return await this.fallbackVerification(npi, result);
      }

      result.roles = roles;

      // Step 2: Get practitioner ID from first role
      const practitionerReference = roles[0].practitioner.reference;
      result.practitionerId = practitionerReference.split('/').pop() || '';

      // Step 3: Retrieve Practitioner resource for qualifications
      const practitioner = await this.getPractitioner(result.practitionerId);

      if (practitioner) {
        // Extract licenses from qualifications
        result.licenses = this.extractLicenses(practitioner.qualification || []);

        // Extract certifications from qualifications
        result.certifications = this.extractCertifications(practitioner.qualification || []);
      }

      // Step 4: Extract specialties from roles
      result.specialties = this.extractSpecialties(roles);

      // Step 5: Extract active organizations
      result.activeOrganizations = this.extractOrganizations(roles);

      // Step 6: Evaluate eligibility
      const eligibility = this.evaluateEligibility(result);
      result.eligibleForPrivileging = eligibility.eligible;
      result.warnings.push(...eligibility.warnings);

      result.ok = true;

      // Cache the result
      this.cacheResult(npi, result);

      return result;

    } catch (error: any) {
      result.errors.push(`FHIR retrieval error: ${error.message}`);
      result.dataSource = 'fallback';

      // Attempt fallback verification
      return await this.fallbackVerification(npi, result);
    }
  }

  /**
   * Search for PractitionerRole resources by NPI
   */
  private async searchPractitionerRolesByNPI(npi: string): Promise<FHIRPractitionerRole[]> {
    try {
      const url = `${this.config.baseUrl}/PractitionerRole?identifier=http://hl7.org/fhir/sid/us-npi|${npi}`;

      const response = await this.fetchWithRetry(url);
      const bundle = await response.json();

      if (!bundle.entry || bundle.entry.length === 0) {
        return [];
      }

      return bundle.entry
        .map((entry: any) => entry.resource)
        .filter((resource: any) => resource.resourceType === 'PractitionerRole');

    } catch (error: any) {
      log.error('Error searching PractitionerRole:', error);
      throw new Error(`Failed to search PractitionerRole: ${error.message}`);
    }
  }

  /**
   * Get Practitioner resource by ID
   */
  private async getPractitioner(practitionerId: string): Promise<any> {
    try {
      const url = `${this.config.baseUrl}/Practitioner/${practitionerId}`;

      const response = await this.fetchWithRetry(url);
      return await response.json();

    } catch (error: any) {
      log.error('Error retrieving Practitioner:', error);
      return null;
    }
  }

  /**
   * Fetch with retry logic
   */
  private async fetchWithRetry(url: string, attempt = 1): Promise<Response> {
    const headers: HeadersInit = {
      'Accept': 'application/fhir+json'
    };

    if (this.config.authToken) {
      headers['Authorization'] = `Bearer ${this.config.authToken}`;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(url, {
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;

    } catch (error: any) {
      if (attempt < (this.config.retryAttempts || 3)) {
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        return this.fetchWithRetry(url, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Extract license information from FHIR Qualifications
   */
  private extractLicenses(qualifications: FHIRQualification[]): LicenseInfo[] {
    const licenses: LicenseInfo[] = [];

    for (const qual of qualifications) {
      // Check if this qualification represents a license
      const isLicense = qual.code.coding.some(coding =>
        coding.system === 'http://terminology.hl7.org/CodeSystem/v2-0360' &&
        coding.code === 'MD' || coding.code === 'DO' || coding.code === 'RN'
      ) || qual.code.text?.toLowerCase().includes('license');

      if (isLicense) {
        const licenseNumber = qual.identifier?.find(id =>
          id.system?.includes('license')
        )?.value || 'Unknown';

        const state = this.extractStateFromQualification(qual);
        const status = this.determineLicenseStatus(qual);

        licenses.push({
          licenseNumber,
          state,
          status,
          issueDate: qual.period?.start || 'Unknown',
          expirationDate: qual.period?.end,
          licenseType: qual.code.coding[0]?.display || 'Medical License',
          verified: true,
          verificationDate: new Date().toISOString(),
          source: 'fhir'
        });
      }
    }

    return licenses;
  }

  /**
   * Extract certification information from FHIR Qualifications
   */
  private extractCertifications(qualifications: FHIRQualification[]): CertificationInfo[] {
    const certifications: CertificationInfo[] = [];

    for (const qual of qualifications) {
      // Check if this qualification represents a board certification
      const isCertification = qual.code.coding.some(coding =>
        coding.system?.includes('nucc') ||
        coding.system?.includes('board') ||
        coding.display?.toLowerCase().includes('board certified')
      );

      if (isCertification) {
        const certId = qual.identifier?.[0]?.value || `CERT-${Date.now()}`;
        const boardName = qual.issuer?.display || 'Medical Board';
        const specialty = qual.code.coding[0]?.display || 'General';
        const status = this.determineCertificationStatus(qual);

        certifications.push({
          certificationId: certId,
          boardName,
          specialty,
          status,
          certificationDate: qual.period?.start || 'Unknown',
          expirationDate: qual.period?.end,
          verified: true,
          verificationDate: new Date().toISOString()
        });
      }
    }

    return certifications;
  }

  /**
   * Extract specialties from PractitionerRole resources
   */
  private extractSpecialties(roles: FHIRPractitionerRole[]): string[] {
    const specialties = new Set<string>();

    for (const role of roles) {
      if (role.specialty) {
        for (const spec of role.specialty) {
          for (const coding of spec.coding) {
            if (coding.display) {
              specialties.add(coding.display);
            }
          }
        }
      }
    }

    return Array.from(specialties);
  }

  /**
   * Extract organization affiliations from PractitionerRole resources
   */
  private extractOrganizations(roles: FHIRPractitionerRole[]): string[] {
    const orgs = new Set<string>();

    for (const role of roles) {
      if (role.active && role.organization?.display) {
        orgs.add(role.organization.display);
      }
    }

    return Array.from(orgs);
  }

  /**
   * Extract state from qualification
   */
  private extractStateFromQualification(qual: FHIRQualification): string {
    // Try to find state in identifier system
    const stateIdentifier = qual.identifier?.find(id =>
      id.system?.includes('state') || id.system?.includes('/us/')
    );

    if (stateIdentifier) {
      const match = stateIdentifier.system?.match(/\/([A-Z]{2})\//);
      if (match) return match[1];
    }

    // Try to extract from issuer display
    if (qual.issuer?.display) {
      const match = qual.issuer.display.match(/\b([A-Z]{2})\b/);
      if (match) return match[1];
    }

    return 'Unknown';
  }

  /**
   * Determine license status from qualification period
   */
  private determineLicenseStatus(qual: FHIRQualification): LicenseStatus {
    if (!qual.period) return 'active';

    const now = new Date();

    if (qual.period.end) {
      const endDate = new Date(qual.period.end);
      if (endDate < now) return 'expired';
    }

    if (qual.period.start) {
      const startDate = new Date(qual.period.start);
      if (startDate > now) return 'inactive';
    }

    return 'active';
  }

  /**
   * Determine certification status from qualification period
   */
  private determineCertificationStatus(qual: FHIRQualification): CertificationInfo['status'] {
    if (!qual.period) return 'current';

    const now = new Date();

    if (qual.period.end) {
      const endDate = new Date(qual.period.end);
      if (endDate < now) return 'expired';
    }

    return 'current';
  }

  /**
   * Evaluate eligibility for privileging based on criteria
   */
  private evaluateEligibility(result: PrivilegeCriteriaResult): {
    eligible: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];
    let eligible = true;

    // Check for at least one active license
    const activeLicenses = result.licenses.filter(l => l.status === 'active');
    if (activeLicenses.length === 0) {
      eligible = false;
      warnings.push('No active medical license found');
    }

    // Check for suspended or revoked licenses
    const problematicLicenses = result.licenses.filter(l =>
      l.status === 'suspended' || l.status === 'revoked' || l.status === 'probation'
    );
    if (problematicLicenses.length > 0) {
      eligible = false;
      warnings.push(`License issue(s): ${problematicLicenses.map(l => l.status).join(', ')}`);
    }

    // Check for at least one current board certification (preferred but not required)
    const currentCertifications = result.certifications.filter(c => c.status === 'current');
    if (currentCertifications.length === 0 && result.certifications.length > 0) {
      warnings.push('No current board certifications found - all certifications expired');
    }

    // Check for active roles
    const activeRoles = result.roles.filter(r => r.active);
    if (activeRoles.length === 0) {
      warnings.push('No active PractitionerRole found in FHIR system');
    }

    // Check for expired licenses approaching expiration (within 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const expiringLicenses = result.licenses.filter(l => {
      if (!l.expirationDate) return false;
      const expDate = new Date(l.expirationDate);
      return expDate <= thirtyDaysFromNow && expDate > new Date();
    });

    if (expiringLicenses.length > 0) {
      warnings.push(`License(s) expiring within 30 days: ${expiringLicenses.map(l => l.state).join(', ')}`);
    }

    return { eligible, warnings };
  }

  /**
   * Fallback verification when FHIR is unavailable
   * Returns stub data structure for manual verification
   */
  private async fallbackVerification(
    npi: string,
    baseResult: PrivilegeCriteriaResult
  ): Promise<PrivilegeCriteriaResult> {
    // In production, this might call alternative verification services
    // or return a structure that prompts manual verification

    baseResult.dataSource = 'fallback';
    baseResult.ok = false;
    baseResult.eligibleForPrivileging = false;
    baseResult.warnings.push(
      'FHIR data unavailable - manual verification required',
      'Please verify licenses and certifications through state boards',
      'Upload supporting documentation to credentialing portal'
    );

    // Provide stub entries to indicate what needs manual verification
    baseResult.licenses.push({
      licenseNumber: 'VERIFICATION_REQUIRED',
      state: 'Unknown',
      status: 'active',
      issueDate: 'Unknown',
      licenseType: 'Medical License',
      verified: false,
      verificationDate: new Date().toISOString(),
      source: 'manual'
    });

    return baseResult;
  }

  /**
   * Get cached result if available and not expired
   */
  private getCached(npi: string): PrivilegeCriteriaResult | null {
    const cached = this.cache.get(npi);
    if (!cached) return null;

    if (new Date() > cached.expiresAt) {
      this.cache.delete(npi);
      return null;
    }

    return cached.result;
  }

  /**
   * Cache result
   */
  private cacheResult(npi: string, result: PrivilegeCriteriaResult): void {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.cacheTTLMinutes);

    this.cache.set(npi, { result, expiresAt });
  }

  /**
   * Clear cache for specific NPI
   */
  clearCache(npi: string): void {
    this.cache.delete(npi);
  }

  /**
   * Clear all cache
   */
  clearAllCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { totalEntries: number; validEntries: number } {
    const now = new Date();
    let validCount = 0;

    for (const entry of this.cache.values()) {
      if (entry.expiresAt > now) {
        validCount++;
      }
    }

    return {
      totalEntries: this.cache.size,
      validEntries: validCount
    };
  }
}

/**
 * Singleton instance
 */
export const fhirRolesService = new FHIRRolesForPrivilegesService();

/**
 * Helper function to format license info for display
 */
export function formatLicenseInfo(license: LicenseInfo): string {
  const statusEmoji = {
    active: '✅',
    inactive: '⏸️',
    expired: '❌',
    suspended: '🚫',
    revoked: '🚫',
    probation: '⚠️'
  };

  let info = `${statusEmoji[license.status]} ${license.state} ${license.licenseType}\n`;
  info += `   License #: ${license.licenseNumber}\n`;
  info += `   Status: ${license.status.toUpperCase()}\n`;
  info += `   Issued: ${license.issueDate}\n`;

  if (license.expirationDate) {
    info += `   Expires: ${license.expirationDate}\n`;
  }

  info += `   Verified: ${license.verified ? 'Yes' : 'No'} (${license.verificationDate})\n`;

  if (license.disciplinaryActions && license.disciplinaryActions.length > 0) {
    info += `   ⚠️ Disciplinary Actions: ${license.disciplinaryActions.join(', ')}\n`;
  }

  return info;
}

/**
 * Helper function to format certification info for display
 */
export function formatCertificationInfo(cert: CertificationInfo): string {
  const statusEmoji = {
    current: '✅',
    expired: '❌',
    suspended: '🚫'
  };

  let info = `${statusEmoji[cert.status]} ${cert.specialty}\n`;
  info += `   Board: ${cert.boardName}\n`;
  info += `   Certified: ${cert.certificationDate}\n`;

  if (cert.expirationDate) {
    info += `   Expires: ${cert.expirationDate}\n`;
  }

  if (cert.recertificationDate) {
    info += `   Recertified: ${cert.recertificationDate}\n`;
  }

  return info;
}

/**
 * Test stub data generator for development
 */
export function generateTestStubs(npi: string): PrivilegeCriteriaResult {
  return {
    ok: true,
    npi,
    practitionerId: `Practitioner/${npi}`,
    licenses: [
      {
        licenseNumber: `MD-${npi.slice(-6)}`,
        state: 'CA',
        status: 'active',
        issueDate: '2015-01-15',
        expirationDate: '2026-01-15',
        licenseType: 'Medical License (MD)',
        verified: true,
        verificationDate: new Date().toISOString(),
        source: 'fhir'
      }
    ],
    certifications: [
      {
        certificationId: `ABIM-${npi}`,
        boardName: 'American Board of Internal Medicine',
        specialty: 'Internal Medicine',
        status: 'current',
        certificationDate: '2016-06-01',
        expirationDate: '2026-06-01',
        verified: true,
        verificationDate: new Date().toISOString()
      }
    ],
    roles: [],
    specialties: ['Internal Medicine'],
    activeOrganizations: ['Test Hospital'],
    eligibleForPrivileging: true,
    warnings: ['This is test/stub data - not real FHIR data'],
    errors: [],
    retrievalDate: new Date().toISOString(),
    dataSource: 'fallback'
  };
}

