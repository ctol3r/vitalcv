import type { IdentitySource } from './ingestion-v3';

export interface MatchCandidate {
  sourceId: string;
  sourceType: string;
  fields: Record<string, unknown>;
  confidence: number;
}

export interface MatchScore {
  candidate: MatchCandidate;
  score: number;
  rationale: string;
  overlappingFields: string[];
}

/**
 * Bayesian match scoring for overlapping identity sources
 */
export function scoreIdentityMatch(
  candidate: MatchCandidate,
  reference: MatchCandidate,
): MatchScore {
  const overlappingFields = findOverlappingFields(candidate.fields, reference.fields);
  const fieldScores = computeFieldScores(candidate.fields, reference.fields, overlappingFields);

  // Bayesian prior: base confidence on source type reliability
  const prior = computePrior(candidate, reference);

  // Likelihood: how well do the fields match?
  const likelihood = computeLikelihood(fieldScores, overlappingFields);

  // Posterior: P(match | data) = P(data | match) * P(match) / P(data)
  // Simplified: posterior = likelihood * prior
  const posterior = likelihood * prior;

  // Normalize to 0-1 range
  const normalizedScore = Math.min(Math.max(posterior, 0), 1);

  const rationale = buildRationale(
    normalizedScore,
    overlappingFields,
    fieldScores,
    candidate.sourceType,
    reference.sourceType,
  );

  return {
    candidate,
    score: normalizedScore,
    rationale,
    overlappingFields,
  };
}

function findOverlappingFields(
  fields1: Record<string, unknown>,
  fields2: Record<string, unknown>,
): string[] {
  const keys1 = new Set(Object.keys(fields1));
  const keys2 = new Set(Object.keys(fields2));
  const overlapping: string[] = [];

  for (const key of keys1) {
    if (keys2.has(key) && fields1[key] !== null && fields2[key] !== null) {
      overlapping.push(key);
    }
  }

  return overlapping;
}

function computeFieldScores(
  fields1: Record<string, unknown>,
  fields2: Record<string, unknown>,
  overlappingFields: string[],
): Record<string, number> {
  const scores: Record<string, number> = {};

  for (const field of overlappingFields) {
    const value1 = fields1[field];
    const value2 = fields2[field];

    if (value1 === value2) {
      scores[field] = 1.0;
    } else if (typeof value1 === 'string' && typeof value2 === 'string') {
      scores[field] = computeStringSimilarity(value1, value2);
    } else if (typeof value1 === 'number' && typeof value2 === 'number') {
      // For numeric fields, use relative difference
      const diff = Math.abs(value1 - value2);
      const avg = (Math.abs(value1) + Math.abs(value2)) / 2;
      scores[field] = avg > 0 ? Math.max(0, 1 - diff / avg) : 0;
    } else {
      scores[field] = 0;
    }
  }

  return scores;
}

function computeStringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1.0;

  // Exact substring match
  if (s1.includes(s2) || s2.includes(s1)) {
    return 0.85;
  }

  // Levenshtein distance (simplified)
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;

  const distance = levenshteinDistance(s1, s2);
  return 1 - distance / maxLen;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

function computePrior(candidate: MatchCandidate, reference: MatchCandidate): number {
  // Source type reliability weights
  const sourceWeights: Record<string, number> = {
    NPPES: 0.95,
    STATE_BOARD: 0.9,
    NPDB: 0.98,
    GLOBAL_REGULATOR: 0.88,
  };

  const candidateWeight = sourceWeights[candidate.sourceType] ?? 0.7;
  const referenceWeight = sourceWeights[reference.sourceType] ?? 0.7;

  // Average of source confidences and type weights
  const avgConfidence = (candidate.confidence + reference.confidence) / 2;
  const avgTypeWeight = (candidateWeight + referenceWeight) / 2;

  return (avgConfidence * 0.6 + avgTypeWeight * 0.4);
}

function computeLikelihood(
  fieldScores: Record<string, number>,
  overlappingFields: string[],
): number {
  if (!overlappingFields.length) {
    return 0.1; // Low likelihood if no overlapping fields
  }

  // Weighted average of field scores
  // Critical fields (name, npi, license) get higher weight
  const criticalFields = ['name', 'npi', 'licenseNumber', 'state'];
  let totalScore = 0;
  let totalWeight = 0;

  for (const field of overlappingFields) {
    const score = fieldScores[field] ?? 0;
    const weight = criticalFields.includes(field) ? 2.0 : 1.0;
    totalScore += score * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? totalScore / totalWeight : 0;
}

function buildRationale(
  score: number,
  overlappingFields: string[],
  fieldScores: Record<string, number>,
  sourceType1: string,
  sourceType2: string,
): string {
  const parts: string[] = [];

  if (score >= 0.9) {
    parts.push('High confidence match');
  } else if (score >= 0.7) {
    parts.push('Moderate confidence match');
  } else if (score >= 0.5) {
    parts.push('Low confidence match');
  } else {
    parts.push('Weak match');
  }

  parts.push(`(${overlappingFields.length} overlapping fields)`);

  const perfectMatches = Object.values(fieldScores).filter((s) => s === 1.0).length;
  if (perfectMatches > 0) {
    parts.push(`${perfectMatches} exact matches`);
  }

  parts.push(`sources: ${sourceType1} vs ${sourceType2}`);

  return parts.join(' · ');
}

/**
 * Score multiple candidates against a reference
 */
export function scoreMultipleMatches(
  candidates: MatchCandidate[],
  reference: MatchCandidate,
): MatchScore[] {
  return candidates.map((candidate) => scoreIdentityMatch(candidate, reference)).sort((a, b) => b.score - a.score);
}

