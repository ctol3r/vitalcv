import { pool } from '../src/agent/db';

(async () => {
  try {
    const { rows } = await pool.query(
      `SELECT count(*) FROM "AgentTrace"
       WHERE outcome->>'notes' = 'golden'
       AND outcome->>'success' = 'true'`
    );

    if (!rows[0] || Number(rows[0].count) < 1) {
      throw new Error('Golden trace missing!');
    }

    console.log('✓ Golden OK');
    process.exit(0);
  } catch (err: any) {
    console.error('✗ Golden trace assertion failed:', err.message);
    process.exit(1);
  }
})();

