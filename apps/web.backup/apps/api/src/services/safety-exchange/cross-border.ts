import type { HarmonizedSanction } from './harmonization';

export interface CrossBorderMapping {
  usSanction: HarmonizedSanction;
  internationalEquivalents: Array<{
    country: string;
    equivalentType: string;
    authority: string;
    mappedAt: string;
  }>;
}

/**
 * Map international disciplinary actions to US equivalents
 */
export function mapCrossBorderSanctions(
  sanctions: HarmonizedSanction[],
  country?: string,
): CrossBorderMapping[] {
  const mappings: CrossBorderMapping[] = [];

  // Country-specific mapping rules
  const countryMappings: Record<string, Record<string, string>> = {
    uk: {
      'gmc_fitness_to_practise': 'license_suspended',
      'gmc_erasure': 'license_revoked',
      'gmc_conditions': 'practice_restriction',
    },
    canada: {
      'cpsc_discipline': 'disciplinary_action',
      'cpsc_suspension': 'license_suspended',
      'cpsc_revocation': 'license_revoked',
    },
    australia: {
      'ahpra_conditions': 'practice_restriction',
      'ahpra_suspension': 'license_suspended',
      'ahpra_cancellation': 'license_revoked',
    },
  };

  for (const sanction of sanctions) {
    if (sanction.source !== 'state_board') continue; // Only map non-US sanctions

    const equivalents: CrossBorderMapping['internationalEquivalents'] = [];

    // Map to US equivalents based on country
    if (country && countryMappings[country.toLowerCase()]) {
      const mapping = countryMappings[country.toLowerCase()];
      const usEquivalent = mapping[sanction.harmonizedType];

      if (usEquivalent) {
        equivalents.push({
          country: 'US',
          equivalentType: usEquivalent,
          authority: 'State Medical Board',
          mappedAt: new Date().toISOString(),
        });
      }
    }

    // Generic international mappings
    if (equivalents.length === 0) {
      equivalents.push({
        country: 'US',
        equivalentType: mapGenericType(sanction.harmonizedType),
        authority: 'State Medical Board',
        mappedAt: new Date().toISOString(),
      });
    }

    mappings.push({
      usSanction: sanction,
      internationalEquivalents: equivalents,
    });
  }

  return mappings;
}

function mapGenericType(type: string): string {
  // Generic mapping for common international sanction types
  const genericMap: Record<string, string> = {
    'suspension': 'license_suspended',
    'revocation': 'license_revoked',
    'cancellation': 'license_revoked',
    'conditions': 'practice_restriction',
    'restrictions': 'practice_restriction',
    'fine': 'monetary_penalty',
  };

  return genericMap[type.toLowerCase()] ?? 'disciplinary_action';
}

