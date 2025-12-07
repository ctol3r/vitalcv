import { Router } from "express";
import { z } from "zod";
import { librarianSelect } from "../agent/librarian";
import { executeMcp, validateMcpInputs } from "../agent/executeMcp";
import { logTrace } from "../agent/logger";
import { abstractTraceToMcp } from "../agent/abstraction";
import { upsertMcp, incrementMcpUsage, getMcpById } from "../agent/store";
import { getRecentTraces, getSuccessfulTraces } from "../agent/logger";
import { planAndExecute } from "../agent/planner";
import { bumpReliability } from "../agent/reliability";
import { cRuns, cOk, hSolve } from "./metrics";

const SolveSchema = z.object({
  task: z.string().min(1),
  input: z.any().default({}),
  scopeHints: z.array(z.string()).optional(),
  userId: z.string().optional(),
  domain: z.string().optional()
});

export const agentRouter = Router();

/**
 * POST /api/agent/solve
 * Solve a task using planner + multi-MCP execution with reliability tracking
 */
agentRouter.post("/solve", async (req, res) => {
  const solveStart = Date.now(); // Round 10: track solve duration

  try {
    // Round 10: increment total runs counter
    cRuns.inc();

    // Zod validation
    let parsed;
    try {
      parsed = SolveSchema.parse(req.body);
    } catch (e: any) {
      return res.status(400).json({
        error: 'invalid_input',
        details: e?.issues
      });
    }

    const { task, scopeHints = [], input = {}, userId, domain } = parsed;

    // Generate traceId
    const traceId = (req as any).rid || require('../middleware/obs').newTraceId();

    // Round 10: Support streaming mode (NDJSON)
    if (String(req.query.stream || '') === '1') {
      res.setHeader('content-type', 'application/x-ndjson');
      const write = (obj: any) => res.write(JSON.stringify(obj) + '\n');

      write({ event: 'begin', traceId });

      try {
        const { plan, output: out } = await planAndExecute(task, input, scopeHints);
        write({ event: 'plan', plan: plan.map((p: any) => p.name) });
        write({ event: 'result', success: true, output: out });

        await logTrace({
          task_type: task,
          user_id: userId,
          domain,
          input,
          steps: plan.map((p: any) => ({ mcp: p.name })),
          outcome: { success: true, notes: 'ok', traceId },
        });

        write({ event: 'end' });
        return res.end();
      } catch (e: any) {
        write({ event: 'error', message: String(e?.message || e) });

        await logTrace({
          task_type: task,
          user_id: userId,
          domain,
          input,
          steps: [],
          outcome: { success: false, notes: 'failed', traceId },
        });

        write({ event: 'end' });
        return res.end();
      }
    }

    let success = false;
    let usedNames: string[] = [];
    let output: any = {};
    let steps: any[] = [];
    let picks: any[] = [];

    try {
      // Use planner to compose multiple MCPs
      const { plan, output: out, picks: planPicks } = await planAndExecute(task, input, scopeHints);

      usedNames = plan.map(p => p.name);
      output = out;
      picks = planPicks || plan;
      steps = plan.map(p => ({ mcp: p.name, manifest: p.manifest }));

      // Check if top pick requires approval
      const chosenManifest = picks?.[0]?.manifest || {};

      // Check if sensitive and requires auth
      const sensitive = Array.isArray(chosenManifest?.tags) && chosenManifest.tags.includes('sensitive');
      if (sensitive && !(req as any).user) {
        return res.status(401).json({ error: 'auth_required_for_sensitive' });
      }

      if (await require('../agent/approvals').requiresApproval({ manifest: chosenManifest })) {
        await require('../agent/approvals').createApproval(traceId, chosenManifest.name || 'unknown', userId);

        // Audit the approval request
        const { audit } = await import('../agent/audit');
        await audit(userId, 'approval.requested', {
          mcp: chosenManifest.name,
          gate: 'sensitive'
        }, {
          rid: (req as any).rid,
          traceId
        });

        return res.status(403).json({
          ok: false,
          needsApproval: true,
          traceId,
          gate: 'sensitive',
          mcp: chosenManifest.name
        });
      }

      success = true;

      // Round 10: increment success counter
      cOk.inc();

      // Round 22: billing increment
      try {
        (await import('../obs/billing')).billInc();
      } catch {
        // billing module not available, skip
      }
    } catch (e: any) {
      steps.push({ error: String(e?.message || e) });
      success = false;
    }

    // Round 10: observe solve duration
    hSolve.observe(Date.now() - solveStart);

    // Log the trace with traceId
    await logTrace({
      task_type: task,
      user_id: userId,
      domain,
      input,
      steps,
      outcome: {
        success,
        notes: success ? 'ok' : 'failed',
        traceId,
      },
    });

    // Bump reliability scores based on success
    if (success) {
      await bumpReliability(usedNames, +1);
    } else {
      await bumpReliability(usedNames, -1);
    }

    res.json({
      success,
      used: usedNames,
      picks,
      output,
      traceId,
      steps: steps.map(s => s.mcp || 'error').filter(Boolean),
    });
  } catch (error: any) {
    console.error("Error in /solve:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * POST /api/agent/learn/from-trace
 * Convert a successful trace to an MCP and store it
 */
agentRouter.post("/learn/from-trace", async (req, res) => {
  try {
    const { trace, scope = "global" } = req.body;

    if (!trace) {
      return res.status(400).json({ error: "trace is required" });
    }

    // Abstract the trace into an MCP
    const mcp = await abstractTraceToMcp(trace);

    // Override scope if provided
    if (scope) {
      mcp.scope = scope;
    }

    // Store the MCP
    const id = await upsertMcp(mcp);

    res.json({
      ok: true,
      id,
      mcp,
      message: "Successfully learned new MCP from trace",
    });
  } catch (error: any) {
    console.error("Error in /learn/from-trace:", error);
    res.status(500).json({ error: error.message || "Failed to learn from trace" });
  }
});

/**
 * GET /api/agent/mcp/search
 * Search MCPs (admin/debugging)
 */
agentRouter.get("/mcp/search", async (req, res) => {
  try {
    const q = String(req.query.q || "");
    const scopes = req.query.scopes
      ? String(req.query.scopes).split(",")
      : [];
    const limit = parseInt(String(req.query.limit || "5"));

    const hits = await librarianSelect(q, scopes, limit);

    res.json({
      query: q,
      scopes,
      results: hits.map((h) => ({
        id: h.id,
        name: h.name,
        description: h.description,
        scope: h.scope,
        tags: h.tags,
        score: h.score,
        reliability: h.reliability_score,
        usageCount: h.usage_count,
        manifest: h.manifest,
      })),
    });
  } catch (error: any) {
    console.error("Error in /mcp/search:", error);
    res.status(500).json({ error: error.message || "Search failed" });
  }
});

/**
 * GET /api/agent/mcp/:id
 * Get a specific MCP by ID
 */
agentRouter.get("/mcp/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const mcp = await getMcpById(id);

    if (!mcp) {
      return res.status(404).json({ error: "MCP not found" });
    }

    res.json(mcp);
  } catch (error: any) {
    console.error("Error in /mcp/:id:", error);
    res.status(500).json({ error: error.message || "Failed to fetch MCP" });
  }
});

/**
 * GET /api/agent/traces
 * Get recent traces
 */
agentRouter.get("/traces", async (req, res) => {
  try {
    const taskType = req.query.taskType as string | undefined;
    const limit = parseInt(String(req.query.limit || "100"));
    const onlySuccessful = req.query.successful === "true";

    const traces = onlySuccessful
      ? await getSuccessfulTraces(taskType, limit)
      : await getRecentTraces(taskType, limit);

    res.json({
      count: traces.length,
      traces,
    });
  } catch (error: any) {
    console.error("Error in /traces:", error);
    res.status(500).json({ error: error.message || "Failed to fetch traces" });
  }
});

/**
 * POST /api/agent/mcp/create
 * Manually create an MCP
 */
agentRouter.post("/mcp/create", async (req, res) => {
  try {
    const { manifest, code } = req.body;

    if (!manifest) {
      return res.status(400).json({ error: "manifest is required" });
    }

    const id = await upsertMcp(manifest, code);

    res.json({
      ok: true,
      id,
      message: "MCP created successfully",
    });
  } catch (error: any) {
    console.error("Error in /mcp/create:", error);
    res.status(500).json({ error: error.message || "Failed to create MCP" });
  }
});

