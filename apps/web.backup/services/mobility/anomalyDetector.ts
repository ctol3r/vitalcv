import { US_STATE_CODES } from '../compacts/models/CompactParticipation.js';
import type { CompactEligibilityV2Result } from './compactEligibilityV2.js';

export interface PassportAnomaly {
  code: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  affected: string[];
  recommendation?: string;
}

export interface DetectAnomalyInput {
  statesEligible: string[];
  compactResults: CompactEligibilityV2Result[];
  compactRecords?: Array<{ compact: string; eligible: boolean }>;
}

const STATE_SET = new Set(US_STATE_CODES);
const COMPACT_DB_ALIAS = new Map<string, string>([
  ['PTC', 'PT'],
  ['AOTA', 'APRN'],
]);

export function detectPassportAnomalies(input: DetectAnomalyInput): PassportAnomaly[] {
  const anomalies: PassportAnomaly[] = [];
  const normalizedStates = (input.statesEligible ?? []).map((state) => state.toUpperCase());
  const stateSet = new Set(normalizedStates);

  const invalidStates = normalizedStates.filter((state) => state && !STATE_SET.has(state));
  if (invalidStates.length > 0) {
    anomalies.push({
      code: 'invalid_state_code',
      description: 'States outside USPS codes detected in mobility passport.',
      severity: 'medium',
      affected: invalidStates,
      recommendation: 'Normalize passport state list to USPS postal abbreviations.',
    });
  }

  if (normalizedStates.length > stateSet.size) {
    const duplicates = findDuplicates(normalizedStates);
    if (duplicates.length > 0) {
      anomalies.push({
        code: 'duplicate_state_entries',
        description: 'Duplicate entries found in eligible state list.',
        severity: 'low',
        affected: duplicates,
        recommendation: 'Deduplicate statesEligible array before persisting snapshot.',
      });
    }
  }

  const dbMap = new Map(
    (input.compactRecords ?? []).map((record) => [record.compact, record.eligible]),
  );

  const compactSeen = new Map<string, number>();
  for (const result of input.compactResults ?? []) {
    compactSeen.set(result.compact, (compactSeen.get(result.compact) ?? 0) + 1);

    if (result.status === 'eligible' && result.authorizedStates.length === 0) {
      anomalies.push({
        code: 'missing_authorized_states',
        description: `${result.compact} marked eligible without authorized states.`,
        severity: 'medium',
        affected: [result.compact],
        recommendation: 'Ensure compact engine populates authorized states before publishing.',
      });
    }

    const orphanStates = result.authorizedStates.filter((state) => !stateSet.has(state));
    if (orphanStates.length > 0) {
      anomalies.push({
        code: 'orphan_compact_states',
        description: `${result.compact} lists states not present in aggregate eligibility.`,
        severity: 'low',
        affected: orphanStates,
        recommendation: 'Merge compact coverage back into passport state roster.',
      });
    }

    const dbKey = COMPACT_DB_ALIAS.get(result.compact) ?? result.compact;
    if (dbMap.has(dbKey)) {
      const previouslyEligible = dbMap.get(dbKey) === true;
      const nowEligible = result.status === 'eligible';
      if (previouslyEligible && !nowEligible) {
        anomalies.push({
          code: 'eligibility_regression',
          description: `${result.compact} regressed from eligible to ${result.status}.`,
          severity: 'high',
          affected: [result.compact],
          recommendation: 'Re-run compact validation or persist rationale for regression.',
        });
      }
    }
  }

  const duplicateCompacts = Array.from(compactSeen.entries())
    .filter(([, count]) => count > 1)
    .map(([compact]) => compact);
  if (duplicateCompacts.length > 0) {
    anomalies.push({
      code: 'duplicate_compact_entry',
      description: 'Mobility engine returned duplicate compact entries.',
      severity: 'medium',
      affected: duplicateCompacts,
      recommendation: 'Ensure compact list is de-duplicated during snapshot generation.',
    });
  }

  return anomalies;
}

function findDuplicates(values: string[]): string[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([value]) => value);
}









