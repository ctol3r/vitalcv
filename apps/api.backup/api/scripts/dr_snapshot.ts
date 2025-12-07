import { pool } from '../src/db';
import fs from 'fs';
import path from 'path';

(async () => {
  try {
    console.log('Starting DR snapshot...');

    // Snapshot MCP tools
    const mcpResult = await pool.query('SELECT * FROM "McpTool"');
    console.log(`Found ${mcpResult.rows.length} MCP tools`);

    // Snapshot recent traces (last 7 days)
    const tracesResult = await pool.query(
      'SELECT * FROM "AgentTrace" WHERE created_at > now() - interval \'7 days\''
    );
    console.log(`Found ${tracesResult.rows.length} traces from last 7 days`);

    // Create snapshots directory if it doesn't exist
    const snapshotsDir = path.join(__dirname, '../snapshots');
    if (!fs.existsSync(snapshotsDir)) {
      fs.mkdirSync(snapshotsDir, { recursive: true });
    }

    // Write snapshots with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const mcpPath = path.join(snapshotsDir, `snapshot_mcp_${timestamp}.json`);
    const tracesPath = path.join(snapshotsDir, `snapshot_traces_${timestamp}.json`);

    fs.writeFileSync(mcpPath, JSON.stringify(mcpResult.rows, null, 2));
    fs.writeFileSync(tracesPath, JSON.stringify(tracesResult.rows, null, 2));

    console.log('SNAPSHOT_OK');
    console.log(`MCP snapshot: ${mcpPath}`);
    console.log(`Traces snapshot: ${tracesPath}`);

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Snapshot failed:', error);
    process.exit(1);
  }
})();

