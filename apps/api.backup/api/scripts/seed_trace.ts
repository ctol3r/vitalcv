/**
 * Seed a sample successful trace for learning demo
 * This creates a trace that the learning job can pick up and convert to an MCP
 */

import { pool } from '../src/agent/db';
import { v4 as uuid } from 'uuid';

async function seedTrace() {
  console.log('🌱 Seeding sample successful trace...\n');

  const traceId = uuid();

  const trace = {
    id: traceId,
    task_type: 'verify medical license',
    user_id: null,
    domain: null,
    input: {
      state: 'CA',
      licensePdfId: 'file_demo',
      licenseNumber: 'A123456',
    },
    steps: [
      {
        step: 1,
        tool: 'verifyLicense',
        params: {
          state: 'CA',
          licenseNumber: 'A123456',
        },
        output: {
          verificationStatus: true,
          isValid: true,
          status: 'active',
          expirationDate: '2025-12-31',
        },
        duration: 234,
      },
    ],
    outcome: {
      success: true,
      notes: 'License verified successfully',
    },
  };

  try {
    await pool.query(
      `INSERT INTO "AgentTrace"(id, task_type, user_id, domain, input, steps, outcome)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO NOTHING`,
      [
        trace.id,
        trace.task_type,
        trace.user_id,
        trace.domain,
        JSON.stringify(trace.input),
        JSON.stringify(trace.steps),
        JSON.stringify(trace.outcome),
      ]
    );

    console.log(`✅ Seeded trace: ${traceId}`);
    console.log(`   Task: ${trace.task_type}`);
    console.log(`   Success: ${trace.outcome.success}`);
    console.log(`\nℹ️  Run 'npm run agent:learn' to convert this trace to an MCP`);
    console.log(`   Then run 'npm run agent:dedupe' to clean up duplicates`);
    console.log(`   Finally run 'npm run agent:eval' to test the agent\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to seed trace:', error);
    process.exit(1);
  }
}

// CLI entry point
if (require.main === module) {
  seedTrace();
}

