import { Router } from 'express';
import { bumpReliability, decayReliability, getReliabilityStats } from '../agent/reliability';
import { learnFromRecent } from '../jobs/learn_from_traces';
import { dedupe } from '../jobs/dedupe_mcp';

export const adminAgentRouter = Router();

/**
 * POST /api/agent/admin/reliability/bump
 * Manually bump reliability for specific MCPs
 */
adminAgentRouter.post('/reliability/bump', async (req, res) => {
  try {
    const { names = [], delta = 1 } = req.body;

    if (!Array.isArray(names)) {
      return res.status(400).json({ error: 'names must be an array' });
    }

    await bumpReliability(names, delta);

    res.json({ ok: true, updated: names.length });
  } catch (error: any) {
    console.error('Error bumping reliability:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/agent/admin/reliability/decay
 * Run reliability decay on all MCPs
 */
adminAgentRouter.post('/reliability/decay', async (_req, res) => {
  try {
    await decayReliability();
    res.json({ ok: true, message: 'Reliability decay applied to all MCPs' });
  } catch (error: any) {
    console.error('Error in decay:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/agent/admin/reliability/stats
 * Get reliability statistics
 */
adminAgentRouter.get('/reliability/stats', async (_req, res) => {
  try {
    const stats = await getReliabilityStats();
    res.json(stats);
  } catch (error: any) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/agent/admin/learn
 * Trigger learning from recent successful traces
 */
adminAgentRouter.post('/learn', async (req, res) => {
  try {
    const { hours = 12 } = req.body;
    const stats = await learnFromRecent(hours);

    res.json({
      ok: true,
      ...stats,
    });
  } catch (error: any) {
    console.error('Error in learn:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/agent/admin/dedupe
 * Trigger deduplication of similar MCPs
 */
adminAgentRouter.post('/dedupe', async (req, res) => {
  try {
    const { threshold = 0.97 } = req.body;
    const stats = await dedupe(threshold);

    res.json({
      ok: true,
      ...stats,
    });
  } catch (error: any) {
    console.error('Error in dedupe:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/agent/admin/approvals
 * Get all pending/recent approvals
 */
adminAgentRouter.get('/approvals', async (_req, res) => {
  try {
    const { pool } = await import('../db');
    const { rows } = await pool.query(
      'SELECT * FROM "AgentApproval" ORDER BY created_at DESC LIMIT 100'
    );
    res.json({ rows });
  } catch (error: any) {
    console.error('Error fetching approvals:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/agent/admin/approve
 * Approve a pending high-risk MCP execution
 */
adminAgentRouter.post('/approve', async (req, res) => {
  try {
    const { traceId, mcp, decider, notes } = req.body || {};
    const { pool } = await import('../db');
    const { audit } = await import('../agent/audit');

    await pool.query(
      'UPDATE "AgentApproval" SET status=$1, decided_by=$2, decided_at=now(), notes=$3 WHERE trace_id=$4 AND mcp_name=$5 AND status=$6',
      ['approved', decider || 'admin', notes || null, traceId, mcp, 'pending']
    );

    await audit(decider, 'approval.approved', { mcp, notes }, { traceId });

    // webhook/email stub - log to console for now
    console.log(JSON.stringify({
      type: 'agent.approval',
      status: 'approved',
      traceId,
      mcp
    }));

    res.json({ ok: true });
  } catch (error: any) {
    console.error('Error approving:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/agent/admin/deny
 * Deny a pending high-risk MCP execution
 */
adminAgentRouter.post('/deny', async (req, res) => {
  try {
    const { traceId, mcp, decider, notes } = req.body || {};
    const { pool } = await import('../db');
    const { audit } = await import('../agent/audit');

    await pool.query(
      'UPDATE "AgentApproval" SET status=$1, decided_by=$2, decided_at=now(), notes=$3 WHERE trace_id=$4 AND mcp_name=$5 AND status=$6',
      ['denied', decider || 'admin', notes || null, traceId, mcp, 'pending']
    );

    await audit(decider, 'approval.denied', { mcp, notes }, { traceId });

    console.log(JSON.stringify({
      type: 'agent.approval',
      status: 'denied',
      traceId,
      mcp
    }));

    res.json({ ok: true });
  } catch (error: any) {
    console.error('Error denying:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/agent/admin/promote
 * Promote an MCP to native tool status
 */
adminAgentRouter.post('/promote', async (req, res) => {
  try {
    const { name } = req.body || {};
    const { promoteMcp } = await import('../agent/promote');
    await promoteMcp(String(name));
    res.json({ ok: true });
  } catch (error: any) {
    console.error('Error promoting MCP:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/agent/admin/promote/codegen
 * Generate native tool code from MCP
 */
adminAgentRouter.post('/promote/codegen', async (req, res) => {
  try {
    const { name } = req.body || {};
    const { codegenNativeTool } = await import('../agent/promote_codegen');
    const js = await codegenNativeTool(String(name));
    res.json({ ok: true, file: `${name}.gen.ts`, code: js });
  } catch (error: any) {
    console.error('Error generating code:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/agent/admin/promote/pipeline
 * Full promote pipeline: codegen → compile → hot-load
 */
adminAgentRouter.post('/promote/pipeline', async (req, res) => {
  try {
    const { name } = req.body || {};
    const { codegenNativeTool, compileNativeTool } = await import('../agent/promote_codegen');
    const { loadNative } = await import('../tools/registry');

    const { fnName, file } = await codegenNativeTool(String(name));
    await compileNativeTool(file);
    const ok = await loadNative(fnName);

    res.json({ ok, fnName, file });
  } catch (error: any) {
    console.error('Error in promote pipeline:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/agent/admin/promote/pin
 * Pin an MCP as stable after promotion
 */
adminAgentRouter.post('/promote/pin', async (req, res) => {
  try {
    const { name } = req.body || {};
    const { pinStable } = await import('../agent/versioning');
    await pinStable(String(name), 'stable');
    res.json({ ok: true });
  } catch (error: any) {
    console.error('Error pinning stable:', error);
    res.status(500).json({ error: error.message });
  }
});

