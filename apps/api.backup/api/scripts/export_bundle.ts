import { pool } from '../src/agent/db';
import fs from 'fs/promises';
import path from 'path';

/**
 * Export Bundle Script (Round 15)
 *
 * Creates backup bundles of critical configuration:
 * - MCP tools and configurations from database
 * - Environment configuration snapshot
 *
 * Usage: pnpm tsx scripts/export_bundle.ts
 */

async function exportBundle() {
  try {
    console.log('🔄 Starting export bundle...');

    // Export MCP tools from database
    const mcpResult = await pool.query('SELECT * FROM "McpTool"');
    const mcpData = {
      exported_at: new Date().toISOString(),
      count: mcpResult.rows.length,
      tools: mcpResult.rows
    };

    // Export configuration snapshot (no secrets!)
    const configData = {
      exported_at: new Date().toISOString(),
      pilot_mode: process.env.PILOT_MODE === '1',
      issuer_url: process.env.PUBLIC_ISSUER_URL,
      environment: process.env.NODE_ENV || 'development',
      features: {
        oidc4vci: true,
        sd_jwt: true,
        bbs_plus: true,
        status_list: true,
        webhooks: true,
        anchoring: true
      }
    };

    // Create exports directory if it doesn't exist
    const exportsDir = path.join(process.cwd(), 'exports');
    await fs.mkdir(exportsDir, { recursive: true });

    // Write bundles
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const mcpPath = path.join(exportsDir, `bundle_mcp_${timestamp}.json`);
    const confPath = path.join(exportsDir, `bundle_conf_${timestamp}.json`);

    await fs.writeFile(mcpPath, JSON.stringify(mcpData, null, 2));
    await fs.writeFile(confPath, JSON.stringify(configData, null, 2));

    // Also create latest versions (symlink-like)
    const latestMcpPath = path.join(exportsDir, 'bundle_mcp_latest.json');
    const latestConfPath = path.join(exportsDir, 'bundle_conf_latest.json');

    await fs.writeFile(latestMcpPath, JSON.stringify(mcpData, null, 2));
    await fs.writeFile(latestConfPath, JSON.stringify(configData, null, 2));

    console.log('✅ Export complete:');
    console.log(`   - MCP Bundle: ${mcpPath}`);
    console.log(`   - Config Bundle: ${confPath}`);
    console.log(`   - MCP Tools: ${mcpData.count}`);
    console.log(`   - Pilot Mode: ${configData.pilot_mode}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Export failed:', error);
    process.exit(1);
  }
}

exportBundle();

