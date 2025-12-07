import { Request, Response } from 'express';
import { pool } from '../../db';
import { api as getChainApi } from '../../chain/substrate';

export const fullHealth = async (_req: Request, res: Response) => {
  const status = {
    db: 'OK',
    chain: 'OK',
    agent: 'OK',
    env: 'OK'
  };

  // DB Check
  try {
    await pool.query('SELECT 1');
  } catch (error) {
    status.db = 'FAIL';
    console.error('Health DB fail', error);
  }

  // Chain Check
  try {
    const chainApi = await getChainApi();
    if (!chainApi.isConnected) {
        status.chain = 'FAIL';
    }
  } catch (error) {
    status.chain = 'FAIL';
    console.error('Health Chain fail', error);
  }

  // Agent Check - placeholder for actual agent service health check
  // Assuming if this API is running, the agent routes are mounted.
  // For a more robust check, we'd ping the python agent if it's external, or check the internal agent state.
  status.agent = 'OK';

  // Env Check
  if (!process.env.NODE_ENV) {
      status.env = 'WARN';
  }

  const allOk = Object.values(status).every(s => s === 'OK');
  res.status(allOk ? 200 : 503).json(status);
};















