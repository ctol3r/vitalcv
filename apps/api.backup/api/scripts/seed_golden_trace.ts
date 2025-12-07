import { pool } from '../src/agent/db';
import { v4 as uuid } from 'uuid';

async function main() {
  console.log('Seeding golden trace...');

  await pool.query(
    `INSERT INTO "AgentTrace"(id, task_type, input, steps, outcome)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT DO NOTHING`,
    [
      uuid(),
      'verify license',
      { state: 'CA', licensePdfId: 'golden1' },
      [{ mcp: 'verify_medical_license_basic' }],
      { success: true, notes: 'golden' }
    ]
  );

  console.log('✓ Golden trace seeded');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error seeding golden trace:', err);
    process.exit(1);
  });

