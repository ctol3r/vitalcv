import type { SanctionEvent } from './ingestion-v2';

export interface HarmonizedSanction extends SanctionEvent {
  harmonizedType: string;
  harmonizedSeverity: 'low' | 'medium' | 'high' | 'critical';
  stateCode?: string;
  crossStateEquivalent?: string[];
}

/**
 * Normalize state-to-state terminology for sanctions
 */
export function harmonizeSanctions(events: SanctionEvent[]): HarmonizedSanction[] {
  return events.map((event) => {
    const harmonized = {
      ...event,
      harmonizedType: harmonizeType(event.type, event.source),
      harmonizedSeverity: event.severity,
      stateCode: extractStateCode(event),
      crossStateEquivalent: findCrossStateEquivalents(event.type),
    };

    return harmonized;
  });
}

function harmonizeType(type: string, source: string): string {
  // Normalize common sanction types across states
  const typeMap: Record<string, string> = {
    'license_revocation': 'license_revoked',
    'license_suspension': 'license_suspended',
    'probation': 'license_probation',
    'fine': 'monetary_penalty',
    'cease_and_desist': 'practice_restriction',
    'reprimand': 'disciplinary_action',
  };

  const normalized = type.toLowerCase().replace(/\s+/g, '_');
  return typeMap[normalized] ?? normalized;
}

function extractStateCode(event: SanctionEvent): string | undefined {
  // Extract state code from metadata or description
  if (event.metadata?.stateCode) {
    return event.metadata.stateCode as string;
  }

  const statePattern = /\b([A-Z]{2})\b/;
  const match = event.description.match(statePattern);
  return match ? match[1] : undefined;
}

function findCrossStateEquivalents(type: string): string[] {
  // Map sanction types to equivalent types in other states
  const equivalents: Record<string, string[]> = {
    'license_revoked': ['license_suspended', 'license_terminated'],
    'license_suspended': ['license_revoked', 'license_probation'],
    'monetary_penalty': ['fine', 'civil_penalty'],
    'practice_restriction': ['cease_and_desist', 'practice_limitation'],
  };

  return equivalents[type] ?? [];
}

