export interface CrossBorderRoute {
  fromCountry: string;
  toCountry: string;
  clinicianId: string;
  routeScore: number;
  estimatedDays: number;
  requirements: string[];
}

/**
 * Route US↔UK↔AU↔SG clinicians for shortages
 */
export function routeCrossBorderClinicians(
  fromCountry: string,
  toCountry: string,
  clinicianIds: string[],
): CrossBorderRoute[] {
  const routes: CrossBorderRoute[] = [];

  // Country-specific routing rules
  const routingRules: Record<string, Record<string, { days: number; requirements: string[] }>> = {
    US: {
      UK: { days: 14, requirements: ['GMC registration', 'Visa', 'Work permit'] },
      AU: { days: 21, requirements: ['AHPRA registration', 'Visa', 'Medical board approval'] },
      SG: { days: 30, requirements: ['SMC registration', 'Visa', 'MOH approval'] },
    },
    UK: {
      US: { days: 21, requirements: ['State license', 'Visa', 'ECFMG certification'] },
      AU: { days: 14, requirements: ['AHPRA registration', 'Visa'] },
    },
  };

  const rules = routingRules[fromCountry]?.[toCountry] ?? {
    days: 30,
    requirements: ['General registration', 'Visa'],
  };

  for (const clinicianId of clinicianIds) {
    routes.push({
      fromCountry,
      toCountry,
      clinicianId,
      routeScore: 0.7, // Mock score
      estimatedDays: rules.days,
      requirements: rules.requirements,
    });
  }

  return routes;
}

