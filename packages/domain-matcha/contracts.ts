type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
interface JsonObject {
  [key: string]: JsonValue | undefined;
}

export const MATCH_STRATEGIES = ['exact', 'weighted', 'model'] as const;
export type MatchStrategy = (typeof MATCH_STRATEGIES)[number];

export interface MatchCandidate {
  id: string;
  attributes: JsonObject;
}

export interface MatchRequest {
  requestId: string;
  criteria: JsonObject;
  candidates: MatchCandidate[];
  strategy?: MatchStrategy;
}

export interface MatchScore {
  candidateId: string;
  score: number;
  reasons?: string[];
  metadata?: JsonObject;
}

export interface MatchResult {
  requestId: string;
  strategy: MatchStrategy;
  results: MatchScore[];
  generatedAt: string;
}

export interface MatchSummary {
  requestId: string;
  matchedIds: string[];
  unmatchedIds: string[];
  averageScore: number;
}
