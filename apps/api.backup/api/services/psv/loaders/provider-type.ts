const log = getServiceLogger('psv/loaders/provider-type');
/**
 * Provider-Type PSV Loader
 * B108B-PSV-026: Provider-type PSV loader: helpful remediation messages
 *
 * Handles provider-type-specific PSV loading with helpful error messages
 * for unknown types and mapping hints.
 */

import { getSource, Source } from '../registry';
import { createEvidenceBundle, storePSVCheck, PSVCheck } from '../evidence';
import { getServiceLogger } from '../../logging/serviceLogger';

/**
 * Supported provider types for PSV
 */
export const SUPPORTED_PROVIDER_TYPES = [
  'physician',
  'nurse',
  'physician_assistant',
  'nurse_practitioner',
  'pharmacist',
  'therapist',
  'dentist',
  'optometrist',
  'podiatrist',
  'chiropractor',
  'psychologist',
  'counselor',
  'social_worker',
  'organization',
] as const;

export type ProviderType = typeof SUPPORTED_PROVIDER_TYPES[number];

/**
 * Provider type mapping hints
 * Maps common variations to standard types
 */
export const PROVIDER_TYPE_MAPPING_HINTS: Record<string, ProviderType> = {
  // Physician variations
  'md': 'physician',
  'doctor': 'physician',
  'physician': 'physician',
  'medical doctor': 'physician',

  // Nurse variations
  'rn': 'nurse',
  'registered nurse': 'nurse',
  'nurse': 'nurse',
  'lpn': 'nurse',
  'licensed practical nurse': 'nurse',

  // Physician Assistant variations
  'pa': 'physician_assistant',
  'physician assistant': 'physician_assistant',
  'physician\'s assistant': 'physician_assistant',

  // Nurse Practitioner variations
  'np': 'nurse_practitioner',
  'nurse practitioner': 'nurse_practitioner',
  'aprn': 'nurse_practitioner',
  'advanced practice registered nurse': 'nurse_practitioner',

  // Pharmacist variations
  'pharmd': 'pharmacist',
  'pharmacist': 'pharmacist',
  'pharmacy': 'pharmacist',

  // Therapist variations
  'pt': 'therapist',
  'physical therapist': 'therapist',
  'ot': 'therapist',
  'occupational therapist': 'therapist',
  'speech therapist': 'therapist',

  // Dentist variations
  'dds': 'dentist',
  'dmd': 'dentist',
  'dentist': 'dentist',

  // Other provider types
  'od': 'optometrist',
  'optometrist': 'optometrist',
  'dpm': 'podiatrist',
  'podiatrist': 'podiatrist',
  'dc': 'chiropractor',
  'chiropractor': 'chiropractor',
  'phd': 'psychologist',
  'psychologist': 'psychologist',
  'counselor': 'counselor',
  'lsw': 'social_worker',
  'social worker': 'social_worker',
  'organization': 'organization',
  'org': 'organization',
  'facility': 'organization',
};

/**
 * Normalize provider type string
 */
export function normalizeProviderType(type: string): ProviderType | null {
  const normalized = type.toLowerCase().trim();

  // Check direct match
  if (SUPPORTED_PROVIDER_TYPES.includes(normalized as ProviderType)) {
    return normalized as ProviderType;
  }

  // Check mapping hints
  if (PROVIDER_TYPE_MAPPING_HINTS[normalized]) {
    return PROVIDER_TYPE_MAPPING_HINTS[normalized];
  }

  return null;
}

/**
 * Get remediation message for unknown provider type
 * B109B-PSV-026: Returns list of supported types and mapping guidance
 */
