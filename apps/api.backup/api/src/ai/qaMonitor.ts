/**
 * AI Governance Monitor (credential QA)
 * Runs bias/accuracy checks on credential-file classification
 * Per CHAI/Joint Commission guidance
 * Emits GovernanceEvent logs
 * Aligns to AHA + CHAI seven pillars framework
 */

import { pool } from '../db';

export interface GovernanceEvent {
  id?: string;
  model_id: string;
  model_version: string;
  accuracy?: number;
  bias_score?: number;
  owner: string;
  timestamp: Date;
  metrics: {
    accuracy?: number;
    bias?: number;
    fairness?: number;
    safety?: number;
  };
}

/**
 * Compute accuracy metrics vs baseline
 */
async function computeAccuracyMetrics(modelId: string, modelVersion: string): Promise<number> {
  // Query credential QA outputs for this model
  const result = await pool.query(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN predicted_label = ground_truth_label THEN 1 ELSE 0 END) as correct
     FROM "CredentialQA"
     WHERE model_id = $1 AND model_version = $2`,
    [modelId, modelVersion]
  );

  if (result.rows.length === 0 || result.rows[0].total === '0') {
    return 0;
  }

  const total = parseInt(result.rows[0].total, 10);
  const correct = parseInt(result.rows[0].correct, 10);
  return total > 0 ? correct / total : 0;
}

/**
 * Compute bias metrics per CHAI/Joint Commission framework
 */
async function computeBiasMetrics(modelId: string, modelVersion: string): Promise<number> {
  // Query for demographic parity across groups
  const result = await pool.query(
    `SELECT
       demographic_group,
       COUNT(*) as total,
       SUM(CASE WHEN predicted_label = ground_truth_label THEN 1 ELSE 0 END) as correct
     FROM "CredentialQA"
     WHERE model_id = $1 AND model_version = $2
     GROUP BY demographic_group`,
    [modelId, modelVersion]
  );

  if (result.rows.length < 2) {
    return 0; // Need at least 2 groups to measure bias
  }

  // Compute accuracy per group
  const accuracies = result.rows.map((row) => {
    const total = parseInt(row.total, 10);
    const correct = parseInt(row.correct, 10);
    return total > 0 ? correct / total : 0;
  });

  // Bias score = max difference between groups (0 = no bias, 1 = maximum bias)
  const minAcc = Math.min(...accuracies);
  const maxAcc = Math.max(...accuracies);
  return maxAcc - minAcc;
}

/**
 * Emit governance event
 */
async function emitGovernanceEvent(event: GovernanceEvent): Promise<void> {
  // Ensure GovernanceEvent table exists
  await pool.query(
    `CREATE TABLE IF NOT EXISTS "GovernanceEvent" (
      id SERIAL PRIMARY KEY,
      model_id VARCHAR(255) NOT NULL,
      model_version VARCHAR(255) NOT NULL,
      accuracy NUMERIC(5,4),
      bias_score NUMERIC(5,4),
      owner VARCHAR(255),
      ts TIMESTAMP DEFAULT NOW(),
      metrics JSONB
    )`
  );

  await pool.query(
    `INSERT INTO "GovernanceEvent" (model_id, model_version, accuracy, bias_score, owner, metrics)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      event.model_id,
      event.model_version,
      event.accuracy || null,
      event.bias_score || null,
      event.owner,
      JSON.stringify(event.metrics || {}),
    ]
  );
}

/**
 * Run AI QA monitoring scan
 * Scans credential QA outputs and computes metrics
 */
export async function runAIGovernanceScan(): Promise<void> {
  try {
    // Get all unique model/version combinations from CredentialQA
    const models = await pool.query(
      `SELECT DISTINCT model_id, model_version, owner
       FROM "CredentialQA"
       WHERE ts > NOW() - INTERVAL '24 hours'`
    );

    for (const model of models.rows) {
      const accuracy = await computeAccuracyMetrics(model.model_id, model.model_version);
      const bias = await computeBiasMetrics(model.model_id, model.model_version);

      const event: GovernanceEvent = {
        model_id: model.model_id,
        model_version: model.model_version,
        accuracy,
        bias_score: bias,
        owner: model.owner || 'unknown',
        timestamp: new Date(),
        metrics: {
          accuracy,
          bias,
          fairness: 1 - bias, // Inverse of bias
          safety: accuracy * (1 - bias), // Combined safety score
        },
      };

      await emitGovernanceEvent(event);
      console.log(`[AI Governance] Emitted event for ${model.model_id}@${model.model_version}: acc=${accuracy.toFixed(2)}, bias=${bias.toFixed(2)}`);
    }
  } catch (error) {
    console.error('[AI Governance] Scan error:', error);
  }
}

/**
 * Start AI governance monitoring
 * Runs every hour using setInterval
 */
export function startAIGovernanceMonitor(): void {
  // Run immediately on startup
  runAIGovernanceScan();

  // Schedule hourly scans (3600000 ms = 1 hour)
  const intervalMs = 3600000;
  setInterval(() => {
    runAIGovernanceScan();
  }, intervalMs);

  console.log('[AI Governance] Monitor started (hourly scans)');
}

