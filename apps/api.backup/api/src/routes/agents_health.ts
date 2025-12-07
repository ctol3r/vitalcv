/**
 * Multi-Agent Health Check - Batch 54
 * Orchestrator + per-role agents + auto-tagger status
 */

import { Router } from 'express';

export const agentsHealth = Router();

agentsHealth.get('/api/agents/health', (_req, res) => {
  // Check each agent subsystem (stub health - wire to actual agents)
  const producer = (global as any).__kafka_producer_ok || false;
  const consumer = (global as any).__kafka_consumer_ok || false;

  const health = {
    orchestrator: true,  // Main event bus coordinator
    clinician: true,     // Holder/clinician UX agent
    verifier: true,      // PSV/NCQA/JC evidence agent
    issuer: true,        // OIDC4VCI credential issuer agent
    tagger: true,        // Auto-classification agent
    kafka_producer: producer,
    kafka_consumer: consumer,
    timestamp: new Date().toISOString(),
  };

  const allHealthy = Object.values(health).every((v) => v === true || typeof v === 'string');

  res.json({
    ok: allHealthy,
    agents: health,
    architecture: 'orchestrator+agents',
  });
});

