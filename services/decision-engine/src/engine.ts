import { generateDecisionRecommendations } from './rules';
import type { DecisionEngineInput } from './types';

export function createDecisionEngine() {
  return {
    generate(input: DecisionEngineInput) {
      return generateDecisionRecommendations(input);
    },
  };
}
