import express from "express";
import fetch from "node-fetch"; // or global fetch
import { z } from "zod";
import { COMMANDS } from "packages/command-registry";
import { isValidNPI } from "./npiUtil";
import { auditLog } from "./audit";

const router = express.Router();

// Basic safe fetch wrapper (for internal service calls)
async function proxyPostJson(url: string, body: any) {
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await resp.json();
  if (!resp.ok) throw new Error(`upstream ${url} ${resp.status}`);
  return json;
}

// Very small NL -> structured parser (improveable later)
function parseNLtoCommand(text: string) {
  const t = (text || "").trim();
  const npiMatch = t.match(/(\b[12]\d{9}\b)/);
  if (t.match(/\bvalidate npi\b/i) || npiMatch) {
    return { id: "npi.validate", params: { npi: npiMatch ? npiMatch[1] : "" } };
  }
  if (t.match(/\b(start|new) claim\b/i)) return { id: "claim.new", params: {} };
  if (t.match(/\bexplain\b/i)) {
    const parts = t.split(/\s+/);
    return { id: "ai.explain", params: { subjectType: parts[1] ?? "claim", subjectId: parts[2] ?? "" } };
  }
  // default: fuzzy pick first matching command
  const found = COMMANDS.find(c => t.includes(c.id.split(".")[0]) || c.title.toLowerCase().includes(t.toLowerCase()));
  return found ? { id: found.id, params: {} } : null;
}

// execute handlers
async function handleExecuteCommand(user: {id:string, roles:string[]}, id: string, params: any) {
  // check command exists & role
  const cmd = COMMANDS.find(c => c.id === id);
  if (!cmd) throw new Error("unknown_command");
  if (cmd.rolesAllowed && cmd.rolesAllowed.length && !cmd.rolesAllowed.some(r => user.roles.includes(r))) {
    throw new Error("forbidden");
  }
  // param zod validation if provided
  if (cmd.paramsSchema) {
    const parsed = (cmd.paramsSchema as any).safeParse(params || {});
    if (!parsed.success) throw new Error("invalid_params:" + JSON.stringify(parsed.error.format()));
    params = parsed.data;
  }

  // sample handlers:
  if (id === "npi.validate") {
    const { npi } = params;
    if (!isValidNPI(npi)) throw new Error("invalid_npi_format");
    // check local cache / db first
    // (replace with actual DB/redis calls)
    // pseudo: const cached = await Provider.findByNpi(npi)
    // if (cached && fresh) return cached
    // else call NPPES internal worker
    const nppesUrl = process.env.NPPES_PROXY_URL || `${process.env.BACKEND_BASE_URL}/internal/nppes/lookup`;
    const provider = await proxyPostJson(nppesUrl, { npi });
    // persist to DB (pseudo)
    // await Provider.upsert({npi, data:provider, last_verified: new Date()})
    // emit audit
    await auditLog(user.id, "npi.validate", { npi, result: !!provider });
    return { provider };
  }

  if (id === "claim.new") {
    // create claim stub (persist real record in DB)
    const claim = { id: `temp-${Date.now()}`, status: "started", createdBy: user.id };
    await auditLog(user.id, "claim.new", { claimId: claim.id });
    return { claim };
  }

  if (id === "ai.explain") {
    // safe AI stub: DO NOT send PHI out. If subject is PHI, require anonymize flag.
    const { subjectType, subjectId } = params;
    // fetch the thing (DB) and sanitize; here we return a stub summary
    await auditLog(user.id, "ai.explain", { subjectType, subjectId });
    return { summary: `AI explain stub for ${subjectType}/${subjectId}` };
  }

  // default stub
  await auditLog(user.id, "command.exec", { id, params });
  return { ok: true, message: `executed ${id}` };
}

// express endpoints
router.post("/parse", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "missing_text" });
    const parsed = parseNLtoCommand(text);
    if (!parsed) return res.json({ ok: false, message: "no_match" });
    return res.json({ ok: true, command: parsed });
  } catch (err:any) {
    return res.status(500).json({ error: String(err.message) });
  }
});

router.post("/execute", async (req, res) => {
  try {
    const user = req.user || { id: "system-test", roles: ["clinician"] }; // integrate your auth middleware
    const { id, rawQuery, params } = req.body;
    let cmdId = id;
    let paramObj = params;
    if (!cmdId && rawQuery) {
      const parsed = parseNLtoCommand(rawQuery);
      if (!parsed) return res.status(400).json({ error: "cannot_parse" });
      cmdId = parsed.id;
      paramObj = parsed.params;
    }
    const result = await handleExecuteCommand(user, cmdId, paramObj || {});
    return res.json({ ok: true, result });
  } catch (err:any) {
    return res.status(400).json({ ok: false, error: String(err.message) });
  }
});

export default router;
