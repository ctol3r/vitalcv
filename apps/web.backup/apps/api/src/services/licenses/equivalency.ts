type EquivalencyLevel = 'automatic' | 'conditional' | 'manual';

export interface GlobalLicenseEquivalency {
  sourceCountry: string;
  authority?: string;
  targetCountry: string;
  level: EquivalencyLevel;
  rationale: string;
  requirements: string[];
  lastReviewed: string;
}

const BASELINE_EQUIVALENCY: GlobalLicenseEquivalency = {
  sourceCountry: 'GLOBAL',
  targetCountry: 'US',
  level: 'manual',
  rationale: 'No reciprocity rule on file.',
  requirements: [
    'Submit notarized translations',
    'Provide verification letter from issuing board',
    'Schedule manual credentialing review',
  ],
  lastReviewed: '2024-12-31',
};

const COUNTRY_EQUIVALENCY: Record<
  string,
  Omit<GlobalLicenseEquivalency, 'sourceCountry' | 'lastReviewed'>
> = {
  UK: {
    targetCountry: 'US',
    level: 'automatic',
    rationale: 'UK GMC/NMC licenses recognized via transatlantic pilot.',
    requirements: ['Upload GMC revalidation proof', 'Maintain annual CPD summary'],
  },
  AU: {
    targetCountry: 'US',
    level: 'conditional',
    rationale: 'AHPRA general registration maps to US compact in pilot mode.',
    requirements: ['Share AHPRA certificate', 'Provide AHPRA Good Standing letter (<90d)'],
  },
  SG: {
    targetCountry: 'US',
    level: 'conditional',
    rationale: 'Singapore SMC credentials align with US PGY2 equivalency.',
    requirements: ['Provide SMC standing letter', 'Attest to CME compliance'],
  },
  PH: {
    targetCountry: 'US',
    level: 'manual',
    rationale: 'PRC licenses require CGFNS + NCLEX validation.',
    requirements: [
      'Upload PRC digital certificate',
      'Provide CGFNS certificate',
      'Schedule NCLEX or provide pass letter',
    ],
  },
};

export interface ResolveEquivalencyInput {
  country: string;
  authority?: string;
  status?: string;
}

export function resolveGlobalLicenseEquivalency(
  input: ResolveEquivalencyInput,
): GlobalLicenseEquivalency {
  const country = normalizeCountry(input.country);
  const authority = input.authority?.toUpperCase();
  const base = COUNTRY_EQUIVALENCY[country];

  if (!base) {
    return {
      ...BASELINE_EQUIVALENCY,
      sourceCountry: country,
      authority,
    };
  }

  const adjustedLevel = adjustLevelForStatus(base.level, input.status);

  return {
    sourceCountry: country,
    authority,
    targetCountry: base.targetCountry,
    level: adjustedLevel,
    rationale: base.rationale,
    requirements: [...base.requirements],
    lastReviewed: '2025-01-15',
  };
}

function normalizeCountry(country: string): string {
  if (!country) return 'GLOBAL';
  return country.trim().toUpperCase();
}

function adjustLevelForStatus(level: EquivalencyLevel, status?: string): EquivalencyLevel {
  if (!status) return level;
  const normalized = status.trim().toLowerCase();
  if (normalized === 'suspended') {
    return 'manual';
  }
  if (normalized === 'expired' && level === 'automatic') {
    return 'conditional';
  }
  return level;
}









