/**
 * B139A-INTL-010: International CPT/ICD Code Mapping
 *
 * Maps US CPT codes to international equivalents:
 * - ICD-10-AM (Australian Modification)
 * - ICD-10-CA (Canadian Modification)
 * - Also supports ICD-10-CM (US Clinical Modification) for reference
 */

/**
 * Code system enum
 */
export enum CodeSystem {
  CPT = 'CPT',               // Current Procedural Terminology (US)
  ICD_10_CM = 'ICD-10-CM',   // US Clinical Modification
  ICD_10_AM = 'ICD-10-AM',   // Australian Modification
  ICD_10_CA = 'ICD-10-CA',   // Canadian Modification
  SNOMED_CT = 'SNOMED-CT',   // International standard
}

/**
 * Code mapping entry
 */
export interface CodeMapping {
  sourceCode: string;
  sourceSystem: CodeSystem;
  targetCode: string;
  targetSystem: CodeSystem;
  display: string;
  notes?: string;
  confidence: 'exact' | 'approximate' | 'narrow' | 'broad';
}

/**
 * Sample CPT → ICD-10-AM mappings
 */
export const CPT_TO_ICD10_AM: CodeMapping[] = [
  {
    sourceCode: '99213',
    sourceSystem: CodeSystem.CPT,
    targetCode: '0172',
    targetSystem: CodeSystem.ICD_10_AM,
    display: 'Office visit, established patient, level 3',
    confidence: 'approximate',
    notes: 'Australian codes use ACHI (Australian Classification of Health Interventions)',
  },
  {
    sourceCode: '80053',
    sourceSystem: CodeSystem.CPT,
    targetCode: '73561-00',
    targetSystem: CodeSystem.ICD_10_AM,
    display: 'Comprehensive metabolic panel',
    confidence: 'approximate',
  },
  {
    sourceCode: '93000',
    sourceSystem: CodeSystem.CPT,
    targetCode: '55111-00',
    targetSystem: CodeSystem.ICD_10_AM,
    display: 'Electrocardiogram (ECG) complete',
    confidence: 'exact',
  },
  {
    sourceCode: '99221',
    sourceSystem: CodeSystem.CPT,
    targetCode: '0176',
    targetSystem: CodeSystem.ICD_10_AM,
    display: 'Initial hospital care, per day',
    confidence: 'approximate',
  },
  {
    sourceCode: '36415',
    sourceSystem: CodeSystem.CPT,
    targetCode: '73813-00',
    targetSystem: CodeSystem.ICD_10_AM,
    display: 'Routine venipuncture',
    confidence: 'exact',
  },
];

/**
 * Sample CPT → ICD-10-CA mappings
 */
export const CPT_TO_ICD10_CA: CodeMapping[] = [
  {
    sourceCode: '99213',
    sourceSystem: CodeSystem.CPT,
    targetCode: '1.XX.35.^^',
    targetSystem: CodeSystem.ICD_10_CA,
    display: 'Office visit, established patient, level 3',
    confidence: 'approximate',
    notes: 'Canadian codes use CCI (Canadian Classification of Health Interventions)',
  },
  {
    sourceCode: '80053',
    sourceSystem: CodeSystem.CPT,
    targetCode: '3.KD.70.LA',
    targetSystem: CodeSystem.ICD_10_CA,
    display: 'Comprehensive metabolic panel',
    confidence: 'approximate',
  },
  {
    sourceCode: '93000',
    sourceSystem: CodeSystem.CPT,
    targetCode: '3.EN.10.^^',
    targetSystem: CodeSystem.ICD_10_CA,
    display: 'Electrocardiogram (ECG) complete',
    confidence: 'exact',
  },
  {
    sourceCode: '99221',
    sourceSystem: CodeSystem.CPT,
    targetCode: '1.XX.50.^^',
    targetSystem: CodeSystem.ICD_10_CA,
    display: 'Initial hospital care, per day',
    confidence: 'approximate',
  },
  {
    sourceCode: '36415',
    sourceSystem: CodeSystem.CPT,
    targetCode: '3.KD.10.^^',
    targetSystem: CodeSystem.ICD_10_CA,
    display: 'Routine venipuncture',
    confidence: 'exact',
  },
];

/**
 * Map CPT code to target system
 */
export function mapCptCode(
  cptCode: string,
  targetSystem: CodeSystem
): CodeMapping | null {
  let mappings: CodeMapping[] = [];

  switch (targetSystem) {
    case CodeSystem.ICD_10_AM:
      mappings = CPT_TO_ICD10_AM;
      break;
    case CodeSystem.ICD_10_CA:
      mappings = CPT_TO_ICD10_CA;
      break;
    default:
      return null;
  }

  return mappings.find(m => m.sourceCode === cptCode) || null;
}

/**
 * Batch map CPT codes
 */
export function batchMapCptCodes(
  cptCodes: string[],
  targetSystem: CodeSystem
): Map<string, CodeMapping | null> {
  const result = new Map<string, CodeMapping | null>();

  for (const code of cptCodes) {
    result.set(code, mapCptCode(code, targetSystem));
  }

  return result;
}

/**
 * Get all mappings for a target system
 */
export function getAllMappings(targetSystem: CodeSystem): CodeMapping[] {
  switch (targetSystem) {
    case CodeSystem.ICD_10_AM:
      return [...CPT_TO_ICD10_AM];
    case CodeSystem.ICD_10_CA:
      return [...CPT_TO_ICD10_CA];
    default:
      return [];
  }
}

/**
 * Reverse lookup: Find CPT code from target code
 */
export function reverseLookup(
  targetCode: string,
  targetSystem: CodeSystem
): CodeMapping | null {
  const mappings = getAllMappings(targetSystem);
  return mappings.find(m => m.targetCode === targetCode) || null;
}

/**
 * Check if mapping exists
 */
export function hasMappingFor(cptCode: string, targetSystem: CodeSystem): boolean {
  return mapCptCode(cptCode, targetSystem) !== null;
}

/**
 * Get mapping confidence level
 */
export function getMappingConfidence(
  cptCode: string,
  targetSystem: CodeSystem
): 'exact' | 'approximate' | 'narrow' | 'broad' | 'none' {
  const mapping = mapCptCode(cptCode, targetSystem);
  return mapping?.confidence || 'none';
}

/**
 * Filter mappings by confidence level
 */
export function filterByConfidence(
  mappings: CodeMapping[],
  minConfidence: 'exact' | 'approximate' | 'narrow' | 'broad'
): CodeMapping[] {
  const confidenceLevels = ['exact', 'approximate', 'narrow', 'broad'];
  const minIndex = confidenceLevels.indexOf(minConfidence);

  return mappings.filter(m => {
    const mappingIndex = confidenceLevels.indexOf(m.confidence);
    return mappingIndex <= minIndex;
  });
}

