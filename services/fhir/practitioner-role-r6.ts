/**
 * B119A-FHIR6-008: Upgrade PractitionerRole mapping to FHIR R6
 *
 * Implements FHIR R6 normative PractitionerRole resource mapping.
 * Supports partial dates, multi-role practitioners, and Organization references.
 */

import { FhirPractitionerRole, FhirDate, mapPartialDate, mapToFhirDate, mapMultiRolePractitioner, mapToFhirRoles } from './tests/r6-mapping';

export interface PractitionerInput {
  id: string;
  npi?: string;
  name?: {
    given?: string[];
    family?: string;
    prefix?: string[];
    suffix?: string[];
  };
  identifier?: Array<{
    system: string;
    value: string;
  }>;
  active?: boolean;
}

export interface OrganizationInput {
  id: string;
  name: string;
  identifier?: Array<{
    system: string;
    value: string;
  }>;
  active?: boolean;
}

export interface CredentialInput {
  practitionerId: string;
  organizationId?: string;
  role: string;
  specialty?: string[];
  startDate?: {
    year: number;
    month?: number;
    day?: number;
  };
  endDate?: {
    year: number;
    month?: number;
    day?: number;
  };
  active?: boolean;
  license?: {
    number: string;
    state: string;
    type: string;
    issueDate?: FhirDate;
    expirationDate?: FhirDate;
  };
  boardCertification?: {
    board: string;
    specialty: string;
    certificationDate?: FhirDate;
    expirationDate?: FhirDate;
  };
}

/**
 * FHIR R6 PractitionerRole Service
 * B119A-FHIR6-008: R6 normative implementation
 */
export class FHIRR6PractitionerRoleService {
  private practitioners: Map<string, PractitionerInput> = new Map();
  private organizations: Map<string, OrganizationInput> = new Map();
  private roles: Map<string, FhirPractitionerRole[]> = new Map();

  /**
   * Register a practitioner
   */
  registerPractitioner(practitioner: PractitionerInput): void {
    this.practitioners.set(practitioner.id, practitioner);
  }

  /**
   * Register an organization
   */
  registerOrganization(organization: OrganizationInput): void {
    this.organizations.set(organization.id, organization);
  }

