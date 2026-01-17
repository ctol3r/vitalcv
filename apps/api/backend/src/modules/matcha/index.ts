import type { MatchRequest, MatchResult } from '@domain/matcha/contracts';

export interface MatchaService {
  match(request: MatchRequest): Promise<MatchResult>;
}

export type { MatchRequest, MatchResult };
