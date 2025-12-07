/**
 * B160A-RISK-009: Risk thresholds config (per-route: login, applyWithVC, payerEnroll)
 *
 * Config object mapping routeKey→{warn,block} thresholds.
 * riskGate uses; tests ensure correct mapping & defaults.
 */

export interface RiskThreshold {
  warn: number; // Score threshold for warning (log but allow)
  block: number; // Score threshold for blocking (HTTP 429/403)
}

export interface RiskThresholdConfig {
  [routeKey: string]: RiskThreshold;
}

/**
 * Default risk thresholds per route
 */
export const riskThresholds: RiskThresholdConfig = {
  // Login endpoint - moderate thresholds
  login: {
    warn: 40,
    block: 70,
  },

  // Apply with VC endpoint - high-value, stricter thresholds
  applyWithVC: {
    warn: 30,
    block: 60,
  },

  // Payer enrollment - high-value, strictest thresholds
  payerEnroll: {
    warn: 25,
    block: 50,
  },

  // Default thresholds for other routes
  default: {
    warn: 50,
    block: 80,
  },
};

/**
 * Get risk threshold for a route
 */
export function getRiskThreshold(routeKey: string): RiskThreshold {
  return riskThresholds[routeKey] || riskThresholds.default;
}

/**
 * Check if score exceeds threshold
 */
export function exceedsThreshold(
  score: number,
  threshold: RiskThreshold
): 'allow' | 'warn' | 'block' {
  if (score >= threshold.block) {
    return 'block';
  }
  if (score >= threshold.warn) {
    return 'warn';
  }
  return 'allow';
}

