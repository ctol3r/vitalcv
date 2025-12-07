/**
 * Multi-jurisdiction risk harmonizer
 * Normalizes severity levels across jurisdictions
 */

export interface HarmonizedRisk {
  originalRisk: any;
  normalizedSeverity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  jurisdiction: string;
  confidence: number;
  mapping: {
    original: string;
    normalized: string;
  };
}

const SEVERITY_MAP: Record<string, Record<string, string>> = {
  US: {
    'low': 'LOW',
    'moderate': 'MEDIUM',
    'high': 'HIGH',
    'critical': 'CRITICAL',
  },
  UK: {
    'minor': 'LOW',
    'moderate': 'MEDIUM',
    'serious': 'HIGH',
    'severe': 'CRITICAL',
  },
  EU: {
    '1': 'LOW',
    '2': 'MEDIUM',
    '3': 'HIGH',
    '4': 'CRITICAL',
  },
};

export function riskHarmonizer(riskEvents: any[]): HarmonizedRisk[] {
  return riskEvents.map(risk => {
    const jurisdiction = risk.jurisdiction || risk.country || 'US';
    const severityMap = SEVERITY_MAP[jurisdiction] || SEVERITY_MAP.US;

    const originalSeverity = (risk.severity || risk.level || 'low').toLowerCase();
    const normalized = severityMap[originalSeverity] || 'MEDIUM';

    return {
      originalRisk: risk,
      normalizedSeverity: normalized as HarmonizedRisk['normalizedSeverity'],
      jurisdiction,
      confidence: 0.85,
      mapping: {
        original: originalSeverity,
        normalized,
      },
    };
  });
}








