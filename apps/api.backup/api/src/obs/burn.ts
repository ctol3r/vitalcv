import client from 'prom-client';

const g = new client.Gauge({
  name: 'error_burn_ratio',
  help: '(4xx+5xx)/all in 10m'
});

export async function burnTick(ok: number, total: number) {
  const r = total ? (1 - ok / total) : 0;
  g.set(r);
}

