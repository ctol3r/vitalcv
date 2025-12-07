/**
 * B136A-FHIR-009: FHIR R6 Capability Statement Validation
 *
 * Validates FHIR R6 conformance when saving EHR configuration.
 * Returns warnings for older FHIR versions (R4, R5) and errors for non-conformant servers.
 */

import fetch from 'node-fetch';
import { EhrConfig } from './models/EhrConfig.js';

interface CapabilityStatement {
  resourceType: string;
  fhirVersion: string;
  rest?: Array<{
    mode: string;
    resource?: Array<{
      type: string;
      interaction?: Array<{ code: string }>;
      searchParam?: Array<{ name: string; type: string }>;
    }>;
  }>;
}

export interface ValidationResult {
  valid: boolean;
  fhirVersion?: string;
  warnings: string[];
  errors: string[];
  supportedResources?: string[];
}

/**
 * Validate FHIR R6 capability statement on EHR config save
 */
export async function validateFhirCapability(config: EhrConfig): Promise<ValidationResult> {
  const warnings: string[] = [];
  const errors: string[] = [];

  try {
    // Fetch capability statement from metadata endpoint
    const metadataUrl = `${config.fhirBaseUrl}/metadata`;
    const response = await fetch(metadataUrl, {
      headers: {
        Accept: 'application/fhir+json',
      },
    });

    if (!response.ok) {
      errors.push(`Failed to fetch capability statement: ${response.status} ${response.statusText}`);
      return { valid: false, warnings, errors };
    }

    const capability: CapabilityStatement = await response.json() as CapabilityStatement;

    // Validate resource type
    if (capability.resourceType !== 'CapabilityStatement') {
      errors.push(`Expected CapabilityStatement, got ${capability.resourceType}`);
      return { valid: false, warnings, errors };
    }

    // Check FHIR version
    const fhirVersion = capability.fhirVersion;
    if (!fhirVersion) {
      errors.push('FHIR version not specified in capability statement');
      return { valid: false, warnings, errors };
    }

    // Check if R6 (6.0.x)
    if (!fhirVersion.startsWith('6.0')) {
      if (fhirVersion.startsWith('5.0')) {
        warnings.push('FHIR R5 detected. R6 is recommended for full compatibility.');
      } else if (fhirVersion.startsWith('4.0')) {
        warnings.push('FHIR R4 detected. Upgrade to R6 is strongly recommended.');
      } else {
        errors.push(`Unsupported FHIR version: ${fhirVersion}. R6 (6.0.x) is required.`);
      }
    }

    // Check for required resources (Practitioner, PractitionerRole)
    const supportedResources = extractSupportedResources(capability);
    const requiredResources = ['Practitioner', 'PractitionerRole'];
    const missingResources = requiredResources.filter(r => !supportedResources.includes(r));

    if (missingResources.length > 0) {
      errors.push(`Missing required resources: ${missingResources.join(', ')}`);
    }

    // Check for read/search interactions on required resources
    const rest = capability.rest?.find(r => r.mode === 'server');
    if (rest?.resource) {
      for (const resource of rest.resource) {
        if (requiredResources.includes(resource.type)) {
          const interactions = resource.interaction?.map(i => i.code) || [];
          if (!interactions.includes('read') && !interactions.includes('search-type')) {
            warnings.push(`Resource ${resource.type} does not support read or search operations`);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      fhirVersion,
      warnings,
      errors,
      supportedResources,
    };
  } catch (error) {
    errors.push(`Failed to validate capability statement: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { valid: false, warnings, errors };
  }
}

/**
 * Extract supported resources from capability statement
 */
function extractSupportedResources(capability: CapabilityStatement): string[] {
  const resources: string[] = [];
  const rest = capability.rest?.find(r => r.mode === 'server');

  if (rest?.resource) {
    for (const resource of rest.resource) {
      resources.push(resource.type);
    }
  }

  return resources;
}

/**
 * Check if a specific resource type is supported
 */
export function isResourceSupported(capability: CapabilityStatement, resourceType: string): boolean {
  const supportedResources = extractSupportedResources(capability);
  return supportedResources.includes(resourceType);
}

