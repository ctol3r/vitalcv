import client from 'prom-client';

export const billRuns = new client.Counter({
  name: 'bill_runs',
  help: 'billable runs'
});

export function billInc() {
  billRuns.inc();
}

