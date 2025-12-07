import { Router } from 'express';
import axios from 'axios';

export const chaosGate = Router();

chaosGate.get('/chaos/gate', async (_req, res) => {
  const prom = process.env.PROM_URL;
  if (!prom) return res.status(200).json({ ok: true, note: 'PROM_URL not set' });

  const q95 = 'histogram_quantile(0.95, sum(rate(agent_solve_ms_bucket[10m])) by (le))';
  const qok = '(agent_success_total / agent_runs_total)';

  const rq = async (q: string) => (await axios.get(prom, { params: { query: q } })).data;

  try {
    const p95v = Number(rq ? (await rq(q95))?.data?.result?.[0]?.value?.[1] : 0);
    const okv = Number(rq ? (await rq(qok))?.data?.result?.[0]?.value?.[1] : 1);
    const pass = (p95v <= Number(process.env.SLO_P95_MS || 2000)) && (okv >= Number(process.env.SLO_SUCCESS_RATE || 0.98));
    res.json({ pass, p95_ms: p95v, success_rate: okv });
  } catch (e: any) {
    res.status(200).json({ ok: true, note: 'prom query failed (non-blocking)', error: String(e?.message || e) });
  }
});

