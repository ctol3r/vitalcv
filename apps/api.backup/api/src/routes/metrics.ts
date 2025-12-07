import { Router } from 'express';
import { pool } from '../db';
import client from 'prom-client';

export const metricsRouter = Router();

// Round 10: Prometheus metrics registry with counters + histograms
const reg = new client.Registry();

export const cRuns = new client.Counter({
  name: 'agent_runs_total',
  help: 'total agent runs',
  registers: [reg]
});

export const cOk = new client.Counter({
  name: 'agent_success_total',
  help: 'successful agent runs',
  registers: [reg]
});

export const hSolve = new client.Histogram({
  name: 'agent_solve_ms',
  help: 'solve duration in milliseconds',
  buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
  registers: [reg]
});

metricsRouter.get('/', async (_req, res) => {
  res.setHeader('content-type', reg.contentType);
  res.send(await reg.metrics());
});

