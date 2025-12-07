export interface RiskTag {
  category: 'bias' | 'privacy' | 'info_integrity' | 'safety' | 'compliance';
  severity: 'low' | 'medium' | 'high';
  description: string;
}

/**
 * Apply NIST GenAI risk tags
 */
export function applyRiskTags(
  action: string,
  inputs: Record<string, unknown>,
  outputs: Record<string, unknown>,
): RiskTag[] {
  const tags: RiskTag[] = [];

  // Check for bias
  if (action.includes('matching') || action.includes('recommendation')) {
    tags.push({
      category: 'bias',
      severity: 'medium',
      description: 'Matching/recommendation actions may introduce bias',
    });
  }

  // Check for privacy
  if (inputs && Object.keys(inputs).some(k => k.toLowerCase().includes('phi') || k.toLowerCase().includes('pii'))) {
    tags.push({
      category: 'privacy',
      severity: 'high',
      description: 'Action involves PHI/PII data',
    });
  }

  // Check for info integrity
  if (action.includes('verification') || action.includes('validation')) {
    tags.push({
      category: 'info_integrity',
      severity: 'high',
      description: 'Verification actions impact information integrity',
    });
  }

  return tags;
}

