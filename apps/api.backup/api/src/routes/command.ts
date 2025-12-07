// backend/src/routes/command.ts

import express, { Request, Response, Router } from "express";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { isValidNPI } from "../lib/npi.js";

// For now, import command registry from local until package is linked
// TODO: import from "@chai-vc/command-registry" once package is built
import { COMMANDS, findCommands, validateParams, getCommand } from "../../../packages/command-registry/src/index.js";

const router = Router();
const prisma = new PrismaClient();

// Extend Request type to include user
interface RequestWithUser extends Request {
  user?: {
    id: string;
    email: string;
    roles: string[];
  };
}

// Simple NL->Command parse stub (replace with internal LLM later)
router.post("/parse", async (req: Request, res: Response) => {
  const { text } = req.body as { text: string };

  if (!text) return res.status(400).json({ error: "missing text" });

  // naive heuristics for demo
  const t = text.toLowerCase();

  if (t.includes("npi") || /^\d{10}$/.test(t.trim())) {
    const npiMatch = t.match(/\b([12]\d{9})\b/);
    if (npiMatch) {
      return res.json({
        command: "/npi validate " + npiMatch[1],
        parsed: {
          id: "npi.validate",
          params: { npi: npiMatch[1] },
          confidence: 0.95
        }
      });
    }
  }

  if (t.includes("claim")) {
    return res.json({
      command: "/claim new",
      parsed: {
        id: "claim.new",
        params: {},
        confidence: 0.7
      }
    });
  }

  // fallback: return top match from registry
  const found = findCommands(text)[0];
  if (found) {
    return res.json({
      command: found.usage || found.id,
      parsed: {
        id: found.id,
        params: {},
        confidence: 0.5
      }
    });
  }

  return res.status(404).json({ error: "no suggestion" });
});

// Execute command endpoint (validates using registry)
router.post("/execute", async (req: RequestWithUser, res: Response) => {
  const { id, params } = req.body as { id: string; params?: any };

  const cmd = getCommand(id as any);
  if (!cmd) return res.status(400).json({ ok: false, error: "unknown command" });

  // Check role permissions (optional for now, until auth is fully wired)
  const userRoles = req.user?.roles || [];
  if (cmd.rolesAllowed && userRoles.length > 0 && !cmd.rolesAllowed.some(role => userRoles.includes(role))) {
    return res.status(403).json({ ok: false, error: "insufficient permissions" });
  }

  // validate params if schema present
  const validation = validateParams(id as any, params || {});
  if (!validation.valid) {
    return res.status(400).json({ ok: false, error: `invalid params: ${validation.error}` });
  }

  // demo handlers (wire to real services)
  try {
    if (id === "npi.validate") {
      const npi = validation.data?.npi;

      if (!isValidNPI(npi)) {
        return res.json({ ok: false, error: "invalid NPI format/checksum" });
      }

      // TODO: query real NPPES service
      const provider = {
        npi,
        name: "Dr Demo",
        type: "Individual",
        status: "Active"
      };

      return res.json({ ok: true, result: { provider } });
    }

    if (id === "claim.new") {
      // TODO: create claim in database
      return res.json({ ok: true, result: { claimId: "claim_demo_001" } });
    }

    if (id === "claim.resume") {
      const claimId = validation.data?.claimId;

      // TODO: fetch claim from database
      const claim = await prisma.npiClaim.findUnique({
        where: { id: claimId },
        include: { user: true }
      });

      if (!claim) {
        return res.json({ ok: false, error: "claim not found" });
      }

      return res.json({
        ok: true,
        result: {
          claimId: claim.id,
          npi: claim.npi,
          level: claim.level,
          nextStep: claim.level === 0 ? "sendOTP" : claim.level === 1 ? "uploadDocs" : "requestAttestation"
        }
      });
    }

    if (id === "ai.explain") {
      // call internal AI endpoint or mock
      return res.json({
        ok: true,
        result: {
          explanation: "This is a demo explanation. Wire to /api/ai/explain for richer output."
        }
      });
    }

    if (id === "agent.autotag") {
      const npi = validation.data?.npi;

      // TODO: trigger orchestrator agent
      return res.json({
        ok: true,
        result: {
          message: "Agent triggered",
          npi,
          status: "running"
        }
      });
    }

    // default
    return res.json({ ok: true, result: { message: "command executed (stub)" } });

  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// AI explain endpoint (wraps internal/external model safely, stubbed here)
router.post("/ai/explain", async (req: Request, res: Response) => {
  const { subjectType, subjectId } = req.body as { subjectType: string; subjectId: string };

  // In production: route to internal model, redact PHI, log model id & provenance
  // STUB:
  return res.json({
    ok: true,
    model: "local-stub-v0",
    explanation: `Explanation (demo): ${subjectType} ${subjectId} — run PSV, check license, then contact issuer for attestation.`
  });
});

export default router;

