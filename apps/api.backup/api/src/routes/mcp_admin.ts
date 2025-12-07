import { Router } from 'express';
import { pool } from '../db';
import { upsertMcp } from '../agent/store';

export const mcpAdminRouter = Router();

/**
 * POST /api/agent/mcp-admin/import
 * Import an MCP from manifest + code
 */
mcpAdminRouter.post('/import', async (req, res) => {
  try {
    const { manifest, code } = req.body || {};

    if (!manifest) {
      return res.status(400).json({ error: 'manifest is required' });
    }

    const id = await upsertMcp(manifest, code);
    res.json({ ok: true, id });
  } catch (error: any) {
    console.error('Error importing MCP:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/agent/mcp-admin/export
 * Export all MCPs as JSON
 */
mcpAdminRouter.get('/export', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT name, description, scope, tags, manifest, code FROM "McpTool" ORDER BY name'
    );
    res.json({ mcp: rows });
  } catch (error: any) {
    console.error('Error exporting MCPs:', error);
    res.status(500).json({ error: error.message });
  }
});