export function getUnknownTypeRemediationMessage(unknownType: string): string {
  const normalized = normalizeProviderType(unknownType);

  if (normalized) {
    return `Provider type "${unknownType}" maps to "${normalized}". Use the normalized type.`;
  }

  const supportedList = SUPPORTED_PROVIDER_TYPES.join(', ');
  const mappingHints = Object.entries(PROVIDER_TYPE_MAPPING_HINTS)
    .filter(([key]) => {
      const keyLower = key.toLowerCase();
      const typeLower = unknownType.toLowerCase();
      return keyLower.includes(typeLower.substring(0, 3)) ||
             typeLower.includes(keyLower.substring(0, 3)) ||
             keyLower.includes(typeLower) ||
             typeLower.includes(keyLower);
    })
    .map(([key, value]) => `"${key}" → "${value}"`)
    .slice(0, 5)
    .join(', ');

  let message = `Unknown provider type: "${unknownType}".\n\n`;
  message += `Supported types (${SUPPORTED_PROVIDER_TYPES.length} total): ${supportedList}.\n\n`;

  if (mappingHints) {
    message += `Similar mapping hints: ${mappingHints}.\n\n`;
  } else {
    message += `No similar mappings found. Consider adding "${unknownType.toLowerCase()}" to PROVIDER_TYPE_MAPPING_HINTS.\n\n`;
  }

  message += `To add support for this type:\n`;
  message += `1. Add "${unknownType.toLowerCase()}" to SUPPORTED_PROVIDER_TYPES array\n`;
  message += `2. Add mapping entry to PROVIDER_TYPE_MAPPING_HINTS object\n`;
  message += `3. Update file: services/psv/loaders/provider-type.ts`;

  return message;
}

/**
 * Load PSV checks for a provider type
 * B109B-PSV-026: Provider-type PSV loader: remediation hints on unknown type
 */
export async function loadPSVForProviderType(
  providerType: string,
  providerId: string,
  sourceId: string
): Promise<PSVCheck> {
  const normalizedType = normalizeProviderType(providerType);

  if (!normalizedType) {
    const remediationMessage = getUnknownTypeRemediationMessage(providerType);
    const supportedTypes = getSupportedProviderTypes();
    const mappingHints = getProviderTypeMappingHints();

    // Log structured remediation guidance
    log.error('[PSV Loader] Unknown provider type encountered', {
      unknownType: providerType,
      providerId,
      sourceId,
      supportedTypes,
      mappingHints: Object.entries(mappingHints)
        .filter(([key]) =>
          key.toLowerCase().includes(providerType.toLowerCase().substring(0, 3)) ||
          providerType.toLowerCase().includes(key.toLowerCase().substring(0, 3))
        )
        .slice(0, 5)
        .reduce((acc, [key, value]) => {
          acc[key] = value;
          return acc;
        }, {} as Record<string, string>),
      remediation: remediationMessage,
      timestamp: new Date().toISOString(),
    });

    // Log mapping guidance for operators
    log.warn('[PSV Loader] Mapping Guidance:', {
      message: `To map "${providerType}" to a supported type, consider:`,
      suggestions: Object.entries(mappingHints)
        .filter(([key]) =>
          key.toLowerCase().includes(providerType.toLowerCase().substring(0, 3)) ||
          providerType.toLowerCase().includes(key.toLowerCase().substring(0, 3))
        )
        .map(([key, value]) => `"${key}" → "${value}"`)
        .slice(0, 5),
      allSupportedTypes: supportedTypes,
      action: 'Update PROVIDER_TYPE_MAPPING_HINTS in services/psv/loaders/provider-type.ts',
    });

    throw new Error(`Unknown provider type: ${providerType}. ${remediationMessage}`);
  }

  const source = getSource(sourceId);
  if (!source) {
    throw new Error(`Source not found: ${sourceId}`);
  }

  // Create a mock request/response for evidence bundle
  // In production, this would make actual API calls
  const request = {
    providerType: normalizedType,
    providerId,
    sourceId,
  };

  const response = {
    verified: true,
    providerType: normalizedType,
    timestamp: Date.now(),
  };

  const evidenceBundle = createEvidenceBundle(
    source,
    request,
    response,
    'NCQA-2025',
    undefined,
    'verified'
  );

  const check: PSVCheck = {
    id: `psv-${providerId}-${sourceId}-${Date.now()}`,
    providerId,
    checkType: `provider-type-${normalizedType}`,
    sourceId,
    evidenceBundle,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  storePSVCheck(check);

  return check;
}

/**
 * Get supported provider types list (for API responses)
 */
export function getSupportedProviderTypes(): string[] {
  return [...SUPPORTED_PROVIDER_TYPES];
}

/**
 * Get provider type mapping hints (for API responses)
 */
export function getProviderTypeMappingHints(): Record<string, string> {
  return { ...PROVIDER_TYPE_MAPPING_HINTS };
}

