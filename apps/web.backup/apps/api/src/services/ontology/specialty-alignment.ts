/**
 * Specialty alignment engine
 * Resolves ambiguous specialty equivalencies
 */

export interface SpecialtyAlignment {
  specialtyA: string;
  specialtyB: string;
  countryA: string;
  countryB: string;
  equivalent: boolean;
  confidence: number;
  mapping: {
    normalized: string;
    differences: string[];
  };
}

const SPECIALTY_EQUIVALENCY_MAP: Record<string, string[]> = {
  'FAMILY_MEDICINE': ['FAMILY_MEDICINE', 'GENERAL_PRACTICE', 'PRIMARY_CARE'],
  'INTERNAL_MEDICINE': ['INTERNAL_MEDICINE', 'GENERAL_MEDICINE'],
  'EMERGENCY_MEDICINE': ['EMERGENCY_MEDICINE', 'ACCIDENT_EMERGENCY'],
  'GENERAL_PRACTICE': ['GENERAL_PRACTICE', 'FAMILY_MEDICINE', 'PRIMARY_CARE'],
};

export function specialtyAlignmentEngine(
  specialtyA: string,
  specialtyB: string,
  countryA: string,
  countryB: string
): SpecialtyAlignment {
  // Normalize specialties
  const normalizedA = specialtyA.toUpperCase().replace(/\s+/g, '_');
  const normalizedB = specialtyB.toUpperCase().replace(/\s+/g, '_');

  // Check direct match
  if (normalizedA === normalizedB) {
    return {
      specialtyA,
      specialtyB,
      countryA,
      countryB,
      equivalent: true,
      confidence: 1.0,
      mapping: {
        normalized: normalizedA,
        differences: [],
      },
    };
  }

  // Check equivalency map
  const equivA = SPECIALTY_EQUIVALENCY_MAP[normalizedA] || [normalizedA];
  const equivB = SPECIALTY_EQUIVALENCY_MAP[normalizedB] || [normalizedB];

  const hasOverlap = equivA.some(a => equivB.includes(a));
  const differences: string[] = [];

  if (!hasOverlap) {
    differences.push(`Different specialty categories: ${normalizedA} vs ${normalizedB}`);
  }

  if (countryA !== countryB) {
    differences.push(`Different jurisdictions: ${countryA} vs ${countryB}`);
  }

  // Calculate confidence
  let confidence = hasOverlap ? 0.8 : 0.3;
  if (countryA === countryB) {
    confidence += 0.1;
  }

  return {
    specialtyA,
    specialtyB,
    countryA,
    countryB,
    equivalent: hasOverlap,
    confidence: Math.min(1.0, confidence),
    mapping: {
      normalized: hasOverlap ? equivA.find(a => equivB.includes(a)) || normalizedA : normalizedA,
      differences,
    },
  };
}








