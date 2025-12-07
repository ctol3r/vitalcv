/**
 * Multi-country specialty taxonomy parser
 * Normalizes US/UK/AU/SG/EU specialty languages
 */

const COUNTRY_TAXONOMY_MAPS: Record<string, Record<string, string>> = {
  US: {
    '207Q00000X': 'Family Medicine',
    '207R00000X': 'Internal Medicine',
    '207T00000X': 'Emergency Medicine',
    '208D00000X': 'General Practice',
  },
  UK: {
    'CCT-FM': 'Family Medicine',
    'CCT-IM': 'Internal Medicine',
    'CCT-EM': 'Emergency Medicine',
    'CCT-GP': 'General Practice',
  },
  AU: {
    'FRACGP': 'Family Medicine',
    'FRACP': 'Internal Medicine',
    'FACEM': 'Emergency Medicine',
    'RACGP': 'General Practice',
  },
  SG: {
    'FM': 'Family Medicine',
    'IM': 'Internal Medicine',
    'EM': 'Emergency Medicine',
    'GP': 'General Practice',
  },
  EU: {
    'FM-EU': 'Family Medicine',
    'IM-EU': 'Internal Medicine',
    'EM-EU': 'Emergency Medicine',
    'GP-EU': 'General Practice',
  },
};

const SPECIALTY_NORMALIZATION: Record<string, string> = {
  'Family Medicine': 'FAMILY_MEDICINE',
  'Internal Medicine': 'INTERNAL_MEDICINE',
  'Emergency Medicine': 'EMERGENCY_MEDICINE',
  'General Practice': 'GENERAL_PRACTICE',
};

export interface ParsedSpecialty {
  original: string;
  normalized: string;
  country: string;
  taxonomyCode: string;
  equivalentCodes: Record<string, string>;
}

export function specialtyTaxonomyParser(specialty: string, country: string): ParsedSpecialty {
  const countryMap = COUNTRY_TAXONOMY_MAPS[country.toUpperCase()] || {};
  const taxonomyCode = Object.entries(countryMap).find(([_, name]) =>
    name.toLowerCase().includes(specialty.toLowerCase()) ||
    specialty.toLowerCase().includes(name.toLowerCase())
  )?.[0] || specialty;

  const specialtyName = countryMap[taxonomyCode] || specialty;
  const normalized = SPECIALTY_NORMALIZATION[specialtyName] || specialty.toUpperCase().replace(/\s+/g, '_');

  // Find equivalent codes across countries
  const equivalentCodes: Record<string, string> = {};
  Object.entries(COUNTRY_TAXONOMY_MAPS).forEach(([c, map]) => {
    const equivalent = Object.entries(map).find(([_, name]) =>
      name === specialtyName ||
      SPECIALTY_NORMALIZATION[name] === normalized
    );
    if (equivalent) {
      equivalentCodes[c] = equivalent[0];
    }
  });

  return {
    original: specialty,
    normalized,
    country: country.toUpperCase(),
    taxonomyCode,
    equivalentCodes,
  };
}