  /**
   * Map credential to FHIR R6 PractitionerRole
   * B119A-FHIR6-008: R6 normative mapping with partial dates
   */
  mapCredentialToPractitionerRole(credential: CredentialInput): FhirPractitionerRole {
    const role: FhirPractitionerRole = {
      id: `role-${credential.practitionerId}-${Date.now()}`,
      practitioner: {
        reference: `Practitioner/${credential.practitionerId}`,
      },
      code: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/practitioner-role',
          code: credential.role,
          display: credential.role,
        }],
      }],
      active: credential.active !== false,
    };

    // Add organization reference if provided
    if (credential.organizationId) {
      role.organization = {
        reference: `Organization/${credential.organizationId}`,
      };
    }

    // Add specialty codes
    if (credential.specialty && credential.specialty.length > 0) {
      role.specialty = credential.specialty.map(code => ({
        coding: [{
          system: 'http://snomed.info/sct',
          code,
          display: code,
        }],
      }));
    }

    // Add period with partial date support
    if (credential.startDate || credential.endDate) {
      role.period = {};
      if (credential.startDate) {
        role.period.start = mapToFhirDate(credential.startDate);
      }
      if (credential.endDate) {
        role.period.end = mapToFhirDate(credential.endDate);
      }
    }

    return role;
  }

  /**
   * Create PractitionerRole from credential
   */
  createPractitionerRole(credential: CredentialInput): FhirPractitionerRole {
    const role = this.mapCredentialToPractitionerRole(credential);

    // Store role
    const existingRoles = this.roles.get(credential.practitionerId) || [];
    existingRoles.push(role);
    this.roles.set(credential.practitionerId, existingRoles);

    return role;
  }

  /**
   * Get PractitionerRole by practitioner ID
   * B119A-FHIR6-008: Returns R6 normative PractitionerRole resources
   */
  getPractitionerRoles(practitionerId: string): FhirPractitionerRole[] {
    return this.roles.get(practitionerId) || [];
  }

  /**
   * Get PractitionerRole by ID
   */
  getPractitionerRoleById(roleId: string): FhirPractitionerRole | null {
    for (const roles of this.roles.values()) {
      const role = roles.find(r => r.id === roleId);
      if (role) {
        return role;
      }
    }
    return null;
  }

  /**
   * Map PractitionerRole back to credential format
   */
  mapPractitionerRoleToCredential(role: FhirPractitionerRole): CredentialInput | null {
    const practitionerRef = role.practitioner?.reference;
    if (!practitionerRef) {
      return null;
    }

    const practitionerId = practitionerRef.replace('Practitioner/', '');
    const organizationRef = role.organization?.reference;
    const organizationId = organizationRef?.replace('Organization/', '');

    const roleCode = role.code?.[0]?.coding?.[0]?.code || 'unknown';
    const specialties = role.specialty?.map(s => s.coding?.[0]?.code).filter(Boolean) as string[] | undefined;

    let startDate: { year: number; month?: number; day?: number } | undefined;
    let endDate: { year: number; month?: number; day?: number } | undefined;

    if (role.period?.start) {
      const mapped = mapPartialDate(role.period.start);
      startDate = {
        year: mapped.year,
        month: mapped.month,
        day: mapped.day,
      };
    }

    if (role.period?.end) {
      const mapped = mapPartialDate(role.period.end);
      endDate = {
        year: mapped.year,
        month: mapped.month,
        day: mapped.day,
      };
    }

    return {
      practitionerId,
      organizationId,
      role: roleCode,
      specialty: specialties,
      startDate,
      endDate,
      active: role.active,
    };
  }

  /**
   * Get Practitioner resource (R6 normative)
   */
  getPractitioner(practitionerId: string): {
    resourceType: 'Practitioner';
    id: string;
    identifier?: Array<{
      system: string;
      value: string;
    }>;
    name?: Array<{
      use?: string;
      family?: string;
      given?: string[];
      prefix?: string[];
      suffix?: string[];
    }>;
    active?: boolean;
  } | null {
    const practitioner = this.practitioners.get(practitionerId);
    if (!practitioner) {
      return null;
    }

    const fhirPractitioner: any = {
      resourceType: 'Practitioner',
      id: practitioner.id,
      active: practitioner.active !== false,
    };

    if (practitioner.identifier) {
      fhirPractitioner.identifier = practitioner.identifier;
    }

    if (practitioner.name) {
      fhirPractitioner.name = [{
        use: 'official',
        family: practitioner.name.family,
        given: practitioner.name.given,
        prefix: practitioner.name.prefix,
        suffix: practitioner.name.suffix,
      }];
    }

    if (practitioner.npi) {
      fhirPractitioner.identifier = [
        ...(fhirPractitioner.identifier || []),
        {
          system: 'http://hl7.org/fhir/sid/us-npi',
          value: practitioner.npi,
        },
      ];
    }

    return fhirPractitioner;
  }

  /**
   * Get Organization resource (R6 normative)
   */
  getOrganization(organizationId: string): {
    resourceType: 'Organization';
    id: string;
    name: string;
    identifier?: Array<{
      system: string;
      value: string;
    }>;
    active?: boolean;
  } | null {
    const organization = this.organizations.get(organizationId);
    if (!organization) {
      return null;
    }

    return {
      resourceType: 'Organization',
      id: organization.id,
      name: organization.name,
      identifier: organization.identifier,
      active: organization.active !== false,
    };
  }

  /**
   * Validate PractitionerRole against R6 conformance
   * B119A-FHIR6-008: Validates R6 normative structure
   * B121A-FHIR-006: FHIR R6 Practitioner/Role conformance - R6 fields present; HL7 validation passes
   */
  validatePractitionerRole(role: FhirPractitionerRole): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // B121A-FHIR-006: R6 normative: Practitioner reference is required
    if (!role.practitioner?.reference) {
      errors.push('PractitionerRole.practitioner.reference is required (R6 normative)');
    }

    // B121A-FHIR-006: Validate practitioner reference format
    if (role.practitioner?.reference && !role.practitioner.reference.startsWith('Practitioner/')) {
      errors.push('PractitionerRole.practitioner.reference must be in format "Practitioner/{id}" (R6 normative)');
    }

    // B121A-FHIR-006: R6 normative: Code is recommended
    if (!role.code || role.code.length === 0) {
      warnings.push('PractitionerRole.code is recommended (R6 normative)');
    }

    // B121A-FHIR-006: Validate period dates are valid FHIR R6 date format (supports partial dates)
    if (role.period) {
      if (role.period.start) {
        const datePattern = /^\d{4}(-\d{2}(-\d{2})?)?$/;
        if (!datePattern.test(role.period.start)) {
          errors.push(`Invalid FHIR R6 date format: ${role.period.start} (expected YYYY, YYYY-MM, or YYYY-MM-DD)`);
        }
      }
      if (role.period.end) {
        const datePattern = /^\d{4}(-\d{2}(-\d{2})?)?$/;
        if (!datePattern.test(role.period.end)) {
          errors.push(`Invalid FHIR R6 date format: ${role.period.end} (expected YYYY, YYYY-MM, or YYYY-MM-DD)`);
        }
      }
    }

    // B121A-FHIR-006: Validate coding structure (R6 normative)
    if (role.code) {
      for (const code of role.code) {
        if (!code.coding || code.coding.length === 0) {
          warnings.push('PractitionerRole.code.coding should have at least one entry');
        } else {
          // Validate each coding entry
          for (const coding of code.coding) {
            if (!coding.system && !coding.code) {
              warnings.push('PractitionerRole.code.coding should have system or code (R6 normative)');
            }
          }
        }
      }
    }

    // B121A-FHIR-006: Validate organization reference format if present
    if (role.organization?.reference && !role.organization.reference.startsWith('Organization/')) {
      errors.push('PractitionerRole.organization.reference must be in format "Organization/{id}" (R6 normative)');
    }

    // B121A-FHIR-006: Validate specialty codes if present (R6 normative)
    if (role.specialty && role.specialty.length > 0) {
      for (const specialty of role.specialty) {
        if (!specialty.coding || specialty.coding.length === 0) {
          warnings.push('PractitionerRole.specialty.coding should have at least one entry (R6 normative)');
        }
      }
    }

    // B121A-FHIR-006: Validate location references if present (R6 normative)
    if (role.location) {
      for (const location of role.location) {
        if (location.reference && !location.reference.startsWith('Location/')) {
          warnings.push('PractitionerRole.location.reference should be in format "Location/{id}" (R6 normative)');
        }
      }
    }

    // B121A-FHIR-006: Validate telecom if present (R6 normative)
    if (role.telecom && role.telecom.length > 0) {
      for (const telecom of role.telecom) {
        if (!telecom.system || !telecom.value) {
          warnings.push('PractitionerRole.telecom should have system and value (R6 normative)');
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

// Singleton instance
let fhirR6Service: FHIRR6PractitionerRoleService | null = null;

export function getFHIRR6Service(): FHIRR6PractitionerRoleService {
  if (!fhirR6Service) {
    fhirR6Service = new FHIRR6PractitionerRoleService();
  }
  return fhirR6Service;
}

