/**
 * Matching engine collector
 * Collects matching engine models and configuration
 */

import * as fs from 'fs';
import * as path from 'path';

const MONOREPO_ROOT = path.resolve(__dirname, '../../../..');

export interface MatchingEngineState {
  models: string[];
  activeModels: number;
  matcherService?: boolean;
  aiMatcher?: boolean;
}

export async function collectMatchingEngines(): Promise<MatchingEngineState> {
  const models: string[] = [];

  // Check for matching service
  const matchingRoutesDir = path.join(MONOREPO_ROOT, 'apps/api/src/routes/matching');
  const matcherService = fs.existsSync(matchingRoutesDir);

  // Check for AI matcher service
  const aiMatcherServiceDir = path.join(MONOREPO_ROOT, 'ai-matcher-service');
  const aiMatcher = fs.existsSync(aiMatcherServiceDir);

  // Scan for matching-related services
  const servicesDir = path.join(MONOREPO_ROOT, 'apps/api/src/services');
  if (fs.existsSync(servicesDir)) {
    const scanForMatching = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isFile() && entry.name.includes('match')) {
          const modelName = entry.name.replace('.ts', '');
          models.push(modelName);
        } else if (entry.isDirectory()) {
          scanForMatching(fullPath);
        }
      }
    };
    scanForMatching(servicesDir);
  }

  return {
    models: [...new Set(models)],
    activeModels: models.length,
    matcherService,
    aiMatcher,
  };
}

